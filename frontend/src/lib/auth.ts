import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const IMPERSONATE_SECRET = process.env.NEXTAUTH_SECRET || "***REMOVED***";

export function createImpersonateToken(targetUserId: string, originalAdminId: string): string {
  const timestamp = Date.now();
  const payload = `${targetUserId}:${originalAdminId}:${timestamp}`;
  const signature = crypto.createHmac("sha256", IMPERSONATE_SECRET).update(payload).digest("hex");
  return `${payload}:${signature}`;
}

export function verifyImpersonateToken(token: string): { targetUserId: string; originalAdminId: string } | null {
  try {
    const parts = token.split(":");
    if (parts.length !== 4) return null;
    const [targetUserId, originalAdminId, timestampStr, signature] = parts;
    const payload = `${targetUserId}:${originalAdminId}:${timestampStr}`;
    const expectedSig = crypto.createHmac("sha256", IMPERSONATE_SECRET).update(payload).digest("hex");
    if (signature !== expectedSig) return null;
    const timestamp = parseInt(timestampStr, 10);
    // Valid for 5 minutes
    if (Date.now() - timestamp > 5 * 60 * 1000) return null;
    return { targetUserId, originalAdminId };
  } catch {
    return null;
  }
}

// Helper to ensure default admin user exists if database is fresh
async function ensureAdminUser() {
  try {
    const adminExists = await prisma.user.findUnique({
      where: { username: "admin" }
    });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("123", 10);
      await prisma.user.create({
        data: {
          username: "admin",
          name: "Admin User",
          email: "admin@vibehosting.com",
          password: hashedPassword,
          role: "admin"
        }
      });
      console.log("Seeded default admin user (admin / 123)");
    }
  } catch (err) {
    console.error("Error ensuring default admin user:", err);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" },
        impersonateUserId: { label: "ImpersonateUserId", type: "text" },
        impersonateToken: { label: "ImpersonateToken", type: "text" },
      },
      async authorize(credentials) {
        console.log("Authorize called with credentials keys:", Object.keys(credentials || {}));
        // Case 1: Admin impersonation
        if (credentials?.impersonateUserId && credentials?.impersonateToken) {
          console.log("Impersonating user:", credentials.impersonateUserId);
          const verified = verifyImpersonateToken(credentials.impersonateToken);
          console.log("Token verification result:", verified);
          if (!verified || verified.targetUserId !== credentials.impersonateUserId) {
            console.error("Invalid or expired impersonation token");
            return null;
          }

          const targetUser = await prisma.user.findUnique({
            where: { id: credentials.impersonateUserId },
          });

          if (!targetUser) {
            console.error("Target user for impersonation not found");
            return null;
          }

          const isReturningToSelf = verified.originalAdminId === targetUser.id;

          return {
            id: targetUser.id,
            name: targetUser.name || targetUser.username,
            email: targetUser.email || `${targetUser.username}@vibehosting.com`,
            role: targetUser.role,
            isImpersonating: !isReturningToSelf,
            originalAdminId: isReturningToSelf ? null : verified.originalAdminId,
          };
        }

        // Case 2: Normal credentials login
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        await ensureAdminUser();

        const user = await prisma.user.findUnique({
          where: { username: credentials.username }
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name || user.username,
          email: user.email || `${user.username}@vibehosting.com`,
          role: user.role,
          isImpersonating: false,
          originalAdminId: null,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.isImpersonating = (user as any).isImpersonating ?? false;
        token.originalAdminId = (user as any).originalAdminId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).isImpersonating = token.isImpersonating ?? false;
        (session.user as any).originalAdminId = token.originalAdminId ?? null;
      }
      return session;
    }
  },
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: '/login',
  }
};
