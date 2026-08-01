import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/site/PageHeader";
import { jobs, stores } from "@/lib/data";

export const Route = createFileRoute("/tuyen-dung")({
  head: () => ({
    meta: [
      { title: "Tuyển dụng nhân sự — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Cơ hội việc làm tại Trà Trái Cây Tô: barista trà trái cây, thu ngân, quản lý cửa hàng và part-time. Nộp CV online.",
      },
      { property: "og:title", content: "Tuyển dụng — Trà Trái Cây Tô" },
      { property: "og:description", content: "Gia nhập đội ngũ 48 chi nhánh trên toàn quốc." },
    ],
  }),
  component: Recruitment,
});

function Recruitment() {
  const [applyFor, setApplyFor] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Tuyển dụng"
        title="Cùng pha nên vị tươi mới"
        desc="Chúng tôi tìm những người yêu nguyên liệu thật và thích chăm sóc khách hàng."
      />

      <div className="container-page grid gap-5 py-10 md:grid-cols-2">
        {jobs.map((j) => (
          <article key={j.id} className="bg-card rounded-2xl border p-5">
            <div className="flex items-start gap-3">
              <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-xl">
                <Briefcase className="size-5" />
              </span>
              <div className="flex-1">
                <h2 className="font-display text-lg font-bold">{j.title}</h2>
                <Badge variant="secondary" className="mt-1 rounded-full text-[11px] font-normal">
                  {j.type}
                </Badge>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="font-semibold">Mô tả công việc</dt>
                <dd className="text-muted-foreground">{j.jd}</dd>
              </div>
              <div>
                <dt className="font-semibold">Yêu cầu</dt>
                <dd className="text-muted-foreground">{j.req}</dd>
              </div>
              <div>
                <dt className="font-semibold">Mức lương & quyền lợi</dt>
                <dd className="text-primary font-semibold">{j.salary}</dd>
              </div>
            </dl>
            <Button variant="hero" className="mt-4 w-full" onClick={() => setApplyFor(j.title)}>
              Ứng tuyển ngay
            </Button>
          </article>
        ))}
      </div>

      <Dialog open={!!applyFor} onOpenChange={(v) => !v && setApplyFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Nộp hồ sơ · {applyFor}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Đã gửi hồ sơ", {
                description: "Chúng tôi sẽ liên hệ trong 3 ngày làm việc.",
              });
              setApplyFor(null);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="fullname">Họ và tên</Label>
              <Input id="fullname" required placeholder="Nguyễn Minh Trang" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input id="phone" required inputMode="tel" placeholder="09xx xxx xxx" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="ban@email.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Chi nhánh mong muốn</Label>
              <Select defaultValue={stores[0].id}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cv">Tải lên CV (PDF / Word)</Label>
              <label
                htmlFor="cv"
                className="hover:border-primary text-muted-foreground flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm"
              >
                <Upload className="size-4" /> Chọn tệp từ thiết bị
              </label>
              <Input id="cv" type="file" className="hidden" accept=".pdf,.doc,.docx" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link">Hoặc dán link hồ sơ online</Label>
              <Input id="link" placeholder="https://" />
            </div>
            <Button type="submit" variant="hero" className="w-full">
              Gửi hồ sơ
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
