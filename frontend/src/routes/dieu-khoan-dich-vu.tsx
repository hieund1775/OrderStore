import { createFileRoute, Link } from '@tanstack/react-router';
import { FileText, CheckCircle2, AlertCircle, ShoppingBag, CreditCard, HelpCircle } from 'lucide-react';
import { PageHeader } from '@/components/site/PageHeader';
import { brand } from '@/lib/data';

export const Route = createFileRoute('/dieu-khoan-dich-vu')({
  head: () => ({
    meta: [
      { title: `Điều khoản dịch vụ — ${brand.name}` },
      { name: 'description', content: `Điều khoản và quy định sử dụng dịch vụ tại hệ thống ${brand.name}.` },
    ],
  }),
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Chính sách & Pháp lý"
        title="Điều Khoản Dịch Vụ"
        desc={`Quy định và điều khoản áp dụng đối với mọi giao dịch và dịch vụ trên hệ thống ${brand.name}.`}
      />

      <div className="container-page max-w-4xl py-12 space-y-10 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <FileText className="size-5" />
            <h2>1. Chấp thuận điều khoản</h2>
          </div>
          <p>
            Khi quý khách truy cập website, ứng dụng hoặc đặt món tại <strong>{brand.name}</strong>, quý khách đồng ý tuân thủ và chịu ràng buộc bởi các Điều khoản dịch vụ này. Nếu quý khách không đồng ý với bất kỳ điều khoản nào, vui lòng ngừng sử dụng dịch vụ.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <ShoppingBag className="size-5" />
            <h2>2. Đặt hàng và xác nhận đơn hàng</h2>
          </div>
          <p>
            Khách hàng có thể đặt món thông qua website, ứng dụng hoặc trực tiếp tại quầy thu ngân của từng chi nhánh.
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Đơn hàng chỉ được xem là thành công khi hệ thống hiển thị mã đơn hàng (mã bắt đầu bằng <code>#TP...</code> hoặc <code>#PO...</code>).</li>
            <li>Đối với đơn đặt trước (Preorder), khách hàng vui lòng đến nhận món theo đúng khung giờ đã đăng ký để bảo đảm hương vị và chất lượng sản phẩm tốt nhất.</li>
            <li>Chi nhánh có quyền từ chối phục vụ nếu món ăn đã hết nguyên liệu tươi trong ngày hoặc thời gian giao hàng vượt quá bán kính phục vụ.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <CreditCard className="size-5" />
            <h2>3. Giá cả và phương thức thanh toán</h2>
          </div>
          <p>
            Tất cả giá niêm yết trên website là giá đã bao gồm thuế GTGT và được tính bằng Việt Nam Đồng (VNĐ). Các hình thức thanh toán được hỗ trợ bao gồm:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Thanh toán tiền mặt khi nhận hàng (COD)</li>
            <li>Chuyển khoản ngân hàng qua mã VietQR tự động</li>
            <li>Ví điện tử MoMo, ZaloPay, VNPay</li>
            <li>Thẻ ngân hàng nội địa và thẻ quốc tế (Visa/Mastercard)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <AlertCircle className="size-5" />
            <h2>4. Thay đổi hoặc hủy bỏ đơn hàng</h2>
          </div>
          <p>
            Do đặc thù các món đồ uống và trà trái cây được chế biến tươi ngay khi nhận đơn, quý khách chỉ có thể yêu cầu thay đổi hoặc hủy đơn trong vòng <strong>05 phút</strong> kể từ khi tạo đơn và đơn hàng chưa bước vào trạng thái pha chế (Đang làm).
          </p>
        </section>

        <section className="space-y-3 border-t pt-8">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <HelpCircle className="size-5" />
            <h2>5. Hỗ trợ khách hàng</h2>
          </div>
          <p>
            Mọi thắc mắc hoặc yêu cầu hỗ trợ giải quyết tranh chấp, xin vui lòng liên hệ Hotline <strong>{brand.hotline}</strong> hoặc gửi email về <strong>{brand.email}</strong>.
          </p>
        </section>
      </div>
    </div>
  );
}
