// 存储服务 - 封装 window.electron.plugin.storage（SQLite key-value，按 pluginId+userId 隔离）
// 参考 favorite-plugin/src/services/sqliteStorageService.ts 的封装范式

import type { PluginConfig, PluginSettings } from '../types';

const STORAGE_KEY = 'plugin-one-email';
const CONFIG_KEY = 'config';
const CONFIG_VERSION = '1.0.0';

const DEFAULT_SETTINGS: PluginSettings = {
  defaultSignature: '',
  pageSize: 50,
};

function getPluginContext() {
  const pluginData = (window as any).__PLUGIN_DATA__;
  const pluginId = pluginData?.pluginId || STORAGE_KEY;
  const userId = pluginData?.userId || 'default';
  const isElectron = !!(window as any).electron?.plugin?.storage;
  return { pluginId, userId, isElectron };
}

function createDefaultConfig(): PluginConfig {
  return { version: CONFIG_VERSION, accounts: [], settings: { ...DEFAULT_SETTINGS } };
}

function migrateConfig(config: PluginConfig): PluginConfig {
  if (!config.accounts) config.accounts = [];
  if (!config.settings) config.settings = { ...DEFAULT_SETTINGS };
  if (config.settings.pageSize === undefined) config.settings.pageSize = DEFAULT_SETTINGS.pageSize;
  if (config.version !== CONFIG_VERSION) config.version = CONFIG_VERSION;
  return config;
}

export async function loadConfig(): Promise<PluginConfig> {
  const { pluginId, userId, isElectron } = getPluginContext();

  if (isElectron) {
    try {
      const result = await (window as any).electron.plugin.storage.get(pluginId, userId, CONFIG_KEY);
      if (result) {
        const parsed = (typeof result === 'string' ? JSON.parse(result) : result) as PluginConfig;
        return migrateConfig(parsed);
      }
    } catch (e) {
      console.error('loadConfig from SQLite failed:', e);
    }
  }

  try {
    const raw = localStorage.getItem('toolbox.one-email.config');
    if (raw) return migrateConfig(JSON.parse(raw) as PluginConfig);
  } catch {
    /* ignore */
  }

  return createDefaultConfig();
}

export async function saveConfig(config: PluginConfig): Promise<void> {
  const { pluginId, userId, isElectron } = getPluginContext();

  try {
    if (isElectron) {
      await (window as any).electron.plugin.storage.set(pluginId, userId, CONFIG_KEY, config);
    }
    localStorage.setItem('toolbox.one-email.config', JSON.stringify(config));
  } catch (e) {
    console.error('saveConfig failed:', e);
  }
}

export async function resetConfig(): Promise<PluginConfig> {
  const config = createDefaultConfig();
  await saveConfig(config);
  return config;
}
