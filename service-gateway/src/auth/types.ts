import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  branchIds: string[];
}
