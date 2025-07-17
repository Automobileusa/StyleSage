import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import TransactionTable from "@/components/TransactionTable";

export default function TransactionsPage() {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to view your transactions.</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Button>
            </Link>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-[var(--text-primary)]">
              All Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionTable 
              transactions={[]} // Empty array since we're using pagination
              showPagination={true}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}