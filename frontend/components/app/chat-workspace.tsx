'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { AppConfig } from '@/app-config';
import { App } from '@/components/app/app';
import { Sidebar } from '@/components/sidebar/sidebar';
import { HistoryOverlay } from '@/components/history/history-overlay';

interface ChatWorkspaceProps {
  appConfig: AppConfig;
  accountSlot?: ReactNode;
}

/**
 * 2ペインのワークスペース。
 * 左 = Sidebar（履歴 + RAG、md+ のみ・固定幅）、右 = チャット本体（App）。
 *
 * 重要（再mount/接続保護）:
 * - 右ペインの <App>（SessionProvider / RoomContext を内包）はツリー上で常に同一位置・無条件で描画する。
 *   サイドバーの表示/非表示は CSS（hidden md:flex）のみで行い、DOM から出し入れしないため、
 *   通話中の幅変化や App の再mountを起こさない。
 *
 * 重要（クリック可否 / レイアウト閉じ込め）:
 * - チャット（session-view）は `fixed inset-0`・`fixed bottom-0` を使う＝本来 viewport 基準で全画面に広がり、
 *   2ペインだと左サイドバー上に透明オーバーレイとして被って pointer を奪う。
 * - 右ペイン div に transform(translateZ(0)) を与えると「position:fixed 子孫の包含ブロック」になり、
 *   チャットの fixed 要素が右ペイン内に閉じ込められる → サイドバーがクリック可能・コントロールバーもペイン内に収まる。
 *   App/session-view 自体は無改変（最小変更）。
 */
export function ChatWorkspace({ appConfig, accountSlot }: ChatWorkspaceProps) {
  const [historyId, setHistoryId] = useState<string | null>(null);
  const closeHistory = useCallback(() => setHistoryId(null), []);
  // App は historyId トグルで再render/再生成させない（要素参照を固定）。
  const appEl = useMemo(() => <App appConfig={appConfig} />, [appConfig]);

  return (
    <div className="flex h-svh w-full overflow-hidden">
      <Sidebar
        className="hidden md:flex md:w-[300px] md:shrink-0 md:border-r md:border-border"
        onSelectHistory={setHistoryId}
        accountSlot={accountSlot}
      />

      {/* モバイル用 履歴/RAG 導線（md 未満のみ。サイドバー非表示の代替）。既存ルートへ遷移。 */}
      <nav className="fixed top-0 right-0 z-50 flex gap-3 p-3 md:hidden">
        <Link
          href="/history"
          className="text-foreground font-mono text-xs underline underline-offset-4"
        >
          履歴
        </Link>
        <Link
          href="/rag"
          className="text-foreground font-mono text-xs underline underline-offset-4"
        >
          RAG
        </Link>
      </nav>

      <div className="relative min-w-0 flex-1 [transform:translateZ(0)]">
        {appEl}
        {historyId && <HistoryOverlay sessionId={historyId} onClose={closeHistory} />}
      </div>
    </div>
  );
}
