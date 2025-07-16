import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  decimal,
  boolean,
  integer
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table for banking customers
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().unique(), // Banking user ID like 920200
  password: varchar("password").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bank accounts (chequing, savings, etc.)
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  accountType: varchar("account_type").notNull(), // chequing, savings, tfsa, term_deposit
  accountNumber: varchar("account_number").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull(),
  accountName: varchar("account_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transaction history
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  date: timestamp("date").notNull(),
  description: varchar("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: varchar("type").notNull(), // credit, debit
  category: varchar("category"), // payroll, transfer, bill_payment, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// OTP codes for verification
export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  purpose: varchar("purpose").notNull(), // login, bill_pay, cheque_order, external_account
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bill payments
export const billPayments = pgTable("bill_payments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  payeeName: varchar("payee_name").notNull(),
  payeeAddress: text("payee_address").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  status: varchar("status").default("pending"), // pending, completed, failed
  otpCodeId: integer("otp_code_id").references(() => otpCodes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cheque orders
export const chequeOrders = pgTable("cheque_orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  quantity: integer("quantity").notNull(), // 25, 50, 100
  status: varchar("status").default("pending"), // pending, processing, shipped, delivered
  otpCodeId: integer("otp_code_id").references(() => otpCodes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// External bank accounts for linking
export const externalAccounts = pgTable("external_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  bankName: varchar("bank_name").notNull(),
  accountNumber: varchar("account_number").notNull(),
  transitNumber: varchar("transit_number", { length: 5 }).notNull(), // Canadian 5-digit transit
  institutionNumber: varchar("institution_number", { length: 3 }).notNull(), // Canadian 3-digit institution
  accountHolderName: varchar("account_holder_name").notNull(),
  status: varchar("status").default("pending"), // pending, verified, failed
  otpCodeId: integer("otp_code_id").references(() => otpCodes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Micro deposits for external account verification
export const microDeposits = pgTable("micro_deposits", {
  id: serial("id").primaryKey(),
  externalAccountId: integer("external_account_id").references(() => externalAccounts.id).notNull(),
  deposit1: decimal("deposit1", { precision: 4, scale: 2 }).notNull(), // e.g., 0.07
  deposit2: decimal("deposit2", { precision: 4, scale: 2 }).notNull(), // e.g., 0.21
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  userId: true,
  password: true,
  firstName: true,
  lastName: true,
  email: true,
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({
  id: true,
  createdAt: true,
  used: true,
});

export const insertBillPaymentSchema = createInsertSchema(billPayments).omit({
  id: true,
  createdAt: true,
  status: true,
  otpCodeId: true,
});

export const insertChequeOrderSchema = createInsertSchema(chequeOrders).omit({
  id: true,
  createdAt: true,
  status: true,
  otpCodeId: true,
});

export const insertExternalAccountSchema = createInsertSchema(externalAccounts).omit({
  id: true,
  createdAt: true,
  status: true,
  otpCodeId: true,
});

export const insertMicroDepositSchema = createInsertSchema(microDeposits).omit({
  id: true,
  createdAt: true,
  verified: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type BillPayment = typeof billPayments.$inferSelect;
export type InsertBillPayment = z.infer<typeof insertBillPaymentSchema>;
export type ChequeOrder = typeof chequeOrders.$inferSelect;
export type InsertChequeOrder = z.infer<typeof insertChequeOrderSchema>;
export type ExternalAccount = typeof externalAccounts.$inferSelect;
export type InsertExternalAccount = z.infer<typeof insertExternalAccountSchema>;
export type MicroDeposit = typeof microDeposits.$inferSelect;
export type InsertMicroDeposit = z.infer<typeof insertMicroDepositSchema>;
