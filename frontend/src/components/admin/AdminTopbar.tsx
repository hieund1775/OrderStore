import { Bell, LogOut, Menu } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getUser, logout } from '@/lib/api';
import { isSafeInternalLink, useAdminNotifications } from '@/lib/notifications';
import { toast } from 'sonner';
import {
  formatAdminRoleLabel,
  formatNotificationBadgeCount,
  getRecentNotifications,
} from '@/lib/admin-topbar';

export function AdminTopbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const navigate = useNavigate();
  const adminUser = getUser();
  const displayName = adminUser?.fullname || 'Quản trị viên';
  const roleLabel = formatAdminRoleLabel(adminUser?.role);
  const initials = displayName.split(' ').pop()?.charAt(0)?.toUpperCase() || 'A';

  const { data: notificationData, isLoading, isError, refetch, markRead } = useAdminNotifications();
  const unreadBadge = formatNotificationBadgeCount(notificationData?.unread_count);
  const recentList = getRecentNotifications(notificationData?.notifications, 5);

  const handleNotificationClick = async (id: number, isRead: boolean, link?: string | null) => {
    if (!isRead) {
      try {
        await markRead(id);
      } catch {
        toast.error('Không thể đánh dấu thông báo đã đọc');
      }
    }
    if (link && isSafeInternalLink(link)) {
      void navigate({ to: link });
    }
  };

  return (
    <header className="bg-background/90 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Mở menu"
      >
        <Menu className="size-5" />
      </Button>

      {/* Spacer to push controls to the right */}
      <div className="flex-1" />

      {/* Notifications Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Thông báo"
          >
            <Bell className="size-5" />
            {Boolean(unreadBadge) && (
              <span className="bg-berry text-berry-foreground absolute top-1 right-1 grid min-w-4 h-4 px-1 place-items-center rounded-full text-[10px] font-bold">
                {unreadBadge}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Thông báo hệ thống</p>
            {notificationData?.unread_count ? (
              <span className="text-muted-foreground text-xs">
                {notificationData.unread_count} chưa đọc
              </span>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <p className="text-muted-foreground py-8 text-center text-xs">Đang tải thông báo...</p>
            ) : isError ? (
              <div className="space-y-2 px-4 py-6 text-center">
                <p className="text-muted-foreground text-xs">Không tải được thông báo.</p>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  Thử lại
                </Button>
              </div>
            ) : recentList.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-xs">Không có thông báo nào.</p>
            ) : (
              <ul className="divide-y">
                {recentList.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void handleNotificationClick(n.id, n.is_read, n.link)}
                      className={`w-full px-4 py-3 text-left text-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                        !n.is_read ? 'bg-primary/5 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-foreground">{n.title}</p>
                        {!n.is_read && (
                          <span className="bg-primary size-2 shrink-0 rounded-full mt-1" />
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-relaxed">
                        {n.body}
                      </p>
                      <p className="text-muted-foreground mt-1 text-[10px] opacity-75">
                        {new Date(n.created_at).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t p-2 text-center bg-muted/20">
            <Button asChild variant="ghost" size="sm" className="w-full text-xs font-semibold">
              <Link to="/admin/thong-bao">Xem tất cả thông báo ➔</Link>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* User Account Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <span className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground grid size-8 place-items-center rounded-full text-xs font-bold shadow-sm">
              {initials}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-xs font-semibold">{displayName}</span>
              <span className="text-muted-foreground block text-[11px]">{roleLabel}</span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-xs font-bold">{displayName}</p>
            <p className="text-muted-foreground text-[11px] font-normal">{roleLabel}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive cursor-pointer">
            <LogOut className="size-4 mr-2" /> Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
