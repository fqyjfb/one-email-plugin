// 本地草稿服务 - 草稿存 localStorage（非服务器 \Drafts 草稿箱）
// 草稿不涉凭据，仅正文/收件人/主题，localStorage 足够且读写同步、简单可靠

import type { Draft } from '../types';

const DRAFTS_KEY = 'toolbox.one-email.drafts';

function readAll(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as Draft[]) : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: Draft[]): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.error('save drafts failed:', e);
  }
}

/** 读取某账号的草稿，按更新时间倒序 */
export function loadDrafts(accountId: string): Draft[] {
  return readAll()
    .filter((d) => d.accountId === accountId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadDraftById(id: string): Draft | null {
  return readAll().find((d) => d.id === id) || null;
}

export function upsertDraft(draft: Draft): void {
  const all = readAll();
  const idx = all.findIndex((d) => d.id === draft.id);
  if (idx >= 0) all[idx] = draft;
  else all.push(draft);
  writeAll(all);
}

export function deleteDraft(id: string): void {
  writeAll(readAll().filter((d) => d.id !== id));
}
