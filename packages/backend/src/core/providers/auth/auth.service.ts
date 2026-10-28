import { db } from '@mvs/database';
import { Injectable } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

export function makeAuth(bootstrap = false) {
  return betterAuth({
    database: prismaAdapter(db, { provider: 'postgresql' }),
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true, disableSignUp: !bootstrap, minPasswordLength: 12 },
    trustedOrigins: [process.env.BETTER_AUTH_URL || 'http://localhost:3000'],
    rateLimit: { enabled: true, window: 60, max: 30 },
  });
}
export const auth = makeAuth();
@Injectable()
export class AuthService {
  readonly auth = auth;
}
