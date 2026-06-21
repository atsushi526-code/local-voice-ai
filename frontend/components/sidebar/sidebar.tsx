'use client';

import type { ReactNode } from 'react';
import { HistoryPanel } from '@/components/sidebar/history-panel';
import { RagPanel } from '@/components/sidebar/rag-panel';

/**
 * 2ペイン左サイドバー（履歴 + RAG の縦積み）。
 * 表示制御は親（ChatWorkspace）の className（`hidden md:flex` 等）で行う。
 * v1: md+ のみ表示。タブ化・モバイルドロワーは後続PR。
 */
export function Sidebar({
  className = '',
  onSelectHistory,
  accountSlot,
}: {
  className?: string;
  onSelectHistory?: (id: string) => void;
  accountSlot?: ReactNode;
}) {
  return (
    <aside className={`h-svh flex-col bg-background ${className}`}>
      {/* 上: 会話履歴（伸長 + スクロール） */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <HistoryPanel onSelectHistory={onSelectHistory} />
      </div>
      {/* 下: RAG 管理（高さ上限 + スクロール） */}
      <div className="max-h-[45%] min-h-0 overflow-y-auto border-t border-border">
        <RagPanel />
      </div>
      {/* footer: アカウント（常時DOM維持・空でも存在）。accountSlot に Server Component を流し込み */}
      <div className="shrink-0 border-t border-border">{accountSlot}</div>
    </aside>
  );
}
