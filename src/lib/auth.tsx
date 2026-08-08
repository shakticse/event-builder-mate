import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { API_BASE, setStoredToken, getStoredToken } from "./api-client";

export interface AuthUser {
  name: string;
  email: string;
  role: string;
  department: string;
  avatar: string;
  permissions: string[];
}

const USER_KEY = "projecthub.user";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredUser();
    if (stored && getStoredToken()) setUser(stored);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) ?? {};
    } catch {
      data = {};
    }

    if (!res.ok || !data.token) {
      throw new Error(
        (data.message as string) ||
          (res.ok ? "Login response missing token" : `Login failed (${res.status})`),
      );
    }

    const nextUser: AuthUser = {
      name: (data.name as string) ?? "",
      email: (data.email as string) ?? email,
      role: (data.role as string) ?? "",
      department: (data.department as string) ?? "",
      avatar: (data.avatar as string) ?? "",
      permissions: (data.permissions as string[]) ?? [],
    };

    setStoredToken(data.token as string);
    try {
      window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } catch {
      /* ignore */
    }
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    try {
      window.localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
