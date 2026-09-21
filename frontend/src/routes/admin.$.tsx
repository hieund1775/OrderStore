import { createFileRoute, Link } from '@tanstack/react-router';
import { AlertTriangle, ClipboardList, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/admin/$')({
  component: AdminNotFoundPage,
  head: () => ({
    meta: [
      { title: '404 - Không tìm thấy trang quản trị | Admin Trà Trái Cây Tô' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
});

function AdminNotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="bg-primary/10 text-primary mb-4 grid size-16 place-items-center rounded-2xl">
        <AlertTriangle className="size-8" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-foreground">404</h1>
      <h2 className="mt-2 text-xl font-semibold text-foreground">Không tìm thấy trang quản trị</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Đường dẫn quản trị bạn đang truy cập không tồn tại hoặc đã được thay đổi.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link to="/admin/don-hang">
            <ClipboardList className="mr-2 size-4" /> Về danh sách đơn hàng
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/admin">
            <Home className="mr-2 size-4" /> Bảng điều khiển
          </Link>
        </Button>
      </div>
    </div>
  );
}
