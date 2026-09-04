import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountMeta, AttachmentMeta, Credential, Draft, MailDetail, MailMeta } from './types';
import { useAccountStore, AccountInput } from './store/useAccountStore';
import { useMailStore } from './store/useMailStore';
import { useUnifiedStore, UNIFIED_ID } from './store/useUnifiedStore';
import { useUnreadStore } from './store/useUnreadStore';
import * as emailService from './services/emailService';
import * as draftService from './services/draftService';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import AccountForm from './components/AccountForm';
import MailList, { MailFilter } from './components/MailList';
import MailReader from './components/MailReader';
import Compose, { ComposeMode } from './components/Compose';
import Modal from './components/Modal';
import Toast from './components/Toast';
import MoveFolderModal from './components/MoveFolderModal';
import DraftsModal from './components/DraftsModal';
import SettingsModal from './components/SettingsModal';

type ComposeState = {
  mode: ComposeMode;
  source: MailDetail | null;
  account: AccountMeta;
  credential: Credential;
} | null;

const ToolPanel: React.FC = () => {
  const {
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
    toasts,
    addToast,
  } = useAccountStore();

  const currentAccount = accounts.find((a) => a.id === currentAccountId) || null;
  const isUnified = currentAccountId === UNIFIED_ID;

  const [credential, setCredential] = useState<Credential | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountMeta | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(null);
  const [composeDraft, setComposeDraft] = useState<Draft | null>(null);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<AccountMeta | null>(null);

  // 批量操作
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());

  // 邮件分类（全部 / 未读 / 已读），默认聚焦未读——账号/文件夹切换时重置
  const [mailFilter, setMailFilter] = useState<MailFilter>('unread');

  // 移动邮件
  const [moveUids, setMoveUids] = useState<number[] | null>(null);

  // 草稿箱
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  // 账号切换时同步重置凭据（render-phase reset），避免旧账号凭据串扰新账号
  const [prevAccountId, setPrevAccountId] = useState<string | null>(currentAccountId);
  if (prevAccountId !== currentAccountId) {
    setPrevAccountId(currentAccountId);
    setCredential(null);
  }

  // IDLE 新邮件回调（经 ref 读取最新视图状态）
  const isUnifiedRef = useRef(isUnified);
  isUnifiedRef.current = isUnified;
  const accountIdRef = useRef(currentAccountId);
  accountIdRef.current = currentAccountId;

  // 先取 adjustUnread，再声明需要它的 store（避免循环依赖）。
  const { unread, refreshUnread, scheduleUnreadRefresh, adjustUnread } = useUnreadStore(accounts, decryptCredential);
  const mailStore = useMailStore(currentAccount, credential, adjustUnread);
  const unifiedStore = useUnifiedStore(accounts, decryptCredential, isUnified, adjustUnread);

  // 统一订阅 IDLE 新邮件事件
  useEffect(() => {
    const handler = (payload: { id: string }) => {
      scheduleUnreadRefresh();
      if (isUnifiedRef.current) void unifiedStore.refresh();
      else if (payload.id === accountIdRef.current) mailStore.refreshList();
    };
    emailService.onNewMail(handler);
    return () => {
      emailService.onNewMail(() => {});
    };
  }, [scheduleUnreadRefresh, unifiedStore.refresh, mailStore.refreshList]);

  // 账号切换 → 解密凭据（统一视图无需）
  useEffect(() => {
    let cancelled = false;
    if (!isUnified && currentAccount) {
      decryptCredential(currentAccount).then((c) => {
        if (!cancelled) {
          if (c) setCredential(c);
          else addToast('凭据解密失败，请重新编辑账号', 'error');
        }
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccountId]);

  // 账号或文件夹切换时退出多选并恢复「未读」默认视图
  useEffect(() => {
    setSelectionMode(false);
    setSelectedUids(new Set());
    setMailFilter('unread');
  }, [currentAccountId, mailStore.currentFolder]);

  // —— 视图数据源路由 ——
  const activeMessages = isUnified ? unifiedStore.messages : mailStore.messages;
  const activeTotal = isUnified ? unifiedStore.messages.length : mailStore.total;
  const activeLoading = isUnified ? unifiedStore.loading : mailStore.loadingList;
  const activeSearching = isUnified ? unifiedStore.searching : mailStore.searching;
  const activeHasMore = isUnified ? false : mailStore.hasMore;
  const activeSearchQuery = isUnified ? unifiedStore.searchQuery : mailStore.searchQuery;
  const activeDetail = isUnified ? unifiedStore.selectedDetail : mailStore.selectedDetail;
  const activeLoadingDetail = isUnified ? unifiedStore.loadingDetail : mailStore.loadingDetail;
  const activeError = isUnified ? unifiedStore.error : mailStore.error;

  const openAddAccount = useCallback(() => {
    setEditingAccount(null);
    setShowAccountForm(true);
  }, []);

  const openEditAccount = useCallback((account: AccountMeta) => {
    setEditingAccount(account);
    setShowAccountForm(true);
  }, []);

  const handleSaveAccount = useCallback(
    async (input: AccountInput, cred: Credential | null) => {
      if (editingAccount) {
        await updateAccount(editingAccount.id, input, cred ?? undefined);
      } else {
        if (!cred) throw new Error('缺少凭据');
        await addAccount(input, cred);
      }
      setShowAccountForm(false);
    },
    [editingAccount, addAccount, updateAccount],
  );

  const handleDeleteAccount = useCallback(async () => {
    if (!deleteAccountTarget) return;
    await deleteAccount(deleteAccountTarget.id);
    setDeleteAccountTarget(null);
  }, [deleteAccountTarget, deleteAccount]);

  const trashFolder = mailStore.folders.find((f) => f.specialUse === '\\Trash')?.path || null;

  // —— 写信 / 回复 / 转发（携带账号上下文，统一视图与单账号通用） ——

  const openCompose = useCallback(() => {
    if (isUnified) {
      addToast('请在具体账号下写邮件', 'info');
      return;
    }
    if (!currentAccount || !credential) {
      addToast('请先选择账号', 'info');
      return;
    }
    setComposeDraft(null);
    setCompose({ mode: 'new', source: null, account: currentAccount, credential });
  }, [isUnified, currentAccount, credential, addToast]);

  const openComposeFromDetail = useCallback(
    (d: MailDetail, mode: ComposeMode) => {
      setComposeDraft(null);
      if (isUnified) {
        const acc = accounts.find((a) => a.id === d.accountId);
        if (!acc) return;
        decryptCredential(acc).then((cred) => {
          if (cred) setCompose({ mode, source: d, account: acc, credential: cred });
          else addToast('凭据解密失败，请重新编辑账号', 'error');
        });
      } else {
        if (!currentAccount || !credential) return;
        setCompose({ mode, source: d, account: currentAccount, credential });
      }
    },
    [isUnified, accounts, currentAccount, credential, decryptCredential, addToast],
  );

  // —— 删除（统一视图 / 单账号分派） ——

  const handleDeleteByUids = useCallback(
    async (uids: number[]) => {
      if (!currentAccount || !credential) return;
      try {
        await mailStore.deleteMails(uids, trashFolder);
        addToast('邮件已删除', 'success');
      } catch (e) {
        addToast((e as Error).message, 'error');
      }
    },
    [currentAccount, credential, mailStore, trashFolder, addToast],
  );

  const handleDeleteUnified = useCallback(
    async (m: MailMeta) => {
      try {
        await unifiedStore.deleteMail(m);
        addToast('邮件已删除', 'success');
      } catch (e) {
        addToast((e as Error).message, 'error');
      }
    },
    [unifiedStore, addToast],
  );

  const handleDelete = useCallback(
    (m: MailMeta) => {
      if (isUnified) void handleDeleteUnified(m);
      else void handleDeleteByUids([m.uid]);
    },
    [isUnified, handleDeleteUnified, handleDeleteByUids],
  );

  const handleDownloadAttachment = useCallback(
    async (att: AttachmentMeta) => {
      if (isUnified) {
        const d = unifiedStore.selectedDetail;
        if (!d?.accountId) return;
        const acc = accounts.find((a) => a.id === d.accountId);
        if (!acc) return;
        const cred = await decryptCredential(acc);
        if (!cred) return;
        try {
          const res = await emailService.downloadAttachment(acc, cred, 'INBOX', d.uid, att.filename);
          if (res.saved) addToast(`附件已保存：${res.path}`, 'success');
        } catch (e) {
          addToast((e as Error).message, 'error');
        }
        return;
      }
      if (!currentAccount || !credential || !mailStore.selectedDetail) return;
      try {
        const res = await emailService.downloadAttachment(
          currentAccount,
          credential,
          mailStore.currentFolder,
          mailStore.selectedDetail.uid,
          att.filename,
        );
        if (res.saved) addToast(`附件已保存：${res.path}`, 'success');
      } catch (e) {
        addToast((e as Error).message, 'error');
      }
    },
    [isUnified, unifiedStore.selectedDetail, accounts, decryptCredential, currentAccount, credential, mailStore.selectedDetail, mailStore.currentFolder, addToast],
  );

  // —— 多选 / 批量（仅单账号视图） ——

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedUids(new Set());
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((uid: number) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const selectAll = useCallback((visibleUids: number[]) => {
    setSelectedUids(new Set(visibleUids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedUids(new Set());
  }, []);

  const handleBatchMarkSeen = useCallback(
    async (seen: boolean) => {
      if (selectedUids.size === 0) return;
      try {
        await mailStore.batchMarkSeen([...selectedUids], seen);
        addToast(seen ? '已标记为已读' : '已标记为未读', 'success');
        clearSelection();
      } catch (e) {
        addToast((e as Error).message, 'error');
      }
    },
    [selectedUids, mailStore, addToast, clearSelection],
  );

  // 单封邮件标记已读/未读（MailList 菜单调用）
  const handleSingleMarkSeen = useCallback(
    async (uid: number, seen: boolean) => {
      try {
        if (isUnified) {
          // 统一视图：从 activeMessages 中找到对应的 accountId 与 uid
          const meta = activeMessages.find((m) => m.uid === uid);
          if (meta?.accountId) {
            await unifiedStore.markSeen(meta.accountId, uid, seen);
            addToast(seen ? '已标记为已读' : '已标记为未读', 'success');
          }
        } else {
          await mailStore.markSeen(uid, seen);
          addToast(seen ? '已标记为已读' : '已标记为未读', 'success');
        }
      } catch (e) {
        addToast((e as Error).message, 'error');
      }
    },
    [isUnified, unifiedStore, mailStore, activeMessages, addToast],
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedUids.size === 0) return;
    await handleDeleteByUids([...selectedUids]);
    clearSelection();
  }, [selectedUids, handleDeleteByUids, clearSelection]);

  // —— 刷新 / 搜索（供顶部 Header 使用） ——
  const handleRefresh = useCallback(() => {
    if (isUnified) void unifiedStore.refresh();
    else mailStore.refreshList();
    void refreshUnread();
  }, [isUnified, unifiedStore.refresh, mailStore.refreshList, refreshUnread]);

  const handleSearch = useCallback(
    (q: string) => {
      if (isUnified) unifiedStore.runSearch(q);
      else mailStore.runSearch(q);
    },
    [isUnified, unifiedStore.runSearch, mailStore.runSearch],
  );

  // —— 移动邮件（仅单账号视图） ——

  const handleMoveDetail = useCallback((d: MailDetail) => {
    setMoveUids([d.uid]);
  }, []);

  const handleBatchMove = useCallback(() => {
    if (selectedUids.size === 0) return;
    setMoveUids([...selectedUids]);
  }, [selectedUids]);

  const handlePickFolder = useCallback(
    async (folder: string) => {
      const uids = moveUids;
      setMoveUids(null);
      if (!uids || uids.length === 0) return;
      try {
        await mailStore.moveMails(uids, folder);
        addToast(`已移动到 ${folder}`, 'success');
        clearSelection();
      } catch (e) {
        addToast((e as Error).message, 'error');
      }
    },
    [moveUids, mailStore, addToast, clearSelection],
  );

  // —— 草稿 ——

  const openDrafts = useCallback(() => {
    setDrafts(currentAccount ? draftService.loadDrafts(currentAccount.id) : []);
    setShowDrafts(true);
  }, [currentAccount]);

  const handleOpenDraft = useCallback(
    (d: Draft) => {
      const acc = accounts.find((a) => a.id === d.accountId);
      if (!acc) return;
      decryptCredential(acc).then((cred) => {
        if (!cred) {
          addToast('凭据解密失败，请重新编辑账号', 'error');
          return;
        }
        setShowDrafts(false);
        setComposeDraft(d);
        setCompose({ mode: 'new', source: null, account: acc, credential: cred });
      });
    },
    [accounts, decryptCredential, addToast],
  );

  const handleDeleteDraft = useCallback(
    (id: string) => {
      draftService.deleteDraft(id);
      setDrafts(currentAccount ? draftService.loadDrafts(currentAccount.id) : []);
      addToast('草稿已删除', 'success');
    },
    [currentAccount, addToast],
  );

  // —— 复制邮箱（Sidebar 右键菜单） ——
  const handleCopyEmail = useCallback(
    async (email: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(email);
        } else {
          // 非安全上下文降级：execCommand
          const ta = document.createElement('textarea');
          ta.value = email;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        addToast(`已复制：${email}`, 'success');
      } catch (e) {
        addToast('复制失败，请手动复制', 'error');
      }
    },
    [addToast],
  );

  return (
    <div className="one-email-plugin-root flex flex-col h-full min-h-0 w-full bg-background text-foreground">
      {/* 固定位置的头部区域 */}
      <Header
        searchQuery={activeSearchQuery}
        onSearchChange={handleSearch}
        onRefresh={handleRefresh}
        onCompose={openCompose}
        onAddAccount={openAddAccount}
        onOpenSettings={() => setShowSettings(true)}
        searching={activeSearching}
      />

      {/* 下方三栏布局 */}
      <div className="flex-1 flex min-h-0 min-w-0">
        <Sidebar
          accounts={accounts}
          currentAccountId={currentAccountId}
          folders={isUnified ? [] : mailStore.folders}
          currentFolder={mailStore.currentFolder}
          unread={unread}
          onSelectAccount={setCurrentAccountId}
          onSelectUnified={() => setCurrentAccountId(UNIFIED_ID)}
          onSwitchFolder={mailStore.switchFolder}
          onAddAccount={openAddAccount}
          onEditAccount={openEditAccount}
          onDeleteAccount={setDeleteAccountTarget}
          onOpenDrafts={openDrafts}
          onCopyEmail={handleCopyEmail}
          onReorderAccounts={reorderAccounts}
          onSetAccountColor={setAccountColor}
        />

        <MailList
          messages={activeMessages}
          total={activeTotal}
          loading={activeLoading}
          searching={activeSearching}
          hasMore={activeHasMore}
          selectedUid={activeDetail?.uid ?? null}
          selectionMode={selectionMode}
          selectedUids={selectedUids}
          searchQuery={activeSearchQuery}
          mailFilter={mailFilter}
          onFilterChange={setMailFilter}
          onSelect={(m) => (isUnified ? unifiedStore.openMail(m) : mailStore.openMail(m))}
          onLoadMore={mailStore.loadMore}
          onCompose={openCompose}
          onDelete={handleDelete}
          onToggleSelectionMode={() => {
            if (isUnified) {
              addToast('统一收件箱暂不支持批量操作', 'info');
              return;
            }
            toggleSelectionMode();
          }}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onBatchMarkSeen={handleBatchMarkSeen}
          onBatchDelete={handleBatchDelete}
          onBatchMove={handleBatchMove}
          onMarkSeen={handleSingleMarkSeen}
        />

        <div className="flex-1 flex flex-col min-w-0 border-l border-border">
          {activeError && (
            <div className="px-5 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-border">
              {activeError}
            </div>
          )}

          {compose ? (
            <Compose
              key={`${compose.mode}:${compose.source?.uid ?? 'n'}:${composeDraft?.id ?? 'n'}`}
              account={compose.account}
              credential={compose.credential}
              mode={compose.mode}
              source={compose.source}
              draft={composeDraft}
              onClose={() => {
                setCompose(null);
                setComposeDraft(null);
              }}
              onSent={() => {
                setCompose(null);
                setComposeDraft(null);
                if (isUnified) void unifiedStore.refresh();
                else mailStore.refreshList();
              }}
              addToast={addToast}
            />
          ) : (
            <MailReader
              detail={activeDetail}
              loading={activeLoadingDetail}
              onReply={(d) => openComposeFromDetail(d, 'reply')}
              onForward={(d) => openComposeFromDetail(d, 'forward')}
              onDelete={(d) => {
                if (isUnified && d.accountId) {
                  const meta = activeMessages.find((m) => m.uid === d.uid && m.accountId === d.accountId);
                  if (meta) void handleDeleteUnified(meta);
                } else {
                  void handleDeleteByUids([d.uid]);
                }
              }}
              onMarkUnread={(d) => {
                if (isUnified && d.accountId) void unifiedStore.markSeen(d.accountId, d.uid, false);
                else mailStore.markSeen(d.uid, false);
              }}
              onMove={(d) => {
                if (isUnified) {
                  addToast('统一收件箱暂不支持移动，请在具体账号下操作', 'info');
                  return;
                }
                handleMoveDetail(d);
              }}
              onDownloadAttachment={handleDownloadAttachment}
            />
          )}
        </div>
      </div>

      <AccountForm
        isOpen={showAccountForm}
        account={editingAccount}
        onClose={() => setShowAccountForm(false)}
        onSave={handleSaveAccount}
        oauthClients={oauthClients}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        oauthClients={oauthClients}
        onSaveOAuthClient={setOAuthClient}
      />

      <Modal
        isOpen={!!deleteAccountTarget}
        onClose={() => setDeleteAccountTarget(null)}
        title="删除账号"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteAccountTarget(null)}
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          确认删除账号「{deleteAccountTarget?.displayName || deleteAccountTarget?.email}」？
          删除后该账号将从列表中移除（邮件服务器上的数据不受影响）。
        </p>
      </Modal>

      <MoveFolderModal
        isOpen={moveUids !== null}
        folders={mailStore.folders}
        currentFolder={mailStore.currentFolder}
        onClose={() => setMoveUids(null)}
        onPick={handlePickFolder}
      />

      <DraftsModal
        isOpen={showDrafts}
        drafts={drafts}
        onClose={() => setShowDrafts(false)}
        onOpen={handleOpenDraft}
        onDelete={handleDeleteDraft}
      />

      <Toast toasts={toasts} />
    </div>
  );
};

export default ToolPanel;
