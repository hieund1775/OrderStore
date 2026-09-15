import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/site/PageHeader';
import { PublicReviewHub } from '@/components/reviews/PublicReviewHub';

export const Route = createFileRoute('/danh-gia')({
  head: () => ({
    meta: [
      { title: 'Đánh giá khách hàng — Trà Trái Cây Tô' },
      {
        name: 'description',
        content:
          'Khám phá phản hồi và đánh giá thực tế từ khách hàng đã thưởng thức trà trái cây tô tươi ngon mỗi ngày.',
      },
      { property: 'og:title', content: 'Đánh giá khách hàng — Trà Trái Cây Tô' },
      {
        property: 'og:description',
        content:
          '100% đánh giá thực tế từ khách hàng đã mua và nhận món tại các chi nhánh Trà Trái Cây Tô.',
      },
    ],
  }),
  component: ReviewHubPage,
});

function ReviewHubPage() {
  return (
    <>
      <PageHeader
        eyebrow="Trải nghiệm khách hàng"
        title="Đánh giá từ khách hàng"
        description="Những phản hồi chân thực nhất về hương vị trà, độ tươi của trái cây và chất lượng phục vụ tại các chi nhánh."
      />
      <div className="container-page py-10 max-w-4xl mx-auto">
        <PublicReviewHub />
      </div>
    </>
  );
}
