import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      isImpersonating?: boolean;
      originalAdminId?: string | null;
      githubAccessToken?: string | null;
      githubRefreshToken?: string | null;
      githubTokenExpiresAt?: number | null;
      githubUsername?: string | null;
      githubAvatar?: string | null;
      isGithubConnected?: boolean;
      githubError?: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role?: string;
    isImpersonating?: boolean;
    originalAdminId?: string | null;
    githubAccessToken?: string | null;
    githubRefreshToken?: string | null;
    githubTokenExpiresAt?: number | null;
    githubUsername?: string | null;
    githubAvatar?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: string;
    isImpersonating?: boolean;
    originalAdminId?: string | null;
    githubAccessToken?: string | null;
    githubRefreshToken?: string | null;
    githubTokenExpiresAt?: number | null;
    githubUsername?: string | null;
    githubAvatar?: string | null;
    githubError?: string | null;
    githubSyncAttempted?: boolean;
  }
}
