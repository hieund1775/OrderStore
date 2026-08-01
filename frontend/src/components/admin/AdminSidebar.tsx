import { Link, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard,
  ClipboardList,
  ChefHat,
  UtensilsCrossed,
  Boxes,
  Store,
  Megaphone,
  Users,
  BarChart3,
  Bell,
  Settings,
  Leaf,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const adminNav = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
  { to: '/admin/don-hang', label: 'Đơn hàng', icon: ClipboardList },
  { to: '/admin/bep', label: 'Màn hình bếp (KDS)', icon: ChefHat },
  { to: '/admin/thuc-don', label: 'Thực đơn', icon: UtensilsCrossed },
  { to: '/admin/kho', label: 'Tồn kho & Nguyên liệu', icon: Boxes },
  { to: '/admin/chi-nhanh', label: 'Hệ thống cửa hàng', icon: Store },
  { to: '/admin/khuyen-mai', label: 'Khuyến mãi & Marketing', icon: Megaphone },
  { to: '/admin/khach-hang', label: 'Khách hàng & Loyalty', icon: Users },
  { to: '/admin/bao-cao', label: 'Báo cáo & Thống kê', icon: BarChart3 },
  { to: '/admin/thong-bao', label: 'Trung tâm thông báo', icon: Bell },
  { to: '/admin/cai-dat', label: 'Cài đặt hệ thống', icon: Settings },
] as const;

export function AdminSidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground flex h-full flex-col border-r transition-[width] duration-200',
        collapsed ? 'w-[76px]' : 'w-[264px]',
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-xl">
          <Leaf className="size-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-display truncate text-sm font-bold">Trà Trái Cây Tô Admin</p>
            <p className="text-muted-foreground truncate text-[11px]">Bảng điều khiển v3.0</p>
          </div>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          className="hover:bg-sidebar-accent ml-auto hidden rounded-lg p-1.5 lg:block"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {adminNav.map((item) => {
          const active =
            'exact' in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-0',
              )}
            >
              <item.icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          to="/"
          className="text-muted-foreground hover:text-primary flex items-center gap-3 rounded-xl px-3 py-2 text-xs"
        >
          <Store className="size-4 shrink-0" />
          {!collapsed && <span>Về website khách hàng</span>}
        </Link>
      </div>
    </aside>
  );
}
