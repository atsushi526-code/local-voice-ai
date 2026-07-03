'use client';

/**
 * PR-U1: 遅延接続 (deferred connect) の共有点。
 *
 * 方式(b): 画面表示では接続しない。初回ユーザー操作 (pointerdown / focus / 送信) で
 * ensureConnected() が呼ばれた時に一度だけ start() する (プリウォーム)。
 * - 多重呼び出しは in-flight Promise を共有して単一接続に収束。
 * - 送信側は await ensureConnected() で接続完了を待ってから send できる。
 */
import { createContext, useContext } from 'react';

export interface DeferredConnect {
  /** 未接続なら接続を開始し、接続完了で resolve。接続済なら即 resolve。 */
  ensureConnected: () => Promise<void>;
  isConnected: boolean;
}

export const DeferredConnectContext = createContext<DeferredConnect>({
  ensureConnected: async () => {},
  isConnected: false,
});

export function useDeferredConnect(): DeferredConnect {
  return useContext(DeferredConnectContext);
}
