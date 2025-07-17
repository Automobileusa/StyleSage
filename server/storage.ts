import {
  users,
  accounts,
  transactions,
  otpCodes,
  billPayments,
  chequeOrders,
  externalAccounts,
  microDeposits,
  type User,
  type InsertUser,
  type Account,
  type InsertAccount,
  type Transaction,
  type InsertTransaction,
  type OtpCode,
  type InsertOtpCode,
  type BillPayment,
  type InsertBillPayment,
  type ChequeOrder,
  type InsertChequeOrder,
  type ExternalAccount,
  type InsertExternalAccount,
  type MicroDeposit,
  type InsertMicroDeposit,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, count } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUserId(userId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Account operations
  getUserAccounts(userId: string): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccountBalance(accountId: number, newBalance: string): Promise<void>;

  // Transaction operations
  getAccountTransactions(accountId: number, limit?: number): Promise<Transaction[]>;
  getUserTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  getUserTransactionsPaginated(userId: string, limit: number, offset: number, year?: number | null): Promise<Transaction[]>;
  getUserTransactionsCount(userId: string, year?: number | null): Promise<number>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;

  // OTP operations
  createOtpCode(otp: InsertOtpCode): Promise<OtpCode>;
  getValidOtpCode(userId: string, code: string, purpose: string): Promise<OtpCode | undefined>;
  markOtpCodeUsed(id: number): Promise<void>;
  getRecentOtpCodes(userId: string, minutesBack?: number): Promise<any[]>;

  // Bill payment operations
  createBillPayment(billPayment: InsertBillPayment): Promise<BillPayment>;
  getUserBillPayments(userId: string): Promise<BillPayment[]>;
  updateBillPaymentStatus(id: number, status: string): Promise<void>;

  // Cheque order operations
  createChequeOrder(chequeOrder: InsertChequeOrder): Promise<ChequeOrder>;
  getUserChequeOrders(userId: string): Promise<ChequeOrder[]>;
  updateChequeOrderStatus(id: number, status: string): Promise<void>;

  // External account operations
  createExternalAccount(externalAccount: InsertExternalAccount): Promise<ExternalAccount>;
  getUserExternalAccounts(userId: string): Promise<ExternalAccount[]>;
  updateExternalAccountStatus(id: number, status: string): Promise<void>;

  // Micro deposit operations
  createMicroDeposit(microDeposit: InsertMicroDeposit): Promise<MicroDeposit>;
  getMicroDeposit(externalAccountId: number): Promise<MicroDeposit | undefined>;
  verifyMicroDeposit(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUserId(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.userId, userId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash the password before storing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(insertUser.password, saltRounds);
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
        id: crypto.randomUUID(),
      })
      .returning();
    return user;
  }

  // Account operations
  async getUserAccounts(userId: string): Promise<Account[]> {
    return await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || undefined;
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [newAccount] = await db
      .insert(accounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async updateAccountBalance(accountId: number, newBalance: string): Promise<void> {
    await db
      .update(accounts)
      .set({ balance: newBalance })
      .where(eq(accounts.id, accountId));
  }

  // Transaction operations
  async getAccountTransactions(accountId: number, limit = 50): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .orderBy(desc(transactions.date))
      .limit(limit);
  }

  async getUserTransactions(userId: string, limit = 50): Promise<Transaction[]> {
    return await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        category: transactions.category,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(eq(accounts.userId, userId))
      .orderBy(desc(transactions.date))
      .limit(limit);
  }

  async getUserTransactionsPaginated(userId: string, limit: number, offset: number, year?: number | null): Promise<Transaction[]> {
    let query = db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        category: transactions.category,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(eq(accounts.userId, userId));

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year + 1, 0, 1);
      query = query.where(and(
        eq(accounts.userId, userId),
        gte(transactions.date, startOfYear),
        gte(endOfYear, transactions.date)
      ));
    }

    return await query
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset);
  }

  async getUserTransactionsCount(userId: string, year?: number | null): Promise<number> {
    let query = db
      .select({ count: count(transactions.id) })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(eq(accounts.userId, userId));

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year + 1, 0, 1);
      query = query.where(and(
        eq(accounts.userId, userId),
        gte(transactions.date, startOfYear),
        gte(endOfYear, transactions.date)
      ));
    }

    const result = await query;
    return result[0]?.count || 0;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  // OTP operations
  async createOtpCode(otp: InsertOtpCode): Promise<OtpCode> {
    const [newOtp] = await db
      .insert(otpCodes)
      .values(otp)
      .returning();
    return newOtp;
  }

  async getValidOtpCode(userId: string, code: string, purpose: string): Promise<OtpCode | undefined> {
    const [otp] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.userId, userId),
          eq(otpCodes.code, code),
          eq(otpCodes.purpose, purpose),
          eq(otpCodes.used, false),
          gte(otpCodes.expiresAt, new Date())
        )
      );
    return otp || undefined;
  }

  async markOtpCodeUsed(id: number): Promise<void> {
    await db
      .update(otpCodes)
      .set({ used: true })
      .where(eq(otpCodes.id, id));
  }

  async getRecentOtpCodes(userId: string, minutesBack: number = 5): Promise<any[]> {
    try {
      const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);

      const recentOtps = await db
        .select()
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.userId, userId),
            gte(otpCodes.createdAt, cutoffTime)
          )
        )
        .orderBy(desc(otpCodes.createdAt));

      return recentOtps;
    } catch (error) {
      console.error('Error fetching recent OTP codes:', error);
      return [];
    }
  }

  // Bill payment operations
  async createBillPayment(billPayment: InsertBillPayment): Promise<BillPayment> {
    const [newBillPayment] = await db
      .insert(billPayments)
      .values(billPayment)
      .returning();
    return newBillPayment;
  }

  async getUserBillPayments(userId: string): Promise<BillPayment[]> {
    return await db
      .select()
      .from(billPayments)
      .where(eq(billPayments.userId, userId))
      .orderBy(desc(billPayments.createdAt));
  }

  async updateBillPaymentStatus(id: number, status: string): Promise<void> {
    await db
      .update(billPayments)
      .set({ status })
      .where(eq(billPayments.id, id));
  }

  // Cheque order operations
  async createChequeOrder(chequeOrder: InsertChequeOrder): Promise<ChequeOrder> {
    const [newChequeOrder] = await db
      .insert(chequeOrders)
      .values(chequeOrder)
      .returning();
    return newChequeOrder;
  }

  async getUserChequeOrders(userId: string): Promise<ChequeOrder[]> {
    return await db
      .select()
      .from(chequeOrders)
      .where(eq(chequeOrders.userId, userId))
      .orderBy(desc(chequeOrders.createdAt));
  }

  async updateChequeOrderStatus(id: number, status: string): Promise<void> {
    await db
      .update(chequeOrders)
      .set({ status })
      .where(eq(chequeOrders.id, id));
  }

  // External account operations
  async createExternalAccount(externalAccount: InsertExternalAccount): Promise<ExternalAccount> {
    const [newExternalAccount] = await db
      .insert(externalAccounts)
      .values(externalAccount)
      .returning();
    return newExternalAccount;
  }

  async getUserExternalAccounts(userId: string): Promise<ExternalAccount[]> {
    return await db
      .select()
      .from(externalAccounts)
      .where(eq(externalAccounts.userId, userId))
      .orderBy(desc(externalAccounts.createdAt));
  }

  async updateExternalAccountStatus(id: number, status: string): Promise<void> {
    await db
      .update(externalAccounts)
      .set({ status })
      .where(eq(externalAccounts.id, id));
  }

  // Micro deposit operations
  async createMicroDeposit(microDeposit: InsertMicroDeposit): Promise<MicroDeposit> {
    const [newMicroDeposit] = await db
      .insert(microDeposits)
      .values(microDeposit)
      .returning();
    return newMicroDeposit;
  }

  async getMicroDeposit(externalAccountId: number): Promise<MicroDeposit | undefined> {
    const [microDeposit] = await db
      .select()
      .from(microDeposits)
      .where(eq(microDeposits.externalAccountId, externalAccountId));
    return microDeposit || undefined;
  }

  async verifyMicroDeposit(id: number): Promise<void> {
    await db
      .update(microDeposits)
      .set({ verified: true })
      .where(eq(microDeposits.id, id));
  }
}

export const storage = new DatabaseStorage();