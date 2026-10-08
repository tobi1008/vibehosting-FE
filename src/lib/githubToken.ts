import { prisma } from "@/lib/prisma";

export interface GithubTokenRefreshSuccess {
  success: true;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: Date;
  scope?: string;
  tokenType?: string;
}

export interface GithubTokenRefreshFailure {
  success: false;
  error: string;
  errorDescription?: string;
}

export type GithubTokenRefreshResult = GithubTokenRefreshSuccess | GithubTokenRefreshFailure;

// In-memory mutex map to prevent race conditions during concurrent token refreshes
const activeRefreshes = new Map<string, Promise<GithubTokenRefreshResult>>();

/**
 * Trao đổi Refresh Token với GitHub OAuth API để lấy Access Token và Refresh Token mới (Token Rotation).
 */
export async function refreshGithubOAuthToken(refreshToken: string): Promise<GithubTokenRefreshResult> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: "missing_credentials",
      errorDescription: "GITHUB_CLIENT_ID hoặc GITHUB_CLIENT_SECRET chưa được cấu hình.",
    };
  }

  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error || !data.access_token) {
      console.error("[GitHub Token Rotation] API Error:", data);
      return {
        success: false,
        error: data.error || "refresh_failed",
        errorDescription: data.error_description || "Không thể làm mới token từ GitHub.",
      };
    }

    // GitHub trả về expires_in tính bằng giây (thường là 28800 = 8 tiếng)
    const expiresIn = Number(data.expires_in) || 28800;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // GitHub áp dụng Refresh Token Rotation: cấp một refresh_token mới
    const newRefreshToken = data.refresh_token || refreshToken;

    console.log(`[GitHub Token Rotation] Token refreshed successfully. New token expires at: ${expiresAt.toISOString()}`);

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: newRefreshToken,
      expiresIn,
      expiresAt,
      scope: data.scope,
      tokenType: data.token_type,
    };
  } catch (error: any) {
    console.error("[GitHub Token Rotation] Network exception:", error);
    return {
      success: false,
      error: "network_error",
      errorDescription: error?.message || "Lỗi kết nối khi gửi yêu cầu làm mới token tới GitHub.",
    };
  }
}

/**
 * Lưu trữ bền vững GitHub tokens vào database
 */
export async function saveUserGithubTokens(
  userId: string,
  data: {
    accessToken: string;
    refreshToken?: string | null;
    expiresIn?: number | null;
    expiresAt?: Date | null;
    githubUsername?: string | null;
    githubAvatar?: string | null;
  }
): Promise<boolean> {
  try {
    const expiresAt =
      data.expiresAt ??
      (data.expiresIn ? new Date(Date.now() + data.expiresIn * 1000) : null);

    await prisma.user.update({
      where: { id: userId },
      data: {
        githubToken: data.accessToken,
        githubRefreshToken: data.refreshToken ?? undefined,
        githubTokenExpiresAt: expiresAt ?? undefined,
        ...(data.githubUsername ? { githubUsername: data.githubUsername } : {}),
        ...(data.githubAvatar ? { githubAvatar: data.githubAvatar } : {}),
      },
    });
    return true;
  } catch (err: any) {
    console.error(`[GitHub Token] Failed to save tokens for user ${userId}:`, err);
    // Fallback: nếu cột mới chưa được migrate, lưu ít nhất githubToken
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          githubToken: data.accessToken,
          ...(data.githubUsername ? { githubUsername: data.githubUsername } : {}),
          ...(data.githubAvatar ? { githubAvatar: data.githubAvatar } : {}),
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Làm mới GitHub token cho một user với cơ chế chống race condition (mutex lock)
 */
export async function refreshUserGithubToken(
  userId: string,
  currentRefreshToken?: string | null
): Promise<GithubTokenRefreshResult> {
  // Kiểm tra nếu đang có tiến trình refresh cho userId này thì đợi kết quả chung
  if (activeRefreshes.has(userId)) {
    return activeRefreshes.get(userId)!;
  }

  const refreshPromise = (async (): Promise<GithubTokenRefreshResult> => {
    try {
      let refreshTokenToUse = currentRefreshToken;

      // Nếu không truyền refreshToken vào, lấy từ DB
      if (!refreshTokenToUse) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { githubRefreshToken: true },
          });
          refreshTokenToUse = user?.githubRefreshToken;
        } catch (e) {
          console.error(`[GitHub Token] Error reading user ${userId} refresh token from DB:`, e);
        }
      }

      if (!refreshTokenToUse) {
        return {
          success: false,
          error: "no_refresh_token",
          errorDescription: "Người dùng không có GitHub refresh token (có thể đã sử dụng Personal Access Token thủ công).",
        };
      }

      const result = await refreshGithubOAuthToken(refreshTokenToUse);

      if (result.success) {
        // Lưu token mới vào Database
        await saveUserGithubTokens(userId, {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
          expiresIn: result.expiresIn,
        });
      }

      return result;
    } finally {
      activeRefreshes.delete(userId);
    }
  })();

  activeRefreshes.set(userId, refreshPromise);
  return refreshPromise;
}

/**
 * Lấy Access Token hợp lệ của User.
 * Tự động kiểm tra thời hạn (với buffer an toàn 5 phút) và kích hoạt Refresh Token Rotation nếu sắp/đã hết hạn.
 */
export async function getOrRefreshUserGithubToken(
  userId: string
): Promise<{
  token: string | null;
  refreshed: boolean;
  expiresAt?: Date | null;
  error?: string;
}> {
  try {
    let user: any = null;

    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          githubToken: true,
          githubRefreshToken: true,
          githubTokenExpiresAt: true,
          githubUsername: true,
        },
      });
    } catch {
      // Fallback nếu schema DB chưa sync các cột mới
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          githubToken: true,
          githubUsername: true,
        },
      });
    }

    if (!user || !user.githubToken) {
      return { token: null, refreshed: false };
    }

    // Nếu không có refresh token (e.g. PAT thủ công hoặc legacy token), trả về token hiện tại
    if (!user.githubRefreshToken) {
      return {
        token: user.githubToken,
        refreshed: false,
        expiresAt: user.githubTokenExpiresAt || null,
      };
    }

    // Buffer 5 phút: Nếu token còn dưới 5 phút nữa sẽ hết hạn, làm mới ngay
    const BUFFER_MS = 5 * 60 * 1000;
    const isExpiredOrExpiringSoon =
      user.githubTokenExpiresAt &&
      Date.now() >= new Date(user.githubTokenExpiresAt).getTime() - BUFFER_MS;

    if (isExpiredOrExpiringSoon) {
      console.log(`[GitHub Token] Token for user ${userId} expired or expiring soon. Triggering Refresh Token Rotation...`);
      const refreshRes = await refreshUserGithubToken(userId, user.githubRefreshToken);

      if (refreshRes.success) {
        return {
          token: refreshRes.accessToken,
          refreshed: true,
          expiresAt: refreshRes.expiresAt,
        };
      } else {
        console.warn(`[GitHub Token] Token rotation failed for user ${userId}:`, refreshRes.errorDescription);
        // Trả về token cũ kèm error flag nếu vẫn còn cơ hội dùng
        return {
          token: user.githubToken,
          refreshed: false,
          expiresAt: user.githubTokenExpiresAt || null,
          error: refreshRes.errorDescription,
        };
      }
    }

    return {
      token: user.githubToken,
      refreshed: false,
      expiresAt: user.githubTokenExpiresAt || null,
    };
  } catch (err: any) {
    console.error(`[GitHub Token] Error in getOrRefreshUserGithubToken for ${userId}:`, err);
    return { token: null, refreshed: false, error: err?.message };
  }
}

/**
 * Xóa/Hủy liên kết GitHub Token khi bị thu hồi hoặc người dùng ngắt kết nối
 */
export async function invalidateUserGithubToken(userId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        githubToken: null,
        githubRefreshToken: null,
        githubTokenExpiresAt: null,
        githubUsername: null,
        githubAvatar: null,
      },
    });
    return true;
  } catch (err) {
    console.error(`[GitHub Token] Failed to invalidate token for user ${userId}:`, err);
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          githubToken: null,
          githubUsername: null,
          githubAvatar: null,
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}
