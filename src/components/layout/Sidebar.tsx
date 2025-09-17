'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
      </svg>
    )
  },
  {
    id: 'clientes',
    label: 'Clientes',
    href: '/clientes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
];

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <nav className={`pc-sidebar fixed left-0 top-0 h-full bg-theme-sidebarbg dark:bg-themedark-sidebarbg transition-all duration-300 z-40
        ${isCollapsed && !isMobileOpen ? 'w-sidebar-collapsed-width' : 'w-sidebar-width'}
        ${isMobileOpen ? 'translate-x-0' : 'lg:translate-x-0 -translate-x-full'}
      `}>
      <div className="navbar-wrapper h-full">
        {/* Logo/Brand */}
        <div className="m-header flex items-center py-4 px-6 h-header-height border-b border-theme-border/20 dark:border-themedark-border/20">
          <Link href="/" className="b-brand flex items-center gap-3 text-theme-sidebarcaption dark:text-themedark-sidebarcaption">
            {!isCollapsed && (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
                C
              </div>
            )}
            {!isCollapsed && <span className="text-lg font-semibold">CRM Charbelle</span>}
          </Link>

          {/* Toggle Button */}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setIsMobileOpen(false);
              } else {
                setIsCollapsed(!isCollapsed);
              }
            }}
            className={`p-1 rounded-md text-theme-sidebarcolor dark:text-themedark-sidebarcolor hover:bg-white/10 transition-colors ${
              isCollapsed ? 'ml-0' : 'ml-auto'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <div className="navbar-content h-[calc(100vh_-_74px)] py-4 overflow-y-auto">
          <ul className="pc-navbar space-y-1 px-3">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (window.innerWidth < 1024) {
                        setIsMobileOpen(false);
                      }
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-primary text-white shadow-md'
                        : 'text-theme-sidebarcolor dark:text-themedark-sidebarcolor hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-theme-sidebarcolor dark:text-themedark-sidebarcolor group-hover:text-white'}`}>
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span className="transition-opacity duration-200">
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
    </>
  );
}