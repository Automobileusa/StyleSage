import { storage } from "./storage";

export async function initializeSampleData() {
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
        accountNumber: '35103221',
        balance: '1245000.00',
        accountName: 'Chequing Account'
      });

      savingsAccount1 = await storage.createAccount({
        userId: user1.id,
        accountType: 'savings',
        accountNumber: '35107892',
        balance: '375000.00',
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
        accountNumber: '35205687',
        balance: '875000.00',
        accountName: 'Primary Chequing'
      });

      savingsAccount2 = await storage.createAccount({
        userId: user2.id,
        accountType: 'savings',
        accountNumber: '35209234',
        balance: '525000.00',
        accountName: 'Emergency Savings'
      });
    } else {
      chequingAccount2 = existingAccounts2.find(acc => acc.accountType === 'chequing');
      savingsAccount2 = existingAccounts2.find(acc => acc.accountType === 'savings');
    }

    // Create comprehensive transactions for user 1 (50+ transactions)
    if (existingAccounts1.length === 0 && chequingAccount1) {
      const transactions1 = [
        // 2025 transactions (January - July)
        { accountId: chequingAccount1.id, date: new Date('2025-07-17'), description: 'Direct Deposit - Payroll', amount: '5200.00', type: 'credit', category: 'payroll' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-16'), description: 'Tim Hortons Drive-Thru', amount: '-15.67', type: 'debit', category: 'food' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-15'), description: 'Netflix Subscription', amount: '-18.99', type: 'debit', category: 'entertainment' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-14'), description: 'Amazon.ca Purchase', amount: '-127.89', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-13'), description: 'Sobeys Grocery', amount: '-234.56', type: 'debit', category: 'groceries' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-12'), description: 'Rent Payment', amount: '-1950.00', type: 'debit', category: 'housing' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-11'), description: 'Bell Canada Internet', amount: '-95.99', type: 'debit', category: 'utilities' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-10'), description: 'Starbucks Coffee', amount: '-12.45', type: 'debit', category: 'food' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-09'), description: 'Investment Return', amount: '450.00', type: 'credit', category: 'investment' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-08'), description: 'Costco Wholesale', amount: '-389.67', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-07'), description: 'Interac e-Transfer from Brother', amount: '250.00', type: 'credit', category: 'transfer' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-06'), description: 'Esso Gas Station', amount: '-85.34', type: 'debit', category: 'automotive' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-05'), description: 'Canadian Tire Auto Service', amount: '-456.78', type: 'debit', category: 'automotive' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-04'), description: 'Rogers Wireless', amount: '-125.00', type: 'debit', category: 'utilities' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-03'), description: 'McDonald\'s', amount: '-18.90', type: 'debit', category: 'food' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-02'), description: 'CRA Tax Refund', amount: '2850.00', type: 'credit', category: 'government' },
        { accountId: chequingAccount1.id, date: new Date('2025-07-01'), description: 'Direct Deposit - Payroll', amount: '5200.00', type: 'credit', category: 'payroll' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-30'), description: 'Nova Scotia Power', amount: '-167.89', type: 'debit', category: 'utilities' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-29'), description: 'Best Buy Electronics', amount: '-899.99', type: 'debit', category: 'electronics' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-28'), description: 'IKEA Furniture', amount: '-267.45', type: 'debit', category: 'home' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-27'), description: 'Atlantic Superstore', amount: '-156.78', type: 'debit', category: 'groceries' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-26'), description: 'Dentist Appointment', amount: '-420.00', type: 'debit', category: 'health' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-25'), description: 'Freelance Project Payment', amount: '1200.00', type: 'credit', category: 'income' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-24'), description: 'Uber Eats Delivery', amount: '-34.67', type: 'debit', category: 'food' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-23'), description: 'Winners Clothing', amount: '-89.99', type: 'debit', category: 'clothing' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-22'), description: 'Goodlife Fitness', amount: '-65.99', type: 'debit', category: 'fitness' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-21'), description: 'Shoppers Drug Mart', amount: '-47.83', type: 'debit', category: 'health' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-20'), description: 'Pet Valu Supplies', amount: '-78.45', type: 'debit', category: 'pets' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-19'), description: 'Interac e-Transfer to Sarah', amount: '-300.00', type: 'debit', category: 'transfer' },
        { accountId: chequingAccount1.id, date: new Date('2025-06-18'), description: 'Home Depot Building Supplies', amount: '-245.67', type: 'debit', category: 'home' },

        // 2024 transactions (December)
        { accountId: chequingAccount1.id, date: new Date('2024-12-31'), description: 'Year-end Bonus', amount: '2500.00', type: 'credit', category: 'payroll' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-30'), description: 'LCBO Holiday Purchase', amount: '-89.45', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-29'), description: 'Uber Ride', amount: '-27.80', type: 'debit', category: 'transportation' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-28'), description: 'Cineplex Movie Night', amount: '-45.99', type: 'debit', category: 'entertainment' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-27'), description: 'Boxing Day Shopping', amount: '-567.89', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-26'), description: 'Boxing Day Returns', amount: '125.67', type: 'credit', category: 'shopping' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-25'), description: 'Christmas Gift from Parents', amount: '500.00', type: 'credit', category: 'transfer' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-24'), description: 'Christmas Dinner Groceries', amount: '-345.78', type: 'debit', category: 'groceries' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-23'), description: 'Last Minute Gift Shopping', amount: '-234.56', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-22'), description: 'Halifax Water Bill', amount: '-78.90', type: 'debit', category: 'utilities' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-21'), description: 'Pizza Corner', amount: '-23.45', type: 'debit', category: 'food' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-20'), description: 'Pharmacy Prescription', amount: '-67.89', type: 'debit', category: 'health' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-19'), description: 'Holiday Party Catering', amount: '-189.99', type: 'debit', category: 'food' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-18'), description: 'Dollarama Holiday Supplies', amount: '-45.67', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-17'), description: 'Parking Downtown', amount: '-8.50', type: 'debit', category: 'transportation' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-16'), description: 'Spotify Premium', amount: '-11.99', type: 'debit', category: 'entertainment' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-15'), description: 'Direct Deposit - Payroll', amount: '5200.00', type: 'credit', category: 'payroll' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-14'), description: 'Subway Lunch', amount: '-15.89', type: 'debit', category: 'food' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-13'), description: 'Insurance Payment', amount: '-245.00', type: 'debit', category: 'insurance' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-12'), description: 'Loblaws Grocery Run', amount: '-178.34', type: 'debit', category: 'groceries' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-11'), description: 'YouTube Premium', amount: '-14.99', type: 'debit', category: 'entertainment' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-10'), description: 'Cash Withdrawal ATM', amount: '-100.00', type: 'debit', category: 'cash' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-09'), description: 'Harvey\'s Burger', amount: '-19.99', type: 'debit', category: 'food' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-08'), description: 'Staples Office Supplies', amount: '-89.67', type: 'debit', category: 'office' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-07'), description: 'Indigo Books Gift Cards', amount: '-156.78', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-06'), description: 'Interest Payment', amount: '67.89', type: 'credit', category: 'interest' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-05'), description: 'Dairy Queen', amount: '-12.45', type: 'debit', category: 'food' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-04'), description: 'Manulife Financial Services', amount: '-189.99', type: 'debit', category: 'insurance' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-03'), description: 'Shell Gas Station', amount: '-76.54', type: 'debit', category: 'automotive' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-02'), description: 'Rexall Pharmacy', amount: '-34.56', type: 'debit', category: 'health' },
        { accountId: chequingAccount1.id, date: new Date('2024-12-01'), description: 'Direct Deposit - Payroll', amount: '5200.00', type: 'credit', category: 'payroll' }
      ];

      for (const transaction of transactions1) {
        await storage.createTransaction(transaction);
      }
    }

    // Create comprehensive transactions for user 2 (50+ transactions)
    if (existingAccounts2.length === 0 && chequingAccount2) {
      const transactions2 = [
        // 2025 transactions for user 2
        { accountId: chequingAccount2.id, date: new Date('2025-07-17'), description: 'Direct Deposit - Salary', amount: '4200.00', type: 'credit', category: 'payroll' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-16'), description: 'Second Cup Coffee', amount: '-8.75', type: 'debit', category: 'food' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-15'), description: 'Disney+ Subscription', amount: '-11.99', type: 'debit', category: 'entertainment' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-14'), description: 'Walmart Shopping', amount: '-156.78', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-13'), description: 'Metro Grocery', amount: '-198.45', type: 'debit', category: 'groceries' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-12'), description: 'Mortgage Payment', amount: '-2100.00', type: 'debit', category: 'housing' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-11'), description: 'Eastlink Internet', amount: '-89.99', type: 'debit', category: 'utilities' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-10'), description: 'Country Style Coffee', amount: '-6.50', type: 'debit', category: 'food' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-09'), description: 'Dividend Payment', amount: '350.00', type: 'credit', category: 'investment' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-08'), description: 'Superstore Shopping', amount: '-267.89', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-07'), description: 'Interac e-Transfer from Sister', amount: '180.00', type: 'credit', category: 'transfer' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-06'), description: 'Petro Canada Gas', amount: '-72.15', type: 'debit', category: 'automotive' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-05'), description: 'Mr. Lube Oil Change', amount: '-85.99', type: 'debit', category: 'automotive' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-04'), description: 'Telus Mobility', amount: '-95.00', type: 'debit', category: 'utilities' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-03'), description: 'A&W Drive-Thru', amount: '-16.45', type: 'debit', category: 'food' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-02'), description: 'Provincial Tax Refund', amount: '1850.00', type: 'credit', category: 'government' },
        { accountId: chequingAccount2.id, date: new Date('2025-07-01'), description: 'Direct Deposit - Salary', amount: '4200.00', type: 'credit', category: 'payroll' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-30'), description: 'NS Power Bill', amount: '-145.67', type: 'debit', category: 'utilities' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-29'), description: 'Future Shop Electronics', amount: '-567.99', type: 'debit', category: 'electronics' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-28'), description: 'Leon\'s Furniture', amount: '-189.99', type: 'debit', category: 'home' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-27'), description: 'No Frills Grocery', amount: '-134.56', type: 'debit', category: 'groceries' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-26'), description: 'Eye Doctor Visit', amount: '-250.00', type: 'debit', category: 'health' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-25'), description: 'Part-time Teaching', amount: '850.00', type: 'credit', category: 'income' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-24'), description: 'Skip The Dishes', amount: '-28.90', type: 'debit', category: 'food' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-23'), description: 'Reitmans Clothing', amount: '-67.99', type: 'debit', category: 'clothing' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-22'), description: 'Planet Fitness', amount: '-19.99', type: 'debit', category: 'fitness' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-21'), description: 'Lawtons Pharmacy', amount: '-42.67', type: 'debit', category: 'health' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-20'), description: 'Global Pet Foods', amount: '-56.78', type: 'debit', category: 'pets' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-19'), description: 'Interac e-Transfer to Mike', amount: '-200.00', type: 'debit', category: 'transfer' },
        { accountId: chequingAccount2.id, date: new Date('2025-06-18'), description: 'Kent Building Supplies', amount: '-178.45', type: 'debit', category: 'home' },

        // 2024 transactions for user 2
        { accountId: chequingAccount2.id, date: new Date('2024-12-31'), description: 'Holiday Bonus', amount: '1500.00', type: 'credit', category: 'payroll' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-30'), description: 'Sobeys Wine', amount: '-67.89', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-29'), description: 'Halifax Transit Pass', amount: '-84.00', type: 'debit', category: 'transportation' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-28'), description: 'Empire Theatres', amount: '-32.99', type: 'debit', category: 'entertainment' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-27'), description: 'Boxing Week Sales', amount: '-345.67', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-26'), description: 'Gift Return Credit', amount: '89.99', type: 'credit', category: 'shopping' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-25'), description: 'Christmas Money Gift', amount: '300.00', type: 'credit', category: 'transfer' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-24'), description: 'Christmas Eve Dinner', amount: '-234.56', type: 'debit', category: 'groceries' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-23'), description: 'Gift Wrap Supplies', amount: '-45.67', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-22'), description: 'Halifax Water & Sewer', amount: '-65.43', type: 'debit', category: 'utilities' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-21'), description: 'Boston Pizza', amount: '-38.99', type: 'debit', category: 'food' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-20'), description: 'Guardian Pharmacy', amount: '-56.78', type: 'debit', category: 'health' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-19'), description: 'Office Christmas Party', amount: '-125.00', type: 'debit', category: 'food' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-18'), description: 'Dollar Tree Decorations', amount: '-34.56', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-17'), description: 'Parking Meter', amount: '-5.00', type: 'debit', category: 'transportation' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-16'), description: 'Apple Music', amount: '-9.99', type: 'debit', category: 'entertainment' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-15'), description: 'Direct Deposit - Salary', amount: '4200.00', type: 'credit', category: 'payroll' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-14'), description: 'Tim Hortons Lunch', amount: '-11.67', type: 'debit', category: 'food' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-13'), description: 'Car Insurance Premium', amount: '-189.99', type: 'debit', category: 'insurance' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-12'), description: 'Walmart Grocery', amount: '-145.78', type: 'debit', category: 'groceries' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-11'), description: 'Amazon Prime', amount: '-9.99', type: 'debit', category: 'entertainment' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-10'), description: 'ATM Cash Withdrawal', amount: '-80.00', type: 'debit', category: 'cash' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-09'), description: 'Wendy\'s Dinner', amount: '-14.89', type: 'debit', category: 'food' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-08'), description: 'Business Depot Supplies', amount: '-67.45', type: 'debit', category: 'office' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-07'), description: 'Chapters Gift Shopping', amount: '-89.99', type: 'debit', category: 'shopping' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-06'), description: 'Savings Interest', amount: '45.67', type: 'credit', category: 'interest' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-05'), description: 'Dairy Queen Treat', amount: '-7.89', type: 'debit', category: 'food' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-04'), description: 'TD Insurance Payment', amount: '-156.78', type: 'debit', category: 'insurance' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-03'), description: 'Ultramar Gas', amount: '-68.90', type: 'debit', category: 'automotive' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-02'), description: 'Shoppers Health', amount: '-28.45', type: 'debit', category: 'health' },
        { accountId: chequingAccount2.id, date: new Date('2024-12-01'), description: 'Direct Deposit - Salary', amount: '4200.00', type: 'credit', category: 'payroll' }
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