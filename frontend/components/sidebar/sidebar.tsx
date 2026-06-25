'use client';

import type { ReactNode } from 'react';
import {
  SidebarSimpleIcon,
  ClockCounterClockwiseIcon,
  FilesIcon,
  XIcon,
} from '@phosphor-icons/react/dist/ssr';
import { HistoryPanel } from '@/components/sidebar/history-panel';
import { RagPanel } from '@/components/sidebar/rag-panel';

/**
 * 左サイドバー（履歴 + RAG）。
 * PR2B: デスクトップ = レール(56px) ⇄ 展開(300px)、モバイル = ドロワー。
 * 開閉は CSS のみ（width / transform / opacity / pointer-events）。display:none・条件render・unmount は不使用。
 * レール層・本体層は常時マウントし、HistoryPanel / RagPanel の fetch 状態とスクロール位置を保持する。
 * 開閉 state・localStorage 永続・scrim は親（ChatWorkspace）が保持。ここは props を CSS に写すだけ。
 */
export function Sidebar({
  collapsed = false,
  mobileOpen = false,
  ready = false,
  onCollapseToggle,
  onMobileClose,
  onSelectHistory,
  accountSlot,
}: {
  collapsed?: boolean;
  mobileOpen?: boolean;
  ready?: boolean;
  onCollapseToggle?: () => void;
  onMobileClose?: () => void;
  onSelectHistory?: (id: string) => void;
  accountSlot?: ReactNode;
}) {
  return (
    <aside
      className={[
        'h-svh overflow-hidden border-r border-border bg-background',
        // モバイル: root 直下 absolute ドロワー（root の relative に対して overlay）
        'absolute inset-y-0 left-0 z-[60] w-[300px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // デスクトップ: flex フロー内（relative = 絶対子のアンカー）。レール ⇄ 展開を width で。
        'md:relative md:inset-auto md:z-auto md:translate-x-0',
        collapsed ? 'md:w-[56px]' : 'md:w-[300px]',
        // transition は ready ゲート（初回スナップ / スライド抑止）
        ready ? 'transition-[width,transform] duration-200 ease-out' : '',
      ].join(' ')}
    >
      {/* ── レール層: md+ かつ collapsed のときだけ可視（常時マウント・幅固定でクリップ） ── */}
      <div
        aria-hidden={!collapsed}
        className={[
          'pointer-events-none absolute inset-y-0 left-0 hidden w-[56px] flex-col items-center gap-1 py-3 opacity-0',
          'md:flex',
          collapsed
            ? 'md:pointer-events-auto md:opacity-100'
            : 'md:pointer-events-none md:opacity-0',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onCollapseToggle}
          aria-label="サイドバーを展開"
          className="grid size-9 place-items-center rounded-lg text-foreground/70 hover:bg-muted hover:text-foreground"
        >
          <SidebarSimpleIcon size={20} />
        </button>
        <button
          type="button"
          onClick={onCollapseToggle}
          aria-label="履歴を開く"
          className="grid size-9 place-items-center rounded-lg text-foreground/70 hover:bg-muted hover:text-foreground"
        >
          <ClockCounterClockwiseIcon size={20} />
        </button>
        <button
          type="button"
          onClick={onCollapseToggle}
          aria-label="RAG を開く"
          className="grid size-9 place-items-center rounded-lg text-foreground/70 hover:bg-muted hover:text-foreground"
        >
          <FilesIcon size={20} />
        </button>
      </div>

      {/* ── 本体層: 展開(md+) / ドロワー開(モバイル) のとき可視（常時マウント・幅固定） ── */}
      <div
        className={[
          'absolute inset-y-0 left-0 flex w-[300px] flex-col',
          collapsed
            ? 'md:pointer-events-none md:opacity-0'
            : 'md:pointer-events-auto md:opacity-100',
        ].join(' ')}
      >
        {/* ヘッダ: 折りたたみ(デスクトップ) / 閉じる(モバイル) */}
        <div className="flex h-12 shrink-0 items-center justify-between px-3">
          <span className="text-sm font-semibold text-foreground">Helix</span>
          <button
            type="button"
            onClick={onCollapseToggle}
            aria-label="サイドバーを折りたたむ"
            className="hidden size-8 place-items-center rounded-lg text-foreground/70 hover:bg-muted hover:text-foreground md:grid"
          >
            <SidebarSimpleIcon size={18} />
          </button>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="閉じる"
            className="grid size-8 place-items-center rounded-lg text-foreground/70 hover:bg-muted hover:text-foreground md:hidden"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* 上: 会話履歴（伸長 + スクロール） */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <HistoryPanel onSelectHistory={onSelectHistory} />
        </div>
        {/* 下: RAG 管理（高さ上限 + スクロール） */}
        <div className="max-h-[45%] min-h-0 overflow-y-auto border-t border-border">
          <RagPanel />
        </div>
        {/* footer: アカウント（PR1・常時DOM維持・空でも存在） */}
        <div className="shrink-0 border-t border-border">{accountSlot}</div>
      </div>
    </aside>
  );
}
