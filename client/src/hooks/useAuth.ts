
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  login: (credentials: { userId: string; password: string }) => Promise<any>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const queryClient = useQueryClient();

  // Check authentication status
  const { 
    data: user, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/auth/user');
        return await response.json();
      } catch (error: any) {
        // Don't throw for 401 errors, just return null
        if (error.status === 401) {
          return null;
        }
        throw error;
      }
    }
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { userId: string; password: string }) => {
      const response = await apiRequest('POST', '/api/auth/login', credentials);
      return await response.json();
    },
    onSuccess: (data) => {
      // Invalidate auth query to refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      console.error("Login error:", error);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/logout', {});
      return await response.json();
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      // Force a page reload to reset application state
      window.location.href = '/';
    },
    onError: (error: any) => {
      console.error("Logout error:", error);
      // Even if logout fails on server, clear local state
      queryClient.clear();
      window.location.href = '/';
    },
  });

  const login = async (credentials: { userId: string; password: string }) => {
    return loginMutation.mutateAsync(credentials);
  };

  const logout = async () => {
    return logoutMutation.mutateAsync();
  };

  return {
    user: user || null,
    isAuthenticated: !!user,
    isLoading: isLoading || loginMutation.isPending || logoutMutation.isPending,
    error: error as Error | null,
    login,
    logout,
  };
}
