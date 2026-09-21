import { createFileRoute, Link } from '@tanstack/react-router';
import { RotateCcw, ShieldAlert, CheckCircle, Clock, HeartHandshake, Phone } from 'lucide-react';
import { PageHeader } from '@/components/site/PageHeader';
import { brand } from '@/lib/data';

export const Route = createFileRoute('/chinh-sach-doi-tra')({
  head: () => ({
    meta: [
      { title: `Chính sách đổi trả & hoàn tiền — ${brand.name}` },
      { name: 'description', content: `Cam kết chất lượng đồ uống và chính sách đổi trả, hoàn tiền minh bạch tại ${brand.name}.` },
    ],
  }),
  component: ReturnPolicyPage,
});

function ReturnPolicyPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Chính sách & Pháp lý"
        title="Chính Sách Đổi Trả & Hoàn Tiền"
        desc={`Cam kết mang lại trải nghiệm ẩm thực trọn vẹn và bảo vệ tối đa quyền lợi của khách hàng.`}
      />

      <div className="container-page max-w-4xl py-12 space-y-10 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <CheckCircle className="size-5" />
            <h2>1. Các trường hợp chấp nhận đổi trả / pha lại món</h2>
          </div>
          <p>
            <strong>{brand.name}</strong> sẵn sàng đổi mới 100% hoặc pha lại ly đồ uống mới hoàn toàn miễn phí cho khách hàng trong các trường hợp:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Món đồ uống giao sai so với đơn đặt hàng (sai size, sai mức đường/đá, thiếu topping).</li>
            <li>Đồ uống bị đổ vỡ, rách màng bọc niêm phong hoặc hư hỏng trong quá trình vận chuyển.</li>
            <li>Trái cây hoặc nguyên liệu có dấu hiệu suy giảm chất lượng, không đạt độ tươi ngon theo tiêu chuẩn cam kết của thương hiệu.</li>
            <li>Thời gian giao hàng trễ hơn 45 phút so với cam kết mà không có thông báo trước từ cửa hàng.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <Clock className="size-5" />
            <h2>2. Thời hạn tiếp nhận yêu cầu đổi trả</h2>
          </div>
          <p>
            Do đồ uống pha chế tươi có hạn sử dụng ngắn trong ngày, quý khách vui lòng thông báo cho bộ phận CSKH trong vòng <strong>60 phút</strong> kể từ khi nhận hàng kèm theo hình ảnh hoặc video chụp tình trạng sản phẩm.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <RotateCcw className="size-5" />
            <h2>3. Phương thức hoàn tiền</h2>
          </div>
          <p>Trong trường hợp quý khách không có nhu cầu nhận ly pha lại, chúng tôi sẽ thực hiện hoàn tiền theo các hình thức:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li><strong>Ví điện tử / Chuyển khoản VietQR:</strong> Hoàn trả trong vòng 1 – 2 giờ làm việc.</li>
            <li><strong>Thẻ ATM / Thẻ quốc tế:</strong> Hoàn trả trong vòng 2 – 5 ngày làm việc theo quy định ngân hàng.</li>
            <li><strong>Voucher đền bù:</strong> Tặng mã giảm giá có giá trị tương đương hoặc lớn hơn để sử dụng cho lần đặt món tiếp theo.</li>
          </ul>
        </section>

        <section className="space-y-3 border-t pt-8">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <HeartHandshake className="size-5" />
            <h2>4. Kênh tiếp nhận khiếu nại đổi trả</h2>
          </div>
          <div className="bg-muted/40 rounded-2xl p-5 border space-y-2">
            <p className="font-semibold text-foreground">Bộ phận Chăm Sóc Khách Hàng TeaPlus</p>
            <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-4 text-primary" /> Hotline: <strong className="text-foreground">{brand.hotline}</strong> (hỗ trợ nhanh 24/7)</p>
            <p className="text-muted-foreground">Hoặc nhắn tin trực tiếp qua Zalo OA / Fanpage chính thức của {brand.name}.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
