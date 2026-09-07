import { useState } from 'react';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { Star, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReviewModerationPanel } from '@/components/admin/reviews/ReviewModerationPanel';

export const Route = createFileRoute('/admin/danh-gia')({
  component: AdminReviewsPage,
  head: () => ({
    meta: [{ title: 'Quản lý đánh giá — Admin — Trà Trái Cây Tô' }],
  }),
});

function AdminReviewsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý đánh giá</h1>
        <p className="mt-1 text-sm text-gray-500">
          Duyệt, phản hồi và kiểm duyệt đánh giá của khách hàng
        </p>
      </div>

      <ReviewModerationPanel />
    </div>
  );
}