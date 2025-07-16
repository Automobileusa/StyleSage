
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const transactionsPerPage = 10;

  const filteredTransactions = transactions.filter(transaction => {
    if (filter === 'all') return true;
    return transaction.type === filter;
  });

  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-CA', { 
      year: 'numeric',
      month: 'short', 
      day: '2-digit' 
    });
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    const formatted = Math.abs(num).toLocaleString('en-CA', { 
      style: 'currency', 
      currency: 'CAD' 
    });
    return num >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleFilterChange = (newFilter: 'all' | 'credit' | 'debit') => {
    setFilter(newFilter);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleViewTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
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
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => handleFilterChange('all')}
        >
          All ({transactions.length})
        </Button>
        <Button
          size="sm"
          className={`px-3 py-1 rounded-full text-sm ${
            filter === 'credit' 
              ? 'bg-[var(--primary-blue)] text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => handleFilterChange('credit')}
        >
          Credit ({transactions.filter(t => t.type === 'credit').length})
        </Button>
        <Button
          size="sm"
          className={`px-3 py-1 rounded-full text-sm ${
            filter === 'debit' 
              ? 'bg-[var(--primary-blue)] text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => handleFilterChange('debit')}
        >
          Debit ({transactions.filter(t => t.type === 'debit').length})
        </Button>
      </div>

      {/* Transaction Count and Page Info */}
      <div className="flex justify-between items-center mb-4 text-sm text-[var(--text-gray)]">
        <span>
          Showing {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} transactions
        </span>
        <span>
          Page {currentPage} of {totalPages}
        </span>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--card-bg)]">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Description</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-center p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentTransactions.map((transaction) => (
              <tr key={transaction.id} className="transaction-row border-t hover:bg-gray-50">
                <td className="p-3">{formatDate(transaction.date)}</td>
                <td className="p-3">
                  <div className="max-w-xs truncate" title={transaction.description}>
                    {transaction.description}
                  </div>
                </td>
                <td className={`p-3 text-right font-semibold ${
                  parseFloat(transaction.amount) >= 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {formatAmount(transaction.amount)}
                </td>
                <td className="p-3 text-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewTransaction(transaction)}
                    className="hover:bg-[var(--primary-blue)] hover:text-white"
                  >
                    <Eye size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {currentTransactions.length === 0 && (
          <div className="text-center py-8 text-[var(--text-gray)]">
            No transactions found for the selected filter.
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredTransactions.length > transactionsPerPage && (
        <div className="flex justify-between items-center mt-6">
          <Button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="flex items-center space-x-2 bg-[var(--primary-blue)] hover:bg-[var(--navy-blue)] text-white disabled:bg-gray-300 disabled:text-gray-500"
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </Button>

          <div className="flex space-x-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 ${
                    currentPage === pageNum
                      ? 'bg-[var(--primary-blue)] text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="flex items-center space-x-2 bg-[var(--primary-blue)] hover:bg-[var(--navy-blue)] text-white disabled:bg-gray-300 disabled:text-gray-500"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </Button>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedTransaction(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-[var(--navy-blue)]">Transaction Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTransaction(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-gray)]">Transaction ID</label>
                <p className="text-[var(--navy-blue)]">#{selectedTransaction.id}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-[var(--text-gray)]">Date</label>
                <p className="text-[var(--navy-blue)]">{formatDate(selectedTransaction.date)}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-[var(--text-gray)]">Description</label>
                <p className="text-[var(--navy-blue)]">{selectedTransaction.description}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-[var(--text-gray)]">Type</label>
                <p className="text-[var(--navy-blue)] capitalize">{selectedTransaction.type}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-[var(--text-gray)]">Amount</label>
                <p className={`text-lg font-semibold ${
                  parseFloat(selectedTransaction.amount) >= 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {formatAmount(selectedTransaction.amount)}
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setSelectedTransaction(null)}
                className="bg-[var(--primary-blue)] hover:bg-[var(--navy-blue)] text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
