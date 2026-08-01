import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PackagePlus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader, StatCard } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ingredients, stockLevel, type Ingredient } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/kho")({
  head: () => ({
    meta: [
      { title: "Tồn kho & nguyên liệu | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "Quản lý nguyên liệu tươi và đồ đóng lon với ngưỡng cảnh báo tồn kho 4 cấp độ.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Tồn kho & nguyên liệu | Admin Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Cảnh báo tồn kho 4 cấp và khóa món nhanh khi hết nguyên liệu.",
      },
    ],
  }),
  component: InventoryPage,
});

const toneClass = {
  ok: "bg-leaf/15 text-leaf",
  warn: "bg-primary/15 text-primary",
  danger: "bg-berry/15 text-berry",
  out: "bg-foreground/10 text-foreground",
};

function InventoryPage() {
  const fresh = ingredients.filter((i) => i.kind === "fresh");
  const canned = ingredients.filter((i) => i.kind === "canned");
  const counts = ingredients.reduce(
    (acc, i) => {
      acc[stockLevel(i).tone] += 1;
      return acc;
    },
    { ok: 0, warn: 0, danger: 0, out: 0 } as Record<string, number>,
  );

  return (
    <>
      <AdminPageHeader
        title="Tồn kho & nguyên liệu"
        desc="Tự động tính % tồn kho theo định mức an toàn tối thiểu của chi nhánh"
        actions={
          <Button variant="hero">
            <PackagePlus className="mr-1 size-4" /> Nhập hàng
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="🟢 Bình thường (>30%)" value={counts.ok} tone="leaf" />
        <StatCard label="🟡 Cảnh báo (20–30%)" value={counts.warn} tone="primary" />
        <StatCard label="🔴 Nguy hiểm (10–19%)" value={counts.danger} tone="berry" />
        <StatCard label="⬛ Hết hàng (0%)" value={counts.out} tone="muted" />
      </div>

      <Tabs defaultValue="fresh">
        <TabsList>
          <TabsTrigger value="fresh">Nguyên liệu tươi</TabsTrigger>
          <TabsTrigger value="canned">Đồ đóng lon</TabsTrigger>
        </TabsList>
        <TabsContent value="fresh" className="mt-5">
          <StockTable rows={fresh} />
        </TabsContent>
        <TabsContent value="canned" className="mt-5">
          <StockTable rows={canned} />
        </TabsContent>
      </Tabs>

      <Card className="border-berry/40 bg-berry/5 shadow-soft mt-6 flex flex-wrap items-center gap-4 p-5">
        <ShieldAlert className="text-berry size-6" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Khóa món nhanh khi hết nguyên liệu</p>
          <p className="text-muted-foreground text-xs">
            Tạm ngưng nhận đơn toàn bộ món chứa “Dưa hấu” tại chi nhánh đang chọn.
          </p>
        </div>
        <Button variant="outline" onClick={() => toast.success("Đã tạm ngưng 3 món chứa dưa hấu")}>
          Tạm ngưng 3 món liên quan
        </Button>
      </Card>
    </>
  );
}

function StockTable({ rows }: { rows: Ingredient[] }) {
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  return (
    <Card className="shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nguyên liệu</TableHead>
              <TableHead>Tồn kho</TableHead>
              <TableHead className="hidden md:table-cell">Định mức an toàn</TableHead>
              <TableHead className="w-48">Mức tồn (%)</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Ngưng bán món liên quan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((i) => {
              const s = stockLevel(i);
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell>
                    {i.stock} {i.unit}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {i.safe} {i.unit}
                  </TableCell>
                  <TableCell>
                    <Progress value={Math.min(s.pct, 100)} className="h-2" />
                    <span className="text-muted-foreground mt-1 block text-xs">{s.pct}%</span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass[s.tone]}`}
                    >
                      {s.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={paused[i.id] ?? s.tone === "out"}
                      onCheckedChange={(v) => setPaused((p) => ({ ...p, [i.id]: v }))}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
