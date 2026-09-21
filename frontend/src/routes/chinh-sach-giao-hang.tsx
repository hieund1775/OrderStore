import { createFileRoute, Link } from '@tanstack/react-router';
import { Truck, Clock, MapPin, DollarSign, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/site/PageHeader';
import { brand } from '@/lib/data';

export const Route = createFileRoute('/chinh-sach-giao-hang')({
  head: () => ({
    meta: [
      { title: `Chính sách giao hàng — ${brand.name}` },
      { name: 'description', content: `Quy định về thời gian, phí vận chuyển và phạm vi giao hàng tận nơi của ${brand.name}.` },
    ],
  }),
  component: DeliveryPolicyPage,
});

function DeliveryPolicyPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Chính sách & Pháp lý"
        title="Chính Sách Giao Hàng"
        desc={`Cam kết giao đồ uống tươi ngon, đúng nhiệt độ và nhanh chóng đến tận tay quý khách.`}
      />

      <div className="container-page max-w-4xl py-12 space-y-10 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <MapPin className="size-5" />
            <h2>1. Phạm vi giao hàng</h2>
          </div>
          <p>
            <strong>{brand.name}</strong> phục vụ giao hàng trong bán kính tối đa <strong>10km</strong> tính từ chi nhánh gần nhất đang hoạt động. Đối với các đơn hàng ngoài bán kính trên, quý khách vui lòng liên hệ trực tiếp hotline để được hỗ trợ điều phối riêng.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <Clock className="size-5" />
            <h2>2. Thời gian giao hàng dự kiến</h2>
          </div>
          <p>Thời gian giao hàng tính từ lúc chi nhánh xác nhận đơn:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li><strong>Dưới 3km:</strong> 20 – 30 phút.</li>
            <li><strong>Từ 3km – 6km:</strong> 30 – 45 phút.</li>
            <li><strong>Từ 6km – 10km:</strong> 45 – 60 phút.</li>
          </ul>
          <p className="text-xs text-muted-foreground italic">
            * Thời gian giao hàng có thể kéo dài hơn đôi chút trong các khung giờ cao điểm (11:30 - 13:00 và 17:30 - 19:00) hoặc điều kiện thời tiết mưa bão.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <DollarSign className="size-5" />
            <h2>3. Biểu phí vận chuyển & Ưu đãi Freeship</h2>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/50 font-semibold border-b">
                <tr>
                  <th className="p-3">Khoảng cách</th>
                  <th className="p-3">Phí tiêu chuẩn</th>
                  <th className="p-3">Chính sách ưu đãi</th>
                </tr>
              </thead>
              <tbody className="divide-y text-muted-foreground">
                <tr>
                  <td className="p-3">Dưới 2km</td>
                  <td className="p-3">15.000₫</td>
                  <td className="p-3 text-emerald-600 font-semibold">Freeship cho đơn từ 99.000₫</td>
                </tr>
                <tr>
                  <td className="p-3">Từ 2km – 5km</td>
                  <td className="p-3">25.000₫</td>
                  <td className="p-3 text-emerald-600 font-semibold">Freeship cho đơn từ 149.000₫</td>
                </tr>
                <tr>
                  <td className="p-3">Từ 5km – 10km</td>
                  <td className="p-3">35.000₫ – 45.000₫</td>
                  <td className="p-3 text-primary font-medium">Hỗ trợ 20.000₫ cho đơn từ 200.000₫</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <CheckCircle2 className="size-5" />
            <h2>4. Kiểm tra hàng khi nhận (Đồng kiểm)</h2>
          </div>
          <p>
            Quý khách vui lòng kiểm tra kỹ số lượng ly, tem niêm phong và hóa đơn đi kèm trước khi nhận hàng từ tài xế. Nếu phát hiện món uống bị đổ vỡ, sai topping hoặc thiếu món, quý khách có quyền từ chối nhận và liên hệ ngay Hotline {brand.hotline} để được giao bù ngay lập tức.
          </p>
        </section>
      </div>
    </div>
  );
}
