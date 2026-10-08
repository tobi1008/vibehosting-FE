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

    const formData = await req.formData();

    // Bảo mật: Kiểm tra nếu cả BE repo và FE repo đều là Public
    const beRepo = formData.get('be_repo_url') as string;
    const feRepo = formData.get('fe_repo_url') as string;
    if (formData.has('github_token')) {
      const bePublic = await isRepoPublic(beRepo);
      const fePublic = feRepo ? await isRepoPublic(feRepo) : true;
      if (bePublic && fePublic) {
        console.log(`[Security] Fullstack repos are public. Removed github_token from FormData.`);
        formData.delete('github_token');
      }
    }

    const res = await fetch(`${baseUrl}/api/deploy-fullstack`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { status: res.statusText }, { status: res.status });
  } catch (err: any) {
    console.error('Error proxying deploy-fullstack:', err);
    return NextResponse.json(
      { status: 'error', detail: `Lỗi kết nối máy chủ deploy: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
