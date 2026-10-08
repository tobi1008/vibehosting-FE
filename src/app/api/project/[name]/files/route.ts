import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Octokit } from '@octokit/rest';
import { parseGitHubRepoUrl, buildTreeFromPaths, stagedProjectFiles } from '@/lib/projectFiles';
import { getOrRefreshUserGithubToken } from '@/lib/githubToken';

// Helper to fetch git tree items from a GitHub repo
async function fetchRepoTreeItems(
  octokit: Octokit,
  repoUrl: string,
  prefix: string = ''
): Promise<Array<{ path: string; type: 'blob' | 'tree'; size?: number }>> {
  const repoInfo = parseGitHubRepoUrl(repoUrl);
  if (!repoInfo) return [];

  let defaultBranch = 'main';
  try {
    const { data: repoData } = await octokit.rest.repos.get({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
    });
    defaultBranch = repoData.default_branch || 'main';
  } catch (e) {
    // default to main
  }

  let treeData: any[] = [];
  try {
    const { data } = await octokit.rest.git.getTree({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      tree_sha: defaultBranch,
      recursive: 'true',
    });
    treeData = data.tree || [];
  } catch (treeErr: any) {
    if (treeErr.status === 404 && defaultBranch === 'main') {
      const { data } = await octokit.rest.git.getTree({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        tree_sha: 'master',
        recursive: 'true',
      });
      treeData = data.tree || [];
    } else {
      throw treeErr;
    }
  }

  const cleanPrefix = prefix ? (prefix.endsWith('/') ? prefix : `${prefix}/`) : '';

  return treeData
    .filter((item: any) => item.path && item.type)
    .map((item: any) => ({
      path: `${cleanPrefix}${item.path}`,
      type: (item.type === 'tree' ? 'tree' : 'blob') as 'blob' | 'tree',
      size: item.size,
    }));
}

export async function GET(
  req: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name: appName } = await context.params;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    // 1. Try to proxy to remote backend endpoint first (http://116.118.50.199:8080/api/...)
    try {
      let backendRes = await fetch(`${baseUrl}/api/project/${appName}/files`, { cache: 'no-store' });
      if (!backendRes.ok && backendRes.status === 404) {
        backendRes = await fetch(`${baseUrl}/api/projects/${appName}/files`, { cache: 'no-store' });
      }
      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }
    } catch (e) {
      // Backend not reached or not implementing this endpoint yet, proceed to GitHub fallback
    }

    // 2. Fallback: Fetch directly from GitHub repository (supports 2 repos: FE & BE)
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

    if (!project) {
      return NextResponse.json(
        { error: 'Không tìm thấy dự án trong cơ sở dữ liệu' },
        { status: 404 }
      );
    }

    const octokit = new Octokit({
      auth: userGithubToken || undefined,
    });

    let items: Array<{ path: string; type: 'blob' | 'tree'; size?: number }> = [];

    const isFullstackTwoRepo =
      (project.arch_type === 'fullstack' || Boolean(project.fe_repo_url && project.be_repo_url)) &&
      project.fe_repo_url &&
      project.be_repo_url &&
      project.fe_repo_url !== project.be_repo_url;

    if (isFullstackTwoRepo && project.fe_repo_url && project.be_repo_url) {
      // Fetch both Frontend and Backend repos and namespace them into frontend/ and backend/
      const [feItems, beItems] = await Promise.all([
        fetchRepoTreeItems(octokit, project.fe_repo_url, 'frontend').catch((err) => {
          console.error('Error fetching FE repo tree:', err);
          return [];
        }),
        fetchRepoTreeItems(octokit, project.be_repo_url, 'backend').catch((err) => {
          console.error('Error fetching BE repo tree:', err);
          return [];
        }),
      ]);

      items = [...feItems, ...beItems];
    } else {
      // Single repo or monorepo
      const repoUrl = project.repo_url || project.fe_repo_url || project.be_repo_url;
      if (!repoUrl) {
        return NextResponse.json(
          { error: 'Không tìm thấy thông tin repository của dự án' },
          { status: 404 }
        );
      }
      items = await fetchRepoTreeItems(octokit, repoUrl, '');
    }

    // Check if there are staged local files that were added/edited
    const staged = stagedProjectFiles[appName] || {};
    for (const stagedPath of Object.keys(staged)) {
      if (!items.some((i) => i.path === stagedPath)) {
        items.push({
          path: stagedPath,
          type: 'blob',
          size: staged[stagedPath].length,
        });
      }
    }

    const tree = buildTreeFromPaths(items);
    return NextResponse.json({
      status: 'success',
      tree,
    });
  } catch (error: any) {
    console.error('Failed to get project files:', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Không thể tải danh sách tập tin mã nguồn từ kho lưu trữ',
      },
      { status: 500 }
    );
  }
}
