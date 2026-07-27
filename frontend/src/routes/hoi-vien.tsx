import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/site/PageHeader";
import { rewards, tiers } from "@/lib/data";

export const Route = createFileRoute("/hoi-vien")({
  head: () => ({
    meta: [
      { title: "Thẻ hội viên & tích điểm đổi quà — Vườn Xanh" },
      {
        name: "description",
        content:
          "Tích điểm mỗi ly trà, thăng hạng Đồng – Bạc – Vàng – Kim Cương và đổi voucher, topping, quà tặng hấp dẫn.",
      },
      { property: "og:title", content: "Thẻ hội viên Vườn Xanh" },
      { property: "og:description", content: "1 điểm cho mỗi 10.000₫ — đổi quà bất cứ lúc nào." },
    ],
  }),
  component: Loyalty,
});

const currentPoints = 1820;

function Loyalty() {
  const nextTier = tiers.find((t) => t.need > currentPoints);
  const progress = nextTier ? Math.round((currentPoints / nextTier.need) * 100) : 100;

  return (
    <>
      <PageHeader
        eyebrow="Thẻ hội viên"
        title="Tích điểm – Thăng hạng – Đổi quà"
        desc="Mỗi 10.000₫ chi tiêu tương đương 1 điểm thưởng, tự động cộng vào tài khoản của bạn."
      />

      <div className="container-page py-10">
        <div className="gradient-warm text-primary-foreground rounded-3xl p-6 shadow-glow md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs tracking-widest uppercase opacity-80">Hạng hiện tại</p>
              <p className="font-display flex items-center gap-2 text-3xl font-extrabold">
                <Crown className="size-7" /> Vàng
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-80">Điểm khả dụng</p>
              <p className="font-display text-3xl font-extrabold">
                {currentPoints.toLocaleString("vi-VN")}
              </p>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs opacity-90">
              <span>Tiến độ lên hạng {nextTier?.name ?? "cao nhất"}</span>
              <span>
                {currentPoints} / {nextTier?.need ?? currentPoints} điểm
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        <h2 className="font-display mt-12 mb-5 text-2xl font-extrabold">Đặc quyền theo hạng</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`bg-card rounded-2xl border p-5 ${t.name === "Vàng" ? "border-primary shadow-card-soft" : ""}`}
            >
              <p className="font-display text-lg font-bold">{t.name}</p>
              <p className="text-muted-foreground text-xs">
                Từ {t.need.toLocaleString("vi-VN")} điểm
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Check className="text-leaf mt-0.5 size-4 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h2 className="font-display mt-12 mb-5 text-2xl font-extrabold">Ví đổi quà</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const enough = currentPoints >= r.points;
            return (
              <div key={r.id} className="bg-card flex items-center gap-4 rounded-2xl border p-5">
                <span className="bg-accent flex size-12 items-center justify-center rounded-xl text-2xl">
                  {r.emoji}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-primary text-sm font-bold">{r.points} điểm</p>
                </div>
                <Button
                  size="sm"
                  variant={enough ? "hero" : "secondary"}
                  disabled={!enough}
                  onClick={() => toast.success("Đổi quà thành công", { description: r.name })}
                >
                  Đổi ngay
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
