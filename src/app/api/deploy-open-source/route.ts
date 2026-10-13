import { NextResponse } from 'next/server';

async function isRepoPublic(repoUrl?: string | null): Promise<boolean> {
  if (!repoUrl) return false;
  try {
    const cleanUrl = repoUrl.trim().replace(/\.git$/, '');
    const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return false;
    const [, owner, repo] = match;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { 'User-Agent': 'VibeHosting' },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    const body = await req.json();

    // Chuẩn hóa payload theo đặc tả
    const payload: {
      repo_url: string;
      app_name: string;
      app_domain: string;
      db_type: string;
      ai_provider?: string;
      github_token?: string | null;
    } = {
      repo_url: body.repo_url?.trim() || '',
      app_name: body.app_name?.trim() || '',
      app_domain: body.app_domain?.trim() || '',
      db_type: body.db_type || 'mysql',
      ai_provider: body.ai_provider || 'agy',
      github_token: body.github_token?.trim() || null,
    };

    // Bảo mật: Nếu repo là Public, loại bỏ token để bảo vệ an toàn
    if (payload.repo_url && payload.github_token) {
      const publicRepo = await isRepoPublic(payload.repo_url);
      if (publicRepo) {
        console.log(`[Security] Repo ${payload.repo_url} is public. Removed github_token.`);
        payload.github_token = null;
      }
    }

    // Gửi yêu cầu tới backend POST /api/deploy-open-source
    const res = await fetch(`${baseUrl}/api/deploy-open-source`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { status: res.statusText }, { status: res.status });
  } catch (err: any) {
    console.error('Error proxying deploy-open-source:', err);
    return NextResponse.json(
      { status: 'error', detail: `Lỗi kết nối máy chủ deploy: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
