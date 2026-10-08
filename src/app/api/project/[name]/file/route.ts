import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Octokit } from '@octokit/rest';
import { parseGitHubRepoUrl, stagedProjectFiles, isBinaryFile } from '@/lib/projectFiles';
import { getOrRefreshUserGithubToken } from '@/lib/githubToken';

export async function GET(
  req: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name: appName } = await context.params;
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ status: 'error', error: 'Missing path query parameter' }, { status: 400 });
    }

    // Check if binary file format
    if (isBinaryFile(filePath)) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Định dạng file không hỗ trợ xem hoặc chỉnh sửa trực tiếp',
          is_binary: true,
          path: filePath,
        },
        { status: 400 }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    // 1. Check if file is currently staged / modified in memory
    if (stagedProjectFiles[appName] && filePath in stagedProjectFiles[appName]) {
      return NextResponse.json({
        status: 'success',
        content: stagedProjectFiles[appName][filePath],
        path: filePath,
      });
    }

    // 2. Try proxying to remote backend (http://116.118.50.199:8080/api/...)
    try {
      let backendRes = await fetch(
        `${baseUrl}/api/project/${appName}/file?path=${encodeURIComponent(filePath)}`,
        { cache: 'no-store' }
      );
      if (!backendRes.ok && backendRes.status === 404) {
        backendRes = await fetch(
          `${baseUrl}/api/projects/${appName}/file?path=${encodeURIComponent(filePath)}`,
          { cache: 'no-store' }
        );
      }
      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }
    } catch (e) {
      // Backend not reached, fall back to GitHub
    }

    // 3. Fallback: Fetch directly from GitHub repository
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    let userGithubToken: string | null = null;
    if (userId) {
      const tokenInfo = await getOrRefreshUserGithubToken(userId);
      userGithubToken = tokenInfo?.token || null;
    }

    const project = await prisma.project.findFirst({
      where: { app_name: appName },
    });

    let repoUrl = project?.repo_url || project?.be_repo_url || project?.fe_repo_url;
    let githubPath = filePath;

    const isFullstackTwoRepo =
      (project?.arch_type === 'fullstack' || Boolean(project?.fe_repo_url && project?.be_repo_url)) &&
      project?.fe_repo_url &&
      project?.be_repo_url &&
      project.fe_repo_url !== project.be_repo_url;

    if (isFullstackTwoRepo) {
      if (filePath.startsWith('frontend/')) {
        repoUrl = project!.fe_repo_url;
        githubPath = filePath.replace(/^frontend\//, '');
      } else if (filePath.startsWith('backend/')) {
        repoUrl = project!.be_repo_url;
        githubPath = filePath.replace(/^backend\//, '');
      }
    }

    if (!repoUrl) {
      return NextResponse.json({ error: 'Không tìm thấy repository của dự án' }, { status: 404 });
    }

    const repoInfo = parseGitHubRepoUrl(repoUrl);
    if (!repoInfo) {
      return NextResponse.json({ error: 'Repository URL không hợp lệ' }, { status: 400 });
    }

    const octokit = new Octokit({
      auth: userGithubToken || undefined,
    });

    const { data } = await octokit.rest.repos.getContent({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      path: githubPath,
    });

    if (Array.isArray(data)) {
      return NextResponse.json({ error: 'Đường dẫn là thư mục, không phải tập tin' }, { status: 400 });
    }

    if (data.type !== 'file') {
      return NextResponse.json({ error: 'Loại nội dung không hỗ trợ' }, { status: 400 });
    }

    // Decode base64 content
    let decodedContent = '';
    if (data.content && data.encoding === 'base64') {
      decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
    } else if (data.content) {
      decodedContent = data.content;
    }

    return NextResponse.json({
      status: 'success',
      content: decodedContent,
      path: filePath,
    });
  } catch (error: any) {
    console.error('Failed to get file content:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error?.message || 'Không thể đọc nội dung tập tin',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name: appName } = await context.params;
    const body = await req.json();
    const { path: filePath, content } = body;

    if (!filePath || typeof content !== 'string') {
      return NextResponse.json(
        { status: 'error', error: 'Missing path or content in request body' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    // 1. Save in staged memory cache
    if (!stagedProjectFiles[appName]) {
      stagedProjectFiles[appName] = {};
    }
    stagedProjectFiles[appName][filePath] = content;

    // 2. Try proxying PUT to remote backend if available
    try {
      let backendRes = await fetch(`${baseUrl}/api/project/${appName}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });
      if (!backendRes.ok && backendRes.status === 404) {
        backendRes = await fetch(`${baseUrl}/api/projects/${appName}/file`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, content }),
        });
      }
      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json({
          status: 'success',
          ...(typeof data === 'object' ? data : {}),
          message: data.message || `Đã lưu thay đổi cho tập tin ${filePath}`,
          path: filePath,
        });
      }
    } catch (e) {
      // Backend not running/ready, memory staging succeeded
    }

    return NextResponse.json({
      status: 'success',
      message: `Đã lưu thay đổi cho tập tin ${filePath}`,
      path: filePath,
    });
  } catch (error: any) {
    console.error('Failed to save file:', error);
    return NextResponse.json(
      { error: error?.message || 'Không thể lưu nội dung tập tin' },
      { status: 500 }
    );
  }
}
