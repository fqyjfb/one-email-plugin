// 账号状态管理 - 账号增删改 + 当前选中账号 + 凭据解密
// 参考 favorite-plugin/src/store/useBookmarkStore.ts 的 hook 范式

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AccountMeta, Credential, OAuthClientConfig, OAuthClientMap, PluginConfig, ToastMessage } from '../types';
import { loadConfig, saveConfig } from '../services/storageService';
import { generateAccountId } from '../utils/id';
import { cryptoService } from '../services/cryptoService';

export type AccountInput = Omit<AccountMeta, 'id' | 'credentialEnc' | 'createdAt' | 'updatedAt' | 'color' | 'order'>;

export function useAccountStore() {
  const [config, setConfig] = useState<PluginConfig | null>(null);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadConfig().then((c) => {
        setConfig(c);
        setCurrentAccountId((prev) => prev ?? (c.accounts.length > 0 ? c.accounts[0].id : null));
      });
    }
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const persist = useCallback(async (next: PluginConfig) => {
    setConfig(next);
    await saveConfig(next);
  }, []);

  const accounts = config?.accounts || [];

  const addAccount = useCallback(
    async (input: AccountInput, credential: Credential): Promise<AccountMeta> => {
      if (!config) throw new Error('数据未就绪');
      const credentialEnc = await cryptoService.encrypt(credential);
      const now = Date.now();
      const account: AccountMeta = {
        ...input,
        id: generateAccountId(),
        credentialEnc,
        createdAt: now,
        updatedAt: now,
        order: now,
      };
      await persist({ ...config, accounts: [...config.accounts, account] });
      setCurrentAccountId(account.id);
      addToast('账号添加成功', 'success');
      return account;
    },
    [config, persist, addToast],
  );

  const updateAccount = useCallback(
    async (id: string, input: Partial<AccountInput>, credential?: Credential) => {
      if (!config) return;
      const target = config.accounts.find((a) => a.id === id);
      if (!target) return;
      const next: AccountMeta = {
        ...target,
        ...input,
        updatedAt: Date.now(),
      };
      if (credential) {
        next.credentialEnc = await cryptoService.encrypt(credential);
      }
      await persist({ ...config, accounts: config.accounts.map((a) => (a.id === id ? next : a)) });
      addToast('账号更新成功', 'success');
    },
    [config, persist, addToast],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      if (!config) return;
      const remaining = config.accounts.filter((a) => a.id !== id);
      await persist({ ...config, accounts: remaining });
      if (currentAccountId === id) {
        setCurrentAccountId(remaining[0]?.id || null);
      }
      addToast('账号已删除', 'success');
    },
    [config, currentAccountId, persist, addToast],
  );

  const decryptCredential = useCallback(async (account: AccountMeta): Promise<Credential | null> => {
    return (await cryptoService.decrypt(account.credentialEnc)) as Credential | null;
  }, []);

  /** 拖拽排序：按传入 id 顺序写入 order（组内相对顺序），持久化 */
  const reorderAccounts = useCallback(
    async (orderedIds: string[]) => {
      if (!config) return;
      const rank = new Map(orderedIds.map((id, i) => [id, i]));
      const accounts = config.accounts.map((a) =>
        rank.has(a.id) ? { ...a, order: rank.get(a.id)! } : a,
      );
      await persist({ ...config, accounts });
    },
    [config, persist],
  );

  /** 设置 / 清除邮箱标记颜色 */
  const setAccountColor = useCallback(
    async (id: string, color: string | null) => {
      if (!config) return;
      const target = config.accounts.find((a) => a.id === id);
      if (!target) return;
      const next: AccountMeta = { ...target };
      if (color) next.color = color;
      else delete next.color;
      await persist({ ...config, accounts: config.accounts.map((a) => (a.id === id ? next : a)) });
    },
    [config, persist],
  );

  const settings = config?.settings;
  const oauthClients: OAuthClientMap = settings?.oauthClients || {};

  const setOAuthClient = useCallback(
    async (provider: 'gmail' | 'outlook', cfg: OAuthClientConfig | null) => {
      if (!config) return;
      const next: OAuthClientMap = { ...(config.settings.oauthClients || {}) };
      if (cfg && (cfg.clientId.trim() || cfg.clientSecret.trim())) {
        next[provider] = { clientId: cfg.clientId.trim(), clientSecret: cfg.clientSecret.trim() };
      } else {
        delete next[provider];
      }
      await persist({
        ...config,
        settings: { ...config.settings, oauthClients: next },
      });
      addToast('OAuth 客户端配置已更新', 'success');
    },
    [config, persist, addToast],
  );

  const getOAuthClient = useCallback(
    (provider: 'gmail' | 'outlook'): OAuthClientConfig | undefined => {
      return oauthClients[provider];
    },
    [oauthClients],
  );

  return {
    config,
    settings,
    accounts,
    currentAccountId,
    setCurrentAccountId,
    addAccount,
    updateAccount,
    deleteAccount,
    decryptCredential,
    reorderAccounts,
    setAccountColor,
    oauthClients,
    setOAuthClient,
    getOAuthClient,
    toasts,
    addToast,
  };
}
