import React, { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import type { OAuthClientConfig, OAuthClientMap } from '../types';
import Modal from './Modal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  oauthClients: OAuthClientMap;
  onSaveOAuthClient: (provider: 'gmail' | 'outlook', cfg: OAuthClientConfig | null) => Promise<void>;
}

interface ProviderFormState {
  clientId: string;
  clientSecret: string;
}

const PROVIDERS: { key: 'gmail' | 'outlook'; name: string; desc: string }[] = [
  { key: 'gmail', name: 'Google (Gmail)', desc: 'Google Cloud Console 创建的 OAuth 2.0 客户端' },
  { key: 'outlook', name: 'Microsoft (Outlook)', desc: 'Azure Portal 应用注册的 OAuth 客户端' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  oauthClients,
  onSaveOAuthClient,
}) => {
  const [forms, setForms] = useState<Record<'gmail' | 'outlook', ProviderFormState>>({
    gmail: { clientId: '', clientSecret: '' },
    outlook: { clientId: '', clientSecret: '' },
  });
  const [saving, setSaving] = useState<'gmail' | 'outlook' | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForms({
      gmail: {
        clientId: oauthClients.gmail?.clientId || '',
        clientSecret: oauthClients.gmail?.clientSecret || '',
      },
      outlook: {
        clientId: oauthClients.outlook?.clientId || '',
        clientSecret: oauthClients.outlook?.clientSecret || '',
      },
    });
    setSaving(null);
    setSavedHint(null);
  }, [isOpen, oauthClients.gmail?.clientId, oauthClients.gmail?.clientSecret, oauthClients.outlook?.clientId, oauthClients.outlook?.clientSecret]);

  const updateForm = (provider: 'gmail' | 'outlook', field: keyof ProviderFormState, value: string) => {
    setForms((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  };

  const handleSave = async (provider: 'gmail' | 'outlook') => {
    const { clientId, clientSecret } = forms[provider];
    setSaving(provider);
    setSavedHint(null);
    try {
      await onSaveOAuthClient(provider, { clientId, clientSecret });
      setSavedHint(`${PROVIDERS.find((p) => p.key === provider)!.name} 已保存`);
      setTimeout(() => setSavedHint(null), 2000);
    } finally {
      setSaving(null);
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'block text-xs text-muted-foreground mb-1';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="设置" size="lg" cancelText="关闭" onCancel={onClose}>
      <div className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold mb-1">全局 OAuth 自有客户端配置</h4>
          <p className="text-xs text-muted-foreground mb-3">
            为 Gmail / Outlook 配置你自己的 OAuth 客户端 ID（clientId）。
            配置后，在添加或编辑邮箱账号、选择 OAuth2 授权登录时，可以一键切换使用该全局配置。
          </p>
        </div>

        {PROVIDERS.map((p) => {
          const form = forms[p.key];
          const existing = oauthClients[p.key];
          const hasExisting = !!(existing?.clientId || existing?.clientSecret);
          const isDirty =
            form.clientId !== (existing?.clientId || '') ||
            form.clientSecret !== (existing?.clientSecret || '');
          const busy = saving === p.key;

          return (
            <div
              key={p.key}
              className="rounded-md border border-border p-3 space-y-2.5 bg-muted/20"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {p.name}
                    {hasExisting && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-normal">
                        已配置
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSave(p.key)}
                  disabled={busy || !isDirty}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-50 shrink-0"
                >
                  {busy ? (
                    <Save className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  保存
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>
                    clientId
                    {hasExisting && existing?.clientId && (
                      <span className="text-muted-foreground/60 ml-1">（已保存）</span>
                    )}
                  </label>
                  <input
                    value={form.clientId}
                    onChange={(e) => updateForm(p.key, 'clientId', e.target.value)}
                    className={inputCls}
                    placeholder="输入 clientId"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    clientSecret
                    {hasExisting && existing?.clientSecret && (
                      <span className="text-muted-foreground/60 ml-1">（已保存）</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={form.clientSecret}
                    onChange={(e) => updateForm(p.key, 'clientSecret', e.target.value)}
                    className={inputCls}
                    placeholder="公共客户端可留空"
                    disabled={busy}
                  />
                </div>
              </div>

              {hasExisting && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      setSaving(p.key);
                      try {
                        await onSaveOAuthClient(p.key, { clientId: '', clientSecret: '' });
                        setForms((prev) => ({
                          ...prev,
                          [p.key]: { clientId: '', clientSecret: '' },
                        }));
                      } finally {
                        setSaving(null);
                      }
                    }}
                    disabled={busy}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-accent transition-colors text-destructive disabled:opacity-60"
                  >
                    <X className="w-3 h-3" />
                    清除配置
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {savedHint && (
          <p className="text-xs text-green-600 dark:text-green-400">{savedHint}</p>
        )}

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
          <p>
            <strong>说明：</strong>
          </p>
          <p>1. 此客户端配置为全局设置，不会与具体邮箱账号绑定。</p>
          <p>2. 添加或编辑账号，当认证方式选择「OAuth2 授权登录」且服务商为 Gmail / Outlook 时，可在「高级」中选择是否使用该全局配置。</p>
          <p>3. 留空会使用插件内置的默认 OAuth 客户端（如可用）。</p>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
