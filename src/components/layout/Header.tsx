'use client';

import { useState } from 'react';

interface HeaderProps {
  onToggleMobileSidebar?: () => void;
}

export default function Header({ onToggleMobileSidebar }: HeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

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
    <header className="pc-header fixed top-0 right-0 lg:left-sidebar-width left-0 h-header-height bg-theme-headerbg dark:bg-themedark-headerbg backdrop-blur-sm border-b border-theme-border dark:border-themedark-border z-30">
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
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-medium text-sm">
              CB
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-theme-headings dark:text-themedark-headings">
                Charbelle
              </p>
              <p className="text-xs text-theme-bodycolor dark:text-themedark-bodycolor">
                Administrador
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}