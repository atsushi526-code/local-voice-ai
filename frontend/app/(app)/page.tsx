import { headers } from 'next/headers';
import { ChatWorkspace } from '@/components/app/chat-workspace';
import { getAppConfig } from '@/lib/utils';

export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return <ChatWorkspace appConfig={appConfig} />;
}
