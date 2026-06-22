'use client';

import { type HTMLAttributes, useCallback, useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { useChat, useLocalParticipant, useRemoteParticipants, useRoomContext } from '@livekit/components-react';
import { ChatTextIcon, MagnifyingGlassIcon, SpeakerSimpleXIcon, SpeakerSimpleHighIcon } from '@phosphor-icons/react/dist/ssr';
import { TrackToggle } from '@/components/livekit/agent-control-bar/track-toggle';
import { Button } from '@/components/livekit/button';
import { Toggle } from '@/components/livekit/toggle';
import { cn } from '@/lib/utils';
import { ChatInput } from './chat-input';
import { UseInputControlsProps, useInputControls } from './hooks/use-input-controls';
import { usePublishPermissions } from './hooks/use-publish-permissions';
import { TrackSelector } from './track-selector';
import { MicButton } from './MicButton';

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
  chatOpen?: boolean; // 外部controlled（任意・未指定時は内部state）
  onChatOpenChange?: (open: boolean) => void;
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
}

// Deep Searchのモード
// 'off'        : 通常（RAG + 必要時Web検索）
// 'oneshot'    : 次の1発話だけDeep Search → 自動OFF（点滅）
// 'continuous' : 継続Deep SearchモードON（点灯）
type DeepSearchMode = 'off' | 'oneshot' | 'continuous';

const LONG_PRESS_MS = 500; // 長押し判定時間（ms）

export function AgentControlBar({
  controls,
  saveUserChoices = false,  // localStorageから前回のマイク状態を復元しない
  className,
  isConnected = false,
  chatOpen: controlledChatOpen,
  onDisconnect,
  onDeviceError,
  onChatOpenChange,
  ...props
}: AgentControlBarProps & HTMLAttributes<HTMLDivElement>) {
  const { send } = useChat();
  const { localParticipant } = useLocalParticipant();
  const participants = useRemoteParticipants();
  const [internalChatOpen, setInternalChatOpen] = useState(false);
  const chatOpen = controlledChatOpen ?? internalChatOpen; // controlled優先・非破壊hybrid

  // ── TTSミュート状態管理 ─────────────────────────────────────
  const [ttsMuted, setTtsMuted] = useState(false); // デフォルトはミュートOFF（音声ON）

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

  // ── New Chat: セッションリセット送信（room切断はしない） ──────────
  const publishResetSession = useCallback(async () => {
    // 楽観的UIクリア: backendのreset完了(reset_done)を待たず会話ペインを即クリアする。
    // reset_doneは確認用の保険として残す（engine切断でreset_doneを取りこぼしてもUIは消える）。
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('helix:new-chat'));
    }
    try {
      const payload = JSON.stringify({ type: 'reset_session' });
      await localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true }
      );
    } catch (e) {
      console.error('reset_session publish failed:', e);
    }
  }, [localParticipant]);

  // 接続確立時に初期ミュート状態をagentに送信（2秒待ってagentのdata_receivedが準備完了するのを待つ）
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

  // ── Deep Search 状態管理 ─────────────────────────────────────
  const [deepSearchMode, setDeepSearchMode] = useState<DeepSearchMode>('off');

  // ── Deep Search 実行中状態（agentからのstart/endを受信） ──
  const room = useRoomContext();
  const [deepSearchRunning, setDeepSearchRunning] = useState(false);
  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'deep_search_status') {
          if (msg.status === 'start') {
            setDeepSearchRunning(true);
          } else if (msg.status === 'end') {
            setDeepSearchRunning(false);
            // oneshot は1回実行で消費 → agent 側の自動OFF に表示を同期
            // continuous は維持（agent 側も継続のため戻さない）
            setDeepSearchMode((prev) => (prev === 'oneshot' ? 'off' : prev));
          }
        }
      } catch {
        // 無視
      }
    };
    room.on('dataReceived', handleData);
    return () => { room.off('dataReceived', handleData); };
  }, [room]);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const publishDeepSearch = useCallback(async (mode: DeepSearchMode) => {
    try {
      const payload = JSON.stringify({ type: 'deep_search', mode });
      await localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true }
      );
    } catch (e) {
      console.error('Deep Search publish failed:', e);
    }
  }, [localParticipant]);

  // ポインター押下開始 → 長押しタイマー起動
  const handleDsPointerDown = useCallback(() => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      // 長押し → 継続モードON（既にONならOFF）
      setDeepSearchMode(prev => {
        const next: DeepSearchMode = prev === 'continuous' ? 'off' : 'continuous';
        publishDeepSearch(next);
        return next;
      });
    }, LONG_PRESS_MS);
  }, [publishDeepSearch]);

  // ポインター離した → 短押し判定
  const handleDsPointerUp = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      // 短押し → oneshotモード（既にoneshotならOFF）
      setDeepSearchMode(prev => {
        if (prev === 'continuous') return prev; // 継続中は短押し無視
        const next: DeepSearchMode = prev === 'oneshot' ? 'off' : 'oneshot';
        publishDeepSearch(next);
        return next;
      });
    }
    isLongPressRef.current = false;
  }, [publishDeepSearch]);

  const publishPermissions = usePublishPermissions();
  const {
    micTrackRef,
    cameraToggle,
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
      setInternalChatOpen(open);
      onChatOpenChange?.(open);
    },
    [onChatOpenChange, setInternalChatOpen]
  );

  const visibleControls = {
    leave: controls?.leave ?? true,
    microphone: controls?.microphone ?? publishPermissions.microphone,
    screenShare: controls?.screenShare ?? publishPermissions.screenShare,
    camera: controls?.camera ?? publishPermissions.camera,
    chat: controls?.chat ?? publishPermissions.data,
  };

  const isAgentAvailable = participants.some((p) => p.isAgent);

  const deepSearchTitle =
    deepSearchMode === 'continuous' ? 'Deep Search 継続ON（長押しでOFF）' :
    deepSearchMode === 'oneshot'    ? 'Deep Search 1回待機中（タップでキャンセル）' :
    'Deep Search（短押し：1回 / 長押し：継続）';

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
            <MicButton />
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
              className="[&_button:first-child]:h-9 [&_button:first-child]:w-9 [&_button:first-child]:rounded-full [&_button:last-child]:h-9"
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
              className="h-9 w-9 rounded-full"
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
            className="h-9 w-9 rounded-full"
          >
            {ttsMuted
              ? <SpeakerSimpleXIcon weight="bold" />
              : <SpeakerSimpleHighIcon weight="bold" />
            }
          </Toggle>

          {/* Deep Search ボタン（短押し=1shot / 長押し=継続） */}
          <button
            type="button"
            aria-label="Deep Search"
            title={deepSearchTitle}
            onPointerDown={handleDsPointerDown}
            onPointerUp={handleDsPointerUp}
            onPointerLeave={() => {
              if (pressTimerRef.current) {
                clearTimeout(pressTimerRef.current);
                pressTimerRef.current = null;
              }
              isLongPressRef.current = false;
            }}
            className={cn(
              'relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 select-none',
              deepSearchMode === 'continuous' && 'bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary/30',
              deepSearchMode === 'oneshot'    && 'bg-muted text-primary hover:bg-muted/80 ring-2 ring-primary/30',
              deepSearchMode === 'off'        && 'bg-muted text-foreground hover:bg-muted/80',
            )}
          >
            <MagnifyingGlassIcon
              weight="bold"
              className={cn(
                'h-4 w-4 transition-all duration-300',
                (deepSearchMode === 'oneshot' || deepSearchRunning) && 'animate-pulse',
              )}
            />
            {/* Deep Search 実行中インジケータ（agentからstart/end受信） */}
            {deepSearchRunning && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-400 animate-pulse" />
            )}
          </button>

          {/* Toggle Transcript */}
          <Toggle
            size="icon"
            variant="secondary"
            aria-label="Toggle transcript"
            pressed={chatOpen}
            onPressedChange={handleToggleTranscript}
            className="h-9 w-9 rounded-full"
          >
            <ChatTextIcon weight="bold" />
          </Toggle>
        </div>

        {/* New Chat（セッションリセット。room切断はしない） */}
        {visibleControls.leave && (
          <Button
            variant="secondary"
            onClick={publishResetSession}
            disabled={!isConnected}
            className="font-mono"
          >
            <ChatTextIcon weight="bold" />
            <span className="hidden md:inline">New Chat</span>
            <span className="inline md:hidden">New</span>
          </Button>
        )}
      </div>
    </div>
  );
}
