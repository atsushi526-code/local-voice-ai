import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { PaperPlaneRightIcon, SpinnerIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/livekit/button';

const MOTION_PROPS = {
  variants: {
    hidden: {
      height: 0,
      opacity: 0,
      marginBottom: 0,
    },
    visible: {
      height: 'auto',
      opacity: 1,
      marginBottom: 12,
    },
  },
  initial: 'hidden',
  transition: {
    duration: 0.3,
    ease: 'easeOut',
  },
};

// ── URL保存検知 ────────────────────────────────────────────────

/** メッセージ中のURLを抽出する */
function extractUrl(message: string): string | null {
  const match = message.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

/** 「覚えて」「保存して」などの保存指示キーワードを検知する */
const SAVE_KEYWORDS = [
  '覚えて', '覚えてて', '覚えておいて',
  '保存して', '保存しておいて',
  '記憶して', '記憶しておいて',
  'save', 'remember',
];

function hasSaveKeyword(message: string): boolean {
  return SAVE_KEYWORDS.some((kw) => message.includes(kw));
}

function detectUrlSaveRequest(message: string): string | null {
  if (!hasSaveKeyword(message)) return null;
  return extractUrl(message);
}

async function saveUrlToRag(url: string): Promise<void> {
  try {
    const res = await fetch('/api/rag/save-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      console.info(`[RAG] URL保存受付: ${url}`);
    } else {
      console.warn(`[RAG] URL保存失敗: ${res.status}`);
    }
  } catch (e) {
    console.warn('[RAG] URL保存エラー（無視）:', e);
  }
}

// ── コンポーネント ──────────────────────────────────────────────

interface ChatInputProps {
  chatOpen: boolean;
  isAgentAvailable?: boolean;
  onSend?: (message: string) => void;
}

export function ChatInput({
  chatOpen,
  isAgentAvailable = false,
  onSend = async () => {},
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [saveNotice, setSaveNotice] = useState<string>('');

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!message.trim()) return;
    try {
      setIsSending(true);
      const urlToSave = detectUrlSaveRequest(message);
      if (urlToSave) {
        saveUrlToRag(urlToSave);
        setSaveNotice(`保存中: ${urlToSave.slice(0, 40)}...`);
        setTimeout(() => setSaveNotice(''), 4000);
      }
      await onSend(message);
      setMessage('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  // Enterで送信・Shift+Enterで改行
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = isSending || !isAgentAvailable || message.trim().length === 0;

  useEffect(() => {
    if (chatOpen && isAgentAvailable) return;
    inputRef.current?.focus();
  }, [chatOpen, isAgentAvailable]);

  return (
    <motion.div
      inert={!chatOpen}
      {...MOTION_PROPS}
      animate={chatOpen ? 'visible' : 'hidden'}
      className="border-input/50 flex w-full flex-col overflow-hidden border-b"
    >
      <form
        onSubmit={handleSubmit}
        className="mb-3 flex grow items-end gap-2 rounded-md pl-1 text-sm"
      >
        <textarea
          ref={inputRef}
          rows={3}
          value={message}
          disabled={!chatOpen}
          placeholder="メッセージを入力... (Shift+Enterで改行)"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 resize-none rounded-md p-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          size="icon"
          type="submit"
          disabled={isDisabled}
          variant={isDisabled ? 'secondary' : 'primary'}
          title={isSending ? 'Sending...' : 'Send'}
          className="self-start"
        >
          {isSending ? (
            <SpinnerIcon className="animate-spin" weight="bold" />
          ) : (
            <PaperPlaneRightIcon weight="bold" />
          )}
        </Button>
      </form>

      {saveNotice && (
        <p className="mb-2 pl-1 text-xs text-muted-foreground">
          📎 {saveNotice}
        </p>
      )}
    </motion.div>
  );
}
