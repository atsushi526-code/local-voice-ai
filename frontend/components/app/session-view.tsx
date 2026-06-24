'use client';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useSessionContext, useLocalParticipant, useIsSpeaking, useVoiceAssistant, BarVisualizer } from '@livekit/components-react';

import { useHelixMessages } from '@/hooks/useHelixMessages';
import { useDeepSearchStatus } from '@/hooks/useDeepSearchStatus';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import type { AppConfig } from '@/app-config';
import { ChatTranscript, type StatusIndicator } from '@/components/app/chat-transcript';
import { PreConnectMessage } from '@/components/app/preconnect-message';
import {
  AgentControlBar,
  type ControlBarControls,
} from '@/components/livekit/agent-control-bar/agent-control-bar';
import { cn } from '@/lib/utils';
import { deriveStatusIndicator } from '@/lib/status-indicator';
import { ScrollArea } from '../livekit/scroll-area/scroll-area';

const MotionBottom = motion.create('div');

const BOTTOM_VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

interface SessionViewProps {
  appConfig: AppConfig;
}

export const SessionView = ({
  appConfig,
  ...props
}: React.ComponentProps<'section'> & SessionViewProps) => {
  const session = useSessionContext();
  const { messages, streaming } = useHelixMessages(session?.room);
  const { localParticipant } = useLocalParticipant();
  const isSpeaking = useIsSpeaking(localParticipant);
  const { state: agentState, audioTrack } = useVoiceAssistant();
  const deepSearching = useDeepSearchStatus(session?.room);
  const [chatOpen, setChatOpen] = useState(true);

  const controls: ControlBarControls = {
    leave: true,
    microphone: true,
    chat: true, // PR3: テキスト入力欄を常時表示（表示制御のみ・permissionロジック不変）
    camera: appConfig.supportsVideoInput,
    screenShare: appConfig.supportsVideoInput,
  };

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
    <section className="bg-background relative z-10 h-full w-full overflow-hidden" {...props}>
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
          {(agentState === 'speaking' || agentState === 'listening') && (
            <BarVisualizer
              barCount={5}
              state={agentState}
              trackRef={audioTrack}
              options={{ minHeight: 5 }}
              className="mx-auto mb-2 flex h-6 items-center justify-center gap-1"
            >
              <span className="bg-muted min-h-2.5 w-1.5 origin-center rounded-full transition-colors duration-250 ease-linear data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted" />
            </BarVisualizer>
          )}
          <div className="helix-controlbar">
            <AgentControlBar
              controls={controls}
              isConnected={session.isConnected}
              chatOpen={chatOpen}
              onDisconnect={session.end}
              onChatOpenChange={setChatOpen}
            />
          </div>
        </div>
      </MotionBottom>
    </section>
  );
};
