'use client';

import { useParams } from 'next/navigation';
import { HistoryDetail } from '@/components/history/history-detail';

/**
 * /history/[id] 詳細ページ（deep-link / モバイル温存）。
 * 描画は共有コンポーネント HistoryDetail に委譲（DRY）。onClose 未指定=ルート表示（← 一覧に戻る）。
 */
export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  return (
    <div className="min-h-screen bg-background p-6 pt-20">
      <HistoryDetail sessionId={sessionId} />
    </div>
  );
}
