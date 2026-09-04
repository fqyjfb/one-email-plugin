// 前端协议封装 - 调用 window.electron.email.*，统一结果归一化
// 参数结构严格对齐主进程 emailService.cjs / emailIpc.cjs

import type {
  AccountConnection,
  Credential,
  Folder,
  MailMeta,
  MailDetail,
  ComposeMail,
} from '../types';

interface ImapOpts { host: string; port: number; secure: boolean; }
interface SmtpOpts { host: string; port: number; }

const api = (window as any).electron?.email;

function toImap(a: AccountConnection): ImapOpts {
  return { host: a.imapHost, port: a.imapPort, secure: a.secure !== false };
}

function toSmtp(a: AccountConnection): SmtpOpts {
  return { host: a.smtpHost, port: a.smtpPort };
}

function assertAvailable() {
  if (!api) {
    throw new Error('邮箱协议通道不可用：请确认主程序已集成 email:* IPC');
  }
}

export async function testConnection(account: AccountConnection, credential: Credential): Promise<void> {
  assertAvailable();
  const res = await api.testConnection({ imap: toImap(account), credential });
  if (!res?.ok) throw new Error(res?.error || '连接失败');
}

export async function listFolders(account: AccountConnection, credential: Credential): Promise<Folder[]> {
  assertAvailable();
  const res = await api.listFolders({ imap: toImap(account), credential });
  if (!res?.ok) throw new Error(res?.error || '获取文件夹失败');
  return (res.data || []) as Folder[];
}

// —— 文件夹管理（新建 / 重命名 / 删除 / 订阅 / 清空 / 全部已读）——
// 变更类操作统一回传最新文件夹列表，省去前端二次 listFolders 往返

/** 新建文件夹；parent 为 null 时建在根层级 */
export async function createFolder(
  account: AccountConnection,
  credential: Credential,
  parent: string | null,
  name: string,
): Promise<Folder[]> {
  assertAvailable();
  const res = await api.createFolder({ imap: toImap(account), credential, parent, name });
  if (!res?.ok) throw new Error(res?.error || '新建文件夹失败');
  return (res.data || []) as Folder[];
}

/** 重命名文件夹（仅改末级名称）；返回最新列表与该文件夹的新完整路径 */
export async function renameFolder(
  account: AccountConnection,
  credential: Credential,
  path: string,
  name: string,
): Promise<{ folders: Folder[]; path: string }> {
  assertAvailable();
  const res = await api.renameFolder({ imap: toImap(account), credential, path, name });
  if (!res?.ok) throw new Error(res?.error || '重命名失败');
  return res.data as { folders: Folder[]; path: string };
}

/** 删除文件夹 */
export async function deleteFolder(
  account: AccountConnection,
  credential: Credential,
  path: string,
): Promise<Folder[]> {
  assertAvailable();
  const res = await api.deleteFolder({ imap: toImap(account), credential, path });
  if (!res?.ok) throw new Error(res?.error || '删除文件夹失败');
  return (res.data || []) as Folder[];
}

/** 订阅 / 取消订阅（控制文件夹是否在侧栏展示） */
export async function setFolderSubscribed(
  account: AccountConnection,
  credential: Credential,
  path: string,
  subscribed: boolean,
): Promise<Folder[]> {
  assertAvailable();
  const res = await api.setFolderSubscribed({ imap: toImap(account), credential, path, subscribed });
  if (!res?.ok) throw new Error(res?.error || (subscribed ? '订阅失败' : '取消订阅失败'));
  return (res.data || []) as Folder[];
}

/** 清空文件夹内全部邮件 */
export async function emptyFolder(
  account: AccountConnection,
  credential: Credential,
  path: string,
): Promise<void> {
  assertAvailable();
  const res = await api.emptyFolder({ imap: toImap(account), credential, path });
  if (!res?.ok) throw new Error(res?.error || '清空文件夹失败');
}

/** 文件夹内全部标记为已读 */
export async function markFolderSeen(
  account: AccountConnection,
  credential: Credential,
  path: string,
): Promise<void> {
  assertAvailable();
  const res = await api.markFolderSeen({ imap: toImap(account), credential, path });
  if (!res?.ok) throw new Error(res?.error || '标记已读失败');
}

export async function listMessages(
  account: AccountConnection,
  credential: Credential,
  folder: string,
  offset = 0,
  limit = 50,
): Promise<{ messages: MailMeta[]; total: number; hasMore: boolean }> {
  assertAvailable();
  const res = await api.listMessages({ imap: toImap(account), credential, folder, offset, limit });
  if (!res?.ok) throw new Error(res?.error || '获取邮件失败');
  return res.data as { messages: MailMeta[]; total: number; hasMore: boolean };
}

export async function getMessage(
  account: AccountConnection,
  credential: Credential,
  folder: string,
  uid: number,
): Promise<MailDetail> {
  assertAvailable();
  const res = await api.getMessage({ imap: toImap(account), credential, folder, uid });
  if (!res?.ok) throw new Error(res?.error || '读取邮件失败');
  return res.data as MailDetail;
}

export async function downloadAttachment(
  account: AccountConnection,
  credential: Credential,
  folder: string,
  uid: number,
  filename: string,
): Promise<{ saved: boolean; path: string | null }> {
  assertAvailable();
  const res = await api.getAttachment({ imap: toImap(account), credential, folder, uid, filename });
  if (!res?.ok) throw new Error(res?.error || '下载附件失败');
  return res.data as { saved: boolean; path: string | null };
}

export async function sendMessage(
  account: AccountConnection,
  credential: Credential,
  mail: ComposeMail,
): Promise<{ messageId: string; accepted: unknown }> {
  assertAvailable();
  const res = await api.sendMessage({ smtp: toSmtp(account), credential, mail });
  if (!res?.ok) throw new Error(res?.error || '发送失败');
  return res.data as { messageId: string; accepted: unknown };
}

export async function setSeen(
  account: AccountConnection,
  credential: Credential,
  folder: string,
  uids: number[],
  seen: boolean,
): Promise<void> {
  assertAvailable();
  const res = await api.setFlags({
    imap: toImap(account),
    credential,
    folder,
    uids,
    add: seen,
    flags: ['\\Seen'],
  });
  if (!res?.ok) throw new Error(res?.error || '标记失败');
}

export async function deleteMessages(
  account: AccountConnection,
  credential: Credential,
  folder: string,
  trashFolder: string | null,
  uids: number[],
): Promise<void> {
  assertAvailable();
  const res = await api.deleteMessages({ imap: toImap(account), credential, folder, trashFolder, uids });
  if (!res?.ok) throw new Error(res?.error || '删除失败');
}

export async function moveMessages(
  account: AccountConnection,
  credential: Credential,
  fromFolder: string,
  toFolder: string,
  uids: number[],
): Promise<void> {
  assertAvailable();
  const res = await api.moveMessages({ imap: toImap(account), credential, fromFolder, toFolder, uids });
  if (!res?.ok) throw new Error(res?.error || '移动失败');
}

export async function getUnreadCounts(
  account: AccountConnection,
  credential: Credential,
): Promise<Record<string, number>> {
  assertAvailable();
  const res = await api.getUnreadCounts({ imap: toImap(account), credential });
  if (!res?.ok) throw new Error(res?.error || '获取未读数失败');
  return (res.data || {}) as Record<string, number>;
}

export async function searchMessages(
  account: AccountConnection,
  credential: Credential,
  folder: string,
  query: string,
  limit = 50,
): Promise<{ messages: MailMeta[]; total: number }> {
  assertAvailable();
  const res = await api.searchMessages({ imap: toImap(account), credential, folder, query, limit });
  if (!res?.ok) throw new Error(res?.error || '搜索失败');
  return res.data as { messages: MailMeta[]; total: number };
}

export async function watchStart(
  account: AccountConnection,
  credential: Credential,
  id: string,
): Promise<void> {
  assertAvailable();
  const res = await api.watchStart({ id, imap: toImap(account), credential });
  if (!res?.ok) throw new Error(res?.error || '启动监听失败');
}

export async function watchStop(id: string): Promise<void> {
  if (!api) return;
  await api.watchStop({ id });
}

export interface OAuthStartPayload {
  provider: 'gmail' | 'outlook';
  /** 可选：留空时主进程回退到内置默认客户端 */
  clientId?: string;
  clientSecret?: string;
  username: string;
}

export interface OAuthResult {
  provider: 'gmail' | 'outlook';
  username: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  clientId: string;
  clientSecret?: string;
}

/** 启动 OAuth2 浏览器授权流，返回令牌（授权码 + PKCE，主进程 loopback 回跳捕获） */
export async function oauthStart(payload: OAuthStartPayload): Promise<OAuthResult> {
  assertAvailable();
  const res = await api.oauthStart(payload);
  if (!res?.ok) throw new Error(res?.error || 'OAuth2 授权失败');
  return res.data as OAuthResult;
}

/** 取消进行中的 OAuth2 授权流（浏览器关闭 / 用户取消），释放主进程回跳端口 */
export async function oauthCancel(): Promise<void> {
  if (!api) return;
  await api.oauthCancel?.();
}

export interface NewMailEvent {
  id: string;
  type: string;
  folder: string;
  count: number | null;
}

export function onNewMail(cb: (payload: NewMailEvent) => void): void {
  api?.onNewMail?.(cb);
}
