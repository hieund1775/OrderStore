import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Flame } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { adminOrders } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/bep")({
  head: () => ({
    meta: [
      { title: "Màn hình bếp KDS | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Kitchen Display System với thẻ đơn lớn, màu trạng thái trực quan và cảnh báo quá 15 phút.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Màn hình bếp KDS | Admin Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Theo dõi và chuyển trạng thái đơn pha chế theo thời gian thực.",
      },
    ],
  }),
  component: KdsPage,
});

type Lane = "wait" | "prep" | "done";

const lanes: { id: Lane; label: string; dot: string; ring: string }[] = [
  { id: "wait", label: "🟡 Chờ làm", dot: "bg-primary", ring: "border-primary/40 bg-primary/5" },
  {
    id: "prep",
    label: "🔵 Đang chuẩn bị",
    dot: "bg-chart-5",
    ring: "border-chart-5/40 bg-chart-5/5",
  },
  { id: "done", label: "🟢 Hoàn thành", dot: "bg-leaf", ring: "border-leaf/40 bg-leaf/5" },
];

function initialLane(status: string): Lane {
  if (status === "Chờ xác nhận") return "wait";
  if (status === "Đang chuẩn bị") return "prep";
  return "done";
}

function KdsPage() {
  const [state, setState] = useState<Record<string, Lane>>(
    Object.fromEntries(adminOrders.map((o) => [o.id, initialLane(o.status)])),
  );

  const move = (id: string, lane: Lane) => {
    setState((s) => ({ ...s, [id]: lane }));
    toast.success(`Đơn ${id} chuyển sang ${lanes.find((l) => l.id === lane)?.label}`);
  };

  return (
    <>
      <AdminPageHeader
        title="Màn hình bếp (KDS)"
        desc="Đơn quá 15 phút sẽ chuyển đỏ và được ưu tiên pha chế trước"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {lanes.map((lane) => {
          const orders = adminOrders.filter(
            (o) => state[o.id] === lane.id && o.status !== "Đã hủy",
          );
          return (
            <section key={lane.id} className={`rounded-2xl border p-4 ${lane.ring}`}>
              <p className="mb-4 flex items-center justify-between text-sm font-bold">
                {lane.label}
                <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                  {orders.length}
                </span>
              </p>
              <div className="space-y-4">
                {orders.map((o) => {
                  const late = o.minutes > 15 && lane.id !== "done";
                  return (
                    <article
                      key={o.id}
                      className={`bg-card rounded-2xl border-2 p-4 ${late ? "border-berry" : "border-transparent"}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-display text-lg font-extrabold">{o.id}</p>
                        <span
                          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                            late
                              ? "bg-berry text-berry-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {late ? <Flame className="size-3" /> : <Clock className="size-3" />}{" "}
                          {o.minutes}′
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {o.type} · {o.branch}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {o.items.map((it) => (
                          <li key={it.name} className="border-l-4 border-primary/40 pl-3">
                            <p className="text-base font-semibold">
                              {it.qty}× {it.name}
                            </p>
                            <p className="text-muted-foreground text-xs">{it.options}</p>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex gap-2">
                        {lane.id !== "wait" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => move(o.id, lane.id === "done" ? "prep" : "wait")}
                          >
                            Lùi lại
                          </Button>
                        )}
                        {lane.id !== "done" && (
                          <Button
                            variant="hero"
                            size="sm"
                            className="flex-1"
                            onClick={() => move(o.id, lane.id === "wait" ? "prep" : "done")}
                          >
                            {lane.id === "wait" ? "Bắt đầu làm" : "Hoàn thành"}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
                {orders.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-sm">Chưa có đơn nào.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
