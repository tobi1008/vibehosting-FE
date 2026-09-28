import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, createImpersonateToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = (session?.user as any)?.id;
    const role = (session?.user as any)?.role;

    if (!session || role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const impersonateToken = createImpersonateToken(targetUser.id, currentUserId);

    return NextResponse.json({
      success: true,
      impersonateUserId: targetUser.id,
      impersonateToken,
      targetUsername: targetUser.username,
    });
  } catch (error) {
    console.error("Admin impersonate error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const isImpersonating = (session?.user as any)?.isImpersonating;
    const originalAdminId = (session?.user as any)?.originalAdminId;

    if (!session || !isImpersonating || !originalAdminId) {
      return NextResponse.json({ error: "Not currently in an impersonation session" }, { status: 400 });
    }

    const originalAdmin = await prisma.user.findUnique({ where: { id: originalAdminId } });
    if (!originalAdmin || originalAdmin.role !== "admin") {
      return NextResponse.json({ error: "Original admin account not found" }, { status: 404 });
    }

    const impersonateToken = createImpersonateToken(originalAdmin.id, originalAdmin.id);

    return NextResponse.json({
      success: true,
      impersonateUserId: originalAdmin.id,
      impersonateToken,
      adminUsername: originalAdmin.username,
    });
  } catch (error) {
    console.error("Revert impersonation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
