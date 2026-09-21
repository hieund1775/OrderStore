import { useState } from 'react';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { Star, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReviewModerationPanel } from '@/components/admin/reviews/ReviewModerationPanel';

export const Route = createFileRoute('/admin/danh-gia')({
  validateSearch: (search: Record<string, unknown>) => ({
    visibility: typeof search.visibility === 'string' ? search.visibility : undefined,
    store_id: typeof search.store_id === 'string' ? search.store_id : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  component: AdminReviewsPage,
  head: () => ({
    meta: [{ title: 'Quản lý đánh giá — Admin — Trà Trái Cây Tô' }],
  }),
});

function AdminReviewsPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý đánh giá</h1>
        <p className="mt-1 text-sm text-gray-500">
          Duyệt, phản hồi và kiểm duyệt đánh giá của khách hàng
        </p>
      </div>

      <ReviewModerationPanel
        initialVisibility={searchParams.visibility}
        initialStoreId={searchParams.store_id}
        initialQuery={searchParams.q}
        onFilterChange={(filters) => {
          navigate({
            search: (prev: any) => ({
              ...prev,
              visibility: filters.visibility !== 'all' ? filters.visibility : undefined,
              store_id: filters.store_id || undefined,
              q: filters.q ? filters.q.trim() : undefined,
            }),
            replace: true,
          });
        }}
      />
    </div>
  );
}