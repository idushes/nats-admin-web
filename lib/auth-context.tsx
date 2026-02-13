"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("nats_token");
    if (saved) {
      setTokenState(saved);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!token && pathname !== "/login") {
      router.replace("/login");
    } else if (token && pathname === "/login") {
      router.replace("/streams");
    }
  }, [token, isLoading, pathname, router]);

  const setToken = useCallback(
    (newToken: string) => {
      localStorage.setItem("nats_token", newToken);
      setTokenState(newToken);
      router.replace("/streams");
    },
    [router]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("nats_token");
    setTokenState(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        isLoading,
        setToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
