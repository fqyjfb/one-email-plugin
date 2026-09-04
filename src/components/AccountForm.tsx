import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Plug, LogIn, X } from 'lucide-react';
import type { AccountMeta, Credential } from '../types';
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

const AccountForm: React.FC<AccountFormProps> = ({ isOpen, account, onClose, onSave }) => {
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

  // OAuth2 浏览器授权流状态
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthToken, setOauthToken] = useState<OAuthResult | null>(null);
  const [showOauthAdvanced, setShowOauthAdvanced] = useState(false);
  // 授权流序号：取消 / 重新打开弹窗时递增，令过期的授权结果失效，避免串扰状态
  const oauthSeqRef = useRef(0);

  const isOauth = authType === 'oauth';
  const oauthProvider = findPreset(presetId)?.oauthProvider;

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
    setShowOauthAdvanced(false);
  }, [isOpen, account]);

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
          clientId: oauthToken.clientId,
          clientSecret: oauthToken.clientSecret,
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
        // 留空时主进程回退到内置默认客户端；仅在用户填写「高级」自定义 clientId 时传入
        clientId: oauthClientId.trim() || undefined,
        clientSecret: oauthClientSecret.trim() || undefined,
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
            <button
              type="button"
              onClick={() => setShowOauthAdvanced((v) => !v)}
              disabled={oauthLoading || !!oauthToken}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              {showOauthAdvanced ? '收起自定义设置' : '高级：使用自有 OAuth 客户端（clientId）'}
            </button>
            {showOauthAdvanced && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>clientId（可选）</label>
                  <input
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    className={inputCls}
                    placeholder="留空使用内置客户端"
                    disabled={oauthLoading || !!oauthToken}
                  />
                </div>
                <div>
                  <label className={labelCls}>clientSecret（可选）</label>
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
