// 服务商预设（借鉴 OneMail 服务商元数据：主机 / 端口属客观事实数据）
// secure 字段为 IMAP 隐式 TLS 标志（993 端口均为 true）；SMTP 是否隐式 TLS 由主进程按端口（465）自动判定

export interface ProviderPreset {
  id: string;
  name: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  /** 默认邮箱后缀（选预设时自动补到 email 输入框） */
  emailDomain?: string;
  note?: string;
  /** 支持的 OAuth2 服务商（gmail/outlook 已停用密码认证，走浏览器授权流） */
  oauthProvider?: 'gmail' | 'outlook';
}

export const CUSTOM_PRESET_ID = 'custom';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'qq', name: 'QQ 邮箱', imapHost: 'imap.qq.com', imapPort: 993, smtpHost: 'smtp.qq.com', smtpPort: 465, secure: true, emailDomain: 'qq.com', note: '需开启 SMTP 并获取授权码' },
  { id: 'foxmail', name: 'Foxmail', imapHost: 'imap.qq.com', imapPort: 993, smtpHost: 'smtp.qq.com', smtpPort: 465, secure: true, emailDomain: 'foxmail.com', note: '需 SMTP 授权码' },
  { id: '163', name: '网易 163 邮箱', imapHost: 'imap.163.com', imapPort: 993, smtpHost: 'smtp.163.com', smtpPort: 465, secure: true, emailDomain: '163.com', note: '需授权码' },
  { id: '126', name: '126 邮箱', imapHost: 'imap.126.com', imapPort: 993, smtpHost: 'smtp.126.com', smtpPort: 465, secure: true, emailDomain: '126.com', note: '需授权码' },
  { id: 'exmail', name: '腾讯企业邮', imapHost: 'imap.exmail.qq.com', imapPort: 993, smtpHost: 'smtp.exmail.qq.com', smtpPort: 465, secure: true, emailDomain: 'exmail.qq.com', note: '需授权码' },
  { id: 'aliyun', name: '阿里邮箱', imapHost: 'imap.aliyun.com', imapPort: 993, smtpHost: 'smtp.aliyun.com', smtpPort: 465, secure: true, emailDomain: 'aliyun.com' },
  { id: 'aliyun-qiye', name: '阿里企业邮', imapHost: 'imap.qiye.aliyun.com', imapPort: 993, smtpHost: 'smtp.qiye.aliyun.com', smtpPort: 465, secure: true, emailDomain: 'qiye.aliyun.com' },
  { id: 'sina', name: '新浪邮箱', imapHost: 'imap.sina.com', imapPort: 993, smtpHost: 'smtp.sina.com', smtpPort: 465, secure: true, emailDomain: 'sina.com' },
  { id: 'sohu', name: '搜狐邮箱', imapHost: 'imap.sohu.com', imapPort: 993, smtpHost: 'smtp.sohu.com', smtpPort: 465, secure: true, emailDomain: 'sohu.com' },
  { id: '189', name: '189 邮箱', imapHost: 'imap.189.cn', imapPort: 993, smtpHost: 'smtp.189.cn', smtpPort: 465, secure: true, emailDomain: '189.cn' },
  { id: '139', name: '139 邮箱', imapHost: 'imap.139.com', imapPort: 993, smtpHost: 'smtp.139.com', smtpPort: 465, secure: true, emailDomain: '139.com' },
  { id: 'gmail', name: 'Gmail', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465, secure: true, emailDomain: 'gmail.com', oauthProvider: 'gmail', note: '已停用密码登录，请用 OAuth2 浏览器授权（或「应用专用密码」）' },
  { id: 'outlook', name: 'Outlook / Hotmail', imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp.office365.com', smtpPort: 587, secure: true, emailDomain: 'outlook.com', oauthProvider: 'outlook', note: '已停用密码认证，请用 OAuth2 浏览器授权（或「应用专用密码」）' },
  { id: 'icloud', name: 'iCloud', imapHost: 'imap.mail.me.com', imapPort: 993, smtpHost: 'smtp.mail.me.com', smtpPort: 587, secure: true, emailDomain: 'icloud.com', note: '应用专用密码' },
  { id: 'yahoo', name: 'Yahoo', imapHost: 'imap.mail.yahoo.com', imapPort: 993, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, secure: true, emailDomain: 'yahoo.com', note: '应用专用密码' },
];

export function findPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
