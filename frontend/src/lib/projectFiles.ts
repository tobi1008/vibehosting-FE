// Global cache for staged file modifications per project
declare global {
  // eslint-disable-next-line no-var
  var __stagedProjectFiles: Record<string, Record<string, string>> | undefined;
}

if (!global.__stagedProjectFiles) {
  global.__stagedProjectFiles = {};
}

export const stagedProjectFiles = global.__stagedProjectFiles;

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}

export function parseGitHubRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
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

export function buildTreeFromPaths(
  items: Array<{ path: string; type: 'blob' | 'tree'; size?: number }>
): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const item of items) {
    const parts = item.path.split('/');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let existing = currentLevel.find((node) => node.name === part);

      if (!existing) {
        const isDir = !isLast || item.type === 'tree';
        existing = {
          name: part,
          path: currentPath,
          type: isDir ? 'directory' : 'file',
          size: isLast && item.type === 'blob' ? item.size : undefined,
          children: isDir ? [] : undefined,
        };
        currentLevel.push(existing);
      }

      if (existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  // Sort nodes: directories first, then alphabetical
  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(root);
  return root;
}

export function isBinaryFile(path: string): boolean {
  const binaryExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.ico',
    '.webp',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    '.pdf',
    '.zip',
    '.tar',
    '.gz',
    '.mp4',
    '.mov',
    '.mp3',
    '.wav',
    '.db',
    '.sqlite',
  ];
  const lower = path.toLowerCase();
  return binaryExtensions.some((ext) => lower.endsWith(ext));
}
