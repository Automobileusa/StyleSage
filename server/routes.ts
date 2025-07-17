import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import bcrypt from "bcrypt";
import { z } from "zod";
import connectPg from "connect-pg-simple";
import { 
  insertBillPaymentSchema,
  insertChequeOrderSchema,
  insertExternalAccountSchema 
} from "@shared/schema";
import { createAndSendOtp, verifyOtp } from "./services/otpService";
import { sendAdminNotification } from "./services/emailService";

// Session configuration
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
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

// Authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
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
  await initializeSampleData();

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { userId, password } = loginSchema.parse(req.body);

      // Static credentials check - support both user accounts
      if ((userId === '1972000' && password === 'Mate@200') || 
          (userId === '197200' && password === 'Mate@200')) {
        const user = await storage.getUserByUserId(userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Generate and send OTP
        await createAndSendOtp(
          user.id,
          'noreply@autosmobile.us', // Fixed recipient as per requirements
          `${user.firstName} ${user.lastName}`,
          'Login'
        );

        // Store temp login data in session
        req.session.tempUserId = user.id;

        res.json({ success: true, message: "OTP sent to your email" });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input format" });
      } else if (error.message === 'Failed to send email') {
        res.status(500).json({ message: "Email service temporarily unavailable. Please try again." });
      } else {
        res.status(400).json({ message: "Invalid request" });
      }
    }
  });

  app.post('/api/auth/verify-otp', async (req, res) => {
    try {
      const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
      const tempUserId = req.session.tempUserId;

      if (!tempUserId) {
        return res.status(400).json({ message: "No login session found" });
      }

      const isValid = await verifyOtp(tempUserId, code, 'Login');

      if (isValid) {
        // Set authenticated session
        req.session.userId = tempUserId;
        delete req.session.tempUserId;

        const user = await storage.getUser(tempUserId);
        res.json({ success: true, user });
      } else {
        res.status(401).json({ 
          message: "Invalid verification code",
          error: "INVALID_OTP"
        });
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(400).json({ message: "Invalid request" });
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

      const [accounts, transactions, externalAccounts] = await Promise.all([
        storage.getUserAccounts(userId),
        storage.getUserTransactions(userId, 20),
        storage.getUserExternalAccounts(userId)
      ]);

      res.json({
        accounts,
        transactions,
        externalAccounts
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Failed to load dashboard data" });
    }
  });

  // Bill payment
  app.post('/api/bill-payment', isAuthenticated, async (req: any, res) => {
    try {
      const billPaymentData = insertBillPaymentSchema.parse(req.body);
      const userId = req.session.userId;

      // Create bill payment record
      const billPayment = await storage.createBillPayment({
        ...billPaymentData,
        userId
      });

      // Generate and send OTP
      const user = await storage.getUser(userId);
      await createAndSendOtp(
        userId,
        'noreply@autosmobile.us',
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
      const chequeOrderData = insertChequeOrderSchema.parse(req.body);
      const userId = req.session.userId;

      const chequeOrder = await storage.createChequeOrder({
        ...chequeOrderData,
        userId
      });

      const user = await storage.getUser(userId);
      await createAndSendOtp(
        userId,
        'noreply@autosmobile.us',
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
      const externalAccountData = insertExternalAccountSchema.parse(req.body);
      const userId = req.session.userId;

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
        'noreply@autosmobile.us',
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

        res.json({ success: true });
      } else {
        res.status(401).json({ message: "Invalid OTP" });
      }
    } catch (error) {
      console.error("External account verification error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Initialize sample data for the demo users
async function initializeSampleData() {
  try {
    const existingUser1 = await storage.getUserByUserId('1972000');
    const existingUser2 = await storage.getUserByUserId('197200');

    let user1, user2;

    if (!existingUser1) {
      // Create the first demo user
      user1 = await storage.createUser({
        userId: '1972000',
        password: 'Mate@200', // In production, this should be hashed
        firstName: 'Mate',
        lastName: 'Smith',
        email: 'noreply@autosmobile.us'
      });
    } else {
      user1 = existingUser1;
    }

    if (!existingUser2) {
      // Create the second demo user
      user2 = await storage.createUser({
        userId: '197200',
        password: 'Mate@200', // In production, this should be hashed
        firstName: 'Matthew',
        lastName: 'Smith',
        email: 'noreply@autosmobile.us'
      });
    } else {
      user2 = existingUser2;
    }

    if (existingUser1 && existingUser2) {
      return; // Both users and their data already exist
    }

    // Check if accounts already exist for users
    const existingAccounts1 = await storage.getUserAccounts(user1.id);
    const existingAccounts2 = await storage.getUserAccounts(user2.id);

    let chequingAccount1, savingsAccount1, chequingAccount2, savingsAccount2;

    // Create accounts for user 1 if they don't exist
    if (existingAccounts1.length === 0) {
      chequingAccount1 = await storage.createAccount({
        userId: user1.id,
        accountType: 'chequing',
        accountNumber: '*****3221',
        balance: '985000.00',
        accountName: 'Chequing Account'
      });

      savingsAccount1 = await storage.createAccount({
        userId: user1.id,
        accountType: 'savings',
        accountNumber: '*****7892',
        balance: '124500.00',
        accountName: 'High Interest Savings'
      });
    } else {
      chequingAccount1 = existingAccounts1.find(acc => acc.accountType === 'chequing');
      savingsAccount1 = existingAccounts1.find(acc => acc.accountType === 'savings');
    }

    // Create accounts for user 2 if they don't exist
    if (existingAccounts2.length === 0) {
      chequingAccount2 = await storage.createAccount({
        userId: user2.id,
        accountType: 'chequing',
        accountNumber: '*****5687',
        balance: '475000.00',
        accountName: 'Primary Chequing'
      });

      savingsAccount2 = await storage.createAccount({
        userId: user2.id,
        accountType: 'savings',
        accountNumber: '*****9234',
        balance: '345000.00',
        accountName: 'Emergency Savings'
      });
    } else {
      chequingAccount2 = existingAccounts2.find(acc => acc.accountType === 'chequing');
      savingsAccount2 = existingAccounts2.find(acc => acc.accountType === 'savings');
    }

    // Create sample transactions only if accounts were just created
    if (existingAccounts1.length === 0 && chequingAccount1) {
      const transactions1 = [
        // December 2024 transactions
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-15'),
          description: 'Direct Deposit - Payroll',
          amount: '5200.00',
          type: 'credit',
          category: 'payroll'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-14'),
          description: 'Amazon.ca Purchase',
          amount: '-89.99',
          type: 'debit',
          category: 'shopping'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-13'),
          description: 'Tim Hortons',
          amount: '-12.45',
          type: 'debit',
          category: 'food'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-12'),
          description: 'Netflix Subscription',
          amount: '-16.49',
          type: 'debit',
          category: 'entertainment'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-11'),
          description: 'Costco Wholesale',
          amount: '-234.67',
          type: 'debit',
          category: 'shopping'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-10'),
          description: 'Bell Canada',
          amount: '-125.99',
          type: 'debit',
          category: 'utilities'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-09'),
          description: 'Shoppers Drug Mart',
          amount: '-45.67',
          type: 'debit',
          category: 'health'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-08'),
          description: 'Rogers Communications',
          amount: '-89.99',
          type: 'debit',
          category: 'utilities'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-07'),
          description: 'Interac e-Transfer to Jane Doe',
          amount: '-2400.00',
          type: 'debit',
          category: 'transfer'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-06'),
          description: 'Canadian Tire',
          amount: '-156.78',
          type: 'debit',
          category: 'automotive'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-05'),
          description: 'Metro Grocery Store',
          amount: '-87.34',
          type: 'debit',
          category: 'groceries'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-04'),
          description: 'Starbucks',
          amount: '-8.95',
          type: 'debit',
          category: 'food'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-03'),
          description: 'CRA Tax Refund',
          amount: '3200.00',
          type: 'credit',
          category: 'government'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-02'),
          description: 'LCBO',
          amount: '-42.99',
          type: 'debit',
          category: 'shopping'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-12-01'),
          description: 'Direct Deposit - Payroll',
          amount: '5200.00',
          type: 'credit',
          category: 'payroll'
        },
        
        // November 2024 transactions
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-30'),
          description: 'Halifax Water',
          amount: '-67.89',
          type: 'debit',
          category: 'utilities'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-29'),
          description: 'Sobeys',
          amount: '-142.56',
          type: 'debit',
          category: 'groceries'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-28'),
          description: 'Direct Deposit - Payroll',
          amount: '5000.00',
          type: 'credit',
          category: 'payroll'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-27'),
          description: 'Walmart Canada',
          amount: '-78.23',
          type: 'debit',
          category: 'shopping'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-26'),
          description: 'Cineplex Theatres',
          amount: '-34.99',
          type: 'debit',
          category: 'entertainment'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-25'),
          description: 'Shell Gas Station',
          amount: '-65.40',
          type: 'debit',
          category: 'automotive'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-24'),
          description: 'Best Buy Canada',
          amount: '-299.99',
          type: 'debit',
          category: 'electronics'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-23'),
          description: 'McDonalds',
          amount: '-14.67',
          type: 'debit',
          category: 'food'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-22'),
          description: 'Home Depot',
          amount: '-189.45',
          type: 'debit',
          category: 'home'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-21'),
          description: 'Spotify Premium',
          amount: '-11.99',
          type: 'debit',
          category: 'entertainment'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-20'),
          description: 'Nova Scotia Power',
          amount: '-150.00',
          type: 'debit',
          category: 'utilities'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-19'),
          description: 'Atlantic Superstore',
          amount: '-167.89',
          type: 'debit',
          category: 'groceries'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-18'),
          description: 'Interac e-Transfer from Mom',
          amount: '200.00',
          type: 'credit',
          category: 'transfer'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-17'),
          description: 'Pizza Hut',
          amount: '-29.99',
          type: 'debit',
          category: 'food'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-16'),
          description: 'Rexall Pharmacy',
          amount: '-23.45',
          type: 'debit',
          category: 'health'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-15'),
          description: 'Direct Deposit - Payroll',
          amount: '5200.00',
          type: 'credit',
          category: 'payroll'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-14'),
          description: 'Esso Gas Station',
          amount: '-72.15',
          type: 'debit',
          category: 'automotive'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-13'),
          description: 'Winners',
          amount: '-89.99',
          type: 'debit',
          category: 'clothing'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-12'),
          description: 'Dentist Appointment',
          amount: '-350.00',
          type: 'debit',
          category: 'health'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-11'),
          description: 'Income Tax Return',
          amount: '1250.00',
          type: 'credit',
          category: 'government'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-10'),
          description: 'Uber Eats',
          amount: '-24.67',
          type: 'debit',
          category: 'food'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-09'),
          description: 'Loblaws',
          amount: '-134.22',
          type: 'debit',
          category: 'groceries'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-08'),
          description: 'YouTube Premium',
          amount: '-14.99',
          type: 'debit',
          category: 'entertainment'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-07'),
          description: 'Kijiji Purchase',
          amount: '-50.00',
          type: 'debit',
          category: 'shopping'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-06'),
          description: 'Pet Valu',
          amount: '-67.34',
          type: 'debit',
          category: 'pets'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-05'),
          description: 'Canadian Automobile Association',
          amount: '-150.00',
          type: 'debit',
          category: 'insurance'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-04'),
          description: 'Freelance Payment',
          amount: '800.00',
          type: 'credit',
          category: 'income'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-03'),
          description: 'Harvey\'s',
          amount: '-18.99',
          type: 'debit',
          category: 'food'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-02'),
          description: 'Goodlife Fitness',
          amount: '-59.99',
          type: 'debit',
          category: 'fitness'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-11-01'),
          description: 'Direct Deposit - Payroll',
          amount: '5200.00',
          type: 'credit',
          category: 'payroll'
        },
        
        // October 2024 transactions
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-31'),
          description: 'Rent Payment',
          amount: '-1800.00',
          type: 'debit',
          category: 'housing'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-30'),
          description: 'No Frills',
          amount: '-95.67',
          type: 'debit',
          category: 'groceries'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-29'),
          description: 'Disney+ Subscription',
          amount: '-11.99',
          type: 'debit',
          category: 'entertainment'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-28'),
          description: 'Parking Meter',
          amount: '-3.50',
          type: 'debit',
          category: 'transportation'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-27'),
          description: 'Insurance Refund',
          amount: '245.00',
          type: 'credit',
          category: 'insurance'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-26'),
          description: 'Dairy Queen',
          amount: '-9.87',
          type: 'debit',
          category: 'food'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-25'),
          description: 'Staples Business Depot',
          amount: '-67.89',
          type: 'debit',
          category: 'office'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-24'),
          description: 'IKEA Canada',
          amount: '-189.99',
          type: 'debit',
          category: 'home'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-23'),
          description: 'Investment Return',
          amount: '125.50',
          type: 'credit',
          category: 'investment'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-22'),
          description: 'Subway',
          amount: '-12.99',
          type: 'debit',
          category: 'food'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-21'),
          description: 'Sport Chek',
          amount: '-124.99',
          type: 'debit',
          category: 'sports'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-20'),
          description: 'Eastlink Internet',
          amount: '-79.99',
          type: 'debit',
          category: 'utilities'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-19'),
          description: 'Drug Store',
          amount: '-34.56',
          type: 'debit',
          category: 'health'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-18'),
          description: 'Interac e-Transfer to John',
          amount: '-100.00',
          type: 'debit',
          category: 'transfer'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-17'),
          description: 'A&W',
          amount: '-16.78',
          type: 'debit',
          category: 'food'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-16'),
          description: 'Dollarama',
          amount: '-23.45',
          type: 'debit',
          category: 'shopping'
        },
        {
          accountId: chequingAccount1.id,
          date: new Date('2024-10-15'),
          description: 'Direct Deposit - Payroll',
          amount: '5200.00',
          type: 'credit',
          category: 'payroll'
        }
      ];

      for (const transaction of transactions1) {
        await storage.createTransaction(transaction);
      }
    }

    if (existingAccounts2.length === 0 && chequingAccount2) {
      const transactions2 = [
        {
          accountId: chequingAccount2.id,
          date: new Date('2024-12-08'),
          description: 'Direct Deposit - Salary',
          amount: '3500.00',
          type: 'credit',
          category: 'payroll'
        },
        {
          accountId: chequingAccount2.id,
          date: new Date('2024-12-05'),
          description: 'Grocery Store Purchase',
          amount: '-180.50',
          type: 'debit',
          category: 'shopping'
        },
        {
          accountId: chequingAccount2.id,
          date: new Date('2024-12-01'),
          description: 'Bell Canada',
          amount: '-85.00',
          type: 'debit',
          category: 'utilities'
        }
      ];

      for (const transaction of transactions2) {
        await storage.createTransaction(transaction);
      }
    }

    console.log('Sample data initialized successfully');
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}