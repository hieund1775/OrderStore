import { createFileRoute, Link } from '@tanstack/react-router';
import { ShieldCheck, Lock, Eye, RefreshCw, Mail, Phone } from 'lucide-react';
import { PageHeader } from '@/components/site/PageHeader';
import { brand } from '@/lib/data';

export const Route = createFileRoute('/chinh-sach-bao-mat')({
  head: () => ({
    meta: [
      { title: `Chính sách bảo mật — ${brand.name}` },
      { name: 'description', content: `Chính sách bảo mật thông tin cá nhân khách hàng tại hệ thống ${brand.name}.` },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Chính sách & Pháp lý"
        title="Chính Sách Bảo Mật Thông Tin"
        desc={`Cam kết bảo vệ dữ liệu và quyền riêng tư cá nhân của khách hàng khi trải nghiệm dịch vụ tại ${brand.name}.`}
      />

      <div className="container-page max-w-4xl py-12 space-y-10 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <ShieldCheck className="size-5" />
            <h2>1. Mục đích và phạm vi thu thập thông tin</h2>
          </div>
          <p>
            Hệ thống <strong>{brand.name}</strong> thu thập thông tin của khách hàng nhằm mục đích xử lý đơn hàng, cung cấp dịch vụ giao hàng tận nơi, chăm sóc khách hàng và thông báo các chương trình ưu đãi hội viên.
          </p>
          <p>Các thông tin thu thập bao gồm:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Họ và tên khách hàng</li>
            <li>Số điện thoại liên hệ nhận hàng</li>
            <li>Địa chỉ giao hàng chi tiết (khi đặt giao hàng tận nơi)</li>
            <li>Lịch sử đơn hàng, điểm tích lũy và mã voucher ưu đãi</li>
            <li>Địa chỉ email (tùy chọn để nhận hóa đơn điện tử)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <Lock className="size-5" />
            <h2>2. Phạm vi sử dụng thông tin</h2>
          </div>
          <p>Thông tin thu thập được chỉ sử dụng trong các trường hợp nội bộ sau:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Xác nhận và chuẩn bị đơn hàng tại chi nhánh gần nhất</li>
            <li>Liên hệ giao nhận món đồ uống đúng giờ và địa điểm yêu cầu</li>
            <li>Giải quyết khiếu nại, hỗ trợ kỹ thuật hoặc đổi trả đơn hàng</li>
            <li>Gửi thông báo chương trình khuyến mãi, voucher sinh nhật dành riêng cho khách hàng</li>
            <li>Phục vụ các yêu cầu pháp lý hợp pháp từ cơ quan quản lý nhà nước khi có văn bản yêu cầu</li>
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <Eye className="size-5" />
            <h2>3. Cam kết không chia sẻ cho bên thứ ba</h2>
          </div>
          <p>
            {brand.name} cam kết không bán, chia sẻ hay trao đổi thông tin cá nhân của khách hàng cho bất kỳ bên thứ ba nào vì mục đích thương mại. Thông tin chỉ được cung cấp cho đơn vị vận chuyển đối tác nhằm phục vụ duy nhất mục đích giao hàng tận nơi.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <RefreshCw className="size-5" />
            <h2>4. Quyền của khách hàng đối với dữ liệu cá nhân</h2>
          </div>
          <p>
            Khách hàng có toàn quyền kiểm tra, cập nhật, điều chỉnh hoặc yêu cầu xóa bỏ thông tin cá nhân của mình bằng cách:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Truy cập mục <Link to="/ho-so" className="text-primary underline font-medium">Hồ sơ cá nhân</Link> trên website hoặc ứng dụng.</li>
            <li>Liên hệ trực tiếp bộ phận CSKH qua Hotline {brand.hotline} hoặc Email {brand.email}.</li>
          </ul>
        </section>

        <section className="space-y-3 border-t pt-8">
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <Mail className="size-5" />
            <h2>5. Thông tin đơn vị quản trị dữ liệu</h2>
          </div>
          <div className="bg-muted/40 rounded-2xl p-5 space-y-2 border">
            <p className="font-bold">{brand.name}</p>
            <p className="flex items-center gap-2"><Phone className="size-4 text-primary" /> Hotline: {brand.hotline} (08:00 - 22:00 hàng ngày)</p>
            <p className="flex items-center gap-2"><Mail className="size-4 text-primary" /> Email tiếp nhận: {brand.email}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
