// 账号状态管理 - 账号增删改 + 当前选中账号 + 凭据解密
// 参考 favorite-plugin/src/store/useBookmarkStore.ts 的 hook 范式

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AccountMeta, Credential, PluginConfig, ToastMessage } from '../types';
import { loadConfig, saveConfig } from '../services/storageService';
import { generateAccountId } from '../utils/id';
import { cryptoService } from '../services/cryptoService';

export type AccountInput = Omit<AccountMeta, 'id' | 'credentialEnc' | 'createdAt' | 'updatedAt'>;

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

  return {
    config,
    accounts,
    currentAccountId,
    setCurrentAccountId,
    addAccount,
    updateAccount,
    deleteAccount,
    decryptCredential,
    toasts,
    addToast,
  };
}
