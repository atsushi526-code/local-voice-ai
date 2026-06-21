'use client';

import { useEffect } from 'react';
import { HistoryDetail } from '@/components/history/history-detail';

interface HistoryOverlayProps {
  sessionId: string | null;
  onClose: () => void;
}

/**
 * 履歴詳細の「右ペイン内完結」オーバーレイ。
 * - 親(ChatWorkspace)の右ペインdiv(transform包含ブロック)内に absolute inset-0 で重なる。
 *   viewport全面にはしない=サイドバー一覧は残置・クリック可(履歴→履歴の最短切替)。
 * - App は親で無条件描画のまま=開閉/切替で通話・入力状態を保持(再mountなし)。
 * - 切替時は scrollコンテナを sessionId で key して再mount=再fetch + スクロール先頭リセット。
 * - 閉じると本コンポーネントごとアンマウント=詳細stateを破棄(常駐キャッシュ・先読みなし)。
 */
export function HistoryOverlay({ sessionId, onClose }: HistoryOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!sessionId) return null;

  return (
    <div
      key={sessionId}
      role="dialog"
      aria-modal="true"
      className="absolute inset-0 z-40 overflow-y-auto bg-background p-6 pt-12"
    >
      <HistoryDetail sessionId={sessionId} onClose={onClose} />
    </div>
  );
}
