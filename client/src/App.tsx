
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import TransactionsPage from "@/pages/transactions";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const [location, setLocation] = useLocation();

  // Log authentication state for debugging
  useEffect(() => {
    console.log('Auth state:', { isAuthenticated, isLoading, error, location });
  }, [isAuthenticated, isLoading, error, location]);

  // Redirect logic based on authentication
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated && location !== "/" && location !== "/login") {
        setLocation("/");
      } else if (isAuthenticated && (location === "/" || location === "/login")) {
        setLocation("/dashboard");
      }
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="spinner w-8 h-8 border-4 border-[var(--primary-blue)] border-t-transparent rounded-full mx-auto mb-4 animate-spin"></div>
          <p className="text-[var(--text-gray)]">Loading application...</p>
        </div>
      </div>
    );
  }

  // Show authentication error if any
  if (error) {
    console.error('Authentication error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Error</h2>
          <p className="text-[var(--text-gray)] mb-4">Please refresh the page and try again.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded hover:bg-[var(--navy-blue)] transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={isAuthenticated ? Dashboard : LoginPage} />
      <Route path="/dashboard" component={isAuthenticated ? Dashboard : LoginPage} />
      <Route path="/transactions" component={isAuthenticated ? TransactionsPage : LoginPage} />
      <Route path="/" component={isAuthenticated ? Dashboard : LoginPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Global error handler
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      // Prevent error from crashing the app
      event.preventDefault();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // Prevent unhandled rejection from crashing the app
      event.preventDefault();
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
