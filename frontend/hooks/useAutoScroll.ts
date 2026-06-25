import { useEffect, useRef } from 'react';
import type { HelixMessage } from '@/hooks/useHelixMessages';
import type { StatusIndicator } from '@/components/app/chat-transcript';

/**
 * 自動スクロール（最下部追従）。
 * - 新メッセージ: 末尾がローカル発話(role==='user') or near-bottom(100px) のとき最下部へ
 * - statusIndicator 変化: near-bottom のときのみ最下部へ
 *
 * ロジックは session-view.tsx から無改変で移設（PR2C-A U3）。
 * scrollAreaRef は本フックが生成・返却する。
 */
export function useAutoScroll(
  messages: HelixMessage[],
  statusIndicator: StatusIndicator | null,
) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが来たら最下部へスクロール
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    const lastMessage = messages.at(-1);
    const lastMessageIsLocal = lastMessage?.role === 'user';
    if (lastMessageIsLocal || isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // インジケータ変化時も自動スクロール（末尾付近のときのみ）
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el || !statusIndicator) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [statusIndicator]);

  return scrollAreaRef;
}
