
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TransactionTable from "@/components/TransactionTable";

export default function TransactionsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Fetch dashboard data to ensure user has access
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ["/api/dashboard"],
    enabled: !!user && !!isAuthenticated,
    retry: 2,
    retryDelay: 1000,
  });

  // Handle dashboard loading error
  useEffect(() => {
    if (dashboardError) {
      console.error("Dashboard access error:", dashboardError);
      toast({
        title: "Access Error",
        description: "Unable to verify account access. Redirecting to dashboard.",
        variant: "destructive",
      });
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    }
  }, [dashboardError, toast, setLocation]);

  const handleBackToDashboard = () => {
    try {
      setLocation("/");
    } catch (error) {
      console.error("Navigation error:", error);
      toast({
        title: "Navigation Error",
        description: "Unable to navigate back. Please try again.",
        variant: "destructive",
      });
      // Fallback navigation
      window.location.href = "/";
    }
  };

  // Show loading state
  if (authLoading || dashboardLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-8 h-8 border-4 border-[var(--primary-blue)] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[var(--text-gray)]">Loading transactions...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (dashboardError) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Access Error
          </h2>
          <p className="text-[var(--text-gray)] mb-4">
            Unable to access transaction data. Redirecting...
          </p>
          <Button onClick={handleBackToDashboard} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Show unauthorized state
  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Authentication Required
          </h2>
          <p className="text-[var(--text-gray)]">Please log in to view your transactions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center space-x-2 hover:bg-[var(--primary-blue)] hover:text-white transition-colors"
              onClick={handleBackToDashboard}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                Transaction History
              </h1>
              <p className="text-[var(--text-gray)] mt-1">
                View all your banking transactions by year
              </p>
            </div>
          </div>
        </div>

        {/* Transaction Table with Pagination */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--text-primary)]">
              All Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionTable 
              transactions={dashboardData?.transactions || []} 
              showPagination={true}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
