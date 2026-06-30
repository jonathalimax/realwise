export type UserRole = 'user' | 'admin';

export interface SessionUser {
  sub: string;
  clientId: string;
  role: UserRole;
  email?: string | null;
  name?: string | null;
  profileImageUrl?: string | null;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user: SessionUser | null;
}

export interface ApiErrorShape {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  error?: ApiErrorShape | string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  nextCursor?: string | null;
}

export interface Lead {
  id: string;
  email: string;
  name?: string | null;
  state?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface Purchase {
  id: string;
  email?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface Coupon {
  id: string;
  code: string;
  enabled?: boolean;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  expiresAt?: string | Date | null;
}

export interface ImportIssue {
  id: string;
  status?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface PricingConfig {
  basePriceCents: number;
  installments: number;
}

export interface OnboardingRun {
  id: string;
  status: string;
  email?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface Testimonial {
  id: string;
  name: string;
  text: string;
  role?: string | null;
  avatar?: string | null;
  rating?: number | null;
  active?: boolean;
}
