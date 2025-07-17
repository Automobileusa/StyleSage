
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: 'credit' | 'debit';
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
      const num = parseFloat(amount);
      if (isNaN(num)) return '$0.00';
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD'
      }).format(num);
    } catch (error) {
      console.error('Amount formatting error:', error);
      return '$0.00';
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setCurrentPage(0);
  };

  const handleRetry = () => {
    if (showPagination) {
      refetch();
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (hasPrevious) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'all'
                ? 'bg-[var(--primary-blue)] text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('credit')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'credit'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Credits
          </button>
          <button
            onClick={() => setFilter('debit')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'debit'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Debits
          </button>
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
          <div className="spinner w-6 h-6 border-2 border-[var(--primary-blue)] border-t-transparent rounded-full mx-auto mb-2 animate-spin"></div>
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

      {/* Pagination Controls */}
      {showPagination && !isLoading && !error && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--text-gray)]">
            Showing {Math.min(filteredTransactions.length, itemsPerPage)} transactions
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={!hasPrevious}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!hasMore}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
