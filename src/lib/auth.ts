import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { refreshGithubOAuthToken, saveUserGithubTokens } from "@/lib/githubToken";

// Secret và mật khẩu admin chỉ lấy từ biến môi trường, không có giá trị mặc định trong code
const AUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function createImpersonateToken(targetUserId: string, originalAdminId: string): string {
  if (!AUTH_SECRET) throw new Error("NEXTAUTH_SECRET chưa được cấu hình");
  const timestamp = Date.now();
  const payload = `${targetUserId}:${originalAdminId}:${timestamp}`;
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  return `${payload}:${signature}`;
}

export function verifyImpersonateToken(token: string): { targetUserId: string; originalAdminId: string } | null {
  try {
    if (!AUTH_SECRET) return null;
    const parts = token.split(":");
    if (parts.length !== 4) return null;
    const [targetUserId, originalAdminId, timestampStr, signature] = parts;
    const payload = `${targetUserId}:${originalAdminId}:${timestampStr}`;
    const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
    if (!safeEqual(signature, expectedSig)) return null;
    const timestamp = parseInt(timestampStr, 10);
    // Valid for 5 minutes
    if (Date.now() - timestamp > 5 * 60 * 1000) return null;
    return { targetUserId, originalAdminId };
  } catch {
    return null;
  }
}

// Đảm bảo tài khoản admin tồn tại và mật khẩu trong DB khớp với ADMIN_PASSWORD
async function ensureAdminUser() {
  if (!ADMIN_PASSWORD) return;
  try {
    const admin = await prisma.user.findUnique({
      where: { username: "admin" },
      select: { id: true, password: true },
    });
    if (!admin) {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.user.create({
        data: {
          username: "admin",
          name: "Admin User",
          email: "admin@vibehosting.com",
          password: hashedPassword,
          role: "admin"
        }
      });
      console.log("Seeded admin user from ADMIN_PASSWORD");
    } else if (!(await bcrypt.compare(ADMIN_PASSWORD, admin.password))) {
      // Ghi đè mật khẩu cũ trong DB để mật khẩu trước đây không còn dùng được
      await prisma.user.update({
        where: { id: admin.id },
        data: { password: await bcrypt.hash(ADMIN_PASSWORD, 10) },
      });
      console.log("Synced admin password from ADMIN_PASSWORD");
    }
  } catch (err) {
    console.error("Error ensuring admin user:", err);
  }
}

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  providers: [
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            authorization: {
              params: {
                scope: "repo,read:user,user:email",
              },
            },
          }),
        ]
      : []),
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
            select: { id: true, name: true, username: true, email: true, role: true },
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

        // Ưu tiên 1: Đảm bảo tài khoản admin luôn đăng nhập được trên mọi môi trường (kể cả Vercel SQLite / serverless)
        // Tài khoản admin chỉ đăng nhập bằng ADMIN_PASSWORD; thiếu biến này thì tắt đăng nhập admin
        if (credentials.username === "admin" && !ADMIN_PASSWORD) {
          console.error("ADMIN_PASSWORD chưa được cấu hình, từ chối đăng nhập admin");
          return null;
        }
        const isMasterAdmin =
          credentials.username === "admin" &&
          !!ADMIN_PASSWORD &&
          safeEqual(credentials.password, ADMIN_PASSWORD);

        if (isMasterAdmin) {
          try {
            await ensureAdminUser();
            const dbAdmin = await prisma.user.findUnique({
              where: { username: "admin" },
              select: { id: true, name: true, email: true, role: true },
            });
            if (dbAdmin) {
              return {
                id: dbAdmin.id,
                name: dbAdmin.name || "Admin User",
                email: dbAdmin.email || "admin@vibehosting.com",
                role: dbAdmin.role || "admin",
                isImpersonating: false,
                originalAdminId: null,
              };
            }
          } catch (e) {
            console.warn("DB inaccessible or read-only, using fallback admin session:", e);
          }

          // Fallback static admin session nếu SQLite DB trên serverless không khả dụng
          return {
            id: "cmty1olh30001o40tjgq8otd8",
            name: "Admin User",
            email: "admin@vibehosting.com",
            role: "admin",
            isImpersonating: false,
            originalAdminId: null,
          };
        }

        // Case 3: Các user khác xác thực qua DB
        try {
          await ensureAdminUser();

          const user = await prisma.user.findUnique({
            where: { username: credentials.username },
            select: { id: true, username: true, name: true, email: true, password: true, role: true },
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
        } catch (dbError) {
          console.error("Database authentication error:", dbError);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // 1. Gán thông tin người dùng khi đăng nhập ban đầu
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.isImpersonating = (user as any).isImpersonating ?? false;
        token.originalAdminId = (user as any).originalAdminId ?? null;
      }

      // 2. Nếu đăng nhập thông qua GitHub Provider
      if (account && account.provider === "github") {
        const expiresIn = account.expires_at
          ? Math.max(0, account.expires_at - Math.floor(Date.now() / 1000))
          : 28800;
        const expiresAt = account.expires_at
          ? new Date(account.expires_at * 1000)
          : new Date(Date.now() + 28800 * 1000);

        token.githubAccessToken = account.access_token || null;
        token.githubRefreshToken = (account.refresh_token as string) || null;
        token.githubTokenExpiresAt = expiresAt.getTime();
        token.githubUsername = (profile as any)?.login || user?.name || null;
        token.githubAvatar = (profile as any)?.avatar_url || (user as any)?.image || null;

        if (token.id) {
          saveUserGithubTokens(token.id as string, {
            accessToken: account.access_token!,
            refreshToken: (account.refresh_token as string) || null,
            expiresAt,
            githubUsername: token.githubUsername,
            githubAvatar: token.githubAvatar,
          }).catch((err) =>
            console.error("[NextAuth] Error saving GitHub tokens on OAuth login:", err)
          );
        }
      }

      // 3. Cơ chế Refresh Token Rotation cho GitHub
      if (token.id) {
        // Trường hợp A: Đã có refresh token và thời hạn trong JWT
        if (token.githubRefreshToken && token.githubTokenExpiresAt) {
          const BUFFER_MS = 5 * 60 * 1000; // 5 phút buffer an toàn
          const isExpiringSoon = Date.now() >= (token.githubTokenExpiresAt - BUFFER_MS);

          if (isExpiringSoon) {
            console.log(`[NextAuth JWT] GitHub token for user ${token.id} expiring soon. Rotating token...`);
            const rotation = await refreshGithubOAuthToken(token.githubRefreshToken);

            if (rotation.success) {
              token.githubAccessToken = rotation.accessToken;
              token.githubRefreshToken = rotation.refreshToken;
              token.githubTokenExpiresAt = rotation.expiresAt.getTime();
              token.githubError = null;

              await saveUserGithubTokens(token.id as string, {
                accessToken: rotation.accessToken,
                refreshToken: rotation.refreshToken,
                expiresAt: rotation.expiresAt,
              });
            } else {
              console.warn(`[NextAuth JWT] Token rotation failed:`, rotation.errorDescription);
              token.githubError = "RefreshAccessTokenError";
            }
          }
        } else {
          // Trường hợp B: Chưa có GitHub token trong JWT (e.g. liên kết qua 1-Click OAuth sau khi đăng nhập credentials)
          // Đồng bộ từ database mỗi 30s để tránh query database quá thường xuyên
          const now = Date.now();
          const lastSync = (token as any)._lastGithubDbSync || 0;

          if (now - lastSync > 30 * 1000) {
            (token as any)._lastGithubDbSync = now;
            try {
              const dbUser = await prisma.user.findUnique({
                where: { id: token.id as string },
                select: {
                  githubToken: true,
                  githubRefreshToken: true,
                  githubTokenExpiresAt: true,
                  githubUsername: true,
                  githubAvatar: true,
                },
              });

              if (dbUser?.githubToken) {
                token.githubAccessToken = dbUser.githubToken;
                token.githubRefreshToken = dbUser.githubRefreshToken || null;
                token.githubTokenExpiresAt = dbUser.githubTokenExpiresAt
                  ? dbUser.githubTokenExpiresAt.getTime()
                  : null;
                token.githubUsername = dbUser.githubUsername || null;
                token.githubAvatar = dbUser.githubAvatar || null;

                // Nếu token lấy từ DB cũng sắp/đã hết hạn, tiến hành rotate ngay
                if (token.githubRefreshToken && token.githubTokenExpiresAt) {
                  const BUFFER_MS = 5 * 60 * 1000;
                  if (Date.now() >= token.githubTokenExpiresAt - BUFFER_MS) {
                    const rotation = await refreshGithubOAuthToken(token.githubRefreshToken);
                    if (rotation.success) {
                      token.githubAccessToken = rotation.accessToken;
                      token.githubRefreshToken = rotation.refreshToken;
                      token.githubTokenExpiresAt = rotation.expiresAt.getTime();
                      await saveUserGithubTokens(token.id as string, {
                        accessToken: rotation.accessToken,
                        refreshToken: rotation.refreshToken,
                        expiresAt: rotation.expiresAt,
                      });
                    }
                  }
                }
              } else if (dbUser && !dbUser.githubToken) {
                token.githubAccessToken = null;
                token.githubRefreshToken = null;
                token.githubTokenExpiresAt = null;
                token.githubUsername = null;
                token.githubAvatar = null;
              }
            } catch {
              // Bỏ qua lỗi DB tạm thời
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).isImpersonating = token.isImpersonating ?? false;
        (session.user as any).originalAdminId = token.originalAdminId ?? null;
        (session.user as any).githubAccessToken = token.githubAccessToken || null;
        (session.user as any).githubRefreshToken = token.githubRefreshToken || null;
        (session.user as any).githubTokenExpiresAt = token.githubTokenExpiresAt || null;
        (session.user as any).githubUsername = token.githubUsername || null;
        (session.user as any).githubAvatar = token.githubAvatar || null;
        (session.user as any).isGithubConnected = Boolean(token.githubAccessToken);
        (session.user as any).githubError = token.githubError || null;
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
