import { NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL;

function toHttp(u: string): string {
  return u.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
}

export const revalidate = 0;

// pagehide → sendBeacon で呼ばれる participant単位の終了通知。
// RemoveParticipant（room維持）→ agent側ハンドラが PARTICIPANT_REMOVED で正規 close → on_exit。
// フォールバック: 発火しない場合は svc.deleteRoom(roomName)（ROOM_DELETED）へ切替検討。
export async function POST(req: Request) {
  if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
    return new NextResponse('LiveKit not configured', { status: 500 });
  }
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const roomName = typeof body?.roomName === 'string' ? body.roomName : undefined;
  const identity = typeof body?.identity === 'string' ? body.identity : undefined;
  if (!roomName || !identity) {
    return new NextResponse('roomName and identity required', { status: 400 });
  }

  const svc = new RoomServiceClient(toHttp(LIVEKIT_URL), API_KEY, API_SECRET);
  try {
    await svc.removeParticipant(roomName, identity);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 通常ケース: SDK標準leave(CLIENT_INITIATED)が先勝し participant は既に消えている = 正常系
    if (/participant does not exist|not.?found/i.test(msg)) {
      console.warn('[leave] participant already gone (SDK leave won the race):', roomName);
    } else {
      console.error('[leave] removeParticipant error:', msg);
      return new NextResponse('error', { status: 500 });
    }
  }
  return new NextResponse(null, { status: 204 });
}
