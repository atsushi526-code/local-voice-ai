'use client';

import { type ComponentProps } from 'react';
import { BarVisualizer, useVoiceAssistant } from '@livekit/components-react';

import type { AppConfig } from '@/app-config';
import {
  AgentControlBar,
  type ControlBarControls,
} from '@/components/livekit/agent-control-bar/agent-control-bar';

interface SessionInputBarProps {
  appConfig: AppConfig;
  agentState: ReturnType<typeof useVoiceAssistant>['state'];
  audioTrack: ReturnType<typeof useVoiceAssistant>['audioTrack'];
  isConnected: ComponentProps<typeof AgentControlBar>['isConnected'];
  chatOpen: ComponentProps<typeof AgentControlBar>['chatOpen'];
  onDisconnect: ComponentProps<typeof AgentControlBar>['onDisconnect'];
  onChatOpenChange: ComponentProps<typeof AgentControlBar>['onChatOpenChange'];
}

export function SessionInputBar({
  appConfig,
  agentState,
  audioTrack,
  isConnected,
  chatOpen,
  onDisconnect,
  onChatOpenChange,
}: SessionInputBarProps) {
  const controls: ControlBarControls = {
    leave: true,
    microphone: true,
    chat: true, // PR3: テキスト入力欄を常時表示（表示制御のみ・permissionロジック不変）
    camera: appConfig.supportsVideoInput,
    screenShare: appConfig.supportsVideoInput,
  };

  return (
    <>
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
          isConnected={isConnected}
          chatOpen={chatOpen}
          onDisconnect={onDisconnect}
          onChatOpenChange={onChatOpenChange}
        />
      </div>
    </>
  );
}
