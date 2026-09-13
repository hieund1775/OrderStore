import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

export const Route = createFileRoute('/don-dat-truoc')({
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === 'string' && search.code.trim() ? search.code.trim() : undefined,
  }),
  component: CustomerPreordersRedirect,
});

function CustomerPreordersRedirect() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  useEffect(() => {
    void navigate({
      to: '/ho-so',
      search: {
        tab: 'preorders',
        ...(search.code ? { code: search.code } : {}),
      },
      replace: true,
    });
  }, [navigate, search.code]);

  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">
        Đang chuyển hướng tới Đơn đặt trước trong Hồ sơ cá nhân…
      </p>
    </div>
  );
}
