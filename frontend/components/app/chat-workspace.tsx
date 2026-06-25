'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ListIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { App } from '@/components/app/app';
import { Sidebar } from '@/components/sidebar/sidebar';
import { HistoryOverlay } from '@/components/history/history-overlay';

interface ChatWorkspaceProps {
  appConfig: AppConfig;
  accountSlot?: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'helix.sidebar.collapsed';

/**
 * 2ペインのワークスペース。左 = Sidebar（履歴 + RAG）、右 = チャット本体（App）。
 *
 * PR2B（開閉）:
 * - collapsed（デスクトップ・既定 true = 56px レール・localStorage 永続） / drawerOpen（モバイル） / ready（transition ゲート）。
 * - SSR / 初回クライアントは既定値で一致 → マウント後 localStorage 復元 → rAF で ready=true（復元の幅スナップを不可視化）。
 * - 開閉は CSS のみ。ハンバーガー / scrim は右ペインの外（root 直下）に置き、z で右ペイン(translateZ)内の fixed z-50 を上回る。
 *
 * 再mount / 接続保護（v1 から不変）:
 * - 右ペインの <App>（SessionProvider / RoomContext）は常に同一位置・無条件で描画。appEl は useMemo[appConfig] で参照固定。
 * - 開閉 state（collapsed/drawerOpen/ready）は appEl の deps に入れない＝通話中の再mountなし。
 * - 右ペイン div の transform(translateZ(0)) はチャットの fixed 子孫の包含ブロック。無改変。
 */
export function ChatWorkspace({ appConfig, accountSlot }: ChatWorkspaceProps) {
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // 既定値で初期描画 → マウント後に localStorage 復元 → rAF で transition 解禁。
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (v === 'false') setCollapsed(false);
      else if (v === 'true') setCollapsed(true);
    } catch {
      /* localStorage 不可時は既定値(collapsed=true)のまま */
    }
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        /* no-op */
      }
      return next;
    });
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeHistory = useCallback(() => setHistoryId(null), []);
  const handleSelectHistory = useCallback((id: string) => {
    setHistoryId(id);
    setDrawerOpen(false); // 履歴選択でモバイルドロワーを閉じる
  }, []);

  // App は historyId / 開閉 state のトグルで再render/再生成させない（要素参照を固定）。
  const appEl = useMemo(() => <App appConfig={appConfig} />, [appConfig]);

  return (
    <div className="relative flex h-svh w-full overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={drawerOpen}
        ready={ready}
        onCollapseToggle={toggleCollapsed}
        onMobileClose={closeDrawer}
        onSelectHistory={handleSelectHistory}
        accountSlot={accountSlot}
      />

      {/* モバイル: ハンバーガー（md 未満のみ・右ペイン外）。z: scrim(55) < burger(56) < drawer(60)。 */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="メニューを開く"
        className="absolute top-3 left-3 z-[56] grid size-10 place-items-center rounded-lg border border-border bg-background text-foreground shadow-sm md:hidden"
      >
        <ListIcon size={20} />
      </button>

      {/* scrim: DOM 常駐・opacity 制御。デスクトップは無害化（クリックを奪わない）。 */}
      <div
        onClick={closeDrawer}
        aria-hidden
        className={[
          'absolute inset-0 z-[55] bg-black/50',
          ready ? 'transition-opacity duration-200' : '',
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          'md:pointer-events-none md:opacity-0',
        ].join(' ')}
      />

      <div className="relative min-w-0 flex-1 [transform:translateZ(0)]">
        {appEl}
        {historyId && <HistoryOverlay sessionId={historyId} onClose={closeHistory} />}
      </div>
    </div>
  );
}
