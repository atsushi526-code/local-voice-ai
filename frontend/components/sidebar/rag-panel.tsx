'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type Document = {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Sidebar 用 RAG 管理パネル。
 * /rag ページのコア（upload + list + delete）を縮約。詳細は既存 /rag へ遷移。
 * NOTE(v1): fetch ロジックは /rag ページと一部重複（hook 共通化は後続PR）。
 */
export function RagPanel() {
  const { data: session, status } = useSession();
  const accessToken = (session as any)?.access_token as string | undefined;
  const sessionError = (session as any)?.error as string | undefined;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== 'authenticated' || sessionError || !accessToken) return;
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, status, sessionError]);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rag/documents`, {
        headers: { Authorization: `Bearer ${(session as any)?.access_token ?? ''}` },
      });
      if (!res.ok) throw new Error(`エラー: ${res.status}`);
      const data = await res.json();
      setDocuments(data.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rag/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${(session as any)?.access_token ?? ''}` },
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setMessage(`完了: 「${data.filename}」（${data.chunks}チャンク）`);
        fetchDocuments();
      } else if (data.status === 'skipped') {
        setMessage(`スキップ: 「${data.existing_filename}」と重複`);
      } else {
        throw new Error(JSON.stringify(data));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deleteDocument(id: string, filename: string) {
    if (!confirm(`「${filename}」を削除しますか？`)) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rag/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${(session as any)?.access_token ?? ''}` },
      });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setMessage(`削除: 「${filename}」`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-xs font-bold">RAG管理</h2>
        <Link
          href="/rag"
          className="font-mono text-[10px] text-muted-foreground underline underline-offset-2"
        >
          詳細
        </Link>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="mb-2 w-full rounded border border-dashed border-border px-2 py-1.5 font-mono text-[10px] transition-colors hover:bg-muted disabled:opacity-50"
      >
        {uploading ? 'アップロード中...' : '＋ ファイル追加'}
      </button>

      {error && <p className="mb-2 font-mono text-[10px] text-red-600">{error}</p>}
      {message && <p className="mb-2 font-mono text-[10px] text-green-600">{message}</p>}

      {loading ? (
        <p className="font-mono text-[10px] text-muted-foreground">読み込み中...</p>
      ) : documents.length === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">ドキュメントなし</p>
      ) : (
        <ul className="space-y-1">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5"
            >
              <span className="min-w-0 truncate font-mono text-[11px]" title={d.filename}>
                {d.filename}
                <span className="ml-1 text-muted-foreground">{formatBytes(d.file_size)}</span>
              </span>
              <button
                onClick={() => deleteDocument(d.id, d.filename)}
                className="shrink-0 font-mono text-[10px] text-red-500 underline underline-offset-2"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
