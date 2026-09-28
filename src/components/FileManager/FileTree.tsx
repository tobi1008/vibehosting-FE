'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  ChevronRight,
  ChevronDown,
  Search,
  Lock,
  Database,
  Terminal,
  Settings,
  Layers,
  Code,
} from 'lucide-react';
import { FileTreeNode } from '@/lib/projectFiles';

interface FileTreeProps {
  tree: FileTreeNode[];
  selectedPath: string | null;
  dirtyFiles: Set<string>;
  onSelectFile: (path: string) => void;
  isLoading?: boolean;
}

// Icon resolver for files based on extension and filename
export function getFileIcon(fileName: string) {
  const lower = fileName.toLowerCase();

  if (lower.startsWith('.env')) {
    return <Lock className="w-4 h-4 text-emerald-400 shrink-0" />;
  }
  if (lower === 'dockerfile' || lower.includes('docker-compose')) {
    return <Layers className="w-4 h-4 text-sky-400 shrink-0" />;
  }
  if (lower.endsWith('.prisma')) {
    return <Database className="w-4 h-4 text-teal-400 shrink-0" />;
  }
  if (lower.endsWith('.sql')) {
    return <Database className="w-4 h-4 text-amber-400 shrink-0" />;
  }
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) {
    return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
  }
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
  }
  if (lower.endsWith('.json')) {
    return <FileJson className="w-4 h-4 text-amber-300 shrink-0" />;
  }
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.sass')) {
    return <Code className="w-4 h-4 text-pink-400 shrink-0" />;
  }
  if (lower.endsWith('.html')) {
    return <Code className="w-4 h-4 text-orange-400 shrink-0" />;
  }
  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    return <FileText className="w-4 h-4 text-indigo-300 shrink-0" />;
  }
  if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.zsh')) {
    return <Terminal className="w-4 h-4 text-emerald-300 shrink-0" />;
  }
  if (lower.endsWith('.yml') || lower.endsWith('.yaml') || lower.endsWith('.toml')) {
    return <Settings className="w-4 h-4 text-purple-400 shrink-0" />;
  }
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.ico') ||
    lower.endsWith('.webp')
  ) {
    return <FileImage className="w-4 h-4 text-rose-400 shrink-0" />;
  }
  if (lower.endsWith('.csv') || lower.endsWith('.xlsx')) {
    return <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />;
  }

  return <File className="w-4 h-4 text-muted-foreground shrink-0" />;
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

interface TreeNodeItemProps {
  node: FileTreeNode;
  level: number;
  selectedPath: string | null;
  dirtyFiles: Set<string>;
  onSelectFile: (path: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}

function TreeNodeItem({
  node,
  level,
  selectedPath,
  dirtyFiles,
  onSelectFile,
  expandedFolders,
  toggleFolder,
}: TreeNodeItemProps) {
  const isDirectory = node.type === 'directory';
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedPath === node.path;
  const isDirty = dirtyFiles.has(node.path);

  // Check if any descendant is dirty
  const hasDirtyDescendant = useMemo(() => {
    if (!isDirectory) return false;
    for (const dirtyPath of dirtyFiles) {
      if (dirtyPath.startsWith(node.path + '/')) return true;
    }
    return false;
  }, [isDirectory, node.path, dirtyFiles]);

  return (
    <div className="select-none">
      <button
        onClick={() => {
          if (isDirectory) {
            toggleFolder(node.path);
          } else {
            onSelectFile(node.path);
          }
        }}
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 text-xs font-mono rounded-md transition-colors text-left group ${
          isSelected
            ? 'bg-primary/15 text-primary font-medium border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
        style={{ paddingLeft: `${Math.max(8, level * 14 + 6)}px` }}
        title={node.path}
      >
        {isDirectory ? (
          <>
            <span className="text-muted-foreground/70 group-hover:text-foreground transition-colors shrink-0">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            {getFileIcon(node.name)}
          </>
        )}

        <span className="truncate flex-1">{node.name}</span>

        {/* Dirty indicators */}
        {isDirty && (
          <span
            className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-xs animate-pulse"
            title="Có thay đổi chưa lưu"
          />
        )}
        {!isDirty && hasDirtyDescendant && !isExpanded && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-rose-500/70 shrink-0"
            title="Thư mục chứa file chưa lưu"
          />
        )}
      </button>

      {isDirectory && isExpanded && node.children && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              dirtyFiles={dirtyFiles}
              onSelectFile={onSelectFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  tree,
  selectedPath,
  dirtyFiles,
  onSelectFile,
  isLoading = false,
}: FileTreeProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<'all' | 'frontend' | 'backend'>('all');

  const hasFrontend = useMemo(() => tree.some((n) => n.name === 'frontend' && n.type === 'directory'), [tree]);
  const hasBackend = useMemo(() => tree.some((n) => n.name === 'backend' && n.type === 'directory'), [tree]);
  const isMultiWorkspace = hasFrontend && hasBackend;

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Default open top-level folders
    const initial = new Set<string>();
    for (const item of tree) {
      if (item.type === 'directory') {
        initial.add(item.path);
        // Also expand src, frontend, backend or app if present
        if (['src', 'app', 'frontend', 'backend', 'pages', 'components'].includes(item.name.toLowerCase()) && item.children) {
          for (const sub of item.children) {
            if (sub.type === 'directory') initial.add(sub.path);
          }
        }
      }
    }
    return initial;
  });

  // Ensure frontend / backend folders are expanded by default when tree updates
  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const item of tree) {
        if (item.type === 'directory') {
          next.add(item.path);
          if (['src', 'app', 'frontend', 'backend'].includes(item.name.toLowerCase()) && item.children) {
            for (const sub of item.children) {
              if (sub.type === 'directory') next.add(sub.path);
            }
          }
        }
      }
      return next;
    });
  }, [tree]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Filter tree based on workspace filter and search
  const filteredTree = useMemo(() => {
    let baseNodes = tree;

    if (isMultiWorkspace && workspaceFilter !== 'all') {
      const targetFolder = baseNodes.find((n) => n.name === workspaceFilter && n.type === 'directory');
      if (targetFolder) {
        baseNodes = [targetFolder];
      }
    }

    if (!searchTerm.trim()) return baseNodes;

    const term = searchTerm.toLowerCase();

    const filterNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      const result: FileTreeNode[] = [];

      for (const node of nodes) {
        if (node.type === 'file') {
          if (node.name.toLowerCase().includes(term) || node.path.toLowerCase().includes(term)) {
            result.push(node);
          }
        } else if (node.type === 'directory' && node.children) {
          const matchingChildren = filterNodes(node.children);
          if (
            matchingChildren.length > 0 ||
            node.name.toLowerCase().includes(term) ||
            node.path.toLowerCase().includes(term)
          ) {
            result.push({
              ...node,
              children: matchingChildren,
            });
          }
        }
      }

      return result;
    };

    return filterNodes(baseNodes);
  }, [tree, isMultiWorkspace, workspaceFilter, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-card/60 border-r border-border select-none">
      {/* Workspace Filter (If project has both frontend and backend) */}
      {isMultiWorkspace && (
        <div className="p-2 border-b border-border/70 bg-muted/20">
          <div className="grid grid-cols-3 gap-1 bg-background/80 p-1 rounded-lg border border-border/80 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setWorkspaceFilter('all')}
              className={`py-1 px-1 rounded transition-colors text-center truncate ${
                workspaceFilter === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceFilter('frontend')}
              className={`py-1 px-1 rounded transition-colors text-center truncate ${
                workspaceFilter === 'frontend'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Frontend
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceFilter('backend')}
              className={`py-1 px-1 rounded transition-colors text-center truncate ${
                workspaceFilter === 'backend'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Backend
            </button>
          </div>
        </div>
      )}

      {/* Search Header */}
      <div className="p-3 border-b border-border/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              workspaceFilter === 'all'
                ? 'Tìm trong toàn bộ workspace...'
                : `Tìm trong ${workspaceFilter}...`
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background/80 border border-border rounded-md pl-8 pr-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs gap-2">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span>Đang tải cây thư mục...</span>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs text-center px-4">
            <span>Không tìm thấy tập tin nào</span>
            {searchTerm && <span className="text-[11px] opacity-70 mt-1">với từ khóa "{searchTerm}"</span>}
          </div>
        ) : (
          filteredTree.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              level={0}
              selectedPath={selectedPath}
              dirtyFiles={dirtyFiles}
              onSelectFile={onSelectFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))
        )}
      </div>

      {/* Footer info */}
      <div className="p-2 px-3 border-t border-border/60 text-[11px] font-mono text-muted-foreground/70 flex items-center justify-between">
        <span>Files: {tree.length > 0 ? countFiles(tree) : 0}</span>
        {dirtyFiles.size > 0 && (
          <span className="text-rose-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            {dirtyFiles.size} chưa lưu
          </span>
        )}
      </div>
    </div>
  );
}

function countFiles(nodes: FileTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') count++;
    else if (node.children) count += countFiles(node.children);
  }
  return count;
}
