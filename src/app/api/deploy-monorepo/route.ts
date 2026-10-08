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

    // Bảo mật: Nếu repo là Public, loại bỏ token để bảo vệ an toàn
    if (body?.repo_url && body?.github_token) {
      const publicRepo = await isRepoPublic(body.repo_url);
      if (publicRepo) {
        console.log(`[Security] Repo ${body.repo_url} is public. Removed github_token.`);
        delete body.github_token;
      }
    }

    const res = await fetch(`${baseUrl}/api/deploy-monorepo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { status: res.statusText }, { status: res.status });
  } catch (err: any) {
    console.error('Error proxying deploy-monorepo:', err);
    return NextResponse.json(
      { status: 'error', detail: `Lỗi kết nối máy chủ deploy: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
