import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  University, 
  CreditCard, 
  PiggyBank, 
  Bell, 
  LogOut, 
  DollarSign,
  TrendingUp,
  Calendar,
  ExternalLink,
  FileText,
  Check,
  Link
} from "lucide-react";
import TransactionTable from "@/components/TransactionTable";
import BillPaymentModal from "@/components/modals/BillPaymentModal";
import ChequeOrderModal from "@/components/modals/ChequeOrderModal";
import ExternalAccountModal from "@/components/modals/ExternalAccountModal";
import OTPVerificationModal from "@/components/modals/OTPVerificationModal";

interface DashboardData {
  accounts: Array<{
    id: number;
    accountType: string;
    accountNumber: string;
    balance: string;
    accountName: string;
  }>;
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    amount: string;
    type: string;
  }>;
  externalAccounts: Array<{
    id: number;
    bankName: string;
    accountNumber: string;
    transitNumber: string;
    institutionNumber: string;
    status: string;
  }>;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/logout', {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.reload();
    },
    onError: (error: any) => {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ["/api/dashboard"],
    enabled: !!user,
    retry: 2,
    retryDelay: 1000,
  });

  // Handle dashboard loading error
  useEffect(() => {
    if (dashboardError) {
      console.error("Dashboard error:", dashboardError);
      toast({
        title: "Dashboard Error",
        description: "Failed to load dashboard data. Please refresh the page.",
        variant: "destructive",
      });
    }
  }, [dashboardError, toast]);

  if (!user || isDashboardLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-8 h-8 border-4 border-[var(--primary-blue)] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[var(--text-gray)]">Loading your banking dashboard...</p>
        </div>
      </div>
    );
  }

  const chequingAccount = dashboardData?.accounts?.find((acc: any) => acc.accountType === 'chequing');
  const savingsAccount = dashboardData?.accounts?.find((acc: any) => acc.accountType === 'savings');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="dashboard-header shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <div className="logo-container mr-6">
                <img 
                  src="https://auth.eastcoastcu.ca/resources/themes/theme-eastcoast-md-refresh-mobile/assets/images/logo.png" 
                  alt="East Coast Credit Union" 
                  className="h-12 w-auto"
                />
              </div>
              <div className="user-welcome">
                <p className="text-sm text-gray-500">Welcome back</p>
                <h1 className="text-xl font-semibold text-gray-900">Mate Smith</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="hover:bg-blue-50">
                <Bell size={18} className="text-gray-600" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="hover:bg-red-50">
                <LogOut size={18} className="text-gray-600" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Account Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Chequing Account */}
          {chequingAccount && (
            <Card className="card-shadow border-l-4 border-[var(--primary-blue)]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[var(--navy-blue)]">Chequing Account</h3>
                  <CreditCard className="text-[var(--primary-blue)]" size={24} />
                </div>
                <div className="mb-4">
                  <p className="text-3xl font-bold text-[var(--navy-blue)]">
                    ${parseFloat(chequingAccount.balance).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-[var(--text-gray)]">Account: {chequingAccount.accountNumber}</p>
                </div>
                <Button className="w-full bg-[var(--primary-blue)] hover:bg-[var(--navy-blue)] text-white">
                  View Details
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Savings Account */}
          {savingsAccount && (
            <Card className="card-shadow border-l-4 border-[var(--accent-green)]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[var(--navy-blue)]">High Interest Savings</h3>
                  <PiggyBank className="text-[var(--accent-green)]" size={24} />
                </div>
                <div className="mb-4">
                  <p className="text-3xl font-bold text-[var(--navy-blue)]">
                    ${parseFloat(savingsAccount.balance).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-[var(--text-gray)]">Account: {savingsAccount.accountNumber}</p>
                </div>
                <Button className="w-full bg-[var(--accent-green)] hover:bg-green-600 text-white">
                  View Details
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="card-shadow">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-[var(--navy-blue)] mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button
                  className="w-full bg-[var(--card-bg)] text-[var(--navy-blue)] hover:bg-gray-200 justify-start"
                  variant="secondary"
                  onClick={() => setActiveModal('billPayment')}
                >
                  <FileText className="mr-2" size={16} />
                  Bill Payment
                </Button>
                <Button
                  className="w-full bg-[var(--card-bg)] text-[var(--navy-blue)] hover:bg-gray-200 justify-start"
                  variant="secondary"
                  onClick={() => setActiveModal('chequeOrder')}
                >
                  <Check className="mr-2" size={16} />
                  Order Cheques
                </Button>
                <Button
                  className="w-full bg-[var(--card-bg)] text-[var(--navy-blue)] hover:bg-gray-200 justify-start"
                  variant="secondary"
                  onClick={() => setActiveModal('externalAccount')}
                >
                  <Link className="mr-2" size={16} />
                  Link External Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video and Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* East Coast Credit Union Video */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-[var(--navy-blue)]">About East Coast Credit Union</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full h-64">
                <iframe
                  src="https://www.youtube.com/embed/HrMSpjY5hBw?si=UFczoGvDYaZJJmJU"
                  title="East Coast Credit Union"
                  className="w-full h-full rounded-lg"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-[var(--navy-blue)]">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={dashboardData?.transactions || []} />
            </CardContent>
          </Card>
        </div>

        {/* External Accounts */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-[var(--navy-blue)]">Linked External Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData?.externalAccounts?.length ? (
                dashboardData.externalAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-4 bg-[var(--card-bg)] rounded-lg">
                    <div>
                      <p className="font-semibold text-[var(--navy-blue)]">{account.bankName}</p>
                      <p className="text-sm text-[var(--text-gray)]">
                        Account: {account.accountNumber} | Transit: {account.transitNumber} | Institution: {account.institutionNumber}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      account.status === 'verified' 
                        ? 'bg-[var(--accent-green)] text-white' 
                        : 'bg-yellow-500 text-white'
                    }`}>
                      {account.status === 'verified' ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[var(--text-gray)]">No external accounts linked</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center space-y-6">
            <div className="footer-logo">
              <img 
                src="https://auth.eastcoastcu.ca/resources/themes/theme-eastcoast-md-refresh-mobile/assets/images/logo.png" 
                alt="East Coast Credit Union" 
                className="h-16 w-auto"
              />
            </div>
            <div className="flex flex-wrap justify-center space-x-6 text-sm text-[var(--text-gray)]">
              <a href="#" className="hover:text-[var(--navy-blue)] hover:underline">Legal</a>
              <a href="#" className="hover:text-[var(--navy-blue)] hover:underline">Security</a>
              <a href="#" className="hover:text-[var(--navy-blue)] hover:underline">Privacy</a>
              <a href="#" className="hover:text-[var(--navy-blue)] hover:underline">CRA Direct Deposit</a>
              <a href="#" className="hover:text-[var(--navy-blue)] hover:underline">About East Coast CU</a>
            </div>
            <div className="text-center text-xs text-[var(--text-gray)]">
              <p>&copy; 2024 East Coast Credit Union. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <BillPaymentModal 
        isOpen={activeModal === 'billPayment'} 
        onClose={() => setActiveModal(null)} 
      />
      <ChequeOrderModal 
        isOpen={activeModal === 'chequeOrder'} 
        onClose={() => setActiveModal(null)} 
      />
      <ExternalAccountModal 
        isOpen={activeModal === 'externalAccount'} 
        onClose={() => setActiveModal(null)} 
      />
      <OTPVerificationModal />
    </div>
  );
}