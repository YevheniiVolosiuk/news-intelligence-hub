'use client';

import {SidebarTrigger} from '@/components/ui/sidebar';
import UserDropdown from '@/components/shadcn-space/blocks/dashboard-shell-01/user-dropdown';
import {Avatar, AvatarFallback} from '@/components/ui/avatar';
import NotificationDropdown from '@/components/shadcn-space/blocks/dashboard-shell-01/notification-dropdown';
import {BellRing, SearchIcon} from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {useAuth} from '@/lib/auth-context';

export function SiteHeader() {
  const {user} = useAuth();
  const initial = user?.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 h-8 w-8 cursor-pointer" />
        <InputGroup className="h-9 rounded-md">
          <InputGroupInput placeholder="Search" />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="flex items-center gap-3">
        <NotificationDropdown
          defaultOpen={false}
          align="center"
          trigger={
            <div className="rounded-full p-2 hover:bg-accent relative before:absolute before:bottom-0 before:left-1/2 before:z-10 before:w-2 before:h-2 before:rounded-full before:bg-destructive before:top-1 cursor-pointer">
              <BellRing className="size-4" />
            </div>
          }
        />
        <UserDropdown
          defaultOpen={false}
          align="center"
          trigger={
            <div className="rounded-full">
              <Avatar className="size-8 cursor-pointer">
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
            </div>
          }
        />
      </div>
    </div>
  );
}
