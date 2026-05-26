'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NAV, type Role } from '@/lib/auth/roles';
import UserMenu from './UserMenu';

const COLLAPSED_KEY = 'sidebar_collapsed_v1';

function getInitialCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(getInitialCollapsed());
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setRole((data.user.user_metadata?.role as Role) ?? 'collaborator');
    });
  }, []);

  function toggleSection(section: string) {
    setCollapsed(prev => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      return next;
    });
  }

  const visibleNav = NAV.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (item.roles === 'all') return true;
      if (!role) return false;
      return (item.roles as Role[]).includes(role);
    }),
  })).filter(s => s.items.length > 0);

  const prioritySections = visibleNav.filter(s => s.priority);
  const collapsibleSections = visibleNav.filter(s => s.collapsible);

  return (
    <aside className="w-64 shrink-0 flex flex-col min-h-screen bg-gray-950 border-r border-white/5">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-5 py-5 border-b border-white/5 hover:bg-white/3 transition-colors">
        <Image src="/drivedata_logo.svg" alt="Drive Data" width={32} height={32} />
        <div>
          <p className="text-[11px] font-bold text-white leading-none tracking-wide">DRIVE DATA</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Portfolio Intelligence</p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto py-3">

        {/* ── PRIORIDADE — itens principais ── */}
        {prioritySections.map(group => (
          <div key={group.section} className="px-3 mb-2">
            {/* Section label */}
            <p className="px-2 pt-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 flex items-center gap-1.5">
              <span>{group.icon}</span>
              {group.section}
            </p>

            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all group ${
                      active
                        ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-500/5 text-cyan-400 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className={`text-base shrink-0 transition-transform ${active ? '' : 'group-hover:scale-110'}`}>
                      {item.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-tight font-medium ${active ? 'text-cyan-400' : 'text-gray-300 group-hover:text-white'}`}>
                        {item.label}
                      </p>
                    </div>
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── Divisor ── */}
        {collapsibleSections.length > 0 && (
          <div className="mx-5 my-3 h-px bg-white/5" />
        )}

        {/* ── EXPANSÍVEIS ── */}
        {mounted && collapsibleSections.map(group => {
          const isOpen = !collapsed[group.section];
          const hasActive = group.items.some(
            item => pathname === item.href || pathname.startsWith(item.href + '/')
          );

          return (
            <div key={group.section} className="px-3 mb-1">
              {/* Toggle button */}
              <button
                onClick={() => toggleSection(group.section)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all group ${
                  hasActive ? 'text-gray-300' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                <span className="text-sm">{group.icon}</span>
                <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-widest">
                  {group.section}
                </span>
                {hasActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 shrink-0 mr-1" />
                )}
                <span className={`text-[10px] text-gray-700 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
                  ▾
                </span>
              </button>

              {/* Items */}
              {isOpen && (
                <div className="mt-0.5 space-y-0.5 pl-1">
                  {group.items.map(item => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group ${
                          active
                            ? 'bg-white/8 text-cyan-400'
                            : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-sm shrink-0">{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs leading-tight ${active ? 'text-cyan-400 font-medium' : 'text-gray-400 group-hover:text-white'}`}>
                            {item.label}
                          </p>
                          <p className={`text-[10px] leading-snug mt-0.5 ${active ? 'text-cyan-400/50' : 'text-gray-700 group-hover:text-gray-500'}`}>
                            {item.desc}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User menu */}
      <UserMenu />

      <div className="px-5 py-2 border-t border-white/5">
        <p className="text-[10px] text-gray-700">v0.5.0 · {new Date().getFullYear()} Drive Data</p>
      </div>
    </aside>
  );
}
