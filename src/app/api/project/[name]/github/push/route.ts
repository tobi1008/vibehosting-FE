import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Octokit } from '@octokit/rest';
import { parseGitHubRepoUrl, stagedProjectFiles } from '@/lib/projectFiles';
import { getOrRefreshUserGithubToken, saveUserGithubTokens } from '@/lib/githubToken';

// Helper to detect environment/secret files that should NEVER be committed to git
function isEnvSecretFile(filePath: string): boolean {
  const clean = filePath.replace(/^\/+/, '').toLowerCase();
  const basename = clean.split('/').pop() || '';
  if (
    basename.includes('.example') ||
    basename.includes('.sample') ||
    basename.includes('.template')
  ) {
    return false;
  }
  return basename === '.env' || basename.startsWith('.env.');
}

// Helper to push a set of files to a GitHub repository under authenticated user's account
async function pushFilesToRepo({
  octokit,
  repoUrl,
  customRepoName,
  targetBranch = 'main',
  files,
  commitMessage,
  authUser,
  componentName = 'code',
}: {
  octokit: Octokit;
  repoUrl: string;
  customRepoName?: string;
  targetBranch?: string;
  files: Record<string, string>;
  commitMessage: string;
  authUser: any;
  componentName?: string;
}): Promise<{
  component: string;
  status: string;
  repo_url: string;
  branch: string;
  owner: string;
  message: string;
  commit_sha?: string;
}> {
  const repoInfo = parseGitHubRepoUrl(repoUrl);
  const originalRepo = repoInfo ? repoInfo.repo : 'project-repo';

  // If user specified customRepoName, use it; otherwise use original repo name
  const targetRepo = customRepoName ? customRepoName.trim() : originalRepo;
  const targetOwner = authUser.login;
  const finalBranch = targetBranch.trim() || 'main';

  // 1. Ensure target repo exists on user's account
  let repoExists = false;
  try {
    const { data: existingRepo } = await octokit.rest.repos.get({
      owner: targetOwner,
      repo: targetRepo,
    });
    repoExists = Boolean(existingRepo.id);
  } catch (e) {
    repoExists = false;
  }

  if (!repoExists) {
    // Try to fork from original repo if available, or create new repository
    let forked = false;
    if (repoInfo && repoInfo.owner.toLowerCase() !== targetOwner.toLowerCase()) {
      try {
        await octokit.rest.repos.createFork({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          name: targetRepo,
        });
        forked = true;
        // Wait for GitHub to initialize fork
        await new Promise((resolve) => setTimeout(resolve, 2500));
      } catch (forkErr) {
        forked = false;
      }
    }

    if (!forked) {
      // Create new repo directly
      try {
        await octokit.rest.repos.createForAuthenticatedUser({
          name: targetRepo,
          auto_init: true,
          description: `Vibe Hosting repository for ${targetRepo}`,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (createErr: any) {
        throw new Error(
          `Không thể tạo repository ${targetOwner}/${targetRepo} trên GitHub: ${createErr?.message}`
        );
      }
    }
  }

  // 2. Identify default branch & current ref
  let refSha = '';
  try {
    const { data: refData } = await octokit.rest.git.getRef({
      owner: targetOwner,
      repo: targetRepo,
      ref: `heads/${finalBranch}`,
    });
    refSha = refData.object.sha;
  } catch (refErr: any) {
    // If targetBranch (e.g. main) does not exist yet, try to find master or default branch
    let fallbackBranch = 'master';
    try {
      const { data: targetRepoData } = await octokit.rest.repos.get({
        owner: targetOwner,
        repo: targetRepo,
      });
      fallbackBranch = targetRepoData.default_branch || 'master';
    } catch (e) {
      fallbackBranch = 'master';
    }

    try {
      const { data: fallbackRef } = await octokit.rest.git.getRef({
        owner: targetOwner,
        repo: targetRepo,
        ref: `heads/${fallbackBranch}`,
      });
      refSha = fallbackRef.object.sha;

      // Create target branch ref
      try {
        await octokit.rest.git.createRef({
          owner: targetOwner,
          repo: targetRepo,
          ref: `refs/heads/${finalBranch}`,
          sha: refSha,
        });
      } catch (createRefErr) {
        // ref might already exist
      }
    } catch (e) {
      // Empty repo without commits
    }
  }

  // 3. Base tree SHA
  let baseTreeSha: string | undefined = undefined;
  if (refSha) {
    try {
      const { data: baseCommit } = await octokit.rest.git.getCommit({
        owner: targetOwner,
        repo: targetRepo,
        commit_sha: refSha,
      });
      baseTreeSha = baseCommit.tree.sha;
    } catch (e) {
      baseTreeSha = undefined;
    }
  }

  let targetTreeSha = baseTreeSha;
  const fileKeys = Object.keys(files);

  // 4. Create blobs and tree
  if (fileKeys.length > 0) {
    const rawItems = await Promise.all(
      fileKeys.map(async (rawFilePath) => {
        // GitHub Git Trees API requires path to NOT start with a slash
        const cleanPath = rawFilePath.replace(/^\/+/, '').trim();
        // Never push secret env files to GitHub (violates GitHub Secret Scanning)
        if (!cleanPath || isEnvSecretFile(cleanPath)) return null;

        const fileContent = files[rawFilePath];
        try {
          const { data: blob } = await octokit.rest.git.createBlob({
            owner: targetOwner,
            repo: targetRepo,
            content: Buffer.from(fileContent).toString('base64'),
            encoding: 'base64',
          });
          return {
            path: cleanPath,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        } catch (blobErr: any) {
          const errorMsg =
            blobErr?.response?.data?.message || blobErr?.message || '';
          console.error(`[PUSH] createBlob failed for "${cleanPath}":`, errorMsg);
          if (
            errorMsg.includes('Secret detected') ||
            errorMsg.includes('Repository rule violations') ||
            blobErr?.status === 422
          ) {
            throw new Error(
              `GitHub Secret Scanning từ chối tập tin "${cleanPath}" vì phát hiện có chứa Secret / Token bí mật (ví dụ: OpenAI API Key, Private Key, PAT). Vui lòng xóa Secret khỏi file (sử dụng GitHub Secrets) trước khi push.`
            );
          }
          throw blobErr;
        }
      })
    );

    const treeItems = rawItems.filter(Boolean) as Array<{
      path: string;
      mode: '100644';
      type: 'blob';
      sha: string;
    }>;

    if (treeItems.length > 0) {
      const { data: newTree } = await octokit.rest.git.createTree({
        owner: targetOwner,
        repo: targetRepo,
        base_tree: baseTreeSha,
        tree: treeItems,
      });

      targetTreeSha = newTree.sha;
    }
  }

  const finalCommitMessage = commitMessage.trim() || 'fix(code): update via Vibe Hosting File Manager';

  // 5. Create commit
  const commitParams: any = {
    owner: targetOwner,
    repo: targetRepo,
    message: finalCommitMessage,
    tree: targetTreeSha || '',
  };
  if (refSha) {
    commitParams.parents = [refSha];
  }

  const { data: newCommit } = await octokit.rest.git.createCommit(commitParams);

  // 6. Update reference
  try {
    await octokit.rest.git.updateRef({
      owner: targetOwner,
      repo: targetRepo,
      ref: `heads/${finalBranch}`,
      sha: newCommit.sha,
      force: true,
    });
  } catch (updateErr) {
    await octokit.rest.git.createRef({
      owner: targetOwner,
      repo: targetRepo,
      ref: `refs/heads/${finalBranch}`,
      sha: newCommit.sha,
    });
  }

  const finalRepoUrl = `https://github.com/${targetOwner}/${targetRepo}`;
  const displayComp = componentName === 'be' || componentName === 'backend' ? 'BACKEND' : componentName === 'fe' || componentName === 'frontend' ? 'FRONTEND' : 'PROJECT';

  return {
    component: componentName === 'be' ? 'backend' : componentName === 'fe' ? 'frontend' : componentName,
    status: 'success',
    repo_url: finalRepoUrl,
    branch: finalBranch,
    owner: targetOwner,
    message: `[${displayComp}] Đã chuyển remote và push thành công lên ${finalRepoUrl} (nhánh ${finalBranch})`,
    commit_sha: newCommit.sha,
  };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name: appName } = await context.params;
    const body = await req.json();
    const {
      githubToken,
      commitMessage = 'Update via Vibe Hosting File Manager',
      repoName,
      targetBranch = 'main',
      component = '',
      autoRebuild = true,
      files,
    } = body;

    let activeToken = (typeof githubToken === 'string' && githubToken.trim().length > 0) ? githubToken.trim() : null;

    if (!activeToken) {
      const session = await getServerSession(authOptions);
      const userId = (session?.user as any)?.id;
      if (userId) {
        const tokenInfo = await getOrRefreshUserGithubToken(userId);
        if (tokenInfo?.token) {
          activeToken = tokenInfo.token;
        }
      }
    }

    if (!activeToken) {
      return NextResponse.json(
        { error: 'GitHub Token là bắt buộc để đẩy code lên GitHub. Vui lòng kết nối tài khoản GitHub hoặc nhập PAT.' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    // 1. Try remote Backend API endpoint first
    try {
      let backendRes = await fetch(`${baseUrl}/api/project/${appName}/github/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubToken: activeToken,
          commitMessage,
          repoName,
          targetBranch,
          component,
          autoRebuild,
          files,
        }),
      });

      if (!backendRes.ok && backendRes.status === 404) {
        backendRes = await fetch(`${baseUrl}/api/projects/${appName}/github/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            githubToken: activeToken,
            commitMessage,
            repoName,
            targetBranch,
            component,
            autoRebuild,
            files,
          }),
        });
      }

      if (backendRes.status !== 404) {
        const rawText = await backendRes.text();
        let data: any = null;
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }

        if (backendRes.ok && data) {
          delete stagedProjectFiles[appName];

          // Sync database with updated repo URLs returned by Backend
          if (Array.isArray(data.results)) {
            for (const r of data.results) {
              if (r.repo_url) {
                if (r.component === 'backend' || r.component === 'be') {
                  await prisma.project.updateMany({
                    where: { app_name: appName },
                    data: { be_repo_url: r.repo_url, repo_url: r.repo_url },
                  }).catch(() => {});
                } else if (r.component === 'frontend' || r.component === 'fe') {
                  await prisma.project.updateMany({
                    where: { app_name: appName },
                    data: { fe_repo_url: r.repo_url },
                  }).catch(() => {});
                } else {
                  await prisma.project.updateMany({
                    where: { app_name: appName },
                    data: { repo_url: r.repo_url },
                  }).catch(() => {});
                }
              }
            }
          }

          return NextResponse.json(data);
        } else {
          // Forward backend error response
          const errorMsg =
            data?.detail ||
            data?.message ||
            data?.error ||
            (backendRes.status === 401
              ? 'Token không hợp lệ hoặc thiếu quyền "repo"'
              : `Máy chủ Backend trả về lỗi (${backendRes.status}): ${rawText.slice(0, 150)}`);
          return NextResponse.json({ error: errorMsg }, { status: backendRes.status });
        }
      }
    } catch (e) {
      // Backend not reached or returned 404, fallback to Octokit implementation
    }

    // 2. Direct GitHub Push Fallback Implementation
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (userId) {
      saveUserGithubTokens(userId, { accessToken: activeToken }).catch(() => {});
    }

    const project = await prisma.project.findFirst({
      where: { app_name: appName },
    });

    if (!project) {
      return NextResponse.json({ error: 'Không tìm thấy thông tin dự án' }, { status: 404 });
    }

    const octokit = new Octokit({ auth: activeToken });

    // Validate token and fetch user identity
    let authUser: any;
    try {
      const { data } = await octokit.rest.users.getAuthenticated();
      authUser = data;
    } catch (authErr: any) {
      return NextResponse.json(
        {
          error:
            'GitHub Token không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại token có quyền "repo".',
        },
        { status: 401 }
      );
    }

    const staged: Record<string, string> = {};
    if (stagedProjectFiles[appName]) {
      for (const [k, v] of Object.entries(stagedProjectFiles[appName])) {
        const clean = k.replace(/^\/+/, '').trim();
        if (isEnvSecretFile(clean)) {
          // Purge secret env files from memory cache so they are never committed to git
          delete stagedProjectFiles[appName][k];
        } else if (clean) {
          staged[clean] = v;
        }
      }
    }

    // Merge files directly sent from editor (skip .env secret files)
    if (Array.isArray(files)) {
      for (const f of files) {
        if (f && f.path && typeof f.content === 'string') {
          const clean = f.path.replace(/^\/+/, '').trim();
          if (clean && !isEnvSecretFile(clean)) {
            staged[clean] = f.content;
            if (!stagedProjectFiles[appName]) stagedProjectFiles[appName] = {};
            stagedProjectFiles[appName][clean] = f.content;
          }
        }
      }
    }

    const isFullstackTwoRepo =
      (project.arch_type === 'fullstack' || Boolean(project.fe_repo_url && project.be_repo_url)) &&
      project.fe_repo_url &&
      project.be_repo_url &&
      project.fe_repo_url !== project.be_repo_url;

    const results: Array<{
      component: string;
      status: string;
      repo_url: string;
      branch: string;
      owner: string;
      message: string;
    }> = [];

    if (isFullstackTwoRepo && project.fe_repo_url && project.be_repo_url) {
      const feFiles: Record<string, string> = {};
      const beFiles: Record<string, string> = {};

      for (const [filePath, content] of Object.entries(staged)) {
        const cleanPath = filePath.replace(/^\/+/, '').trim();
        if (!cleanPath) continue;

        if (cleanPath.startsWith('frontend/')) {
          const rel = cleanPath.replace(/^frontend\//, '').replace(/^\/+/, '');
          if (rel) feFiles[rel] = content;
        } else if (cleanPath.startsWith('backend/')) {
          const rel = cleanPath.replace(/^backend\//, '').replace(/^\/+/, '');
          if (rel) beFiles[rel] = content;
        } else {
          // Put root files in both or target
          if (component === 'fe') feFiles[cleanPath] = content;
          else if (component === 'be') beFiles[cleanPath] = content;
          else {
            feFiles[cleanPath] = content;
            beFiles[cleanPath] = content;
          }
        }
      }

      // Check which components to push
      const shouldPushBe = component === '' || component === 'be';
      const shouldPushFe = component === '' || component === 'fe';

      if (shouldPushBe) {
        const beRepoName = repoName || parseGitHubRepoUrl(project.be_repo_url)?.repo;
        const res = await pushFilesToRepo({
          octokit,
          repoUrl: project.be_repo_url,
          customRepoName: beRepoName,
          targetBranch,
          files: beFiles,
          commitMessage,
          authUser,
          componentName: 'backend',
        });
        results.push(res);
        await prisma.project
          .update({
            where: { id: project.id },
            data: { be_repo_url: res.repo_url },
          })
          .catch(() => {});
      }

      if (shouldPushFe) {
        const feRepoName = repoName ? `${repoName}_FE` : parseGitHubRepoUrl(project.fe_repo_url)?.repo;
        const res = await pushFilesToRepo({
          octokit,
          repoUrl: project.fe_repo_url,
          customRepoName: feRepoName,
          targetBranch,
          files: feFiles,
          commitMessage,
          authUser,
          componentName: 'frontend',
        });
        results.push(res);
        await prisma.project
          .update({
            where: { id: project.id },
            data: { fe_repo_url: res.repo_url },
          })
          .catch(() => {});
      }
    } else {
      // Single repo or Monorepo
      const repoUrl = project.repo_url || project.fe_repo_url || project.be_repo_url;
      if (!repoUrl) {
        return NextResponse.json({ error: 'Không tìm thấy repository của dự án' }, { status: 404 });
      }

      const res = await pushFilesToRepo({
        octokit,
        repoUrl,
        customRepoName: repoName,
        targetBranch,
        files: staged,
        commitMessage,
        authUser,
        componentName: 'backend',
      });
      results.push(res);

      await prisma.project
        .update({
          where: { id: project.id },
          data: { repo_url: res.repo_url },
        })
        .catch(() => {});
    }

    // Clear staged files on successful push
    delete stagedProjectFiles[appName];

    if (autoRebuild) {
      try {
        fetch(`${baseUrl}/api/apps/${appName}/redeploy`, { method: 'POST' }).catch(() => {});
      } catch (e) {}
    }

    const mainMessage =
      results.length === 1
        ? results[0].message
        : `Đã chuyển remote và push thành công lên ${results.map((r) => r.repo_url).join(' và ')}`;

    return NextResponse.json({
      status: 'success',
      user: authUser.login,
      rebuild_triggered: Boolean(autoRebuild),
      results,
      message: mainMessage,
    });
  } catch (error: any) {
    console.error('Failed to push to GitHub:', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Không thể đẩy code lên GitHub. Vui lòng kiểm tra lại quyền hạn của GitHub Token.',
      },
      { status: 500 }
    );
  }
}
