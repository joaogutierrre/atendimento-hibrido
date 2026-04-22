import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: Role;
}
