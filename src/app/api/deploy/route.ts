import { NextResponse } from 'next/server';
import { backendFetch, requireAppNameAvailable } from '@/lib/backend';

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
    const body = await req.json();

    const guard = await requireAppNameAvailable(String(body?.app_name || '').trim());
    if (guard instanceof NextResponse) return guard;

    // Bảo mật: Nếu repo là Public, loại bỏ token để bảo vệ an toàn, tránh lộ token
    if (body?.repo_url && body?.github_token) {
      const publicRepo = await isRepoPublic(body.repo_url);
      if (publicRepo) {
        console.log(`[Security] Repo ${body.repo_url} is public. Removed github_token to protect user credentials.`);
        delete body.github_token;
      }
    }

    const res = await backendFetch(`/api/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { status: res.statusText }, { status: res.status });
  } catch (err: any) {
    console.error('Error proxying deploy:', err);
    return NextResponse.json(
      { status: 'error', detail: `Lỗi kết nối máy chủ deploy: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
