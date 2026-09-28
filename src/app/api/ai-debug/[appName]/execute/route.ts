import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseGitHubRepoUrl, stagedProjectFiles } from '@/lib/projectFiles';
import { Octokit } from '@octokit/rest';

async function getExistingProjectFile(appName: string, filePath: string): Promise<string | null> {
  try {
    if (stagedProjectFiles[appName] && stagedProjectFiles[appName][filePath]) {
      return stagedProjectFiles[appName][filePath];
    }
    const project = await prisma.project.findFirst({ where: { app_name: appName } });
    if (!project) return null;
    let repoUrl = project.repo_url || project.fe_repo_url || project.be_repo_url;
    if (!repoUrl) return null;

    let cleanPath = filePath;
    if (project.arch_type === 'fullstack' && project.fe_repo_url && project.be_repo_url) {
      if (filePath.startsWith('frontend/')) {
        repoUrl = project.fe_repo_url;
        cleanPath = filePath.replace(/^frontend\//, '');
      } else if (filePath.startsWith('backend/')) {
        repoUrl = project.be_repo_url;
        cleanPath = filePath.replace(/^backend\//, '');
      }
    }

    const repoInfo = parseGitHubRepoUrl(repoUrl);
    if (!repoInfo) return null;

    const octokit = new Octokit();
    const { data } = await octokit.rest.repos.getContent({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      path: cleanPath,
    });

    if (!Array.isArray(data) && data.type === 'file' && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ appName: string }> }
) {
  try {
    const { appName } = await context.params;
    const body = await req.json();
    const { actions = [] } = body;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    // Normalize actions so backend receives required path and content for edit_file
    const normalizedActions = await Promise.all(
      actions.map(async (act: any) => {
        const action = { ...act };

        if (action.action_type === 'edit_file') {
          let filePath =
            action.path ||
            action.file_path ||
            action.target_file ||
            action.file ||
            '';

          if (!filePath && action.description) {
            const match = action.description.match(
              /\b([\w./-]+\.(json|js|mjs|ts|tsx|env|yml|yaml|toml|sql|html|css|txt))\b/i
            );
            if (match) {
              filePath = match[1];
            }
          }

          let content =
            action.content ||
            action.file_content ||
            action.new_content ||
            action.code;

          // If content is not directly provided, check diff
          if (!content && action.diff) {
            const diffStr = String(action.diff).trim();
            const codeBlockMatch = diffStr.match(/```(?:\w+)?\n([\s\S]*?)```/);
            if (codeBlockMatch) {
              content = codeBlockMatch[1];
            } else if (diffStr.includes('\n+') || diffStr.startsWith('+')) {
              const lines = diffStr.split('\n');
              const addedLines = lines
                .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
                .map((l) => l.substring(1));
              if (addedLines.length > 0) {
                content = addedLines.join('\n');
              } else {
                content = diffStr;
              }
            } else {
              content = diffStr;
            }
          }

          // If content is STILL empty, inspect description and fetch existing file
          if (!content && filePath) {
            const existing = await getExistingProjectFile(appName, filePath);
            const desc = (action.description || '').toLowerCase();

            if (filePath.endsWith('package.json')) {
              try {
                const pkg = existing ? JSON.parse(existing) : { name: appName, version: '1.0.0' };
                if (
                  desc.includes('module') ||
                  desc.includes('type: module') ||
                  desc.includes('type": "module"')
                ) {
                  pkg.type = 'module';
                }
                if (desc.includes('server.mjs') || desc.includes('start')) {
                  pkg.scripts = pkg.scripts || {};
                  pkg.scripts.start = 'node server.mjs';
                }
                content = JSON.stringify(pkg, null, 2);
              } catch (e) {
                content = JSON.stringify(
                  { name: appName, type: 'module', scripts: { start: 'node server.mjs' } },
                  null,
                  2
                );
              }
            } else if (filePath.endsWith('server.mjs')) {
              const serverJs = (await getExistingProjectFile(appName, 'server.js')) || existing;
              if (serverJs) {
                content = serverJs
                  .replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, "import $1 from '$2';")
                  .replace(/module\.exports\s*=\s*/g, 'export default ');
              } else {
                content = `import http from 'http';\nconst PORT = process.env.PORT || 3000;\nhttp.createServer((req, res) => res.end('OK')).listen(PORT, () => console.log(\`Server on \${PORT}\`));\n`;
              }
            } else if (existing) {
              content = existing;
            } else {
              content = `// Updated by Hermes Agent for ${filePath}\n`;
            }
          }

          action.path = filePath;
          action.file_path = filePath;
          action.content = content || '';

          // Stage locally in memory so File Explorer reflects the changes
          if (filePath && action.content) {
            if (!stagedProjectFiles[appName]) stagedProjectFiles[appName] = {};
            stagedProjectFiles[appName][filePath] = action.content;
          }
        }
        return action;
      })
    );

    const backendRes = await fetch(`${baseUrl}/api/ai-debug/${appName}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actions: normalizedActions }),
    });

    const rawText = await backendRes.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (!backendRes.ok) {
      const errorMsg =
        data?.detail ||
        data?.message ||
        data?.error ||
        (backendRes.status === 500
          ? 'Máy chủ Backend gặp lỗi nội bộ (500 Internal Server Error) khi thực thi hành động trên cụm K8s. Vui lòng kiểm tra lại trạng thái Pod hoặc thử lại.'
          : `Máy chủ Backend trả về lỗi ${backendRes.status}: ${rawText.slice(0, 150)}`);
      return NextResponse.json({ error: errorMsg }, { status: backendRes.status });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Phản hồi từ máy chủ Backend không đúng định dạng JSON' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to execute AI Debug actions:', error);
    return NextResponse.json(
      { error: error?.message || 'Không thể kết nối đến máy chủ thực thi' },
      { status: 500 }
    );
  }
}
