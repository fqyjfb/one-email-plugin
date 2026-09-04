// 加密服务 - 基于 Web Crypto API 的本地存储加密
// 注意：将密钥与数据一同存储在 localStorage 中并不能防止 XSS 攻击
//（恶意 JS 可以读取两者），但可以混淆磁盘上的敏感数据
// 并防止随意检查或"肩部窥探"泄露。

const ALGORITHM = 'AES-GCM';
const KEY_STORAGE_KEY = 'one_email_encryption_key';

export class CryptoService {
  private key: CryptoKey | null = null;

  // 初始化或获取加密密钥
  async init(): Promise<void> {
    const storedKey = localStorage.getItem(KEY_STORAGE_KEY);

    if (storedKey) {
      // 导入现有密钥
      const keyData = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
      this.key = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        ALGORITHM,
        true,
        ['encrypt', 'decrypt']
      );
    } else {
      // 生成新密钥
      this.key = await window.crypto.subtle.generateKey(
        { name: ALGORITHM, length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // 导出并保存密钥（混淆层）
      const exported = await window.crypto.subtle.exportKey('raw', this.key);
      const keyString = btoa(String.fromCharCode(...new Uint8Array(exported)));
      localStorage.setItem(KEY_STORAGE_KEY, keyString);
    }
  }

  async encrypt(data: any): Promise<string> {
    if (!this.key) await this.init();
    if (!this.key) throw new Error("加密密钥初始化失败");

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(data));

    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      this.key,
      encodedData
    );

    // 将 IV 和数据合并存储：IV(12字节) + 加密数据
    const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedContent), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedString: string): Promise<any> {
    if (!this.key) await this.init();
    if (!this.key) throw new Error("加密密钥初始化失败");

    try {
      const combined = Uint8Array.from(atob(encryptedString), c => c.charCodeAt(0));

      // 提取 IV
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decryptedContent = await window.crypto.subtle.decrypt(
        { name: ALGORITHM, iv },
        this.key,
        data
      );

      const decoded = new TextDecoder().decode(decryptedContent);
      return JSON.parse(decoded);
    } catch (e) {
      console.error("解密失败", e);
      return null;
    }
  }
}

export const cryptoService = new CryptoService();
