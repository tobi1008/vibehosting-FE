import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backendFetch } from '@/lib/backend';

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    let userId = (session?.user as any)?.id;

    if (!userId && session?.user) {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(session.user.email ? [{ email: session.user.email }] : []),
            ...(session.user.name ? [{ username: session.user.name }] : []),
          ],
        },
      });
      if (dbUser) userId = dbUser.id;
    }

    return userId || null;
  } catch (err) {
    console.error("Error resolving authenticated user:", err);
    return null;
  }
}

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Format response to match Project interface (createdAt as epoch milliseconds)
    const formatted = projects.map((p) => ({
      id: p.id,
      app_name: p.app_name,
      repo_url: p.repo_url,
      app_domain: p.app_domain,
      status: p.status,
      arch_type: p.arch_type,
      db_type: p.db_type,
      be_repo_url: p.be_repo_url,
      fe_repo_url: p.fe_repo_url,
      be_domain: p.be_domain,
      fe_domain: p.fe_domain,
      auto_cicd: p.auto_cicd,
      createdAt: new Date(p.createdAt).getTime(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      app_name,
      repo_url,
      app_domain,
      status,
      arch_type,
      db_type,
      be_repo_url,
      fe_repo_url,
      be_domain,
      fe_domain,
    } = body;

    const resolvedRepoUrl = repo_url || fe_repo_url || be_repo_url;
    const resolvedDomain = app_domain || fe_domain || be_domain;

    if (!app_name || !resolvedRepoUrl || !resolvedDomain) {
      return NextResponse.json(
        { error: "Missing required fields: app_name, repo_url/fe_repo_url, app_domain/fe_domain" },
        { status: 400 }
      );
    }

    // Tên app là định danh duy nhất trên K3s, không cho trùng với app của người khác
    const takenByOther = await prisma.project.findFirst({
      where: { app_name, NOT: { userId } },
      select: { id: true },
    });
    if (takenByOther) {
      return NextResponse.json({ error: "Tên ứng dụng đã được người khác sử dụng" }, { status: 409 });
    }

    // Check if project already exists for this user, if so update it
    const existing = await prisma.project.findFirst({
      where: { app_name, userId },
    });

    let record;
    if (existing) {
      record = await prisma.project.update({
        where: { id: existing.id },
        data: {
          repo_url: resolvedRepoUrl,
          app_domain: resolvedDomain,
          status: status || existing.status,
          arch_type: arch_type || existing.arch_type,
          db_type: db_type || existing.db_type,
          be_repo_url: be_repo_url || existing.be_repo_url,
          fe_repo_url: fe_repo_url || existing.fe_repo_url,
          be_domain: be_domain || existing.be_domain,
          fe_domain: fe_domain || existing.fe_domain,
        },
      });
    } else {
      record = await prisma.project.create({
        data: {
          app_name,
          repo_url: resolvedRepoUrl,
          app_domain: resolvedDomain,
          status: status || "deploying",
          arch_type: arch_type || "web_only",
          db_type: db_type || null,
          be_repo_url: be_repo_url || null,
          fe_repo_url: fe_repo_url || null,
          be_domain: be_domain || null,
          fe_domain: fe_domain || null,
          auto_cicd: false,
          userId,
        },
      });

      // Default auto_cicd to false on backend config for newly created projects
      try {
        backendFetch(`/api/apps/${app_name}/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auto_cicd: false }),
        }).catch((e) => console.error("Failed to default auto_cicd on backend:", e));
      } catch (e) {
        console.error("Backend config sync error:", e);
      }
    }

    return NextResponse.json(
      {
        id: record.id,
        app_name: record.app_name,
        repo_url: record.repo_url,
        app_domain: record.app_domain,
        status: record.status,
        arch_type: record.arch_type,
        db_type: record.db_type,
        be_repo_url: record.be_repo_url,
        fe_repo_url: record.fe_repo_url,
        be_domain: record.be_domain,
        fe_domain: record.fe_domain,
        auto_cicd: record.auto_cicd,
        createdAt: new Date(record.createdAt).getTime(),
      },
      { status: existing ? 200 : 201 }
    );
  } catch (error: any) {
    console.error("Failed to create or update project:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Ensure the project belongs to the user
    const existing = await prisma.project.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, app_name, status } = body;

    if ((!id && !app_name) || !status) {
      return NextResponse.json({ error: "id or app_name, and status are required" }, { status: 400 });
    }

    const existing = await prisma.project.findFirst({
      where: id ? { id, userId } : { app_name, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const updated = await prisma.project.update({
      where: { id: existing.id },
      data: { status },
    });

    return NextResponse.json({
      id: updated.id,
      app_name: updated.app_name,
      repo_url: updated.repo_url,
      app_domain: updated.app_domain,
      status: updated.status,
      createdAt: new Date(updated.createdAt).getTime(),
    });
  } catch (error) {
    console.error("Failed to update project status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
