import type {
  AdminUserCreateRequest,
  AdminUserUpdateRequest,
  AuthTokenResponse,
  AuthUser,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  MessageResponse,
  ProfileUpdateRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UserListResponse,
} from "@/types/auth";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_HEXAGUARD_API_URL ||
  "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "hexaguard_access_token";
const REFRESH_TOKEN_KEY = "hexaguard_refresh_token";
const AUTH_USER_KEY = "hexaguard_auth_user";
const ACCESS_EXPIRES_AT_KEY = "hexaguard_access_expires_at";
const REFRESH_EXPIRES_AT_KEY = "hexaguard_refresh_expires_at";

const ACCESS_TOKEN_TTL_MS = 14 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000;
const REFRESH_EARLY_MS = 60 * 1000;

type AuthSessionResponse = AuthTokenResponse & {
  access_expires_at?: string | null;
  refresh_expires_at?: string | null;
};

type RefreshTokenRequest = {
  refresh_token: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function buildApiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function resolveExpiryMs(dateValue: string | null | undefined, fallbackMs: number) {
  if (!dateValue) {
    return Date.now() + fallbackMs;
  }

  const parsed = new Date(dateValue).getTime();
  return Number.isNaN(parsed) ? Date.now() + fallbackMs : parsed;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.message === "string"
          ? data.message
          : `Request failed with status ${response.status}`;

    throw new Error(detail);
  }

  return data as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  return parseResponse<T>(response);
}

export function saveAuthSession(session: AuthSessionResponse) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
  localStorage.setItem(
    ACCESS_EXPIRES_AT_KEY,
    String(resolveExpiryMs(session.access_expires_at, ACCESS_TOKEN_TTL_MS))
  );
  localStorage.setItem(
    REFRESH_EXPIRES_AT_KEY,
    String(resolveExpiryMs(session.refresh_expires_at, REFRESH_TOKEN_TTL_MS))
  );
}

export function clearAuthSession() {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(ACCESS_EXPIRES_AT_KEY);
  localStorage.removeItem(REFRESH_EXPIRES_AT_KEY);
}

export function getAccessToken() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getAccessTokenExpiresAt() {
  if (!isBrowser()) {
    return null;
  }

  const value = localStorage.getItem(ACCESS_EXPIRES_AT_KEY);
  return value ? Number(value) : null;
}

export function getRefreshTokenExpiresAt() {
  if (!isBrowser()) {
    return null;
  }

  const value = localStorage.getItem(REFRESH_EXPIRES_AT_KEY);
  return value ? Number(value) : null;
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) {
    return null;
  }

  const value = localStorage.getItem(AUTH_USER_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    clearAuthSession();
    return null;
  }
}

function saveStoredUser(user: AuthUser) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function isAuthenticated() {
  return Boolean(getStoredUser() && getAccessToken() && getRefreshToken());
}

export function isAccessTokenExpired() {
  const expiresAt = getAccessTokenExpiresAt();

  if (!expiresAt) {
    return true;
  }

  return Date.now() >= expiresAt - REFRESH_EARLY_MS;
}

export function isRefreshTokenExpired() {
  const expiresAt = getRefreshTokenExpiresAt();

  if (!expiresAt) {
    return false;
  }

  return Date.now() >= expiresAt;
}

export async function login(payload: LoginRequest): Promise<AuthTokenResponse> {
  const session = await request<AuthSessionResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  saveAuthSession(session);
  return session;
}

export async function register(
  payload: RegisterRequest
): Promise<AuthTokenResponse> {
  const session = await request<AuthSessionResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  saveAuthSession(session);
  return session;
}

export async function refreshSession(
  refreshToken = getRefreshToken()
): Promise<AuthTokenResponse> {
  if (!refreshToken || isRefreshTokenExpired()) {
    clearAuthSession();
    throw new Error("Session expired. Please sign in again.");
  }

  const payload: RefreshTokenRequest = {
    refresh_token: refreshToken,
  };

  const session = await request<AuthSessionResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  saveAuthSession(session);
  return session;
}

export async function getValidAccessToken() {
  const accessToken = getAccessToken();

  if (accessToken && !isAccessTokenExpired()) {
    return accessToken;
  }

  try {
    const session = await refreshSession();
    return session.access_token;
  } catch {
    clearAuthSession();
    return null;
  }
}

export async function authFetch(path: string, init?: RequestInit) {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new Error("Session expired. Please sign in again.");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshedSession = await refreshSession();

  const retryHeaders = new Headers(init?.headers);
  retryHeaders.set("Authorization", `Bearer ${refreshedSession.access_token}`);

  if (!retryHeaders.has("Content-Type") && init?.body) {
    retryHeaders.set("Content-Type", "application/json");
  }

  return fetch(buildApiUrl(path), {
    ...init,
    headers: retryHeaders,
  });
}

export async function logout(): Promise<MessageResponse> {
  const refreshToken = getRefreshToken();

  try {
    if (!refreshToken) {
      return { message: "Logged out successfully." };
    }

    return await request<MessageResponse>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } finally {
    clearAuthSession();
  }
}

export async function forgotPassword(
  payload: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> {
  return request<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(
  payload: ResetPasswordRequest
): Promise<MessageResponse> {
  return request<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyProfile(): Promise<AuthUser> {
  const response = await authFetch("/auth/me");
  const profile = await parseResponse<AuthUser>(response);
  saveStoredUser(profile);
  return profile;
}

export async function updateMyProfile(
  payload: ProfileUpdateRequest
): Promise<AuthUser> {
  const response = await authFetch("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  const profile = await parseResponse<AuthUser>(response);
  saveStoredUser(profile);
  return profile;
}

export async function changePassword(
  payload: ChangePasswordRequest
): Promise<MessageResponse> {
  const response = await authFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return parseResponse<MessageResponse>(response);
}

export async function validateStoredSession(): Promise<AuthUser | null> {
  if (!getStoredUser() || !getRefreshToken()) {
    clearAuthSession();
    return null;
  }

  try {
    return await getMyProfile();
  } catch {
    clearAuthSession();
    return null;
  }
}

export async function listUsers(search?: string): Promise<UserListResponse> {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }

  const response = await authFetch(
    `/users${params.toString() ? `?${params.toString()}` : ""}`
  );

  return parseResponse<UserListResponse>(response);
}

export async function createUser(
  payload: AdminUserCreateRequest
): Promise<AuthUser> {
  const response = await authFetch("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return parseResponse<AuthUser>(response);
}

export async function updateUser(
  userId: string,
  payload: AdminUserUpdateRequest
): Promise<AuthUser> {
  const response = await authFetch(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return parseResponse<AuthUser>(response);
}
