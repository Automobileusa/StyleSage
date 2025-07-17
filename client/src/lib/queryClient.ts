import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const API_BASE_URL = "";

export async function apiRequest(
  method: string,
  endpoint: string,
  data?: any
): Promise<Response> {
  // Input validation
  if (!method || typeof method !== 'string') {
    throw new Error('Invalid HTTP method');
  }

  if (!endpoint || typeof endpoint !== 'string') {
    throw new Error('Invalid API endpoint');
  }

  // Sanitize endpoint
  const sanitizedEndpoint = endpoint.trim();
  if (!sanitizedEndpoint.startsWith('/api/')) {
    throw new Error('Invalid API endpoint format');
  }

  const config: RequestInit = {
    method: method.toUpperCase(),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Important for sessions
    timeout: 30000, // 30 second timeout
  };

  if (data) {
    try {
      config.body = JSON.stringify(data);
    } catch (serializationError) {
      throw new Error('Invalid request data format');
    }
  }

  let response: Response;

  try {
    // Add timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    config.signal = controller.signal;

    response = await fetch(`${API_BASE_URL}${sanitizedEndpoint}`, config);

    clearTimeout(timeoutId);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please try again.');
    }

    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your connection and try again.');
    }

    throw new Error(`Request failed: ${error.message}`);
  }

  if (!response.ok) {
    let errorData: string;

    try {
      errorData = await response.text();
    } catch (textError) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    let message = `${response.status}: ${response.statusText}`;
    let errorCode = 'UNKNOWN_ERROR';

    try {
      const parsedError = JSON.parse(errorData);
      if (parsedError.message) {
        message = parsedError.message;
      }
      if (parsedError.error) {
        errorCode = parsedError.error;
      }
    } catch {
      // If parsing fails, use the raw text
      if (errorData) {
        message = errorData;
      }
    }

    // Add error code to the error for better handling
    const error = new Error(message) as any;
    error.code = errorCode;
    error.status = response.status;

    throw error;
  }

  return response;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});