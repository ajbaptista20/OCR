'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  LogOut,
  Building2,
  Upload,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Faturas', icon: FileText },
  { href: '/projects', label: 'Projetos', icon: FolderKanban },
];

export function AppNav({
  userEmail,
  userRole,
}: {
  userEmail: string;
  userRole: UserRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const roleBadge: Record<UserRole, string> = {
    admin: 'Admin',
    accounting: 'Contabilidade',
    manager: 'Gestor',
  };

  return (
    <>
      {/* Desktop top nav */}
      <header className="hidden md:flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <span className="font-semibold text-gray-900">Gestão de Obra</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/invoices/upload" className="btn-primary text-sm">
            <Upload size={16} />
            Nova Fatura
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">{userEmail}</p>
              <p className="text-xs text-gray-500">{roleBadge[userRole]}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
            <Building2 size={18} />
          </div>
          <span className="font-semibold text-gray-900 text-sm">
            Gestão de Obra
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/invoices/upload"
            className="p-2 rounded-lg bg-brand-600 text-white"
          >
            <Upload size={18} />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium min-w-[64px]',
                  active ? 'text-brand-600' : 'text-gray-500'
                )}
              >
                <item.icon size={22} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
