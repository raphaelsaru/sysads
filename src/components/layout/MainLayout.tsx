'use client';

import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-theme-bodybg dark:bg-themedark-bodybg">
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      <Header
        onToggleMobileSidebar={toggleMobileSidebar}
        isCollapsed={isCollapsed}
      />

      {/* Main Content */}
      <main className={`pc-container pt-header-height transition-all duration-300 ${
        isCollapsed ? 'lg:ml-sidebar-collapsed-width' : 'lg:ml-sidebar-width'
      } ml-0`}>
        <div className="pc-content p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}