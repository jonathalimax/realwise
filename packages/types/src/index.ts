export interface ClientConfig {
  clientId: string;
  features: {
    investments: boolean;
    goals: boolean;
    b3Sync: boolean;
    whatsapp: boolean;
    salaryBreakdown: boolean;
  };
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export type UserRole = 'user' | 'admin';

export interface JwtPayload {
  sub: string;
  client_id: string;
  role: UserRole;
  iat: number;
  exp: number;
}
