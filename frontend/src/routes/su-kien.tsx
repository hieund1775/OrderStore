import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/site/PageHeader";
import { promotions, type PromoStatus } from "@/lib/data";

export const Route = createFileRoute("/su-kien")({
  head: () => ({
    meta: [
      { title: "Khuyến mãi & sự kiện — Tiệm Trà Vườn Xanh" },
      {
        name: "description",
        content:
          "Cập nhật chương trình khuyến mãi trà trái cây: mua 1 tặng 1, giảm giá theo mùa, freeship cuối tuần và mã voucher.",
      },
      { property: "og:title", content: "Khuyến mãi & sự kiện — Vườn Xanh" },
      { property: "og:description", content: "Lưu mã ưu đãi vào ví và dùng ngay khi thanh toán." },
    ],
  }),
  component: Promotions,
});

const statusStyle: Record<PromoStatus, string> = {
  "Đang diễn ra": "bg-leaf text-leaf-foreground",
  "Sắp diễn ra": "bg-primary text-primary-foreground",
  "Đã kết thúc": "bg-muted text-muted-foreground",
};

function Promotions() {
  return (
    <>
      <PageHeader
        eyebrow="Sự kiện"
        title="Khuyến mãi & Tin tức"
        desc="Lưu mã vào ví để hệ thống tự động áp dụng khi bạn thanh toán."
      />
      <div className="container-page grid gap-5 py-10 md:grid-cols-2 lg:grid-cols-3">
        {promotions.map((p) => (
          <article key={p.id} className="bg-card overflow-hidden rounded-2xl border">
            <div className="gradient-fresh flex h-36 items-center justify-center text-6xl">
              {p.emoji}
            </div>
            <div className="space-y-2 p-5">
              <Badge className={`rounded-full ${statusStyle[p.status]}`}>{p.status}</Badge>
              <h2 className="font-display text-lg font-bold">{p.title}</h2>
              <p className="text-muted-foreground text-xs">Áp dụng: {p.period}</p>
              <p className="text-muted-foreground text-sm">{p.rule}</p>
              <div className="flex items-center gap-2 pt-2">
                <code className="bg-secondary rounded-lg border border-dashed px-3 py-1.5 text-sm font-bold">
                  {p.code}
                </code>
                <Button
                  variant="soft"
                  size="sm"
                  disabled={p.status === "Đã kết thúc"}
                  onClick={() => toast.success("Đã lưu mã vào ví", { description: p.code })}
                >
                  <Wallet className="size-4" /> Lưu mã
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
