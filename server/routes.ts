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
      if ((userId === '920200' && password === 'EastM@ple$2025') || 
          (userId === '197200' && password === 'Mate@200')) {
        const user = await storage.getUserByUserId(userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Generate and send OTP
        await createAndSendOtp(
          user.id,
          'support@cbelko.net', // Fixed recipient as per requirements
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
        'support@cbelko.net',
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
        'support@cbelko.net',
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
        'support@cbelko.net',
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
    const existingUser1 = await storage.getUserByUserId('920200');
    const existingUser2 = await storage.getUserByUserId('197200');

    let user1, user2;

    if (!existingUser1) {
      // Create the first demo user
      user1 = await storage.createUser({
        userId: '920200',
        password: 'EastM@ple$2025', // In production, this should be hashed
        firstName: 'Michael',
        lastName: 'Halifax',
        email: 'support@cbelko.net'
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
        email: 'support@cbelko.net'
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
        balance: '75000.00',
        accountName: 'Primary Chequing'
      });

      savingsAccount2 = await storage.createAccount({
        userId: user2.id,
        accountType: 'savings',
        accountNumber: '*****9234',
        balance: '45000.00',
        accountName: 'Emergency Savings'
      });
    } else {
      chequingAccount2 = existingAccounts2.find(acc => acc.accountType === 'chequing');
      savingsAccount2 = existingAccounts2.find(acc => acc.accountType === 'savings');
    }

    // Create sample transactions only if accounts were just created
    if (existingAccounts1.length === 0 && chequingAccount1) {
      // Create extensive sample transactions (60+)
      const sampleTransactions = [
        // January 2024
        { date: '2024-01-25', description: 'Tim Hortons - Dartmouth', amount: '-4.85', type: 'debit', category: 'food' },
        { date: '2024-01-25', description: 'Metro Transit Bus Pass', amount: '-78.00', type: 'debit', category: 'transportation' },
        { date: '2024-01-24', description: 'Sobeys Grocery Store', amount: '-127.43', type: 'debit', category: 'groceries' },
        { date: '2024-01-24', description: 'Direct Deposit - Payroll', amount: '2850.00', type: 'credit', category: 'payroll' },
        { date: '2024-01-23', description: 'ATM Withdrawal - NSLC', amount: '-60.00', type: 'debit', category: 'cash' },
        { date: '2024-01-22', description: 'Shell Gas Station', amount: '-67.23', type: 'debit', category: 'gas' },
        { date: '2024-01-21', description: 'Canadian Tire', amount: '-89.47', type: 'debit', category: 'retail' },
        { date: '2024-01-20', description: 'Cineplex Entertainment', amount: '-28.50', type: 'debit', category: 'entertainment' },
        { date: '2024-01-19', description: 'Walmart Supercenter', amount: '-156.78', type: 'debit', category: 'retail' },
        { date: '2024-01-18', description: 'Pizza Corner - Halifax', amount: '-19.95', type: 'debit', category: 'food' },
        { date: '2024-01-17', description: 'NSPI - Electricity Bill', amount: '-134.67', type: 'debit', category: 'utilities' },
        { date: '2024-01-16', description: 'Pharmasave Pharmacy', amount: '-23.45', type: 'debit', category: 'health' },
        { date: '2024-01-15', description: 'Starbucks Coffee', amount: '-6.78', type: 'debit', category: 'food' },
        { date: '2024-01-14', description: 'Sport Chek', amount: '-112.99', type: 'debit', category: 'retail' },
        { date: '2024-01-13', description: 'Rogers Wireless Bill', amount: '-95.00', type: 'debit', category: 'telecommunications' },
        { date: '2024-01-12', description: 'Kijiji Transaction Deposit', amount: '150.00', type: 'credit', category: 'other' },
        { date: '2024-01-11', description: 'Costco Wholesale', amount: '-234.56', type: 'debit', category: 'groceries' },
        { date: '2024-01-10', description: 'Direct Deposit - Payroll', amount: '2850.00', type: 'credit', category: 'payroll' },
        // December 2023
        { date: '2023-12-31', description: 'New Year\'s Eve Dinner', amount: '-85.00', type: 'debit', category: 'food' },
        { date: '2023-12-30', description: 'Gift Card Purchase', amount: '-100.00', type: 'debit', category: 'gifts' },
        { date: '2023-12-29', description: 'Shoppers Drug Mart', amount: '-34.67', type: 'debit', category: 'health' },
        { date: '2023-12-28', description: 'Boxing Day Shopping', amount: '-234.99', type: 'debit', category: 'retail' },
        { date: '2023-12-27', description: 'Tim Hortons Gift Card', amount: '-25.00', type: 'debit', category: 'gifts' },
        { date: '2023-12-26', description: 'Boxing Day Returns', amount: '45.99', type: 'credit', category: 'returns' },
        { date: '2023-12-25', description: 'Christmas Gift Return', amount: '67.50', type: 'credit', category: 'returns' },
        { date: '2023-12-24', description: 'Christmas Eve Dinner', amount: '-125.00', type: 'debit', category: 'food' },
        { date: '2023-12-23', description: 'Christmas Shopping - Mic Mac Mall', amount: '-456.78', type: 'debit', category: 'gifts' },
        { date: '2023-12-22', description: 'Christmas Tree Purchase', amount: '-65.00', type: 'debit', category: 'seasonal' },
        { date: '2023-12-21', description: 'Holiday Party Catering', amount: '-89.99', type: 'debit', category: 'food' },
        { date: '2023-12-20', description: 'Christmas Bonus Deposit', amount: '1000.00', type: 'credit', category: 'bonus' },
        { date: '2023-12-19', description: 'Holiday Gift Wrapping', amount: '-23.45', type: 'debit', category: 'seasonal' },
        { date: '2023-12-18', description: 'Eastlink Internet Bill', amount: '-89.95', type: 'debit', category: 'telecommunications' },
        { date: '2023-12-17', description: 'Maritime Travel - Flight Booking', amount: '-567.89', type: 'debit', category: 'travel' },
        { date: '2023-12-16', description: 'Dollarama Shopping', amount: '-23.47', type: 'debit', category: 'retail' },
        { date: '2023-12-15', description: 'Walmart Grocery Pickup', amount: '-89.34', type: 'debit', category: 'groceries' },
        { date: '2023-12-14', description: 'Netflix Subscription', amount: '-16.49', type: 'debit', category: 'entertainment' },
        { date: '2023-12-13', description: 'Direct Deposit - Payroll', amount: '2850.00', type: 'credit', category: 'payroll' },
        { date: '2023-12-12', description: 'Best Buy Electronics', amount: '-299.99', type: 'debit', category: 'electronics' },
        { date: '2023-12-11', description: 'McDonald\'s Drive-Thru', amount: '-12.67', type: 'debit', category: 'food' },
        { date: '2023-12-10', description: 'PetSmart Pet Supplies', amount: '-45.23', type: 'debit', category: 'pets' },
        { date: '2023-12-09', description: 'Gas Station - Ultramar', amount: '-72.15', type: 'debit', category: 'gas' },
        { date: '2023-12-08', description: 'Home Depot Hardware', amount: '-187.43', type: 'debit', category: 'home' },
        { date: '2023-12-07', description: 'NSLC Beer Purchase', amount: '-34.99', type: 'debit', category: 'alcohol' },
        { date: '2023-12-06', description: 'Dentist - Dr. Smith', amount: '-150.00', type: 'debit', category: 'health' },
        { date: '2023-12-05', description: 'Taxi Ride - Halifax Downtown', amount: '-18.50', type: 'debit', category: 'transportation' },
        { date: '2023-12-04', description: 'Winners Department Store', amount: '-67.89', type: 'debit', category: 'retail' },
        { date: '2023-12-03', description: 'Subway Restaurant', amount: '-9.99', type: 'debit', category: 'food' },
        { date: '2023-12-02', description: 'Irving Oil Gas Station', amount: '-65.43', type: 'debit', category: 'gas' },
        { date: '2023-12-01', description: 'Monthly Rent Payment', amount: '-1200.00', type: 'debit', category: 'housing' },

        // November 2023
        { date: '2023-11-30', description: 'Freelance Work Payment', amount: '500.00', type: 'credit', category: 'income' },
        { date: '2023-11-29', description: 'Chapters Bookstore', amount: '-34.56', type: 'debit', category: 'books' },
        { date: '2023-11-28', description: 'Direct Deposit - Payroll', amount: '2850.00', type: 'credit', category: 'payroll' },
        { date: '2023-11-27', description: 'Atlantic Superstore', amount: '-145.67', type: 'debit', category: 'groceries' },
        { date: '2023-11-26', description: 'Uber Eats Delivery', amount: '-23.45', type: 'debit', category: 'food' },
        { date: '2023-11-25', description: 'Winners Clothing Store', amount: '-78.90', type: 'debit', category: 'clothing' },
        { date: '2023-11-24', description: 'Movie Theatre - Landmark Cinemas', amount: '-15.99', type: 'debit', category: 'entertainment' },
        { date: '2023-11-23', description: 'Bell Aliant Phone Bill', amount: '-67.50', type: 'debit', category: 'telecommunications' },
        { date: '2023-11-22', description: 'Superstore Pharmacy', amount: '-28.99', type: 'debit', category: 'health' },
        { date: '2023-11-21', description: 'Pizza Delight Takeout', amount: '-34.75', type: 'debit', category: 'food' },

        // October 2023
        { date: '2023-10-31', description: 'Halloween Costume Shop', amount: '-45.99', type: 'debit', category: 'seasonal' },
        { date: '2023-10-30', description: 'Pumpkin Patch Visit', amount: '-15.00', type: 'debit', category: 'entertainment' },
        { date: '2023-10-29', description: 'Thanksgiving Groceries', amount: '-156.78', type: 'debit', category: 'groceries' },
        { date: '2023-10-28', description: 'Direct Deposit - Payroll', amount: '2850.00', type: 'credit', category: 'payroll' },
        { date: '2023-10-27', description: 'Canadian Tire Gas Bar', amount: '-73.24', type: 'debit', category: 'gas' },
        { date: '2023-10-26', description: 'Rona Home Improvement', amount: '-123.45', type: 'debit', category: 'home' },
        { date: '2023-10-25', description: 'Boston Pizza Restaurant', amount: '-42.89', type: 'debit', category: 'food' },
        { date: '2023-10-24', description: 'Spotify Premium Subscription', amount: '-9.99', type: 'debit', category: 'entertainment' },
        { date: '2023-10-23', description: 'Lawtons Pharmacy', amount: '-19.67', type: 'debit', category: 'health' },
        { date: '2023-10-22', description: 'Value Village Thrift Store', amount: '-12.50', type: 'debit', category: 'clothing' },
        { date: '2023-10-21', description: 'Metro Transit Monthly Pass', amount: '-78.00', type: 'debit', category: 'transportation' },
        { date: '2023-10-20', description: 'H&M Clothing Store', amount: '-89.99', type: 'debit', category: 'clothing' },
        { date: '2023-10-19', description: 'Cineplex Movie Tickets', amount: '-24.99', type: 'debit', category: 'entertainment' },
        { date: '2023-10-18', description: 'IKEA Furniture Purchase', amount: '-234.56', type: 'debit', category: 'home' },
        { date: '2023-10-17', description: 'Kingsway Garden Centre', amount: '-67.89', type: 'debit', category: 'gardening' },
        { date: '2023-10-16', description: 'Indigo Books & Music', amount: '-23.45', type: 'debit', category: 'books' },
        { date: '2023-10-15', description: 'Bank Transfer to Savings', amount: '-500.00', type: 'debit', category: 'transfer' },
        { date: '2023-10-14', description: 'Direct Deposit - Payroll', amount: '2850.00', type: 'credit', category: 'payroll' },
        { date: '2023-10-13', description: 'FreshCo Grocery Store', amount: '-98.76', type: 'debit', category: 'groceries' },
        { date: '2023-10-12', description: 'Coffee Shop - Second Cup', amount: '-5.25', type: 'debit', category: 'food' },

        // September 2023
        { date: '2023-09-30', description: 'Interest Earned - Savings Account', amount: '12.50', type: 'credit', category: 'interest' },
        { date: '2023-09-29', description: 'Direct Deposit - Payroll', amount: '2850.00', type: 'credit', category: 'payroll' },
        { date: '2023-09-28', description: 'Loblaws Supermarket', amount: '-167.89', type: 'debit', category: 'groceries' },
        { date: '2023-09-27', description: 'Back to School Supplies', amount: '-78.99', type: 'debit', category: 'education' },

        // August 2023
        { date: '2023-08-31', description: 'Government HST Rebate', amount: '325.00', type: 'credit', category: 'government' },
        { date: '2023-08-30', description: 'Direct Deposit - Payroll', amount: '2850.00', type: 'credit', category: 'payroll' },
        { date: '2023-08-29', description: 'Halifax International Busker Festival', amount: '-45.00', type: 'debit', category: