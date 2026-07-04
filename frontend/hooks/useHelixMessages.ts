'use client';

import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';

export interface HelixMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string; // raw — 一切加工しない
  ts: number;
  part?: number; // 分割送信時のパート番号
  parts?: number; // 総パート数
  kind?: 'delta' | 'final';
  seq?: number; // delta連番
  finalized?: boolean; // finalで確定済み
}

const TOPIC = 'helix.chat';
const CONTROL_TOPIC = 'helix.control';

/**
 * 統一メッセージストリーム(helix.chat)の購読。
 * assistantは同一msg_idでdelta(差分逐次)→final(確定全文置換)を受信する。
 * deltaはseq順に結合してidベースupsert、finalは800B分割を再結合して全文置換する。
 * userはfinalのみ表示。interim/transcription表示は廃止済み。
 */
export function useHelixMessages(
  room?: Room,
  ensureConnected?: () => Promise<void>
): {
  messages: HelixMessage[];
  streaming: boolean; // delta受信中（未finalized assistant有り）
} {
  const [messages, setMessages] = useState<HelixMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const partsBufRef = useRef<Map<string, Map<number, string>>>(new Map());
  // delta結合用: id -> (seq -> text)。seq順に連結して逐次表示する。
  const deltaBufRef = useRef<Map<string, Map<number, string>>>(new Map());
  // final確定済みid。delta遅延到着を同期判定で弾き、deltaBufのリークを防ぐ。
  const finalizedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!room) return;
    const handler = async (reader: any) => {
      const dbgId = `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setMessages((prev) => [
        ...prev,
        {
          id: dbgId,
          role: 'assistant',
          text: `📩 受信開始 (size=${reader?.info?.size ?? '?'})`,
          ts: Date.now(),
        },
      ]);
      try {
        const raw = await reader.readAll();
        // 受信成功 → マーカーを除去
        setMessages((prev) => prev.filter((m) => m.id !== dbgId));
        const msg = JSON.parse(raw) as HelixMessage;
        if (!msg.id || !msg.role || typeof msg.text !== 'string') return;

        // ── delta(差分逐次): seq順に結合してidベースupsert ──
        if (msg.kind === 'delta') {
          // A: final確定済みなら結合もbuf生成も再描画も行わない（リーク防止）
          if (finalizedIdsRef.current.has(msg.id)) return;
          const buf = deltaBufRef.current.get(msg.id) ?? new Map<number, string>();
          buf.set(msg.seq ?? 0, msg.text);
          deltaBufRef.current.set(msg.id, buf);
          const maxSeq = Math.max(...buf.keys());
          const joined = Array.from({ length: maxSeq + 1 }, (_, i) => buf.get(i) ?? '').join('');
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === msg.id);
            if (idx === -1) {
              return [...prev, { id: msg.id, role: msg.role, text: joined, ts: msg.ts, finalized: false }];
            }
            // final確定後はdeltaを無視（順序逆転対策）
            if (prev[idx].finalized) return prev;
            const next = prev.slice();
            next[idx] = { ...next[idx], text: joined };
            return next;
          });
          setStreaming(true);
          return;
        }

        // ── final(確定): 800B分割を再結合して全文置換 ──
        const totalParts = msg.parts ?? 1;
        let finalText = msg.text;
        if (totalParts > 1) {
          const buf = partsBufRef.current.get(msg.id) ?? new Map<number, string>();
          buf.set(msg.part ?? 0, msg.text);
          partsBufRef.current.set(msg.id, buf);
          if (buf.size < totalParts) return; // 全パート未着
          finalText = Array.from({ length: totalParts }, (_, i) => buf.get(i) ?? '').join('');
          partsBufRef.current.delete(msg.id);
        }
        finalizedIdsRef.current.add(msg.id);
        deltaBufRef.current.delete(msg.id);
        setStreaming(false);
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === msg.id);
          if (idx === -1) {
            return [...prev, { id: msg.id, role: msg.role, text: finalText, ts: msg.ts, finalized: true }];
          }
          const next = prev.slice();
          next[idx] = { ...next[idx], text: finalText, finalized: true };
          return next;
        });
      } catch (e) {
        console.error('helix.chat parse failed:', e);
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            text: `⚠️ メッセージ受信エラー: ${String(e)}`,
            ts: Date.now(),
          },
        ]);
      }
    };
    // ── 会話ペインを完全クリアする共通処理（reset_done受信／New Chat即時クリアの両方で使用） ──
    const clearConversation = () => {
      deltaBufRef.current.clear();
      finalizedIdsRef.current.clear();
      partsBufRef.current.clear();
      setStreaming(false);
      setMessages([]);
    };

    // ── helix.control: New Chat の reset 完了通知（確認用の保険。楽観クリア後の再確定） ──
    const controlHandler = async (reader: any) => {
      try {
        const raw = await reader.readAll();
        const msg = JSON.parse(raw) as { type?: string };
        if (msg.type === 'reset_done') {
          clearConversation();
        } else if (msg.type === 'resume_done') {
          // PR-U4: resume完了。表示は helix:resume 受理時に過去ログで初期化済み（クリアしない）。
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('helix:resume-done'));
          }
        }
      } catch (e) {
        console.error('helix.control parse failed:', e);
      }
    };

    // ── New Chat 押下時の楽観的クリア（backendのreset完了を待たず即時。control-barからdispatch） ──
    const onNewChat = () => clearConversation();
    if (typeof window !== 'undefined') {
      window.addEventListener('helix:new-chat', onNewChat);
    }

    // ── PR-U4 履歴resume: HistoryDetailからdispatch。過去ログで表示初期化 → resume_session送信 ──
    // 新session+過去コンテキスト注入（agent側PR-U3）。resume_doneはCONTROL_TOPICで受信。
    const onResume = async (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { sessionId?: string; messages?: { id: string; role: string; content: string; created_at: string }[] }
        | undefined;
      const sid = detail?.sessionId;
      if (!sid) return;
      // 表示初期化: フロント取得済みの過去messagesを使用（agentからは送り返さない=2KB制限回避）
      clearConversation();
      const past = (detail?.messages ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: `hist_${m.id}`,
          role: m.role as 'user' | 'assistant',
          text: m.content,
          ts: new Date(m.created_at).getTime(),
          kind: 'final' as const,
          finalized: true,
        }));
      setMessages(past);
      try {
        if (ensureConnected) await ensureConnected();
        const payload = new TextEncoder().encode(
          JSON.stringify({ type: 'resume_session', session_id: sid })
        );
        await room.localParticipant.publishData(payload, { reliable: true });
      } catch (err) {
        console.error('resume_session publish failed:', err);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('helix:resume-fail'));
        }
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('helix:resume', onResume);
    }

    room.registerTextStreamHandler(TOPIC, handler);
    room.registerTextStreamHandler(CONTROL_TOPIC, controlHandler);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('helix:new-chat', onNewChat);
        window.removeEventListener('helix:resume', onResume);
      }
      try {
        room.unregisterTextStreamHandler(TOPIC);
      } catch {
        /* already unregistered */
      }
      try {
        room.unregisterTextStreamHandler(CONTROL_TOPIC);
      } catch {
        /* already unregistered */
      }
    };
  }, [room, ensureConnected]);

  return { messages, streaming };
}
