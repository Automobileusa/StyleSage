import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: string;
  type: string;
}

interface TransactionTableProps {
  transactions: Transaction[];
}

export default function TransactionTable({ transactions }: TransactionTableProps) {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');

  const filteredTransactions = transactions.filter(transaction => {
    if (filter === 'all') return true;
    return transaction.type === filter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-CA', { month: 'short', day: '2-digit' });
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    const formatted = Math.abs(num).toLocaleString('en-CA', { 
      style: 'currency', 
      currency: 'CAD' 
    });
    return num >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div>
      {/* Filter Buttons */}
      <div className="flex space-x-2 mb-4">
        <Button
          size="sm"
          className={`px-3 py-1 rounded-full text-sm ${
            filter === 'all' 
              ? 'bg-[var(--primary-blue)] text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          size="sm"
          className={`px-3 py-1 rounded-full text-sm ${
            filter === 'credit' 
              ? 'bg-[var(--primary-blue)] text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => setFilter('credit')}
        >
          Credit
        </Button>
        <Button
          size="sm"
          className={`px-3 py-1 rounded-full text-sm ${
            filter === 'debit' 
              ? 'bg-[var(--primary-blue)] text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => setFilter('debit')}
        >
          Debit
        </Button>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--card-bg)]">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Description</th>
              <th className="text-right p-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id} className="transaction-row border-t">
                <td className="p-3">{formatDate(transaction.date)}</td>
                <td className="p-3">{transaction.description}</td>
                <td className={`p-3 text-right ${
                  parseFloat(transaction.amount) >= 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {formatAmount(transaction.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTransactions.length === 0 && (
          <div className="text-center py-8 text-[var(--text-gray)]">
            No transactions found for the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
