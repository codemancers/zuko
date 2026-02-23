/**
 * Type-safe API client for backend integration
 * Works in both Server and Client Components
 */

interface ApiClientConfig {
  baseUrl?: string;
  headers?: HeadersInit;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor(config: ApiClientConfig = {}) {
    // On client side, use Next.js proxy API route instead of hitting backend directly
    // On server side, hit backend API directly
    if (typeof window !== 'undefined') {
      // Browser: use Next.js proxy
      this.baseUrl = config.baseUrl || '/api/proxy';
    } else {
      // Server: use backend directly
      this.baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    }
    this.defaultHeaders = config.headers || {};
  }

  /**
   * Check if we're running on the server
   */
  private isServer(): boolean {
    return typeof window === 'undefined';
  }

  /**
   * Make authenticated request to backend
   * On server: Passes cookies explicitly for better-auth session
   * On client: Uses credentials: 'include' to send cookies automatically
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.defaultHeaders as Record<string, string>,
      ...options.headers as Record<string, string>,
    };

    // On server side, get cookies and pass them explicitly
    if (this.isServer()) {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        headers['Cookie'] = cookieStore.toString();
      } catch (error) {
        // If cookies are not available, continue without them
        console.warn('Failed to get cookies on server:', error);
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: "include",
      // Don't cache API responses by default
      cache: options.cache || "no-store",
    };

    const url = `${this.baseUrl}/api${endpoint}`;

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));
        throw new ApiError(
          error.message || "API request failed",
          response.status,
          error
        );
      }

      // 204 No Content responses don't have a body
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : "Unknown error",
        500,
        error
      );
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Singleton API client instance
 * Use this in Server Components and Server Actions
 */
export const apiClient = new ApiClient();
