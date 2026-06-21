import { SessionErrorHandler } from '@/components/session-error-handler';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <SessionErrorHandler />
      {children}
    </>
  );
}
