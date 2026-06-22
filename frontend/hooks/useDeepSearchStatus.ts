import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';

/**
 * Deep Search status 購読（DataChannel経由）
 * 初回受信した Agent identity を記録し、以降は完全一致で判定する。
 * 将来複数参加者が同一Roomに入った場合にも誤判定しない。
 *
 * 挙動は session-view.tsx から無改変で移設（PR2C-A U2）。
 */
export function useDeepSearchStatus(room?: Room): boolean {
  const [deepSearching, setDeepSearching] = useState(false);
  const myAgentIdentityRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array, participant: any, _kind: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type !== 'deep_search_status') return;
        const senderIdentity: string = participant?.identity ?? '';
        // 初回: Agent種別の参加者からの deep_search_status のみ identity を記録
        // participant.kind === 4 (AGENT) で限定し、将来別DataChannel送信元が増えても誤学習を防ぐ
        if (!myAgentIdentityRef.current && senderIdentity && participant?.kind === 4) {
          myAgentIdentityRef.current = senderIdentity;
        }
        // 2回目以降: 記録済み identity と完全一致のみ受け付ける
        if (myAgentIdentityRef.current && senderIdentity !== myAgentIdentityRef.current) {
          return;
        }
        setDeepSearching(data.status === 'start');
      } catch { /* ignore non-JSON */ }
    };
    room.on('dataReceived', handler);
    return () => { room.off('dataReceived', handler); };
  }, [room]);
  return deepSearching;
}
