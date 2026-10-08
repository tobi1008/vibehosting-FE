import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";
import {
  getOrRefreshUserGithubToken,
  refreshUserGithubToken,
  invalidateUserGithubToken,
} from "@/lib/githubToken";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Tự động kiểm tra và làm mới token nếu đã hết hạn hoặc sắp hết hạn (Token Rotation)
    const tokenInfo = await getOrRefreshUserGithubToken(userId);
    let activeToken = tokenInfo?.token;

    if (!activeToken) {
      return NextResponse.json({
        connected: false,
        repos: [],
        message: "GitHub not connected",
      });
    }

    let user: any = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubUsername: true, githubRefreshToken: true },
      });
    } catch {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubUsername: true },
      });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").toLowerCase().trim();

    // Helper fetch danh sách repos
    const fetchRepos = async (token: string) => {
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        sort: "updated",
        direction: "desc",
        per_page: 100,
        affiliation: "owner,collaborator",
      });
      return data;
    };

    let data;
    try {
      data = await fetchRepos(activeToken);
    } catch (githubErr: any) {
      console.warn("[GitHub Repos] Initial fetch error:", githubErr?.message);

      // Nếu gặp lỗi 401 và user có Refresh Token -> Thực hiện Refresh Token Rotation khẩn cấp và thử lại
      if (githubErr?.status === 401 && user?.githubRefreshToken) {
        console.log(`[GitHub Repos] Received 401 Bad credentials. Attempting emergency Refresh Token Rotation for user ${userId}...`);
        const refreshResult = await refreshUserGithubToken(userId, user.githubRefreshToken);

        if (refreshResult.success) {
          activeToken = refreshResult.accessToken;
          try {
            data = await fetchRepos(activeToken);
          } catch (retryErr: any) {
            console.error("[GitHub Repos] Retry after rotation failed:", retryErr);
            throw retryErr;
          }
        } else {
          console.error("[GitHub Repos] Emergency rotation failed:", refreshResult.errorDescription);
          // Token và Refresh Token thực sự đã bị thu hồi hoàn toàn
          await invalidateUserGithubToken(userId);
          return NextResponse.json(
            {
              connected: false,
              tokenExpired: true,
              error: "Phiên kết nối GitHub đã hết hạn hoàn toàn. Vui lòng kết nối lại tài khoản GitHub.",
              repos: [],
            },
            { status: 401 }
          );
        }
      } else if (githubErr?.status === 401) {
        // Không có refresh token (PAT thủ công bị revoke hoặc hết hạn)
        await invalidateUserGithubToken(userId);
        return NextResponse.json(
          {
            connected: false,
            tokenExpired: true,
            error: "GitHub Token đã bị từ chối (401 Bad credentials). Có thể Token đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại.",
            repos: [],
          },
          { status: 401 }
        );
      } else {
        throw githubErr;
      }
    }

    let repos = data.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      html_url: r.html_url,
      clone_url: r.clone_url,
      language: r.language,
      is_private: r.private,
      stars: r.stargazers_count,
      forks: r.forks_count,
      updated_at: r.updated_at,
    }));

    if (query) {
      repos = repos.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.full_name.toLowerCase().includes(query) ||
          (r.description && r.description.toLowerCase().includes(query))
      );
    }

    return NextResponse.json({
      connected: true,
      githubUsername: user?.githubUsername,
      githubToken: activeToken,
      repos,
    });
  } catch (error) {
    console.error("Failed to process repos request:", error);
    return NextResponse.json({ error: "Failed to fetch repositories from GitHub" }, { status: 500 });
  }
}
