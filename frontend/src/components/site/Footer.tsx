import { Link } from '@tanstack/react-router';
import { Facebook, Mail, MessageCircle, Phone, QrCode } from 'lucide-react';
import { brand } from '@/lib/data';

export function Footer() {
  return (
    <footer className="bg-secondary/60 mt-20 border-t">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-xl font-bold">
            Tiệm Trà <span className="text-primary">Vườn Xanh</span>
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Trà ủ mới mỗi ngày từ vùng nguyên liệu Thái Nguyên & Bảo Lộc, kết hợp 100% trái cây tươi
            nhập trong ngày.
          </p>
          <p className="text-muted-foreground mt-3 text-xs">GPKD số 0312xxxxxx – Sở KHĐT TP.HCM</p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Khám phá</p>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>
              <Link to="/menu" className="hover:text-primary">
                Thực đơn
              </Link>
            </li>
            <li>
              <Link to="/cua-hang" className="hover:text-primary">
                Hệ thống cửa hàng
              </Link>
            </li>
            <li>
              <Link to="/su-kien" className="hover:text-primary">
                Khuyến mãi & sự kiện
              </Link>
            </li>
            <li>
              <Link to="/hoi-vien" className="hover:text-primary">
                Thẻ hội viên
              </Link>
            </li>
            <li>
              <Link to="/tuyen-dung" className="hover:text-primary">
                Tuyển dụng
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Chính sách</p>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>Chính sách bảo mật</li>
            <li>Điều khoản dịch vụ</li>
            <li>Chính sách giao hàng</li>
            <li>Chính sách đổi trả</li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Liên hệ & Kết nối</p>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Phone className="text-primary size-4" /> Hotline {brand.hotline}
            </li>
            <li className="flex items-center gap-2">
              <Mail className="text-primary size-4" /> {brand.email}
            </li>
            <li className="flex items-center gap-2">
              <Facebook className="text-primary size-4" /> Fanpage Vườn Xanh
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="text-primary size-4" /> Zalo OA
            </li>
          </ul>
          <div className="bg-card mt-4 flex items-center gap-3 rounded-xl border p-3">
            <QrCode className="size-10" />
            <p className="text-muted-foreground text-xs">
              Quét mã tải Zalo Mini App
              <br />& nhận 50 điểm chào mừng
            </p>
          </div>
        </div>
      </div>
      <div className="border-t py-5">
        <p className="text-muted-foreground container-page text-center text-xs">
          © 2026 {brand.name}. {brand.tagline}.
        </p>
      </div>
    </footer>
  );
}
