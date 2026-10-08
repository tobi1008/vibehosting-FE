import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrRefreshUserGithubToken } from "@/lib/githubToken";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user, tokenInfo] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          githubUsername: true,
          githubAvatar: true,
          githubToken: true,
          createdAt: true,
        },
      }),
      getOrRefreshUserGithubToken(userId),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      githubUsername: user.githubUsername,
      githubAvatar: user.githubAvatar,
      isGithubConnected: Boolean(tokenInfo?.token || user.githubToken),
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, email } = body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined ? { name: String(name).trim() || null } : {}),
        ...(email !== undefined ? { email: String(email).trim() || null } : {}),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        githubUsername: true,
        githubAvatar: true,
        githubToken: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      username: updated.username,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      githubUsername: updated.githubUsername,
      githubAvatar: updated.githubAvatar,
      isGithubConnected: Boolean(updated.githubToken),
      createdAt: updated.createdAt,
    });
  } catch (error) {
    console.error("Failed to update user profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
