import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vnd } from "@/lib/data";
import { apiGet, apiPost } from "@/lib/api";
import { getCustomerSession, openCustomerLoginModal } from "@/lib/customer-session";

export const Route = createFileRoute("/thanh-toan_/sandbox")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token.trim() : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cổng thanh toán Sandbox — Trà Trái Cây Tô" },
      { name: "description", content: "Xác nhận chuyển khoản thử nghiệm trên môi trường sandbox." },
    ],
  }),
  component: SandboxCheckoutPage,
});

type SandboxSession = {
  ok: boolean;
  payment_code: string;
  order_code?: string;
  target_type: "order" | "checkout_group";
  amount: number;
  expires_at: string | null;
  status: "active" | "expired" | "superseded" | "paid" | "failed";
  payment_provider: string;
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function SandboxCheckoutPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const token = search.token || "";

  const [session, setSession] = useState<SandboxSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const customer = getCustomerSession();
  const customerToken = customer?.token;

  const loadSession = useCallback(async () => {
    if (!token) {
      setErrorMessage("Không tìm thấy mã phiên thanh toán sandbox.");
      setLoading(false);
      return;
    }

    if (!customerToken) {
      setErrorMessage("Vui lòng đăng nhập tài khoản để xem phiên thanh toán.");
      setLoading(false);
      openCustomerLoginModal();
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await apiGet<SandboxSession>(
        `/api/payments/sandbox/session?token=${encodeURIComponent(token)}`
      );
      setSession(data);
      if (data.expires_at) {
        const remaining = Math.max(
          0,
          Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000)
        );
        setSecondsRemaining(remaining);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Không thể tải thông tin phiên thanh toán sandbox.");
    } finally {
      setLoading(false);
    }
  }, [token, customerToken]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Countdown timer
  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0 || success) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, success]);

  const isExpired = useMemo(() => {
    if (session?.status === "expired" || session?.status === "superseded") return true;
    if (secondsRemaining !== null && secondsRemaining <= 0) return true;
    return false;
  }, [session?.status, secondsRemaining]);

  async function handleConfirmTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !session || submitting || isExpired) return;

    const amountNum = Number(transferAmount.trim());
    if (!Number.isSafeInteger(amountNum) || amountNum <= 0) {
      toast.error("Vui lòng nhập số tiền chuyển khoản hợp lệ (số nguyên VND).");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const res = await apiPost<{ ok: boolean; success: boolean; kind?: string; order_code?: string; payment_code?: string }>(
        "/api/payments/sandbox/transfer",
        {
          token,
          amount: amountNum,
        }
      );

      if (res.ok || res.success) {
        setSuccess(true);
        toast.success("Xác nhận chuyển khoản thành công!");
        const code = res.order_code || res.payment_code || session.payment_code;
        setTimeout(() => {
          navigate({
            to: "/theo-doi-don",
            search: { code },
          });
        }, 1200);
      }
    } catch (err: any) {
      const msg = err?.message || "Xác nhận chuyển khoản không thành công.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Đang tải phiên thanh toán...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4">
        <div className="border rounded-2xl p-8 text-center bg-card shadow-sm space-y-4">
          <CreditCard className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-xl font-bold">Yêu cầu đăng nhập</h1>
          <p className="text-sm text-muted-foreground">
            Vui lòng đăng nhập tài khoản đã tạo đơn để tiếp tục thanh toán trên cổng sandbox.
          </p>
          <Button onClick={() => openCustomerLoginModal()} className="mt-4">
            Đăng nhập ngay
          </Button>
        </div>
      </div>
    );
  }

  if (errorMessage && !session) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4">
        <div className="border rounded-2xl p-8 text-center bg-card shadow-sm space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Không thể thanh toán</h1>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <div className="pt-4">
            <Link to="/thanh-toan">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Quay lại giỏ hàng
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-lg mx-auto py-10 px-4">
      <div className="border rounded-2xl p-6 sm:p-8 bg-card shadow-sm space-y-6">
        {/* Header */}
        <div className="border-b pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Cổng Thanh Toán Thử Nghiệm</h1>
              <p className="text-xs text-muted-foreground">Môi trường chuyển khoản Sandbox</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>Chính thức</span>
          </div>
        </div>

        {/* Thông tin thanh toán */}
        {session && (
          <div className="rounded-xl bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Mã đơn hàng:</span>
              <span className="font-mono font-bold text-foreground">{session.payment_code}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Số tiền cần chuyển:</span>
              <span className="text-lg font-bold text-primary">{vnd(session.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Thời gian còn lại:
              </span>
              <span
                className={`font-mono font-bold ${
                  secondsRemaining !== null && secondsRemaining < 120
                    ? "text-destructive animate-pulse"
                    : "text-foreground"
                }`}
              >
                {secondsRemaining !== null ? formatCountdown(secondsRemaining) : "--:--"}
              </span>
            </div>
          </div>
        )}

        {/* Trạng thái thành công */}
        {success && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center space-y-2 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">
              Đã xác nhận thanh toán thành công!
            </p>
            <p className="text-xs text-muted-foreground">Đang chuyển hướng tới trang theo dõi đơn...</p>
          </div>
        )}

        {/* Trạng thái hết hạn */}
        {isExpired && !success && (
          <div className="rounded-xl bg-destructive/10 p-4 text-center space-y-2 border border-destructive/20">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="font-semibold text-destructive">Phiên thanh toán đã hết hạn</p>
            <p className="text-xs text-muted-foreground">
              Vui lòng quay lại đơn hàng để tạo lại mã thanh toán mới.
            </p>
            <div className="pt-2">
              <Link to="/theo-doi-don" search={{ code: session?.payment_code }}>
                <Button size="sm" variant="outline">
                  Xem đơn hàng
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Form nhập tiền */}
        {!isExpired && !success && (
          <form onSubmit={handleConfirmTransfer} className="space-y-4">
            {errorMessage && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sandbox-amount" className="text-sm font-medium">
                Nhập số tiền bạn đã chuyển khoản (VND):
              </Label>
              <Input
                id="sandbox-amount"
                type="number"
                step="1"
                min="1"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder={`Nhập đúng ${session?.amount || ""}`}
                disabled={submitting}
                className="font-mono text-base"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Hệ thống yêu cầu số tiền chuyển khoản phải khớp chính xác 100% với số tiền của đơn hàng.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={submitting || !transferAmount.trim()}
            >
              {submitting ? "Đang xác nhận..." : "Xác nhận chuyển khoản"}
            </Button>
          </form>
        )}

        {/* Footer links */}
        <div className="pt-2 text-center">
          <Link
            to="/thanh-toan"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Quay lại trang thanh toán
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SandboxCheckoutPage;
