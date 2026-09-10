import type { MailMeta } from '../types';

export type MailFilter = 'all' | 'unread' | 'read' | 'attachment';

/**
 * 邮件列表过滤纯函数（供 MailList 与 ToolPanel 共用，保证导航/筛选口径一致）
 * - 搜索态：不过滤，原样返回（搜索结果由各自 store 决定）
 * - 筛选态：按 MailFilter 分类
 */
export function applyMailFilter(
  list: MailMeta[],
  filter: MailFilter,
  isSearching: boolean,
): MailMeta[] {
  if (isSearching) return list;
  if (filter === 'unread') return list.filter((m) => !m.seen);
  if (filter === 'read') return list.filter((m) => m.seen);
  if (filter === 'attachment') return list.filter((m) => m.hasAttachment);
  return list;
}
