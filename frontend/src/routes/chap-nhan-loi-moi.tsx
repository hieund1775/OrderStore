import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, ShieldCheck, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptStaffInvitation } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/chap-nhan-loi-moi")({
  component: AcceptInvitationPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Chấp nhận lời mời | TeaPlus Staff" },
      { name: "description", content: "Thiết lập mật khẩu và kích hoạt tài khoản nhân viên TeaPlus." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AcceptInvitationPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Liên kết không hợp lệ hoặc đã hết hạn.");
      return;
    }

    if (password.length < 8) {
      setError("Mật khẩu phải có tối thiểu 8 ký tự");
      return;
    }

    if (password.length > 128) {
      setError("Mật khẩu không được vượt quá 128 ký tự");
      return;
    }

    if (password !== confirmPassword) {
      setError("Xác nhận mật khẩu không khớp");
      return;
    }

    setLoading(true);
    try {
      const result = await acceptStaffInvitation(token, password);
      toast.success(result.message);
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.message || "Lời mời không hợp lệ hoặc đã hết hạn";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-red-100 text-red-600 mb-4">
              <AlertCircle className="size-8" />
            </div>
            <CardTitle className="text-xl font-display">Liên kết không hợp lệ</CardTitle>
            <CardDescription>
              Đường dẫn chấp nhận lời mời không hợp lệ hoặc đã bị thiếu token.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              variant="hero"
              className="w-full"
              onClick={() => navigate({ to: "/admin/login" })}
            >
              Đăng nhập
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle2 className="size-8" />
            </div>
            <CardTitle className="text-xl font-display">Kích hoạt thành công!</CardTitle>
            <CardDescription>
              Tài khoản của bạn đã được kích hoạt. Bạn có thể đăng nhập ngay với mật khẩu vừa thiết lập.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              variant="hero"
              className="w-full"
              onClick={() => navigate({ to: "/admin/login" })}
            >
              Đăng nhập ngay
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary mb-4">
            <ShieldCheck className="size-8" />
          </div>
          <CardTitle className="text-xl font-display">Chấp nhận lời mời</CardTitle>
          <CardDescription>
            Thiết lập mật khẩu để kích hoạt tài khoản nhân viên TeaPlus của bạn.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accept-password">Mật khẩu mới (tối thiểu 8 ký tự)</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="accept-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accept-confirm-password">Xác nhận mật khẩu</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="accept-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="hero"
              className="w-full font-bold"
              disabled={loading}
            >
              {loading ? "Đang kích hoạt..." : "Kích hoạt tài khoản"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}