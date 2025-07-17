import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: string;
  type: string;
  category?: string;
}

interface TransactionTableProps {
  transactions: Transaction[];
  showPagination?: boolean;
}

export default function TransactionTable({ transactions, showPagination = false }: TransactionTableProps) {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const itemsPerPage = 20;

  // Fetch paginated transactions when pagination is enabled
  const { data: paginatedData, isLoading } = useQuery({
    queryKey: ['/api/transactions', currentPage, selectedYear],
    enabled: showPagination,
    queryFn: async () => {
      const response = await fetch(`/api/transactions?limit=${itemsPerPage}&offset=${currentPage * itemsPerPage}&year=${selectedYear}`, {
        credentials: 'include'
      });
      return response.json();
    }
  });

  // Use paginated data when available, otherwise use props
  const displayTransactions = showPagination && paginatedData ? paginatedData.transactions : transactions;
  const hasMore = showPagination && paginatedData ? paginatedData.hasMore : false;

  const filteredTransactions = displayTransactions.filter(transaction => {
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

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setCurrentPage(0); // Reset to first page when changing year
  };

  return (
    <div>
      {/* Year Selection and Filter Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        {showPagination && (
          <div className="flex space-x-2">
            <Button
              size="sm"
              className={`px-3 py-1 rounded-full text-sm ${
                selectedYear === 2025 
                  ? 'bg-[var(--primary-blue)] text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => handleYearChange(2025)}
            >
              2025
            </Button>
            <Button
              size="sm"
              className={`px-3 py-1 rounded-full text-sm ${
                selectedYear === 2024 
                  ? 'bg-[var(--primary-blue)] text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => handleYearChange(2024)}
            >
              2024
            </Button>
          </div>
        )}
        
        <div className="flex space-x-2">
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
      </div>

      {/* Loading State */}
      {showPagination && isLoading && (
        <div className="text-center py-8 text-[var(--text-gray)]">
          Loading transactions...
        </div>
      )}

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
        {filteredTransactions.length === 0 && !isLoading && (
          <div className="text-center py-8 text-[var(--text-gray)]">
            No transactions found for the selected filter.
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {showPagination && !isLoading && (
        <div className="flex justify-between items-center mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={currentPage === 0}
            className="flex items-center space-x-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Older</span>
          </Button>
          
          <span className="text-sm text-[var(--text-gray)]">
            Page {currentPage + 1} {selectedYear && `(${selectedYear})`}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!hasMore}
            className="flex items-center space-x-2"
          >
            <span>Newer</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
