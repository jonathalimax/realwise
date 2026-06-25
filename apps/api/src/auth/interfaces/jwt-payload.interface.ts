export interface JwtPayload {
  sub: string;
  clientId: string;
  role: 'user' | 'admin';
}
