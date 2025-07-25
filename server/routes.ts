import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import bcrypt from "bcrypt";
import { z } from "zod";
import connectPg from "connect-pg-simple";
import MemoryStore from "memorystore";
import { 
  insertBillPaymentSchema,
  insertChequeOrderSchema,
  insertExternalAccountSchema 
} from "@shared/schema";
import { createAndSendOtp, verifyOtp } from "./services/otpService";
import { sendAdminNotification, sendUserNotification } from "./services/emailService";

// Input sanitization helper
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
}

// Session configuration
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Use memory store for development to avoid session persistence issues
  const MemoryStoreSession = MemoryStore(session);
  const sessionStore = new MemoryStoreSession({
    checkPeriod: 86400000, // prune expired entries every 24h
    ttl: sessionTtl,
  });

  // Add error handling for session store
  sessionStore.on('error', (error) => {
    console.error('Session store error:', error);
  });

  return session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-dev',
    store: sessionStore,
    resave: false, // Don't force save
    saveUninitialized: false,
    rolling: false, // Don't extend session on each request to avoid conflicts
    name: 'sessionId', // Custom session name
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
      sameSite: 'lax', // Better compatibility
    },
  });
}

// Extend session type
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    tempUserId?: string;
  }
}

// Authentication middleware with enhanced security
const isAuthenticated = (req: any, res: any, next: any) => {
  try {
    if (!req.session) {
      return res.status(401).json({ 
        message: "Session not found",
        error: "NO_SESSION" 
      });
    }

    if (!req.session.userId) {
      return res.status(401).json({ 
        message: "Authentication required",
        error: "NOT_AUTHENTICATED" 
      });
    }

    // Validate session userId format
    if (typeof req.session.userId !== 'string' || req.session.userId.length === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ 
        message: "Invalid session data",
        error: "INVALID_SESSION" 
      });
    }

    return next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({ 
      message: "Authentication system error",
      error: "AUTH_SYSTEM_ERROR" 
    });
  }
};

// Validation schemas
const loginSchema = z.object({
  userId: z.string(),
  password: z.string(),
});

const otpSchema = z.object({
  userId: z.string(),
  code: z.string().length(6),
  purpose: z.string(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(getSession());

  // Initialize sample user and accounts (for demo purposes)
  const { initializeSampleData } = await import('./sampleData');
  await initializeSampleData();

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const loginSchema = z.object({ 
        userId: z.string().min(1).max(50),
        password: z.string().min(1).max(100)
      });

      const { userId, password } = loginSchema.parse(req.body);
      const sanitizedUserId = sanitizeInput(userId);
      const sanitizedPassword = sanitizeInput(password);

      const user = await storage.getUserByUserId(sanitizedUserId);
      
      if (!user || !bcrypt.compareSync(sanitizedPassword, user.password)) {
        return res.status(401).json({ 
          message: "Invalid credentials",
          error: "INVALID_CREDENTIALS" 
        });
      }

      // Ensure session exists
      if (!req.session) {
        return res.status(500).json({ 
          message: "Session initialization failed",
          error: "SESSION_ERROR" 
        });
      }

      // Store temporary session data for OTP verification
      req.session.tempUserId = user.id;
      req.session.loginTimestamp = new Date().toISOString();

      // Save session explicitly and wait for completion with retry logic
      let sessionSaved = false;
      let retries = 0;
      const maxRetries = 3;

      while (!sessionSaved && retries < maxRetries) {
        try {
          await new Promise((resolve, reject) => {
            req.session.save((err) => {
              if (err) {
                console.error(`Session save error (attempt ${retries + 1}):`, err);
                reject(err);
              } else {
                console.log("Session saved successfully for user:", user.userId, "Session ID:", req.session.id);
                resolve(true);
              }
            });
          });
          sessionSaved = true;
        } catch (saveError) {
          retries++;
          if (retries >= maxRetries) {
            console.error("Failed to save session after", maxRetries, "attempts");
            return res.status(500).json({ 
              message: "Session save failed",
              error: "SESSION_SAVE_ERROR" 
            });
          }
          // Wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Generate and send OTP
      try {
        await createAndSendOtp(user.id, user.email, user.firstName, 'Login');
        res.json({ success: true, message: "OTP sent to your email" });
      } catch (emailError) {
        console.error("Email service error:", emailError);
        return res.status(500).json({ 
          message: "Email service temporarily unavailable",
          error: "EMAIL_SERVICE_ERROR" 
        });
      }
    } catch (error) {
      console.error("Login error:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid input data",
          error: "VALIDATION_ERROR",
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }

      res.status(500).json({ 
        message: "Database error occurred",
        error: "DATABASE_ERROR" 
      });
    }
  });

  app.post('/api/auth/verify-otp', async (req, res) => {
    try {
      // Enhanced validation schema
      const otpSchema = z.object({ 
        code: z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits") 
      });

      const { code } = otpSchema.parse(req.body);
      const sanitizedCode = sanitizeInput(code);

      // Session validation
      if (!req.session) {
        return res.status(400).json({ 
          message: "No session found",
          error: "NO_SESSION" 
        });
      }

      const tempUserId = req.session.tempUserId;
      const loginTimestamp = req.session.loginTimestamp;

      console.log("OTP verification session check:", {
        sessionId: req.session.id,
        tempUserId,
        loginTimestamp,
        hasSession: !!req.session,
        sessionData: req.session
      });

      if (!tempUserId) {
        console.log("No tempUserId found in session. Full session data:", req.session);
        
        // Try to reload the session from store
        await new Promise((resolve) => {
          req.session.reload((err) => {
            if (err) {
              console.error("Session reload error:", err);
            } else {
              console.log("Session reloaded. New data:", req.session);
            }
            resolve(true);
          });
        });

        const reloadedTempUserId = req.session.tempUserId;
        if (!reloadedTempUserId) {
          return res.status(400).json({ 
            message: "No login session found",
            error: "NO_LOGIN_SESSION" 
          });
        }
        
        // Use the reloaded tempUserId
        console.log("Found tempUserId after reload:", reloadedTempUserId);
      }

      // Check session timeout (15 minutes)
      if (loginTimestamp) {
        const sessionAge = Date.now() - new Date(loginTimestamp).getTime();
        if (sessionAge > 15 * 60 * 1000) {
          delete req.session.tempUserId;
          delete req.session.loginTimestamp;
          return res.status(400).json({ 
            message: "Login session expired. Please login again.",
            error: "SESSION_EXPIRED" 
          });
        }
      }

      // Validate tempUserId format
      if (typeof tempUserId !== 'string' || tempUserId.length === 0) {
        delete req.session.tempUserId;
        return res.status(400).json({ 
          message: "Invalid session data",
          error: "INVALID_SESSION_DATA" 
        });
      }

      // Use the current tempUserId (which might have been reloaded)
      const currentTempUserId = req.session.tempUserId;
      
      let isValid;
      try {
        isValid = await verifyOtp(currentTempUserId, sanitizedCode, 'Login');
      } catch (otpError) {
        console.error("OTP verification error:", otpError);
        return res.status(500).json({ 
          message: "OTP verification service error",
          error: "OTP_SERVICE_ERROR" 
        });
      }

      if (isValid) {
        try {
          // Set authenticated session
          req.session.userId = currentTempUserId;
          req.session.authenticatedAt = new Date().toISOString();
          delete req.session.tempUserId;
          delete req.session.loginTimestamp;

          const user = await storage.getUser(currentTempUserId);

          if (!user) {
            return res.status(404).json({ 
              message: "User not found after authentication",
              error: "USER_NOT_FOUND" 
            });
          }

          // Sanitize user data before sending
          const sanitizedUser = {
            ...user,
            firstName: sanitizeInput(user.firstName || ''),
            lastName: sanitizeInput(user.lastName || ''),
            email: sanitizeInput(user.email || '')
          };

          res.json({ success: true, user: sanitizedUser });
        } catch (userError) {
          console.error("User retrieval error:", userError);
          return res.status(500).json({ 
            message: "User data retrieval error",
            error: "USER_DATA_ERROR" 
          });
        }
      } else {
        // Log failed OTP attempts
        const clientIP = req.ip || req.connection.remoteAddress;
        console.warn(`Failed OTP verification for userId: ${tempUserId} from IP: ${clientIP}`);

        res.status(401).json({ 
          message: "Invalid verification code",
          error: "INVALID_OTP"
        });
      }
    } catch (error) {
      console.error("OTP verification error:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid OTP format",
          error: "VALIDATION_ERROR",
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        });
      }

      res.status(500).json({ 
        message: "Internal server error",
        error: "INTERNAL_ERROR" 
      });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard data
  app.get('/api/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ 
          message: "Invalid user session",
          error: "INVALID_USER_SESSION" 
        });
      }

      // Add timeout for database operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database operation timeout')), 10000);
      });

      const dataPromise = Promise.all([
        storage.getUserAccounts(userId),
        storage.getUserTransactions(userId, 20),
        storage.getUserExternalAccounts(userId)
      ]);

      let accounts, transactions, externalAccounts;

      try {
        [accounts, transactions, externalAccounts] = await Promise.race([
          dataPromise,
          timeoutPromise
        ]) as any;
      } catch (dbError) {
        console.error("Database error in dashboard:", dbError);

        if (dbError.message === 'Database operation timeout') {
          return res.status(504).json({ 
            message: "Database operation timed out",
            error: "DATABASE_TIMEOUT" 
          });
        }

        return res.status(500).json({ 
          message: "Database error",
          error: "DATABASE_ERROR" 
        });
      }

      // Validate and sanitize the response data
      const sanitizedAccounts = (accounts || []).map((account: any) => ({
        ...account,
        accountName: sanitizeInput(account.accountName || ''),
        accountType: sanitizeInput(account.accountType || ''),
        balance: typeof account.balance === 'string' ? account.balance : '0.00'
      }));

      const sanitizedTransactions = (transactions || []).map((transaction: any) => ({
        ...transaction,
        description: sanitizeInput(transaction.description || ''),
        amount: typeof transaction.amount === 'string' ? transaction.amount : '0.00',
        type: sanitizeInput(transaction.type || ''),
        category: sanitizeInput(transaction.category || '')
      }));

      const sanitizedExternalAccounts = (externalAccounts || []).map((account: any) => ({
        ...account,
        bankName: sanitizeInput(account.bankName || ''),
        accountName: sanitizeInput(account.accountName || ''),
        status: sanitizeInput(account.status || '')
      }));

      res.json({
        accounts: sanitizedAccounts,
        transactions: sanitizedTransactions,
        externalAccounts: sanitizedExternalAccounts
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ 
        message: "Failed to load dashboard data",
        error: "DASHBOARD_ERROR" 
      });
    }
  });

  // Transactions with pagination for older/newer navigation
  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      const year = req.query.year ? parseInt(req.query.year) : null;

      const transactions = await storage.getUserTransactionsPaginated(userId, limit, offset, year);
      const totalCount = await storage.getUserTransactionsCount(userId, year);

      res.json({
        transactions,
        totalCount,
        hasMore: offset + limit < totalCount
      });
    } catch (error) {
      console.error("Transactions error:", error);
      res.status(500).json({ message: "Failed to load transactions" });
    }
  });

  // Bill payment
  app.post('/api/bill-payment', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ 
          message: "Invalid user session",
          error: "INVALID_USER_SESSION" 
        });
      }

      // Manually parse and validate the request body with proper date handling
      const { payeeName, payeeAddress, amount, paymentDate } = req.body;

      if (!payeeName || !payeeAddress || !amount || !paymentDate) {
        return res.status(400).json({ 
          message: "Missing required fields",
          error: "MISSING_FIELDS" 
        });
      }

      // Parse and validate the payment date
      let parsedPaymentDate: Date;
      try {
        parsedPaymentDate = new Date(paymentDate);
        if (isNaN(parsedPaymentDate.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (dateError) {
        return res.status(400).json({ 
          message: "Invalid payment date format",
          error: "INVALID_DATE" 
        });
      }

      // Validate amount is a valid number
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ 
          message: "Invalid amount",
          error: "INVALID_AMOUNT" 
        });
      }

      // Sanitize string inputs
      const sanitizedPayeeName = sanitizeInput(payeeName);
      const sanitizedPayeeAddress = sanitizeInput(payeeAddress);

      if (!sanitizedPayeeName || !sanitizedPayeeAddress) {
        return res.status(400).json({ 
          message: "Invalid input data",
          error: "INVALID_INPUT" 
        });
      }

      // Create bill payment record
      const billPayment = await storage.createBillPayment({
        userId,
        payeeName: sanitizedPayeeName,
        payeeAddress: sanitizedPayeeAddress,
        amount: parsedAmount.toFixed(2),
        paymentDate: parsedPaymentDate
      });

      // Generate and send OTP
      const user = await storage.getUser(userId);
      await createAndSendOtp(
        userId,
        user!.email || 'noreply@autosmobile.us',
        `${user!.firstName} ${user!.lastName}`,
        'Bill Payment'
      );

      res.json({ success: true, billPaymentId: billPayment.id });
    } catch (error) {
      console.error("Bill payment error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post('/api/bill-payment/verify', isAuthenticated, async (req: any, res) => {
    try {
      const { code, billPaymentId } = z.object({
        code: z.string().length(6),
        billPaymentId: z.number()
      }).parse(req.body);

      const userId = req.session.userId;
      const isValid = await verifyOtp(userId, code, 'Bill Payment');

      if (isValid) {
        // Update bill payment status
        await storage.updateBillPaymentStatus(billPaymentId, 'completed');

        // Send admin notification
        const user = await storage.getUser(userId);
        const billPayment = await storage.getUserBillPayments(userId);
        const currentBillPayment = billPayment.find(bp => bp.id === billPaymentId);

        await sendAdminNotification(
          'Bill Payment',
          user!,
          currentBillPayment
        );

        // Send user confirmation email
        await sendUserNotification(
          user!.email || 'noreply@autosmobile.us',
          `${user!.firstName} ${user!.lastName}`,
          'Bill Payment',
          {
            'Payee': currentBillPayment?.payeeName || 'Unknown',
            'Amount': `$${currentBillPayment?.amount || '0.00'}`,
            'Payment Date': currentBillPayment?.paymentDate || 'N/A',
            'Status': 'Completed'
          }
        );

        res.json({ success: true });
      } else {
        res.status(401).json({ message: "Invalid OTP" });
      }
    } catch (error) {
      console.error("Bill payment verification error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Cheque orders
  app.post('/api/cheque-order', isAuthenticated, async (req: any, res) => {
    try {
      // Parse request body without userId (it comes from session)
      const chequeOrderData = insertChequeOrderSchema.omit({ userId: true }).parse(req.body);
      const userId = req.session.userId;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ 
          message: "Invalid user session",
          error: "INVALID_USER_SESSION" 
        });
      }

      const chequeOrder = await storage.createChequeOrder({
        ...chequeOrderData,
        userId
      });

      const user = await storage.getUser(userId);
      await createAndSendOtp(
        userId,
        user!.email || 'noreply@autosmobile.us',
        `${user!.firstName} ${user!.lastName}`,
        'Cheque Order'
      );

      res.json({ success: true, chequeOrderId: chequeOrder.id });
    } catch (error) {
      console.error("Cheque order error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post('/api/cheque-order/verify', isAuthenticated, async (req: any, res) => {
    try {
      const { code, chequeOrderId } = z.object({
        code: z.string().length(6),
        chequeOrderId: z.number()
      }).parse(req.body);

      const userId = req.session.userId;
      const isValid = await verifyOtp(userId, code, 'Cheque Order');

      if (isValid) {
        await storage.updateChequeOrderStatus(chequeOrderId, 'processing');

        const user = await storage.getUser(userId);
        const chequeOrders = await storage.getUserChequeOrders(userId);
        const currentOrder = chequeOrders.find(co => co.id === chequeOrderId);

        await sendAdminNotification(
          'Cheque Order',
          user!,
          currentOrder
        );

        // Send user confirmation email
        await sendUserNotification(
          user!.email || 'noreply@autosmobile.us',
          `${user!.firstName} ${user!.lastName}`,
          'Cheque Order',
          {
            'Quantity': `${currentOrder?.quantity || 0} cheques`,
            'Delivery Address': currentOrder?.deliveryAddress || 'N/A',
            'Status': 'Processing',
            'Expected Delivery': '3-5 business days'
          }
        );

        res.json({ success: true });
      } else {
        res.status(401).json({ message: "Invalid OTP" });
      }
    } catch (error) {
      console.error("Cheque order verification error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // External account linking
  app.post('/api/external-account', isAuthenticated, async (req: any, res) => {
    try {
      // Parse request body without userId (it comes from session)
      const externalAccountData = insertExternalAccountSchema.omit({ userId: true }).parse(req.body);
      const userId = req.session.userId;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ 
          message: "Invalid user session",
          error: "INVALID_USER_SESSION" 
        });
      }

      const externalAccount = await storage.createExternalAccount({
        ...externalAccountData,
        userId
      });

      // Generate micro-deposits
      const deposit1 = (Math.random() * 0.99 + 0.01).toFixed(2);
      const deposit2 = (Math.random() * 0.99 + 0.01).toFixed(2);

      await storage.createMicroDeposit({
        externalAccountId: externalAccount.id,
        deposit1,
        deposit2
      });

      const user = await storage.getUser(userId);
      await createAndSendOtp(
        userId,
        user!.email || 'noreply@autosmobile.us',
        `${user!.firstName} ${user!.lastName}`,
        'External Account Linking'
      );

      // Send admin notification with micro-deposit details
      await sendAdminNotification(
        'External Account Linking',
        user!,
        {
          ...externalAccount,
          microDeposits: { deposit1, deposit2 }
        }
      );

      res.json({ 
        success: true, 
        externalAccountId: externalAccount.id,
        microDeposits: { deposit1, deposit2 }
      });
    } catch (error) {
      console.error("External account error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post('/api/external-account/verify', isAuthenticated, async (req: any, res) => {
    try {
      const { code, externalAccountId } = z.object({
        code: z.string().length(6),
        externalAccountId: z.number()
      }).parse(req.body);

      const userId = req.session.userId;
      const isValid = await verifyOtp(userId, code, 'External Account Linking');

      if (isValid) {
        await storage.updateExternalAccountStatus(externalAccountId, 'verified');

        const microDeposit = await storage.getMicroDeposit(externalAccountId);
        if (microDeposit) {
          await storage.verifyMicroDeposit(microDeposit.id);
        }

        // Send user confirmation email
        const user = await storage.getUser(userId);
        const externalAccounts = await storage.getUserExternalAccounts(userId);
        const currentAccount = externalAccounts.find(ea => ea.id === externalAccountId);

        await sendUserNotification(
          user!.email || 'noreply@autosmobile.us',
          `${user!.firstName} ${user!.lastName}`,
          'External Account Verification',
          {
            'Bank': currentAccount?.bankName || 'Unknown',
            'Account Number': currentAccount?.accountNumber || 'N/A',
            'Transit Number': currentAccount?.transitNumber || 'N/A',
            'Institution Number': currentAccount?.institutionNumber || 'N/A',
            'Status': 'Verified and Linked'
          }
        );

        res.json({ success: true });
      } else {
        res.status(401).json({ message: "Invalid OTP" });
      }
    } catch (error) {
      console.error("External account verification error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Delete external account
  app.delete('/api/external-account/:id', isAuthenticated, async (req: any, res) => {
    try {
      const externalAccountId = parseInt(req.params.id);
      const userId = req.session.userId;

      if (!externalAccountId || isNaN(externalAccountId)) {
        return res.status(400).json({ 
          message: "Invalid external account ID",
          error: "INVALID_ACCOUNT_ID" 
        });
      }

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ 
          message: "Invalid user session",
          error: "INVALID_USER_SESSION" 
        });
      }

      // Verify the external account belongs to the authenticated user
      const userExternalAccounts = await storage.getUserExternalAccounts(userId);
      const accountToDelete = userExternalAccounts.find(acc => acc.id === externalAccountId);

      if (!accountToDelete) {
        return res.status(404).json({ 
          message: "External account not found or not authorized",
          error: "ACCOUNT_NOT_FOUND" 
        });
      }

      // Delete the external account and associated micro deposits
      await storage.deleteExternalAccount(externalAccountId);

      res.json({ 
        success: true, 
        message: "External account deleted successfully" 
      });
    } catch (error) {
      console.error("Delete external account error:", error);
      res.status(500).json({ 
        message: "Failed to delete external account",
        error: "DELETE_ERROR" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}