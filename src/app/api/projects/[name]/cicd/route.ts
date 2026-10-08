import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Octokit } from '@octokit/rest';

function parseGitHubRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
  } catch (e) {
    console.error('Error parsing repo URL:', e);
  }
  return null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name: appName } = await context.params;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    // Get backend config
    let autoCicd = false;
    try {
      const res = await fetch(`${baseUrl}/api/apps/${appName}/config`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.data && typeof data.data.auto_cicd === 'boolean') {
          autoCicd = data.data.auto_cicd;
        } else if (data && typeof data.auto_cicd === 'boolean') {
          autoCicd = data.auto_cicd;
        }
      }
    } catch (e) {
      console.error(`Error fetching backend config for ${appName}:`, e);
    }

    // Check user github token and project
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubToken: true, githubUsername: true },
    });

    const project = await prisma.project.findFirst({
      where: { app_name: appName },
    });

    const hasGithubToken = Boolean(user?.githubToken);
    const targetWebhookUrl = `${baseUrl}/api/webhooks/github/${appName}`;

    // If project has auto_cicd as false in database, always enforce false and sync backend
    if (project && !project.auto_cicd) {
      if (autoCicd) {
        autoCicd = false;
        fetch(`${baseUrl}/api/apps/${appName}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auto_cicd: false }),
        }).catch(() => {});
      }
    } else if (project?.auto_cicd && user?.githubToken && project?.repo_url) {
      // If user enabled auto_cicd, verify real webhook status on GitHub
      const repoInfo = parseGitHubRepoUrl(project.repo_url);
      if (repoInfo) {
        try {
          const octokit = new Octokit({ auth: user.githubToken });
          const { data: webhooks } = await octokit.rest.repos.listWebhooks({
            owner: repoInfo.owner,
            repo: repoInfo.repo,
          });
          const hasActiveHook = webhooks.some(
            (h: any) => h.config?.url === targetWebhookUrl && h.active
          );

          if (!hasActiveHook) {
            autoCicd = false;
            fetch(`${baseUrl}/api/apps/${appName}/config`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ auto_cicd: false }),
            }).catch(() => {});
            await prisma.project.update({
              where: { id: project.id },
              data: { auto_cicd: false },
            }).catch(() => {});
          } else {
            autoCicd = true;
          }
        } catch (e) {
          // If token doesn't have permissions, respect database auto_cicd
        }
      }
    }

    return NextResponse.json({
      success: true,
      auto_cicd: autoCicd,
      hasGithubToken,
      githubUsername: user?.githubUsername || null,
    });
  } catch (error) {
    console.error('Failed to get CI/CD state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name: appName } = await context.params;
    const body = await req.json();
    const { auto_cicd } = body;

    if (typeof auto_cicd !== 'boolean') {
      return NextResponse.json({ error: 'auto_cicd must be a boolean' }, { status: 400 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');
    const targetWebhookUrl = `${baseUrl}/api/webhooks/github/${appName}`;

    // 1. Update backend config first
    const backendRes = await fetch(`${baseUrl}/api/apps/${appName}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_cicd }),
    });

    if (!backendRes.ok) {
      const errData = await backendRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.detail || errData.message || 'Không thể cập nhật cấu hình trên máy chủ' },
        { status: backendRes.status }
      );
    }

    // 2. Automate GitHub Webhook via User's GitHub Token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubToken: true, githubUsername: true },
    });

    const project = await prisma.project.findFirst({
      where: { app_name: appName },
    });

    if (project) {
      await prisma.project.update({
        where: { id: project.id },
        data: { auto_cicd },
      }).catch((e) => console.error('Failed to update project auto_cicd:', e));
    }

    let webhookSynced = false;
    let githubNotice = '';

    if (!user?.githubToken) {
      githubNotice = 'Chưa liên kết GitHub Token tại trang Profile. Webhook chưa được tự động đăng ký lên GitHub.';
    } else if (!project?.repo_url) {
      githubNotice = 'Không tìm thấy thông tin GitHub repository của dự án.';
    } else {
      const repoInfo = parseGitHubRepoUrl(project.repo_url);
      if (!repoInfo) {
        githubNotice = `Không thể phân tích owner/repo từ URL: ${project.repo_url}`;
      } else {
        const { owner, repo } = repoInfo;
        try {
          const octokit = new Octokit({ auth: user.githubToken });

          // List current webhooks
          const { data: webhooks } = await octokit.rest.repos.listWebhooks({
            owner,
            repo,
          });

          const existingHook = webhooks.find((hook: any) => {
            return hook.config?.url === targetWebhookUrl;
          });

          if (auto_cicd) {
            // Enable webhook
            if (existingHook) {
              if (!existingHook.active) {
                await octokit.rest.repos.updateWebhook({
                  owner,
                  repo,
                  hook_id: existingHook.id,
                  active: true,
                });
              }
            } else {
              await octokit.rest.repos.createWebhook({
                owner,
                repo,
                name: 'web',
                active: true,
                events: ['push'],
                config: {
                  url: targetWebhookUrl,
                  content_type: 'json',
                  insecure_ssl: '0',
                },
              });
            }
            webhookSynced = true;
          } else {
            // Disable webhook
            if (existingHook && existingHook.active) {
              await octokit.rest.repos.updateWebhook({
                owner,
                repo,
                hook_id: existingHook.id,
                active: false,
              });
            }
            webhookSynced = true;
          }
        } catch (githubErr: any) {
          console.error('GitHub Webhook automated sync error:', githubErr);
          if (githubErr.status === 404 || githubErr.status === 403) {
            githubNotice = `Không thể tự cài Webhook lên repo ${owner}/${repo} (Token không có quyền quản trị hoặc repo thuộc tài khoản khác).`;
          } else {
            githubNotice = `Lỗi đồng bộ GitHub: ${githubErr.message || 'Không xác định'}`;
          }
        }
      }
    }

    let message = auto_cicd
      ? 'Đã kích hoạt Auto Deploy (Webhook).'
      : 'Đã tắt Auto Deploy (Webhook).';

    if (webhookSynced && auto_cicd) {
      message = 'Đã kích hoạt Auto Deploy và tự động cài đặt Webhook trên GitHub thành công!';
    } else if (webhookSynced && !auto_cicd) {
      message = 'Đã tắt Auto Deploy và hủy kích hoạt Webhook trên GitHub.';
    } else if (githubNotice) {
      message = `${message} (${githubNotice})`;
    }

    return NextResponse.json({
      success: true,
      auto_cicd,
      webhookSynced,
      message,
      hasGithubToken: Boolean(user?.githubToken),
    });
  } catch (error) {
    console.error('Failed to update CI/CD state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
