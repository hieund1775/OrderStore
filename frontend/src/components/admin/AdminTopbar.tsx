import { Bell, ChevronDown, Menu, Search, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { adminBranches, adminNotifications, adminRoles } from '@/lib/admin-data';

export function AdminTopbar({
  branch,
  onBranchChange,
  role,
  onRoleChange,
  onOpenMobileNav,
}: {
  branch: string;
  onBranchChange: (id: string) => void;
  role: string;
  onRoleChange: (id: string) => void;
  onOpenMobileNav: () => void;
}) {
  const currentBranch = adminBranches.find((b) => b.id === branch) ?? adminBranches[0];
  const currentRole = adminRoles.find((r) => r.id === role) ?? adminRoles[0];

  return (
    <header className="bg-background/90 sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Mở menu"
      >
        <Menu className="size-5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="max-w-[210px] justify-between gap-2">
            <span className="truncate text-xs md:text-sm">{currentBranch.name}</span>
            <ChevronDown className="size-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Chi nhánh hoạt động</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {adminBranches.map((b) => (
            <DropdownMenuItem key={b.id} onSelect={() => onBranchChange(b.id)}>
              {b.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="relative ml-auto hidden max-w-xs flex-1 md:block">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input placeholder="Tìm đơn hàng, khách hàng, món…" className="pl-9" />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative ml-auto md:ml-0"
            aria-label="Thông báo"
          >
            <Bell className="size-5" />
            <span className="bg-berry text-berry-foreground absolute top-1 right-1 grid size-4 place-items-center rounded-full text-[10px] font-bold">
              {adminNotifications.length}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <p className="border-b px-4 py-3 text-sm font-semibold">Trung tâm thông báo</p>
          <ul className="max-h-72 overflow-y-auto">
            {adminNotifications.map((n) => (
              <li key={n.id} className="hover:bg-muted/60 border-b px-4 py-3 last:border-0">
                <p className="text-sm">{n.title}</p>
                <p className="text-muted-foreground mt-1 text-xs">{n.time}</p>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <span className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground grid size-8 place-items-center rounded-full text-xs font-bold">
              NQ
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-xs font-semibold">Hoàng Quân</span>
              <span className="text-muted-foreground block text-[11px]">{currentRole.label}</span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex items-center gap-2">
            <ShieldCheck className="text-leaf size-4" /> Vai trò đang xem (RBAC)
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {adminRoles.map((r) => (
            <DropdownMenuItem
              key={r.id}
              onSelect={() => onRoleChange(r.id)}
              className="flex-col items-start gap-0.5"
            >
              <span className="flex w-full items-center justify-between text-sm font-medium">
                {r.label}
                {r.id === role && <Badge variant="secondary">Đang chọn</Badge>}
              </span>
              <span className="text-muted-foreground text-xs">{r.desc}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem>Đăng xuất</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
