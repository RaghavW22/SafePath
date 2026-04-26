import type { ReactNode } from 'react';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
  showBackground?: boolean;
  className?: string;
}

export default function Layout({ children, showBackground = true, className }: LayoutProps) {
  return (
    <div
      className={clsx(
        'min-h-screen relative',
        showBackground ? 'facility-bg' : 'bg-navy',
        className
      )}
    >
      {showBackground && (
        <div className="absolute inset-0 bg-black/55 pointer-events-none" />
      )}
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
