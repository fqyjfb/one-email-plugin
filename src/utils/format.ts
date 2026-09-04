import type { Address } from '../types';

export function formatAddress(addr: Address | null | undefined): string {
  if (!addr) return '';
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

export function formatAddressList(list: Address[] | null | undefined): string {
  if (!list || list.length === 0) return '';
  return list.map(formatAddress).join(', ');
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
