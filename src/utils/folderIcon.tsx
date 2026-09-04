import { Inbox, Send, FileText, Trash, Archive, Star, AlertOctagon, Folder, Mail } from 'lucide-react';
import type { Folder as FolderMeta } from '../types';

/** IMAP specialUse / 路径关键字 → 中文显示名；不匹配回退 path */
const FOLDER_NAME_MAP: Record<string, string> = {
  // 收件箱
  '\\inbox': '收件箱', 'inbox': '收件箱',
  // 已发送
  '\\sent': '已发送', 'sent': '已发送', 'sent items': '已发送', 'sent messages': '已发送',
  // 草稿
  '\\drafts': '草稿', 'drafts': '草稿', 'draft': '草稿',
  // 垃圾箱
  '\\trash': '已删除', 'trash': '已删除', 'deleted': '已删除', 'deleted items': '已删除', 'bin': '已删除',
  // 垃圾邮件
  '\\junk': '垃圾邮件', 'junk': '垃圾邮件', 'spam': '垃圾邮件', 'bulk mail': '垃圾邮件', 'junk mail': '垃圾邮件',
  // 存档
  '\\archive': '存档', 'archive': '存档', 'all mail': '所有邮件', 'all messages': '所有邮件',
  // 星标 / 重要
  '\\flagged': '星标邮件', 'flagged': '星标邮件', 'starred': '星标邮件',
  '\\important': '重要', 'important': '重要',
  // 草稿 / 已发送别名
  '\\sent messages': '已发送', '\\deleted': '已删除', '\\all': '所有邮件',
  // 备注 / 笔记
  '\\notes': '笔记', 'notes': '笔记',
};

/** 去掉 IMAP 路径前缀（其它账号共享邮箱 / 嵌套邮箱）后的小写名 */
function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return (i >= 0 ? path.slice(i + 1) : path).toLowerCase();
}

/** 文件夹中文显示名（按 specialUse → 路径 basename 顺序匹配；未匹配回退原 path） */
export function folderDisplayName(folder: FolderMeta): string {
  const use = (folder.specialUse || '').toLowerCase();
  if (use && FOLDER_NAME_MAP[use]) return FOLDER_NAME_MAP[use];
  // 处理 "\Sent Items" 这类带空格的 specialUse
  if (use) {
    for (const key of Object.keys(FOLDER_NAME_MAP)) {
      if (key.startsWith('\\') && use.endsWith(key.slice(1))) return FOLDER_NAME_MAP[key];
    }
  }
  const base = basename(folder.path);
  if (FOLDER_NAME_MAP[base]) return FOLDER_NAME_MAP[base];
  return folder.path;
}

/** 根据文件夹的 specialUse / 名称返回对应图标（Sidebar 与移动弹窗共用） */
export function folderIcon(folder: FolderMeta) {
  const use = folder.specialUse || '';
  const lower = folder.path.toLowerCase();
  if (lower === 'inbox' || use === '\\Inbox') return <Inbox className="w-4 h-4" />;
  if (use === '\\Sent' || lower === 'sent') return <Send className="w-4 h-4" />;
  if (use === '\\Drafts' || lower === 'drafts') return <FileText className="w-4 h-4" />;
  if (use === '\\Trash' || lower === 'trash') return <Trash className="w-4 h-4" />;
  if (use === '\\Junk' || lower === 'junk' || lower === 'spam') return <AlertOctagon className="w-4 h-4" />;
  if (use === '\\Archive' || lower === 'archive') return <Archive className="w-4 h-4" />;
  if (use === '\\Flagged' || lower === 'flagged' || lower === 'starred') return <Star className="w-4 h-4" />;
  if (lower === 'all mail' || lower === 'all messages') return <Mail className="w-4 h-4" />;
  return <Folder className="w-4 h-4" />;
}
