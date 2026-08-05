import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Leaf, Lock, Phone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost, setToken } from "@/lib/api";
import { brand } from "@/lib/data";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Đăng nhập quản trị | Trà Trái Cây Tô" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !password) {
      toast.error("Vui lòng nhập số điện thoại và mật khẩu");
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost<{ token: string; user: { fullname: string } }>("/admin/login", {
        phone,
        password,
      });
      setToken(res.token);
      toast.success(`Xin chào ${res.user.fullname}`);
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_right,rgba(255,159,67,0.14),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(74,176,86,0.12),transparent_60%)] px-4">
      <div className="bg-card w-full max-w-md rounded-3xl border p-8 shadow-card-soft">
        <div className="mb-8 text-center">
          <span className="gradient-warm mx-auto flex size-14 items-center justify-center rounded-2xl text-2xl shadow-glow">
            <Leaf className="text-primary-foreground size-7" />
          </span>
          <h1 className="font-display mt-4 text-2xl font-extrabold">
            Trà Trái Cây <span className="text-primary">Tô</span> Admin
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Đăng nhập để quản lý hệ thống</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Số điện thoại</Label>
            <div className="relative">
              <Phone className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="phone"
                placeholder="0900 000 001"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 rounded-xl pl-9"
                autoComplete="username"
                inputMode="tel"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Lock className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl pl-9"
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
            {!loading && <ArrowRight className="size-4" />}
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          {brand.name} · {brand.hotline}
        </p>
      </div>
    </div>
  );
}
