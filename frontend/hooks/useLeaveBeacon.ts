'use client';

import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';

/**
 * ブラウザ終了（pagehide）時に、unload耐性のある sendBeacon で /api/leave へ
 * 終了通知を送る。backend が RemoveParticipant → agent が正規 close → on_exit。
 * SDK標準の disconnect()（CLIENT_INITIATED, best-effort）が flush できないレースの保険。
 * pagehide のみを対象（タブ切替/最小化では送らない＝復帰可能性を維持）。
 */
export function useLeaveBeacon() {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    const handler = () => {
      const roomName = room.name;
      const identity = room.localParticipant?.identity;
      if (!roomName || !identity) return;
      try {
        const payload = JSON.stringify({ roomName, identity });
        navigator.sendBeacon('/api/leave', new Blob([payload], { type: 'application/json' }));
      } catch {
        // best-effort: 失敗してもサーバ側 timeout にフォールバック
      }
    };

    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, [room]);
}
