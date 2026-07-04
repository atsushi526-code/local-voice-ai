'use client';
import React, { useCallback, useState } from 'react';
import { useDeferredConnect } from '@/components/app/deferred-connect';
import { useSessionContext, useLocalParticipant, useIsSpeaking, useVoiceAssistant } from '@livekit/components-react';

import { useHelixMessages } from '@/hooks/useHelixMessages';
import { useDeepSearchStatus } from '@/hooks/useDeepSearchStatus';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import type { AppConfig } from '@/app-config';
import { ChatTranscript, type StatusIndicator } from '@/components/app/chat-transcript';
import { PreConnectMessage } from '@/components/app/preconnect-message';
import { Fade, MotionBottom, BOTTOM_VIEW_MOTION_PROPS } from '@/components/app/fade';
import { SessionInputBar } from '@/components/app/session-input-bar';
import { cn } from '@/lib/utils';
import { deriveStatusIndicator } from '@/lib/status-indicator';
import { ScrollArea } from '../livekit/scroll-area/scroll-area';

interface SessionViewProps {
  appConfig: AppConfig;
}

export const SessionView = ({
  appConfig,
  ...props
}: React.ComponentProps<'section'> & SessionViewProps) => {
  const session = useSessionContext();
  const { ensureConnected } = useDeferredConnect();

  // PR-U1 プリウォーム: 初回の操作 (pointerdown / focus) で即時に接続を開始する。
  // fire-and-forget (失敗は送信時の ensureConnected で再試行される)。
  const prewarm = useCallback(() => {
    void ensureConnected().catch(() => {});
  }, [ensureConnected]);
  const { messages, streaming, omTask } = useHelixMessages(session?.room, ensureConnected);
  const { localParticipant } = useLocalParticipant();
  const isSpeaking = useIsSpeaking(localParticipant);
  const { state: agentState, audioTrack } = useVoiceAssistant();
  const deepSearching = useDeepSearchStatus(session?.room);
  const [chatOpen, setChatOpen] = useState(true);

  // 状態インジケータの優先度決定
  // isSpeaking > deepSearch > thinking（delta受信中はthinking非表示）
  const statusIndicator: StatusIndicator | null = deriveStatusIndicator({
    isSpeaking,
    deepSearching,
    agentState,
    streaming,
  });

  const scrollAreaRef = useAutoScroll(messages, statusIndicator);

  return (
    <section
      className="bg-background relative z-10 h-full w-full overflow-hidden"
      onPointerDownCapture={prewarm}
      onFocusCapture={prewarm}
      {...props}
    >
      {/* Phase3: OpenManus タスク実行中バッジ + 停止ボタン（最小表示） */}
      {omTask && (omTask.phase === 'accepted' || omTask.phase === 'running') && (
        <div className="pointer-events-auto fixed inset-x-0 top-3 z-30 flex justify-center">
          <div className="bg-muted/90 text-foreground flex items-center gap-3 rounded-full px-4 py-1.5 text-sm shadow-md backdrop-blur">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <span>タスク実行中…</span>
            <button
              type="button"
              className="text-destructive hover:underline"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('helix:om-stop'));
                }
              }}
            >
              停止
            </button>
          </div>
        </div>
      )}

      {/* Chat Transcript */}
      <div
        className={cn(
          'fixed inset-0 grid grid-cols-1 grid-rows-1',
          !chatOpen && 'pointer-events-none'
        )}
      >
        <Fade top className="absolute inset-x-4 top-0 h-16" />
        <ScrollArea ref={scrollAreaRef} className="px-4 pt-16 pb-[220px] md:px-6 md:pb-[260px]">
          <ChatTranscript
            hidden={!chatOpen}
            messages={messages}
            status={statusIndicator}
            className="mx-auto max-w-2xl space-y-3 transition-opacity duration-300 ease-out"
          />
        </ScrollArea>
      </div>

      {/* Bottom */}
      <MotionBottom
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="fixed inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {appConfig.isPreConnectBufferEnabled && (
          <PreConnectMessage messages={messages} className="pb-4" />
        )}
        <div className="bg-background relative mx-auto max-w-2xl pb-3 md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <SessionInputBar
            appConfig={appConfig}
            agentState={agentState}
            audioTrack={audioTrack}
            isConnected={session.isConnected}
            chatOpen={chatOpen}
            onDisconnect={session.end}
            onChatOpenChange={setChatOpen}
          />
        </div>
      </MotionBottom>
    </section>
  );
};
