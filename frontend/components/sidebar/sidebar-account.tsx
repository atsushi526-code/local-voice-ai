import { auth, signOut } from '@/auth';

/**
 * Sidebar footer のアカウント表示（使用者名 + ログアウト）。
 * Server Component（'use client' 禁止）。page.tsx（Server）で生成し、
 * ChatWorkspace → Sidebar へ accountSlot（ReactNode）として渡す。
 * 旧 layout ヘッダ（右上）から移設。PR1 はレイアウト整理のみ＝スタイルは踏襲。
 */
export async function SidebarAccount() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <span className="text-foreground min-w-0 flex-1 truncate font-mono text-xs">
        {session.user.name ?? session.user.email}
      </span>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/' });
        }}
      >
        <button
          type="submit"
          className="text-foreground shrink-0 font-mono text-xs underline underline-offset-4"
        >
          ログアウト
        </button>
      </form>
    </div>
  );
}
