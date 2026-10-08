import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";
import {
  getOrRefreshUserGithubToken,
  saveUserGithubTokens,
  invalidateUserGithubToken,
} from "@/lib/githubToken";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Tự động kiểm tra và làm mới token nếu sắp hết hạn
    const tokenInfo = await getOrRefreshUserGithubToken(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubUsername: true, githubAvatar: true },
    });

    return NextResponse.json({
      connected: Boolean(tokenInfo?.token),
      githubToken: tokenInfo?.token || null,
      githubUsername: user?.githubUsername || null,
      githubAvatar: user?.githubAvatar || null,
      expiresAt: tokenInfo?.expiresAt || null,
      refreshed: Boolean(tokenInfo?.refreshed),
    });
  } catch (error) {
    console.error("Failed to fetch GitHub info:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json(
        { error: "GitHub Personal Access Token is required" },
        { status: 400 }
      );
    }

    const cleanToken = token.trim();

    // Verify token with GitHub API
    let githubUser: any;
    try {
      const octokit = new Octokit({ auth: cleanToken });
      const { data } = await octokit.rest.users.getAuthenticated();
      githubUser = data;
    } catch (githubErr: any) {
      console.error("GitHub verification error:", githubErr);
      return NextResponse.json(
        {
          error:
            githubErr?.message ||
            "Invalid GitHub Personal Access Token. Please check that the token is valid and has 'repo' or 'read:user' permissions.",
        },
        { status: 400 }
      );
    }

    // Save token and GitHub user info to database
    await saveUserGithubTokens(userId, {
      accessToken: cleanToken,
      refreshToken: null,
      expiresAt: null,
      githubUsername: githubUser.login,
      githubAvatar: githubUser.avatar_url,
    });

    return NextResponse.json({
      success: true,
      message: `Connected successfully as @${githubUser.login}`,
      githubUsername: githubUser.login,
      githubAvatar: githubUser.avatar_url,
    });
  } catch (error) {
    console.error("Failed to connect GitHub:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await invalidateUserGithubToken(userId);

    return NextResponse.json({
      success: true,
      message: "GitHub account disconnected successfully",
    });
  } catch (error) {
    console.error("Failed to disconnect GitHub:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
