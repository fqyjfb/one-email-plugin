// 文件夹层级还原 —— IMAP list() 返回的是扁平路径列表，此处按服务端分隔符还原成树
import type { Folder } from '../types';
import { folderDisplayName } from './folderIcon';

export const DEFAULT_DELIMITER = '/';

export interface FolderNode {
  folder: Folder;
  depth: number;
  children: FolderNode[];
}

/** 特殊用途排序权重：收件箱 → 已发送 → 草稿 → 垃圾邮件 → 已删除 → 存档 → 其它特殊 → 自定义 */
function rankOf(f: Folder): number {
  if (f.path.toUpperCase() === 'INBOX') return 0;
  switch ((f.specialUse || '').toLowerCase()) {
    case '\\inbox':
      return 0;
    case '\\sent':
      return 1;
    case '\\drafts':
      return 2;
    case '\\junk':
      return 3;
    case '\\trash':
      return 4;
    case '\\archive':
      return 5;
    default:
      return f.specialUse ? 6 : 7;
  }
}

// 优先取真实出现在路径中的分隔符，避免服务端返回空值或混合分隔符时误判层级
function delimiterOf(folders: Folder[]): string {
  const candidates = folders.map((f) => f.delimiter).filter((d): d is string => !!d);
  return (
    candidates.find((d) => folders.some((f) => f.path.includes(d))) ||
    candidates[0] ||
    DEFAULT_DELIMITER
  );
}

/** 扁平文件夹列表 → 层级树；同级按特殊用途顺序、再按显示名排序 */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const delimiter = delimiterOf(folders);
  const roots: FolderNode[] = [];
  const index = new Map<string, FolderNode>();

  // 路径长度升序：保证父节点先于子节点入表
  const ordered = [...folders].sort(
    (a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path),
  );

  for (const folder of ordered) {
    const node: FolderNode = { folder, depth: 0, children: [] };
    const cut = folder.path.lastIndexOf(delimiter);
    const parent = cut > 0 ? index.get(folder.path.slice(0, cut)) : null;
    if (parent) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    index.set(folder.path, node);
  }

  const sortNodes = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => {
      const r = rankOf(a.folder) - rankOf(b.folder);
      return r !== 0 ? r : folderDisplayName(a.folder).localeCompare(folderDisplayName(b.folder), 'zh');
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

/** 按折叠状态把树摊平成可渲染的行序列 */
export function flattenFolderTree(
  nodes: FolderNode[],
  collapsed: Record<string, boolean>,
): FolderNode[] {
  const rows: FolderNode[] = [];
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      rows.push(n);
      if (n.children.length > 0 && !collapsed[n.folder.path]) walk(n.children);
    }
  };
  walk(nodes);
  return rows;
}

/** 取路径末级名称（重命名时作为输入框初值） */
export function leafName(folder: Folder): string {
  const delimiter = folder.delimiter || DEFAULT_DELIMITER;
  const cut = folder.path.lastIndexOf(delimiter);
  return cut >= 0 ? folder.path.slice(cut + delimiter.length) : folder.path;
}

/** path 是否等于 ancestor，或位于其子树内（删除/重命名后修正当前文件夹用） */
export function isSameOrSubPath(path: string, ancestor: string, delimiter = DEFAULT_DELIMITER): boolean {
  return path === ancestor || path.startsWith(`${ancestor}${delimiter}`);
}
