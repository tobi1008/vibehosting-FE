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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    const formData = await req.formData();

    // Bảo mật: Nếu repo là Public, xóa token khỏi FormData
    const repoUrl = formData.get('repo_url') as string;
    if (repoUrl && formData.has('github_token')) {
      const publicRepo = await isRepoPublic(repoUrl);
      if (publicRepo) {
        console.log(`[Security] Repo ${repoUrl} is public. Removed github_token from FormData.`);
        formData.delete('github_token');
      }
    }

    const res = await fetch(`${baseUrl}/api/deploy-with-db`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { status: res.statusText }, { status: res.status });
  } catch (err: any) {
    console.error('Error proxying deploy-with-db:', err);
    return NextResponse.json(
      { status: 'error', detail: `Lỗi kết nối máy chủ deploy: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
