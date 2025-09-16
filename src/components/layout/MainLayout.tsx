'use client';

import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-theme-bodybg dark:bg-themedark-bodybg">
      <Sidebar isMobileOpen={isMobileSidebarOpen} setIsMobileOpen={setIsMobileSidebarOpen} />
      <Header onToggleMobileSidebar={toggleMobileSidebar} />

      {/* Main Content */}
      <main className="pc-container lg:ml-sidebar-width ml-0 pt-header-height">
        <div className="pc-content p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}