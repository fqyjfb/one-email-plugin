import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plug, LogIn, X } from 'lucide-react';
import type { AccountMeta, Credential, OAuthClientConfig, OAuthClientMap } from '../types';
import type { AccountInput } from '../store/useAccountStore';
import { PROVIDER_PRESETS, CUSTOM_PRESET_ID, findPreset } from '../constants/presets';
import * as emailService from '../services/emailService';
import type { OAuthResult } from '../services/emailService';
import Modal from './Modal';

interface AccountFormProps {
  isOpen: boolean;
  account: AccountMeta | null; // null = 新增
  onClose: () => void;
  onSave: (input: AccountInput, credential: Credential | null) => Promise<void>;
  /** 全局自有 OAuth 客户端配置（按 provider 存储）；组件内部根据当前预设的 oauthProvider 自动取对应项 */
  oauthClients?: OAuthClientMap;
}

const AUTH_TYPES: { value: string; label: string }[] = [
  { value: 'appPassword', label: '应用专用密码 / 授权码（推荐）' },
  { value: 'password', label: '普通密码' },
  { value: 'oauth', label: 'OAuth2 授权登录（Gmail / Outlook）' },
];

function detectPreset(account: AccountMeta | null): string {
  if (!account) return CUSTOM_PRESET_ID;
  const p = PROVIDER_PRESETS.find(
    (x) =>
      x.imapHost === account.imapHost &&
      x.imapPort === account.imapPort &&
      x.smtpHost === account.smtpHost &&
      x.smtpPort === account.smtpPort,
  );
  return p?.id || CUSTOM_PRESET_ID;
}

const AccountForm: React.FC<AccountFormProps> = ({
  isOpen,
  account,
  onClose,
  onSave,
  oauthClients = {},
}) => {
  const isEdit = !!account;

  const [presetId, setPresetId] = useState<string>(CUSTOM_PRESET_ID);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [secure, setSecure] = useState(true);
  const [authType, setAuthType] = useState<string>('appPassword');
  const [password, setPassword] = useState('');
  const [signature, setSignature] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth2 客户端使用模式：
  //  builtin  → 留空，由主进程使用内置默认客户端
  //  global   → 使用设置页配置的全局自有客户端（来自 globalOAuthClient prop）
  //  custom   → 用户在下方手动填写 clientId / clientSecret
  type OAuthClientMode = 'builtin' | 'global' | 'custom';
  const [oauthClientMode, setOAuthClientMode] = useState<OAuthClientMode>('builtin');
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthToken, setOauthToken] = useState<OAuthResult | null>(null);
  // 授权流序号：取消 / 重新打开弹窗时递增，令过期的授权结果失效，避免串扰状态
  const oauthSeqRef = useRef(0);

  const isOauth = authType === 'oauth';
  const oauthProvider = findPreset(presetId)?.oauthProvider;
  // 根据当前预设服务商，从全局配置中找到对应 OAuth 客户端
  const globalOAuthClient: OAuthClientConfig | undefined = useMemo(
    () => (oauthProvider ? oauthClients[oauthProvider] : undefined),
    [oauthProvider, oauthClients],
  );
  const hasGlobalConfig = !!(globalOAuthClient?.clientId || globalOAuthClient?.clientSecret);

  useEffect(() => {
    if (!isOpen) {
      // 关闭弹窗时取消进行中的授权，释放主进程回跳端口
      void emailService.oauthCancel();
      return;
    }
    // 重开弹窗：使旧授权结果失效，并复位加载态
    oauthSeqRef.current++;
    setOauthLoading(false);
    setPresetId(detectPreset(account));
    setDisplayName(account?.displayName || '');
    setEmail(account?.email || '');
    setImapHost(account?.imapHost || '');
    setImapPort(account ? String(account.imapPort) : '993');
    setSmtpHost(account?.smtpHost || '');
    setSmtpPort(account ? String(account.smtpPort) : '465');
    setSecure(account?.secure ?? true);
    setAuthType(account?.authType || 'appPassword');
    setPassword('');
    setSignature(account?.signature || '');
    setTestResult(null);
    setError(null);
    setOauthClientId('');
    setOauthClientSecret('');
    setOauthToken(null);
    // 默认模式：有全局配置就优先用全局，否则用内置；后续用户可自行切换
    setOAuthClientMode(hasGlobalConfig ? 'global' : 'builtin');
  }, [isOpen, account, hasGlobalConfig]);

  const applyPreset = (id: string) => {
    setPresetId(id);
    const p = findPreset(id);
    if (p) {
      setImapHost(p.imapHost);
      setImapPort(String(p.imapPort));
      setSmtpHost(p.smtpHost);
      setSmtpPort(String(p.smtpPort));
      setSecure(p.secure);
      // 自动切换认证类型：Gmail / Outlook 默认 OAuth2，其余离开 OAuth 时回退到应用专用密码
      setAuthType((prev) => (p.oauthProvider ? 'oauth' : prev === 'oauth' ? 'appPassword' : prev));
      // 切换到有 OAuthProvider 的预设时，若当前模式是 global 而全局恰好没配置，则回退到 builtin
      if (p.oauthProvider) {
        const globalForPreset = p.oauthProvider === 'gmail' || p.oauthProvider === 'outlook'
          ? hasGlobalConfig
          : false;
        setOAuthClientMode(globalForPreset ? 'global' : 'builtin');
      }
      // 自动补邮箱后缀，减少用户输入（空 → @域名；仅有后缀 → 跟随新预设；仅用户名 → 补 @域名；完整邮箱 → 保留）
      if (p.emailDomain) {
        setEmail((prev) => {
          const t = prev.trim();
          if (!t) return `@${p.emailDomain}`;
          const at = t.indexOf('@');
          if (at === 0) return `@${p.emailDomain}`;
          if (at === -1) return `${t}@${p.emailDomain}`;
          return t;
        });
      }
    }
    setOauthToken(null);
  };

  // 根据当前模式，计算实际传给 oauthStart 的 clientId/clientSecret
  const effectiveOAuthClient = useMemo((): { clientId?: string; clientSecret?: string } => {
    if (!isOauth || !oauthProvider) return {};
    switch (oauthClientMode) {
      case 'global':
        return {
          clientId: globalOAuthClient?.clientId || undefined,
          clientSecret: globalOAuthClient?.clientSecret || undefined,
        };
      case 'custom':
        return {
          clientId: oauthClientId.trim() || undefined,
          clientSecret: oauthClientSecret.trim() || undefined,
        };
      case 'builtin':
      default:
        return {};
    }
  }, [oauthClientMode, oauthClientId, oauthClientSecret, globalOAuthClient, isOauth, oauthProvider]);

  const buildInput = (): AccountInput => ({
    displayName: displayName.trim() || email.trim(),
    email: email.trim(),
    imapHost: imapHost.trim(),
    imapPort: Number(imapPort),
    smtpHost: smtpHost.trim(),
    smtpPort: Number(smtpPort),
    secure,
    authType: authType as AccountMeta['authType'],
    signature: signature.trim() || undefined,
  });

  const buildCredential = (): Credential | null => {
    if (isOauth) {
      if (oauthToken) {
        // 浏览器授权得到的完整令牌集（含 refreshToken / provider / expiresAt，供自动刷新）
        return {
          username: oauthToken.username || email.trim(),
          accessToken: oauthToken.accessToken,
          refreshToken: oauthToken.refreshToken || undefined,
          clientId: effectiveOAuthClient.clientId ?? oauthToken.clientId,
          clientSecret: effectiveOAuthClient.clientSecret ?? oauthToken.clientSecret,
          provider: oauthToken.provider,
          expiresAt: oauthToken.expiresAt,
        };
      }
      if (!oauthProvider) {
        // 自定义服务器：退化为手动粘贴访问令牌
        return password ? { username: email.trim(), accessToken: password } : null;
      }
      return null; // Gmail/Outlook 未完成授权
    }
    if (!password) return null;
    return { username: email.trim(), password };
  };

  const validate = (): string | null => {
    if (!email.trim()) return '请填写邮箱地址';
    if (!imapHost.trim()) return '请填写 IMAP 服务器';
    if (!smtpHost.trim()) return '请填写 SMTP 服务器';
    if (!Number.isFinite(Number(imapPort)) || Number(imapPort) <= 0) return 'IMAP 端口无效';
    if (!Number.isFinite(Number(smtpPort)) || Number(smtpPort) <= 0) return 'SMTP 端口无效';
    if (!isEdit) {
      if (isOauth) {
        if (oauthProvider && !oauthToken) return '请先完成浏览器授权登录';
        if (!oauthProvider && !password) return '请填写访问令牌';
      } else if (!password) {
        return '请填写密码或授权码';
      }
    }
    return null;
  };

  const handleOAuthLogin = async () => {
    if (!oauthProvider) return;
    const seq = ++oauthSeqRef.current;
    setOauthLoading(true);
    setOauthToken(null);
    setError(null);
    setTestResult(null);
    try {
      const result = await emailService.oauthStart({
        provider: oauthProvider,
        clientId: effectiveOAuthClient.clientId,
        clientSecret: effectiveOAuthClient.clientSecret,
        username: email.trim(),
      });
      if (seq !== oauthSeqRef.current) return; // 已被取消或重新发起，丢弃过期结果
      setOauthToken(result);
      // 授权成功即回填邮箱，免去用户手动输入
      if (result.username && !email.trim()) setEmail(result.username);
      setTestResult({ ok: true, msg: `授权成功：${result.username}` });
    } catch (e) {
      if (seq !== oauthSeqRef.current) return; // 过期失败，忽略
      setError((e as Error).message);
    } finally {
      if (seq === oauthSeqRef.current) setOauthLoading(false);
    }
  };

  const handleOAuthCancel = () => {
    oauthSeqRef.current++; // 使进行中的授权结果失效
    void emailService.oauthCancel();
    setOauthLoading(false);
    setError('已取消授权，可重新点击「浏览器授权登录」');
  };

  const handleTest = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    const cred = buildCredential();
    if (!cred) {
      setError('请先完成授权或填写凭据后再测试连接');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      await emailService.testConnection(buildInput(), cred);
      setTestResult({ ok: true, msg: '连接成功' });
    } catch (e) {
      setTestResult({ ok: false, msg: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(buildInput(), buildCredential());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const presetNote = presetId !== CUSTOM_PRESET_ID ? findPreset(presetId)?.note : undefined;

  // 认证方式动态引导
  const requiresAppPassword = presetId === 'gmail' || presetId === 'outlook';
  const authHint = isOauth
    ? oauthProvider
      ? undefined
      : '自定义服务器暂不支持浏览器授权，请手动粘贴 OAuth2 访问令牌（约 1 小时后失效）。'
    : authType === 'password' && requiresAppPassword
      ? 'Gmail / Outlook 已停用普通密码登录，请改用「应用专用密码」或「OAuth2 授权登录」。'
      : undefined;

  const oauthHint = oauthProvider === 'gmail'
    ? '点击下方按钮，在浏览器中登录 Google 账号并授权，即可自动获取邮箱与访问令牌，无需手动填写任何凭据。'
    : oauthProvider === 'outlook'
      ? '点击下方按钮，在浏览器中登录微软账号并授权，即可自动获取邮箱与访问令牌，无需手动填写任何凭据。'
      : undefined;

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'block text-xs text-muted-foreground mb-1';

  const showOauthForm = isOauth && oauthProvider;
  const showPasswordField = !showOauthForm;

  const credentialLabel = showOauthForm
    ? '授权状态'
    : isEdit
      ? '密码 / 授权码（留空保持不变）'
      : '密码 / 授权码 *';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? '编辑账号' : '添加邮箱账号'}
      size="lg"
      confirmText={isEdit ? '保存' : '添加'}
      cancelText="取消"
      onConfirm={handleSave}
      onCancel={onClose}
    >
      <div className="space-y-3">
        <div>
          <label className={labelCls}>服务商预设</label>
          <select value={presetId} onChange={(e) => applyPreset(e.target.value)} className={inputCls}>
            <option value={CUSTOM_PRESET_ID}>自定义（手动填写服务器）</option>
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {presetNote && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{presetNote}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>显示名</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="工作邮箱" />
          </div>
          <div>
            <label className={labelCls}>邮箱地址 *</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder={findPreset(presetId)?.emailDomain ? `you@${findPreset(presetId)!.emailDomain}` : 'you@example.com'}
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_100px] gap-3">
          <div>
            <label className={labelCls}>IMAP 服务器 *</label>
            <input value={imapHost} onChange={(e) => setImapHost(e.target.value)} className={inputCls} placeholder="imap.example.com" />
          </div>
          <div>
            <label className={labelCls}>端口</label>
            <input value={imapPort} onChange={(e) => setImapPort(e.target.value)} className={inputCls} inputMode="numeric" />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_100px] gap-3">
          <div>
            <label className={labelCls}>SMTP 服务器 *</label>
            <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className={inputCls} placeholder="smtp.example.com" />
          </div>
          <div>
            <label className={labelCls}>端口</label>
            <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className={inputCls} inputMode="numeric" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>认证类型</label>
            <select value={authType} onChange={(e) => { setAuthType(e.target.value); setOauthToken(null); }} className={inputCls}>
              {AUTH_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {showPasswordField && (
            <div>
              <label className={labelCls}>{credentialLabel}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder={isOauth ? '粘贴 OAuth2 访问令牌' : '输入应用专用密码 / 授权码'}
              />
            </div>
          )}
        </div>

        {showOauthForm && (
          <div className="space-y-2 rounded-md border border-border p-3">
            {oauthHint && <p className="text-xs text-muted-foreground">{oauthHint}</p>}
            <button
              onClick={oauthLoading ? handleOAuthCancel : handleOAuthLogin}
              disabled={!!oauthToken}
              className="flex w-full items-center justify-center gap-2 px-3 py-2 text-sm bg-primary text-button-text rounded-md hover:opacity-90 transition-colors disabled:opacity-60"
            >
              {oauthLoading ? (
                <>
                  <X className="w-4 h-4" />
                  取消授权
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {oauthToken ? `已授权：${oauthToken.username}` : '浏览器授权登录'}
                </>
              )}
            </button>
            {oauthLoading && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                已在浏览器打开授权页，请完成登录；如需中断请点击上方按钮取消。
              </p>
            )}

            {/* OAuth 客户端使用模式切换 */}
            <div className="pt-1.5 border-t border-border/60">
              <div className="text-xs text-muted-foreground mb-2">OAuth 客户端选择</div>
              <div className="flex flex-wrap gap-2">
                <label
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border cursor-pointer transition-colors ${
                    oauthClientMode === 'builtin'
                      ? 'bg-accent border-ring'
                      : 'border-border hover:bg-accent/60'
                  } ${oauthLoading || !!oauthToken ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <input
                    type="radio"
                    checked={oauthClientMode === 'builtin'}
                    onChange={() => setOAuthClientMode('builtin')}
                    className="sr-only"
                    disabled={oauthLoading || !!oauthToken}
                  />
                  内置默认客户端
                </label>
                <label
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border cursor-pointer transition-colors ${
                    oauthClientMode === 'global'
                      ? 'bg-accent border-ring'
                      : 'border-border hover:bg-accent/60'
                  } ${(!hasGlobalConfig || oauthLoading || !!oauthToken) ? 'opacity-50 pointer-events-none' : ''}`}
                  title={hasGlobalConfig ? '使用在「设置」中配置的全局 OAuth 客户端' : '请先在「设置」中配置全局 OAuth 客户端'}
                >
                  <input
                    type="radio"
                    checked={oauthClientMode === 'global'}
                    onChange={() => setOAuthClientMode('global')}
                    className="sr-only"
                    disabled={!hasGlobalConfig || oauthLoading || !!oauthToken}
                  />
                  使用全局自有客户端
                  {hasGlobalConfig && (
                    <span className="text-[10px] px-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      已配置
                    </span>
                  )}
                  {!hasGlobalConfig && (
                    <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">未配置</span>
                  )}
                </label>
                <label
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border cursor-pointer transition-colors ${
                    oauthClientMode === 'custom'
                      ? 'bg-accent border-ring'
                      : 'border-border hover:bg-accent/60'
                  } ${oauthLoading || !!oauthToken ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <input
                    type="radio"
                    checked={oauthClientMode === 'custom'}
                    onChange={() => setOAuthClientMode('custom')}
                    className="sr-only"
                    disabled={oauthLoading || !!oauthToken}
                  />
                  自定义（本次专用）
                </label>
              </div>

              {/* 当前模式说明 */}
              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                {oauthClientMode === 'builtin' && (
                  <p>· 使用插件内置的默认 OAuth 客户端（如有）进行浏览器授权。</p>
                )}
                {oauthClientMode === 'global' && hasGlobalConfig && (
                  <p>
                    · 使用在「设置」页中配置的{oauthProvider === 'gmail' ? 'Gmail' : 'Outlook'}全局自有客户端。
                    {globalOAuthClient?.clientId && (
                      <> 当前 clientId：<code className="px-1 rounded bg-muted">{globalOAuthClient.clientId.slice(0, 8)}…</code></>
                    )}
                  </p>
                )}
                {oauthClientMode === 'custom' && (
                  <p>· 手动为本次添加/编辑账号单独指定 clientId/clientSecret，不会影响全局设置。</p>
                )}
              </div>

              {oauthClientMode === 'custom' && (
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>clientId</label>
                    <input
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                      className={inputCls}
                      placeholder="输入 clientId"
                      disabled={oauthLoading || !!oauthToken}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>clientSecret</label>
                    <input
                      type="password"
                      value={oauthClientSecret}
                      onChange={(e) => setOauthClientSecret(e.target.value)}
                      className={inputCls}
                      placeholder="公共客户端可留空"
                      disabled={oauthLoading || !!oauthToken}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {authHint && <p className="text-xs text-amber-600 dark:text-amber-400">{authHint}</p>}

        <div>
          <label className={labelCls}>签名（可选）</label>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            className={`${inputCls} resize-none`}
            rows={2}
            placeholder="发送邮件时自动附加的签名"
          />
        </div>

        {testResult && (
          <p className={`text-sm ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {testResult.msg}
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-60"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
          测试连接
        </button>
      </div>

      {saving && <p className="mt-2 text-sm text-muted-foreground">正在保存…</p>}
    </Modal>
  );
};

export default AccountForm;
