// 邮箱类型识别与分组 —— 复用 presets.ts 的服务商元数据，不另建映射表
import type { AccountMeta } from '../types';
import { PROVIDER_PRESETS, findPreset } from '../constants/presets';

/** 标记颜色板（右键菜单「标记颜色」子菜单用） */
export const MARK_COLORS: { value: string; label: string }[] = [
  { value: '#ef4444', label: '红' },
  { value: '#f97316', label: '橙' },
  { value: '#f59e0b', label: '黄' },
  { value: '#22c55e', label: '绿' },
  { value: '#06b6d4', label: '青' },
  { value: '#3b82f6', label: '蓝' },
  { value: '#8b5cf6', label: '紫' },
  { value: '#ec4899', label: '粉' },
];

/** 依据邮箱域名（优先）→ IMAP 主机/端口（兜底）识别服务商；无法识别返回 custom */
export function detectProvider(account: AccountMeta): string {
  const domain = account.email?.split('@')[1]?.toLowerCase();
  if (domain) {
    const byDomain = PROVIDER_PRESETS.find((p) => p.emailDomain === domain);
    if (byDomain) return byDomain.id;
  }
  const byHost = PROVIDER_PRESETS.find(
    (p) => p.imapHost === account.imapHost && p.imapPort === account.imapPort,
  );
  return byHost?.id ?? 'custom';
}

/** 类型中文名；未知类型回退「其他邮箱」 */
export function providerLabel(id: string): string {
  return findPreset(id)?.name ?? '其他邮箱';
}

/** 侧栏邮箱分组 */
export interface AccountGroup {
  key: string;
  label: string;
  accounts: AccountMeta[];
}

/**
 * 按邮箱类型自动分类：组内按 order（缺省回退 createdAt）排序，
 * 组间按预设表顺序排序，自定义（custom）排最后。
 */
export function groupAccountsByProvider(accounts: AccountMeta[]): AccountGroup[] {
  const map = new Map<string, AccountMeta[]>();
  for (const acc of accounts) {
    const key = detectProvider(acc);
    const list = map.get(key);
    if (list) list.push(acc);
    else map.set(key, [acc]);
  }

  const rank = new Map<string, number>();
  PROVIDER_PRESETS.forEach((p, i) => rank.set(p.id, i));

  const groups: AccountGroup[] = [];
  for (const [key, list] of map) {
    list.sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
    groups.push({ key, label: providerLabel(key), accounts: list });
  }

  groups.sort((a, b) => {
    const ra = rank.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.key) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label);
  });
  return groups;
}
