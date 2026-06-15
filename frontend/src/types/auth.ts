export type UserRole =
  | "admin"
  | "security_engineer"
  | "ai_engineer"
  | "forward_deployed_engineer"
  | "viewer";

export type UserStatus = "active" | "inactive" | "suspended";

export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole | string;
  status: UserStatus | string;
  organization_name?: string | null;
  email_verified: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  full_name: string;
  email: string;
  password: string;
  organization_name?: string | null;
};

export type AuthTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ForgotPasswordResponse = {
  message: string;
};

export type ResetPasswordRequest = {
  token: string;
  new_password: string;
};

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export type ProfileUpdateRequest = {
  full_name?: string;
  organization_name?: string | null;
};

export type AdminUserCreateRequest = {
  full_name: string;
  email: string;
  password: string;
  role: UserRole | string;
  organization_name?: string | null;
};

export type AdminUserUpdateRequest = {
  full_name?: string;
  role?: UserRole | string;
  status?: UserStatus | string;
  organization_name?: string | null;
};

export type UserListResponse = {
  total: number;
  items: AuthUser[];
};

export type MessageResponse = {
  message: string;
};
