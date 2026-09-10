// 邮箱插件类型定义
// 与主进程 emailService.cjs 返回结构对齐

export type AuthType = 'password' | 'appPassword' | 'oauth';

/** 连接所需字段（协议层只用这些；测试连接/收发时无需完整账号对象） */
export interface AccountConnection {
  imapHost: string;
  imapPort: number; // 993
  smtpHost: string;
  smtpPort: number; // 465 / 587
  secure: boolean; // IMAP 是否隐式 TLS（993=true）
}

/** 账号元数据（持久化到 SQLite 的 config） */
export interface AccountMeta extends AccountConnection {
  id: string;
  displayName: string;
  email: string;
  imapHost: string;
  imapPort: number; // 993
  smtpHost: string;
  smtpPort: number; // 465 / 587
  secure: boolean; // IMAP 是否隐式 TLS（993=true）
  authType: AuthType;
  credentialEnc: string; // AES-GCM 密文（Base64）
  signature?: string;
  createdAt: number;
  updatedAt: number;
  /** 手动标记颜色（右键菜单设置；CSS 色值，如 #ef4444） */
  color?: string;
  /** 分组内拖拽排序权重（新增时默认取 createdAt；缺失时回退 createdAt） */
  order?: number;
}

/** 明文凭据（仅内存态，经 IPC 传主进程用后即弃） */
export interface Credential {
  username: string;
  password?: string; // password / appPassword
  accessToken?: string; // oauth
  refreshToken?: string; // oauth：自动刷新令牌
  clientId?: string; // oauth：应用注册的 clientId（刷新令牌用）
  clientSecret?: string; // oauth：可选（公共客户端可省略）
  provider?: 'gmail' | 'outlook'; // oauth：服务商标识
  expiresAt?: number; // oauth：accessToken 过期时间戳（毫秒）
}

export interface Address {
  name?: string;
  address: string;
}

/** 邮件头（列表用，对应 listMessages 返回） */
export interface MailMeta {
  uid: number;
  messageId: string | null;
  from: Address | null;
  subject: string;
  seen: boolean;
  hasAttachment: boolean;
  date: number;
  /** 统一收件箱注入：所属账号 id（单账号视图无） */
  accountId?: string;
  /** 统一收件箱注入：所属账号邮箱 */
  accountEmail?: string;
}

/** 附件元数据 */
export interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
  cid?: string | null;
}

/** 完整邮件（对应 getMessage 返回） */
export interface MailDetail {
  uid: number;
  messageId: string | null;
  from: Address | null;
  to: Address[];
  cc: Address[];
  subject: string;
  text: string | null;
  html: string | null;
  date: number;
  attachments: AttachmentMeta[];
  /** 统一收件箱注入：所属账号 id（单账号视图无） */
  accountId?: string;
}

/** IMAP 文件夹 */
export interface Folder {
  path: string;
  /** 服务端层级分隔符（用于还原父子层级、拼接子路径） */
  delimiter?: string;
  specialUse: string | null; // \Sent \Trash \Drafts 等
  subscribed: boolean;
}

/** 写信内容（对应 sendMessage 的 mail 参数） */
export interface ComposeMail {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: {
    filename: string;
    content: string | ArrayBuffer;
    contentType?: string;
  }[];
}

/** OAuth 自有客户端配置（按服务商存储） */
export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

/** 全局 OAuth 客户端配置映射：provider -> clientId/secret */
export type OAuthClientMap = Partial<Record<'gmail' | 'outlook', OAuthClientConfig>>;

export interface PluginSettings {
  defaultSignature?: string;
  pageSize: number;
  oauthClients?: OAuthClientMap;
}

export interface PluginConfig {
  version: string;
  accounts: AccountMeta[];
  settings: PluginSettings;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

/** 本地草稿（存 localStorage，区别于服务器 \Drafts 草稿箱） */
export interface Draft {
  id: string;
  accountId: string;
  to: string;
  cc: string;
  /** 密送：历史草稿无此字段（兼容：读取时 d.bcc || ''） */
  bcc?: string;
  subject: string;
  bodyHtml: string;
  updatedAt: number;
}

/** 文件夹 → 未读数 映射（getUnreadCounts 返回） */
export type FolderUnreadMap = Record<string, number>;
