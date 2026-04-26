import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import type { UserRole } from '../../types';

interface NavbarProps {
  role: UserRole;
}

const roleConfig: Record<UserRole, { label: string; bgClass: string }> = {
  guest: { label: 'Resident', bgClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40' },
  staff: { label: 'Coordinator', bgClass: 'bg-blue-500/20 text-blue-400 border border-blue-400/40' },
  responder: { label: 'Responder', bgClass: 'bg-danger/20 text-red-400 border border-red-400/40' },
};

export default function Navbar({ role }: NavbarProps) {
  const config = roleConfig[role];

  return (
    <nav className="bg-navy/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer">
          <ShieldCheck className="text-emerald-400 group-hover:scale-110 transition-transform" size={24} />
          <span className="font-outfit text-white font-extrabold text-2xl tracking-tighter">
            Safe<span className="text-emerald-400">Path</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className={clsx('text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-lg', config.bgClass)}>
            {config.label} Portal
          </span>
          <Link
            to="/"
            onClick={() => {
              import('../../store/useAppStore').then(({ useAppStore }) => {
                useAppStore.getState().logout();
              });
              // Fallback synchronous navigation and clearing just in case
              window.location.href = '/'; 
            }}
            className="text-white/40 hover:text-white text-xs transition-colors flex items-center gap-1 uppercase font-bold"
          >
            Log Out
          </Link>
        </div>
      </div>
    </nav>
  );
}
