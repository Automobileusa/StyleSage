
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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
  const { toast } = useToast();

  // Generate year options (current year and 4 previous years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Fetch paginated transactions when pagination is enabled
  const { 
    data: paginatedData, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['/api/transactions', currentPage, selectedYear],
    enabled: showPagination,
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      try {
        const response = await apiRequest(
          'GET', 
          `/api/transactions?limit=${itemsPerPage}&offset=${currentPage * itemsPerPage}&year=${selectedYear}`
        );
        return await response.json();
      } catch (error: any) {
        console.error('Transaction fetch error:', error);
        throw error;
      }
    }
  });

  // Handle fetch errors
  useEffect(() => {
    if (error) {
      console.error('Transaction table error:', error);
      toast({
        title: "Transaction Error",
        description: "Failed to load transactions. Please try again.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Use paginated data when available, otherwise use props
  const displayTransactions = showPagination && paginatedData ? paginatedData.transactions : transactions;
  const hasMore = showPagination && paginatedData ? paginatedData.hasMore : false;
  const hasPrevious = currentPage > 0;

  // Safely filter transactions
  const filteredTransactions = (displayTransactions || []).filter(transaction => {
    if (!transaction) return false;
    if (filter === 'all') return true;
    return transaction.type === filter;
  });

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Invalid Date';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-CA', { 
        month: 'short', 
        day: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const formatAmount = (amount: string) => {
    try {
      if (!amount) return '$0.00';
      const num = parseFloat(amount);
      if (isNaN(num)) return '$0.00';
      
      const formatted = Math.abs(num).toLocaleString('en-CA', { 
        style: 'currency', 
        currency: 'CAD' 
      });
      return num >= 0 ? `+${formatted}` : `-${formatted}`;
    } catch (error) {
      console.error('Amount formatting error:', error);
      return '$0.00';
    }
  };

  const handlePreviousPage = () => {
    if (hasPrevious) {
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

  const handleRetry = () => {
    refetch();
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        {/* Filter */}
        <div className="flex space-x-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs"
          >
            All
          </Button>
          <Button
            variant={filter === 'credit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('credit')}
            className="text-xs"
          >
            Credits
          </Button>
          <Button
            variant={filter === 'debit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('debit')}
            className="text-xs"
          >
            Debits
          </Button>
        </div>

        {/* Year Selector and Retry */}
        <div className="flex items-center space-x-2">
          {error && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="flex items-center space-x-1"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </Button>
          )}
          {showPagination && (
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value))}
              className="px-3 py-1 border rounded text-sm bg-white"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 mb-2">Failed to load transactions</p>
          <Button onClick={handleRetry} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {showPagination && isLoading && (
        <div className="text-center py-8 text-[var(--text-gray)]">
          <div className="spinner w-6 h-6 border-2 border-[var(--primary-blue)] border-t-transparent rounded-full mx-auto mb-2"></div>
          <p>Loading transactions...</p>
        </div>
      )}

      {/* Transactions Table */}
      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--card-bg)]">
              <tr>
                <th className="text-left p-3 font-semibold">Date</th>
                <th className="text-left p-3 font-semibold">Description</th>
                <th className="text-right p-3 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="transaction-row border-t hover:bg-gray-50">
                  <td className="p-3 text-[var(--text-gray)]">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-[var(--text-primary)]">
                      {transaction.description || 'No description'}
                    </div>
                    {transaction.category && (
                      <div className="text-xs text-[var(--text-gray)] mt-1 capitalize">
                        {transaction.category}
                      </div>
                    )}
                  </td>
                  <td className={`p-3 text-right font-semibold ${
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
          
          {/* Empty State */}
          {filteredTransactions.length === 0 && !isLoading && !error && (
            <div className="text-center py-8 text-[var(--text-gray)]">
              <p>No transactions found for the selected filter.</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {showPagination && !isLoading && !error && (
        <div className="flex justify-between items-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={!hasPrevious}
            className="flex items-center space-x-1"
          >
            <ChevronLeft className="h-3 w-3" />
            <span>Previous</span>
          </Button>
          
          <span className="text-sm text-[var(--text-gray)]">
            Page {currentPage + 1}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!hasMore}
            className="flex items-center space-x-1"
          >
            <span>Next</span>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
