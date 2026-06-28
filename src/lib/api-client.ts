/**
 * Tiny auth client for the ProjectHub API.
 * Logs in with the demo credentials, caches the JWT in sessionStorage,
 * and re-logs in transparently on 401.
 */

const API_BASE = "https://projecthub.runasp.net";
const LOGIN_PATH = "/api/auth/login";
const TOKEN_KEY = "projecthub.token";

// Demo credentials provided by the customer.
const DEMO_EMAIL = "pm@projecthub.com";
const DEMO_PASSWORD = "password";

let tokenPromise: Promise<string> | null = null;

function readCachedToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeCachedToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

function clearCachedToken() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function login(): Promise<string> {
  const res = await fetch(`${API_BASE}${LOGIN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status})`);
  }
  const data = (await res.json()) as { token?: string; isSuccess?: boolean };
  if (!data.token) throw new Error("Login response missing token");
  writeCachedToken(data.token);
  return data.token;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = readCachedToken();
    if (cached) return cached;
  }
  if (!tokenPromise) {
    tokenPromise = login().finally(() => {
      tokenPromise = null;
    });
  }
  return tokenPromise;
}

/**
 * Fetch a path on the ProjectHub API with the bearer token attached.
 * Transparently re-authenticates once on 401.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const doFetch = async (token: string) =>
    fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let token = await getToken();
  let res = await doFetch(token);
  if (res.status === 401) {
    clearCachedToken();
    token = await getToken(true);
    res = await doFetch(token);
  }
  return res;
}
