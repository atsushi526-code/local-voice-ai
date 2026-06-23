'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

type SessionMeta = {
  id: string;
  title: string;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
};

interface HistoryDetailProps {
  sessionId: string;
  /** 指定時=オーバーレイ表示（✕閉じる + resumeプレースホルダ）。未指定=ルート表示（← 一覧に戻る）。 */
  onClose?: () => void;
}

/**
 * 履歴詳細の描画（fetch + meta + messages）。
 * /history/[id] ルートと右ペインオーバーレイの双方で共有（DRY）。
 * 詳細は必要時のみ取得し、アンマウントで破棄（常駐キャッシュ・先読みなし）。
 */
export function HistoryDetail({ sessionId, onClose }: HistoryDetailProps) {
  const { data: session, status } = useSession();
  const accessToken = (session as any)?.access_token as string | undefined;
  const sessionError = (session as any)?.error as string | undefined;
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'authenticated' || sessionError || !accessToken || !sessionId) return;
    let aborted = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/history/sessions/${sessionId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) throw new Error(`エラー: ${res.status}`);
        const data = await res.json();
        if (aborted) return;
        setMeta(data.session);
        setMessages(data.messages);
      } catch (e: any) {
        if (!aborted) setError(e.message);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [accessToken, status, sessionError, sessionId]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-xs underline underline-offset-4"
            >
              ✕ 閉じる
            </button>
          ) : (
            <Link href="/history" className="font-mono text-xs underline underline-offset-4">
              ← 一覧に戻る
            </Link>
          )}
          {meta && <h1 className="mt-2 truncate font-mono text-xl font-bold">{meta.title}</h1>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {onClose && (
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="準備中"
              className="cursor-not-allowed rounded border border-border px-2 py-1 font-mono text-xs text-muted-foreground opacity-60"
            >
              会話を再開（準備中）
            </button>
          )}
          {meta && (
            <div className="text-right">
              <p className="font-mono text-xs text-muted-foreground">
                {new Date(meta.started_at).toLocaleString('ja-JP')}
              </p>
              <p className="font-mono text-xs text-muted-foreground">💬 {meta.message_count}件</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-500 bg-red-50 p-3 font-mono text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="読み込み中">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-border p-3">
              <div className="mb-2 h-3 w-24 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="mt-1 h-4 w-2/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">メッセージがありません</p>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg border p-3 ${
                msg.role === 'user' ? 'border-border bg-muted' : 'border-border bg-background'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-xs font-bold">
                  {msg.role === 'user' ? '👤 ユーザー' : '🤖 AI'}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(msg.created_at).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
              <p className="font-mono text-sm">{msg.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
