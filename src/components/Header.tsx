import React from 'react';
import { Plus, RefreshCw, Search, PenLine, Settings, Mail, Languages, Loader2 } from 'lucide-react';
import { TRANSLATE_LANGUAGES } from '../services/translateService';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onCompose: () => void;
  onAddAccount: () => void;
  onOpenSettings: () => void;
  searching?: boolean;
  /** 翻译当前打开邮件 */
  onTranslate: () => void;
  translating?: boolean;
  translateDisabled?: boolean;
  /** 翻译目标语言代码 */
  targetLang: string;
  onTargetLangChange: (lang: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  onCompose,
  onAddAccount,
  onOpenSettings,
  searching = false,
  onTranslate,
  translating = false,
  translateDisabled = false,
  targetLang,
  onTargetLangChange,
}) => {
  const iconBtn =
    'p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-60 shrink-0';
  const primaryBtn =
    'p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-colors shrink-0';

  return (
    <header className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="flex items-center gap-1.5 pr-2 mr-1 border-r border-border">
          <Mail className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold hidden sm:inline">邮件聚合</span>
        </span>
        <button
          onClick={onAddAccount}
          className={primaryBtn}
          title="添加邮箱账号"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-w-0 max-w-xl mx-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-input bg-muted/40">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          placeholder="搜索邮件（主题 / 发件人 / 正文）"
        />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <select
          value={targetLang}
          onChange={(e) => onTargetLangChange(e.target.value)}
          title="翻译目标语言"
          className="hidden sm:block h-7 max-w-[124px] text-xs px-1.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:border-primary shrink-0"
        >
          {TRANSLATE_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
        <button
          onClick={onTranslate}
          className={iconBtn}
          title={translateDisabled ? '请先打开一封邮件' : '翻译当前邮件'}
          disabled={translateDisabled || translating}
        >
          {translating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Languages className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={onRefresh}
          className={iconBtn}
          title="刷新"
          disabled={searching}
        >
          <RefreshCw className={`w-4 h-4 ${searching ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={onCompose}
          className={primaryBtn}
          title="写邮件"
        >
          <PenLine className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenSettings}
          className={iconBtn}
          title="设置"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default Header;
