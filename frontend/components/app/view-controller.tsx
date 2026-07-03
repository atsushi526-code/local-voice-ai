'use client';

import { useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { DeferredConnectContext } from '@/components/app/deferred-connect';
import { SessionView } from '@/components/app/session-view';

const MotionSessionView = motion.create(SessionView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear',
  },
};

interface ViewControllerProps {
  appConfig: AppConfig;
}

export function ViewController({ appConfig }: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  // PR-U1: 遅延接続。in-flight Promise を共有し多重 start を単一接続へ収束。
  const startingRef = useRef<Promise<void> | null>(null);

  const ensureConnected = useCallback(async () => {
    if (isConnected) return;
    if (!startingRef.current) {
      startingRef.current = Promise.resolve(
        start({ tracks: { microphone: { enabled: false } } })
      )
        .then(() => undefined)
        .finally(() => {
          startingRef.current = null;
        });
    }
    await startingRef.current;
  }, [isConnected, start]);

  const deferred = useMemo(
    () => ({ ensureConnected, isConnected }),
    [ensureConnected, isConnected]
  );

  // PR-U1: Welcome/Start call を廃止し、直接チャット画面 (UI 即時表示・接続は初回操作時)。
  return (
    <DeferredConnectContext.Provider value={deferred}>
      <AnimatePresence mode="wait">
        <MotionSessionView key="session-view" {...VIEW_MOTION_PROPS} appConfig={appConfig} />
      </AnimatePresence>
    </DeferredConnectContext.Provider>
  );
}
