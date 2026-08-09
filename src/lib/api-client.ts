/**
 * Tiny auth-aware client for the ProjectHub API.
 * The token is obtained by the login flow (see src/lib/auth.tsx) and
 * persisted in localStorage; requests attach it as a bearer token.
 */

export const API_BASE = "https://projecthub.runasp.net";
const TOKEN_KEY = "projecthub.token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  setStoredToken(null);
  try {
    window.localStorage.removeItem("projecthub.user");
  } catch {
    /* ignore */
  }
  if (!window.location.hash.startsWith("#/login")) {
    window.location.hash = "#/login";
    window.location.reload();
  }
}

/**
 * Fetch a path on the ProjectHub API with the bearer token attached.
 * Any 401 (or a missing token) sends the user back to the login page.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const token = getStoredToken();

  if (!token) {
    redirectToLogin();
    throw new Error("Not authenticated");
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Session expired. Please sign in again.");
  }

  return res;
}

