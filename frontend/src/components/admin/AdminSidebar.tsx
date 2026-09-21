import { Fragment, useEffect, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import {
  ClipboardList,
  ChefHat,
  QrCode,
  Store,
  Megaphone,
  Bell,
  Settings,
  Leaf,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
  Briefcase,
  Boxes,
  PackageCheck,
  Package,
  Star,
  CalendarClock,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchBranchCapabilities, getUser } from '@/lib/api';

type AdminRole = 'super' | 'manager' | 'kitchen' | 'cashier' | 'packing';
const ALL_ROLES: AdminRole[] = ['super', 'manager', 'kitchen', 'cashier', 'packing'];
const MANAGEMENT_ROLES: AdminRole[] = ['super', 'manager'];
const SUPER_ROLES: AdminRole[] = ['super'];

export const adminNav = [
  // Nhóm 1: Vận hành
  { to: '/admin/pos', label: 'Gọi món (POS)', icon: ShoppingCart, section: 'operations', roles: ['super', 'manager', 'cashier'] as AdminRole[] },
  { to: '/admin/bep', label: 'Màn hình bếp (KDS)', icon: ChefHat, section: 'operations', roles: ['super', 'manager', 'kitchen'] as AdminRole[], lane: 'kitchen' },
  { to: '/admin/dong-goi', label: 'Khu vực đóng gói', icon: Package, section: 'operations', roles: ['super', 'manager', 'packing'] as AdminRole[], lane: 'packing' },
  { to: '/admin/dat-truoc', label: 'Đơn đặt trước', icon: CalendarClock, section: 'operations', roles: MANAGEMENT_ROLES },
  // Nhóm 2: Hàng hóa
  { to: '/admin/don-hang', label: 'Đơn hàng', icon: ClipboardList, section: 'catalog', roles: ALL_ROLES },
  { to: '/admin/catalog', label: 'Sản phẩm & Danh mục', icon: Boxes, section: 'catalog', roles: SUPER_ROLES },
  { to: '/admin/hang-dang-ban', label: 'Hàng bán chi nhánh', icon: PackageCheck, section: 'catalog', roles: MANAGEMENT_ROLES },
  // Nhóm 3: Quản lý cửa hàng
  { to: '/admin/chi-nhanh', label: 'Hệ thống cửa hàng', icon: Store, section: 'store_management', roles: SUPER_ROLES },
  { to: '/admin/vi-tri', label: 'Vị trí & Mã QR bàn', icon: QrCode, section: 'store_management', roles: MANAGEMENT_ROLES },
  // Nhóm 4: Quản trị
  { to: '/admin/khuyen-mai', label: 'Khuyến mãi & Voucher', icon: Megaphone, section: 'management', roles: SUPER_ROLES },
  { to: '/admin/danh-gia', label: 'Quản lý đánh giá', icon: Star, section: 'management', roles: SUPER_ROLES },
  { to: '/admin/tuyen-dung', label: 'Tuyển dụng & Ứng viên', icon: Briefcase, section: 'management', roles: SUPER_ROLES },
  { to: '/admin/thong-bao', label: 'Trung tâm thông báo', icon: Bell, section: 'management', roles: ALL_ROLES },
  { to: '/admin/cai-dat', label: 'Tài khoản & Nhật ký', icon: Settings, section: 'management', roles: SUPER_ROLES },
] as const;

const sectionLabels = {
  operations: 'Vận hành',
  catalog: 'Hàng hóa',
  store_management: 'Quản lý cửa hàng',
  management: 'Quản trị',
} as const;

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
  const user = getUser();
  const role = user?.role as AdminRole | undefined;
  const [enabledLanes, setEnabledLanes] = useState<Set<string>>(() => {
    const lanes = new Set<string>();
    if (role === 'super') {
      lanes.add('kitchen');
      lanes.add('packing');
    } else if (role === 'kitchen') {
      lanes.add('kitchen');
    } else if (role === 'packing') {
      lanes.add('packing');
    }
    return lanes;
  });
  const [catalogExpanded, setCatalogExpanded] = useState(() => pathname.startsWith('/admin/catalog'));

  useEffect(() => {
    if (role === 'super') {
      setEnabledLanes(new Set(['kitchen', 'packing']));
      return;
    }
    const defaultLanes = new Set<string>();
    if (role === 'kitchen') defaultLanes.add('kitchen');
    if (role === 'packing') defaultLanes.add('packing');

    if (!user?.branch_id) {
      setEnabledLanes(defaultLanes);
      return;
    }
    let active = true;
    fetchBranchCapabilities(user.branch_id)
      .then((response) => {
        if (!active) return;
        const lanes = new Set(
          (response.data || []).filter((item) => item.is_enabled).map((item) => item.lane_code),
        );
        if (role === 'kitchen') lanes.add('kitchen');
        if (role === 'packing') lanes.add('packing');
        setEnabledLanes(lanes);
      })
      .catch(() => {
        if (active) setEnabledLanes(defaultLanes);
      });
    return () => {
      active = false;
    };
  }, [role, user?.branch_id]);

  const visibleNav = adminNav.filter((item) => {
    if (!role || !item.roles.includes(role)) return false;
    if ('lane' in item) {
      if (role === 'kitchen' && item.lane === 'kitchen') return true;
      if (role === 'packing' && item.lane === 'packing') return true;
      return enabledLanes.has(item.lane);
    }
    return true;
  });

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
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">Tea Station</p>
            <p className="text-muted-foreground truncate text-xs">Trang quản trị</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          className={cn(
            'hover:bg-accent text-muted-foreground hover:text-accent-foreground ml-auto grid size-8 place-items-center rounded-lg transition-colors',
            collapsed && 'hidden',
          )}
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleNav.map((item, index) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          const previousSection = index > 0 ? visibleNav[index - 1].section : null;

          return (
            <Fragment key={item.to}>
              {item.section !== previousSection && !collapsed && (
                <p className="text-muted-foreground px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider first:pt-1">
                  {sectionLabels[item.section]}
                </p>
              )}
              {item.section !== previousSection && collapsed && index > 0 && <div className="my-2 border-t" />}
              {item.to === '/admin/catalog' ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setCatalogExpanded((open) => !open)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      collapsed && 'justify-center px-2',
                    )}
                  >
                    <Icon className={cn('size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-105', active && 'text-primary-foreground')} />
                    {!collapsed && <><span className="min-w-0 flex-1 truncate text-left">{item.label}</span><ChevronDown className={cn('size-4 transition-transform', catalogExpanded && 'rotate-180')} /></>}
                  </button>
                  {!collapsed && catalogExpanded && (
                    <div className="ml-5 mt-1 space-y-1 border-l pl-2">
                      <Link to="/admin/catalog/kitchen" onClick={onNavigate} className={cn('flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium', pathname === '/admin/catalog/kitchen' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}><ChefHat className="size-3.5" />Danh mục Bếp</Link>
                      <Link to="/admin/catalog/packing" onClick={onNavigate} className={cn('flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium', pathname === '/admin/catalog/packing' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}><Package className="size-3.5" />Danh mục Đóng gói</Link>
                    </div>
                  )}
                </div>
              ) : (
              <Link
                to={item.to}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-2',
                )}
              >
                <Icon className={cn('size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-105', active && 'text-primary-foreground')} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
              )}
            </Fragment>
          );
        })}
      </nav>

      {collapsed && (
        <div className="border-t p-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Mở rộng sidebar"
            className="hover:bg-accent text-muted-foreground hover:text-accent-foreground grid size-10 w-full place-items-center rounded-lg transition-colors"
          >
            <PanelLeftOpen className="size-4.5" />
          </button>
        </div>
      )}
    </aside>
  );
}
