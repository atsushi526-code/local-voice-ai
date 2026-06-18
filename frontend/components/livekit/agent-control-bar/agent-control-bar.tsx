'use client';

import { type HTMLAttributes, useCallback, useEffect, useState } from 'react';
import { Track } from 'livekit-client';
import { useChat, useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';
import { ChatTextIcon, PhoneDisconnectIcon, SpeakerSimpleXIcon, SpeakerSimpleHighIcon } from '@phosphor-icons/react/dist/ssr';
import { TrackToggle } from '@/components/livekit/agent-control-bar/track-toggle';
import { Button } from '@/components/livekit/button';
import { Toggle } from '@/components/livekit/toggle';
import { cn } from '@/lib/utils';
import { ChatInput } from './chat-input';
import { UseInputControlsProps, useInputControls } from './hooks/use-input-controls';
import { usePublishPermissions } from './hooks/use-publish-permissions';
import { TrackSelector } from './track-selector';

export interface ControlBarControls {
  leave?: boolean;
  camera?: boolean;
  microphone?: boolean;
  screenShare?: boolean;
  chat?: boolean;
}

export interface AgentControlBarProps extends UseInputControlsProps {
  controls?: ControlBarControls;
  isConnected?: boolean;
  onChatOpenChange?: (open: boolean) => void;
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
}

/**
 * A control bar specifically designed for voice assistant interfaces
 */
export function AgentControlBar({
  controls,
  saveUserChoices = true,
  className,
  isConnected = false,
  onDisconnect,
  onDeviceError,
  onChatOpenChange,
  ...props
}: AgentControlBarProps & HTMLAttributes<HTMLDivElement>) {
  const { send } = useChat();
  const { localParticipant } = useLocalParticipant();
  const participants = useRemoteParticipants();
  const [chatOpen, setChatOpen] = useState(false);

  // ── TTSミュート状態管理 ─────────────────────────────────────
  const [ttsMuted, setTtsMuted] = useState(false);

  const publishTtsMute = useCallback(async (muted: boolean) => {
    try {
      const payload = JSON.stringify({ type: 'tts_mute', muted });
      await localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true }
      );
    } catch (e) {
      console.error('TTS mute publish failed:', e);
    }
  }, [localParticipant]);

  // 接続確立時に初期ミュート状態をagentに送信
  useEffect(() => {
    if (!isConnected || !localParticipant) return;
    const sendInitialMuteState = async () => {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const payload = JSON.stringify({ type: 'tts_mute', muted: ttsMuted });
        await localParticipant.publishData(
          new TextEncoder().encode(payload),
          { reliable: true }
        );
      } catch (e) {
        console.warn('初期TTS mute送信失敗:', e);
      }
    };
    sendInitialMuteState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const publishPermissions = usePublishPermissions();
  const {
    micTrackRef,
    cameraToggle,
    microphoneToggle,
    screenShareToggle,
    handleAudioDeviceChange,
    handleVideoDeviceChange,
    handleMicrophoneDeviceSelectError,
    handleCameraDeviceSelectError,
  } = useInputControls({ onDeviceError, saveUserChoices });

  const handleSendMessage = async (message: string) => {
    await send(message);
  };

  const handleToggleTranscript = useCallback(
    (open: boolean) => {
      setChatOpen(open);
      onChatOpenChange?.(open);
    },
    [onChatOpenChange, setChatOpen]
  );

  const visibleControls = {
    leave: controls?.leave ?? true,
    microphone: controls?.microphone ?? publishPermissions.microphone,
    screenShare: controls?.screenShare ?? publishPermissions.screenShare,
    camera: controls?.camera ?? publishPermissions.camera,
    chat: controls?.chat ?? publishPermissions.data,
  };

  const isAgentAvailable = participants.some((p) => p.isAgent);

  return (
    <div
      aria-label="Voice assistant controls"
      className={cn(
        'bg-background border-input/50 dark:border-muted flex flex-col rounded-[31px] border p-3 drop-shadow-md/3',
        className
      )}
      {...props}
    >
      {/* Chat Input */}
      {visibleControls.chat && (
        <ChatInput
          chatOpen={chatOpen}
          isAgentAvailable={isAgentAvailable}
          onSend={handleSendMessage}
        />
      )}

      <div className="flex gap-1">
        <div className="flex grow gap-1">
          {/* Toggle Microphone */}
          {visibleControls.microphone && (
            <TrackSelector
              kind="audioinput"
              aria-label="Toggle microphone"
              source={Track.Source.Microphone}
              pressed={microphoneToggle.enabled}
              disabled={microphoneToggle.pending}
              audioTrackRef={micTrackRef}
              onPressedChange={microphoneToggle.toggle}
              onMediaDeviceError={handleMicrophoneDeviceSelectError}
              onActiveDeviceChange={handleAudioDeviceChange}
            />
          )}

          {/* Toggle Camera */}
          {visibleControls.camera && (
            <TrackSelector
              kind="videoinput"
              aria-label="Toggle camera"
              source={Track.Source.Camera}
              pressed={cameraToggle.enabled}
              pending={cameraToggle.pending}
              disabled={cameraToggle.pending}
              onPressedChange={cameraToggle.toggle}
              onMediaDeviceError={handleCameraDeviceSelectError}
              onActiveDeviceChange={handleVideoDeviceChange}
            />
          )}

          {/* Toggle Screen Share */}
          {visibleControls.screenShare && (
            <TrackToggle
              size="icon"
              variant="secondary"
              aria-label="Toggle screen share"
              source={Track.Source.ScreenShare}
              pressed={screenShareToggle.enabled}
              disabled={screenShareToggle.pending}
              onPressedChange={screenShareToggle.toggle}
            />
          )}

          {/* TTSミュートボタン（音声ON/OFF） */}
          <Toggle
            size="icon"
            variant="secondary"
            aria-label={ttsMuted ? '音声をONにする' : '音声をOFFにする'}
            title={ttsMuted ? '音声OFF中（タップでON）' : '音声ON中（タップでOFF）'}
            pressed={!ttsMuted}
            onPressedChange={(on) => {
              setTtsMuted(!on);
              publishTtsMute(!on);
            }}
          >
            {ttsMuted
              ? <SpeakerSimpleXIcon weight="bold" />
              : <SpeakerSimpleHighIcon weight="bold" />
            }
          </Toggle>

          {/* Toggle Transcript */}
          <Toggle
            size="icon"
            variant="secondary"
            aria-label="Toggle transcript"
            pressed={chatOpen}
            onPressedChange={handleToggleTranscript}
          >
            <ChatTextIcon weight="bold" />
          </Toggle>
        </div>

        {/* Disconnect */}
        {visibleControls.leave && (
          <Button
            variant="destructive"
            onClick={onDisconnect}
            disabled={!isConnected}
            className="font-mono"
          >
            <PhoneDisconnectIcon weight="bold" />
            <span className="hidden md:inline">END CALL</span>
            <span className="inline md:hidden">END</span>
          </Button>
        )}
      </div>
    </div>
  );
}
