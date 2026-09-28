import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubToken: true, githubUsername: true },
    });

    if (!user?.githubToken) {
      return NextResponse.json({
        connected: false,
        repos: [],
        message: "GitHub not connected",
      });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").toLowerCase().trim();

    try {
      const octokit = new Octokit({ auth: user.githubToken });
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        sort: "updated",
        direction: "desc",
        per_page: 100,
        affiliation: "owner,collaborator",
      });

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
        githubUsername: user.githubUsername,
        githubToken: user.githubToken,
        repos,
      });
    } catch (githubErr: any) {
      console.error("Error fetching GitHub repos:", githubErr);
      if (githubErr?.status === 401) {
        // Automatically reset invalid/revoked token in DB so it doesn't cause repeated failures
        await prisma.user.update({
          where: { id: userId },
          data: { githubToken: null },
        }).catch(() => {});

        return NextResponse.json(
          {
            connected: false,
            tokenExpired: true,
            error: "GitHub Token đã bị từ chối (401 Bad credentials). Có thể Token đã hết hạn hoặc bị GitHub Secret Scanning tự động thu hồi. Vui lòng kiểm tra email GitHub hoặc cập nhật Token mới.",
            repos: [],
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch repositories from GitHub" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to process repos request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
