import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, Check, ClipboardCheck, CupSoda, PartyPopper, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/PageHeader";
import { vnd } from "@/lib/data";

export const Route = createFileRoute("/theo-doi-don")({
  head: () => ({
    meta: [
      { title: "Theo dõi đơn hàng real-time — Vườn Xanh" },
      {
        name: "description",
        content:
          "Xem trạng thái đơn trà theo thời gian thực: chờ xác nhận, đang pha chế, đang giao và hoàn tất.",
      },
      { property: "og:title", content: "Theo dõi đơn hàng — Vườn Xanh" },
      { property: "og:description", content: "Biết chính xác ly trà của bạn đang ở đâu." },
    ],
  }),
  component: Tracking,
});

const steps = [
  { icon: Timer, label: "Chờ xác nhận", desc: "Hệ thống đã nhận đơn" },
  { icon: ClipboardCheck, label: "Đã xác nhận", desc: "Cửa hàng đã chấp nhận đơn" },
  { icon: CupSoda, label: "Đang pha chế", desc: "Barista đang chuẩn bị trà" },
  { icon: Bike, label: "Đang giao hàng", desc: "Shipper đang trên đường" },
  { icon: PartyPopper, label: "Hoàn tất", desc: "Giao thành công" },
];

const currentStep = 2;

function Tracking() {
  return (
    <>
      <PageHeader
        eyebrow="Tracking"
        title="Theo dõi đơn hàng"
        desc="Đơn VX240726 · Chi nhánh Nguyễn Huệ"
      />

      <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_360px]">
        <section className="bg-card rounded-2xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">Mã đơn</p>
              <p className="font-display text-xl font-extrabold">VX240726</p>
            </div>
            <div className="bg-accent text-accent-foreground rounded-full px-3 py-1.5 text-xs font-semibold">
              Dự kiến 15:40
            </div>
          </div>

          <ol className="mt-8 space-y-0">
            {steps.map((s, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <li key={s.label} className="relative flex gap-4 pb-8 last:pb-0">
                  {i < steps.length - 1 && (
                    <span
                      className={`absolute top-10 left-5 h-full w-0.5 ${done ? "bg-leaf" : "bg-border"}`}
                    />
                  )}
                  <span
                    className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 ${
                      done
                        ? "bg-leaf border-leaf text-leaf-foreground"
                        : active
                          ? "gradient-warm border-primary text-primary-foreground animate-pulse"
                          : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="size-5" /> : <s.icon className="size-5" />}
                  </span>
                  <div className="pt-1.5">
                    <p className={`text-sm font-bold ${active ? "text-primary" : ""}`}>{s.label}</p>
                    <p className="text-muted-foreground text-xs">{s.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="space-y-4">
          <div className="bg-card rounded-2xl border p-5">
            <p className="font-display mb-3 text-lg font-bold">Chi tiết đơn</p>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>1× Trà Dâu Tây Lài Thơm (L, 50% đường, thạch nha đam)</li>
              <li>1× Trà Cam Sả Mật Ong (M, 30% đường)</li>
            </ul>
            <div className="mt-4 flex justify-between border-t pt-3 font-semibold">
              <span>Tổng thanh toán</span>
              <span className="text-primary">{vnd(118000)}</span>
            </div>
          </div>
          <div className="bg-card rounded-2xl border p-5">
            <p className="text-sm font-semibold">Giao đến</p>
            <p className="text-muted-foreground mt-1 text-sm">
              125 Nguyễn Huệ, P. Bến Nghé, Quận 1 · 0901 234 567
            </p>
            <Button asChild variant="soft" className="mt-4 w-full">
              <Link to="/ho-so">Xem lịch sử đơn hàng</Link>
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
