// lib/status-indicator.ts
// 会話状態インジケータの型・定数・導出（純関数・副作用なし）。
// PR2C-A U4: session-view の優先度導出と chat-transcript の型をここへ集約。
import type { AgentState } from '@livekit/components-react';

export interface StatusIndicator {
  emoji: string;
  text: string;
}

export const STATUS_LISTENING: StatusIndicator = { emoji: '🎤', text: '聞いています…' };
export const STATUS_SEARCHING: StatusIndicator = { emoji: '🔍', text: '検索しています…' };
export const STATUS_THINKING: StatusIndicator = { emoji: '💭', text: '回答を考えています…' };

export interface StatusIndicatorInputs {
  isSpeaking: boolean;
  deepSearching: boolean;
  agentState: AgentState;
  streaming: boolean;
}

// 優先度: isSpeaking > deepSearch > thinking（streaming=delta受信中は thinking 非表示）
export function deriveStatusIndicator({
  isSpeaking,
  deepSearching,
  agentState,
  streaming,
}: StatusIndicatorInputs): StatusIndicator | null {
  if (isSpeaking) return STATUS_LISTENING;
  if (deepSearching) return STATUS_SEARCHING;
  if (agentState === 'thinking' && !streaming) return STATUS_THINKING;
  return null;
}
