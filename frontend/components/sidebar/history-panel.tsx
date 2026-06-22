'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type SessionItem = {
  id: string;
  title: string;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
  last_message_at: string;
  message_count: number;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / 86400000);
  const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `今日 ${time}`;
  if (diffDays === 1) return `昨日 ${time}`;
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) + ` ${time}`;
}

/**
 * Sidebar 用 会話履歴パネル。
 * /history ページのコア（fetch + list + delete）を縮約。詳細は既存 /history/[id] へ遷移。
 * NOTE(v1): fetch ロジックは /history ページと一部重複（hook 共通化は後続PR）。
 */
export function HistoryPanel({ onSelectHistory }: { onSelectHistory?: (id: string) => void }) {
  const { data: session, status } = useSession();
  const accessToken = (session as any)?.access_token as string | undefined;
  const sessionError = (session as any)?.error as string | undefined;
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authenticated' || sessionError || !accessToken) return;
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, status, sessionError]);

  async function fetchSessions() {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/history/sessions`, {
        headers: { Authorization: `Bearer ${(session as any)?.access_token ?? ''}` },
      });
      if (!res.ok) throw new Error(`エラー: ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSession(id: string, title: string) {
    if (!confirm(`「${title}」を削除しますか？この操作は元に戻せません。`)) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/history/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${(session as any)?.access_token ?? ''}` },
      });
      if (!res.ok) throw new Error(`削除エラー: ${res.status}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-xs font-bold">会話履歴</h2>
        <Link
          href="/history"
          className="font-mono text-[10px] text-muted-foreground underline underline-offset-2"
        >
          一覧
        </Link>
      </div>

      {error && <p className="mb-2 font-mono text-[10px] text-red-600">{error}</p>}

      {loading ? (
        <p className="font-mono text-[10px] text-muted-foreground">読み込み中...</p>
      ) : sessions.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">履歴がありません</p>
      ) : (
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => onSelectHistory?.(s.id)}
                className="block min-w-0 flex-1 rounded border border-border px-2 py-1.5 text-left transition-colors hover:bg-muted"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs">{s.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatDate(s.last_message_at)}
                  </span>
                </div>
              </button>
              <button
                onClick={() => deleteSession(s.id, s.title)}
                aria-label="削除"
                className="shrink-0 rounded border border-border px-1.5 text-xs text-muted-foreground transition-colors hover:border-red-400 hover:text-red-500"
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
