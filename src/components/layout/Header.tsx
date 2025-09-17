'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onToggleMobileSidebar?: () => void;
  isCollapsed?: boolean;
}

export default function Header({ onToggleMobileSidebar, isCollapsed = false }: HeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { userProfile, signOut } = useAuth();

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);

    if (newTheme) {
      document.documentElement.setAttribute('data-pc-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.removeAttribute('data-pc-theme');
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className={`pc-header fixed top-0 right-0 h-header-height bg-theme-headerbg dark:bg-themedark-headerbg backdrop-blur-sm border-b border-theme-border dark:border-themedark-border z-30 transition-all duration-300 ${
      isCollapsed ? 'lg:left-sidebar-collapsed-width' : 'lg:left-sidebar-width'
    } left-0`}>
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Mobile Menu Button & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 rounded-md text-theme-headercolor dark:text-themedark-headercolor hover:bg-theme-activebg dark:hover:bg-themedark-activebg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg lg:text-xl font-semibold text-theme-headings dark:text-themedark-headings">
            CRM Dashboard
          </h1>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-theme-headercolor dark:text-themedark-headercolor hover:bg-theme-activebg dark:hover:bg-themedark-activebg transition-colors"
            title={isDarkMode ? 'Modo claro' : 'Modo escuro'}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-theme-activebg dark:hover:bg-themedark-activebg transition-colors"
            >
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-medium text-sm">
                {userProfile?.company_name?.charAt(0) || 'U'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-theme-headings dark:text-themedark-headings">
                  {userProfile?.company_name || 'Usuário'}
                </p>
                <p className="text-xs text-theme-bodycolor dark:text-themedark-bodycolor">
                  {userProfile?.role === 'admin' ? 'Administrador' : 'Usuário'}
                </p>
              </div>
              <svg className="w-4 h-4 text-theme-bodycolor dark:text-themedark-bodycolor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-themedark-sidebar rounded-md shadow-lg border border-theme-border dark:border-themedark-border z-50">
                <div className="p-4 border-b border-theme-border dark:border-themedark-border">
                  <p className="text-sm font-medium text-theme-headings dark:text-themedark-headings">
                    {userProfile?.email}
                  </p>
                  <p className="text-xs text-theme-bodycolor dark:text-themedark-bodycolor">
                    Moeda: {userProfile?.currency || 'BRL'}
                  </p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      signOut();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  >
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}