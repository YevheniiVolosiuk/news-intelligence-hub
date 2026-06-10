'use client';

import type {ReactNode} from 'react';
import {Avatar, AvatarFallback} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {LucideIcon, CircleUserRound, Settings, LogOut} from 'lucide-react';
import {useAuth} from '@/lib/auth-context';

type Props = {
  trigger: ReactNode;
  defaultOpen?: boolean;
  align?: 'start' | 'center' | 'end';
};

type MenuItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

// Until richer account surfaces exist, every link points at the settings view.
const ACCOUNT_ITEMS: MenuItem[] = [
  {label: 'My Profile', icon: CircleUserRound, href: '/dashboard/settings'},
  {label: 'Account Settings', icon: Settings, href: '/dashboard/settings'},
];

const itemClass =
  'p-2 text-sm font-medium text-popover-foreground cursor-pointer gap-2';

/** First letter of the email, used as the avatar fallback. */
function initialFor(email: string | undefined): string {
  return email?.charAt(0).toUpperCase() ?? '?';
}

const UserDropdown = ({trigger, defaultOpen, align = 'end'}: Props) => {
  const {user, logout} = useAuth();

  return (
    <div className="flex items-center justify-center">
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className="w-3xs rounded-2xl data-open:slide-in-from-bottom-20! data-closed:slide-out-to-bottom-20 data-open:fade-in-0 data-closed:fade-out-0 data-closed:zoom-out-100 duration-400"
        >
          {/* User Info */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-3 px-4 py-3">
              <div className="relative">
                <Avatar className="data-[size=lg]:size-8">
                  <AvatarFallback>{initialFor(user?.email)}</AvatarFallback>
                </Avatar>
                <span className="ring-card absolute right-0 bottom-0 size-2 rounded-full bg-green-600 ring-2" />
              </div>

              <div className="flex min-w-0 flex-col">
                <span className="text-muted-foreground truncate text-sm">
                  {user?.email}
                </span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Account links */}
          <DropdownMenuGroup>
            {ACCOUNT_ITEMS.map(({label, icon: Icon, href}) => (
              <DropdownMenuItem key={label} asChild className={itemClass}>
                <a href={href}>
                  <Icon size={20} />
                  <span>{label}</span>
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Logout */}
          <DropdownMenuItem
            variant="destructive"
            className={itemClass}
            onClick={() => void logout()}
          >
            <LogOut size={20} />
            <span>Signout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserDropdown;
