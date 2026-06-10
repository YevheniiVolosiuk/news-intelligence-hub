'use client';
import React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import Logo from '@/assets/logo/logo';
import {NavMain} from '@/components/shadcn-space/blocks/dashboard-shell-01/nav-main';
import {LayoutDashboard, Rss, Settings, LucideIcon} from 'lucide-react';
import {SiteHeader} from '@/components/shadcn-space/blocks/dashboard-shell-01/site-header';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';

export type NavItem = {
  label?: string;
  isSection?: boolean;
  title?: string;
  icon?: LucideIcon;
  href?: string;
  children?: NavItem[];
  isActive?: boolean;
};

export const navData: NavItem[] = [
  {label: 'Menu', isSection: true},
  {title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard'},
  {title: 'Feeds', icon: Rss, href: '/dashboard/feeds'},
  {title: 'Settings', icon: Settings, href: '/dashboard/settings'},
];

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

const AppSidebar = ({children}: {children: React.ReactNode}) => {
  return (
    <SidebarProvider>
      <Sidebar className="py-4 px-0 bg-background">
        <div className="flex flex-col gap-6 bg-background">
          {/* ---------------- Header ---------------- */}
          <SidebarHeader className="py-0 px-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <a href="/dashboard" className="w-full h-full">
                  <Logo />
                </a>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          {/* ---------------- Content ---------------- */}
          <SidebarContent className="overflow-hidden gap-0 px-0">
            <SimpleBar
              autoHide={true}
              className="h-[calc(100vh-348px)] border-b border-border"
            >
              <div className="px-4">
                <NavMain items={navData} />
              </div>
            </SimpleBar>
          </SidebarContent>
        </div>
      </Sidebar>

      {/* ---------------- Main ---------------- */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-50 flex items-center border-b px-6 py-3 bg-background">
          <SiteHeader />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </SidebarProvider>
  );
};

export default AppSidebar;
