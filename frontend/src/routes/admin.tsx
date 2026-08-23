import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getToken, getUser } from "@/lib/api";

const ADMIN_ROLES = ["super", "manager", "kitchen", "cashier"];

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    const token = getToken();
    const user = getUser();
    const isValidAdmin = Boolean(token && user?.role && ADMIN_ROLES.includes(user.role));
    if (!isValidAdmin && location.pathname !== "/admin/login") {
      throw redirect({ to: "/admin/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Bảng điều khiển quản trị | Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Hệ thống quản trị chuỗi trà trái cây: đơn hàng, KDS, vị trí & QR bàn, khuyến mãi và báo cáo.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Bảng điều khiển quản trị | Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Quản lý đơn hàng, vị trí bàn, khuyến mãi và báo cáo cho toàn chuỗi.",
      },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [branch, setBranch] = useState("all");
  const [role, setRole] = useState("super");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Trang đăng nhập hiển thị toàn màn hình, không sidebar
  if (pathname === "/admin/login") {
    return <Outlet />;
  }

  return (
    <div className="bg-muted/30 flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[264px] p-0">
          <AdminSidebar
            collapsed={false}
            onToggle={() => {}}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          branch={branch}
          onBranchChange={setBranch}
          role={role}
          onRoleChange={setRole}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
