import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, Gift, Loader2, Sparkles, Upload } from "lucide-react";
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
import { apiGet, apiPost } from "@/lib/api";

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
      { property: "og:description", content: "Gia nhập đội ngũ các chi nhánh trên toàn quốc." },
    ],
  }),
  component: RecruitmentPage,
});

type Job = {
  id: number;
  title: string;
  type: string;
  salary: string;
  description: string;
  requirements: string;
  benefits: string | null;
  is_active: boolean;
  stores?: { id: number; name: string }[];
  created_at: string;
};

type Store = {
  id: number;
  name: string;
  city: string;
  district: string;
  address: string;
};

const VN_NAME_REGEX =
  /^([A-Z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9][a-z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]*)(\s([A-Z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9][a-z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]*))+$/;

function validatePhone(phone: string) {
  let str = phone.trim().replace(/[\s\(\)\.-]/g, "");
  if (str.startsWith("+84") && str.length === 12) str = "0" + str.slice(3);
  else if (str.startsWith("84") && str.length === 11) str = "0" + str.slice(2);
  const isVn = /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(str);
  const isIntl = /^\+[1-9][0-9]{7,14}$/.test(str);
  return isVn || isIntl;
}

function RecruitmentPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullname: "",
    phone: "",
    email: "",
    store_id: "",
    cv_url: "",
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<Job[]>("/api/jobs").catch(() => []),
      apiGet<Store[]>("/api/stores").catch(() => []),
    ])
      .then(([jobsData, storesData]) => {
        if (cancelled) return;
        setJobs(jobsData);
        setStores(storesData);
        if (storesData.length > 0) {
          setForm((prev) => ({ ...prev, store_id: String(storesData[0].id) }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleOpenApply(job: Job) {
    setSelectedJob(job);
  }

  async function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJob) return;

    const trimmedName = form.fullname.trim();
    if (!trimmedName || !VN_NAME_REGEX.test(trimmedName)) {
      return toast.error("Vui lòng nhập họ và tên hợp lệ (viết hoa chữ cái đầu, tối thiểu 2 từ)");
    }

    if (!validatePhone(form.phone)) {
      return toast.error("Số điện thoại không hợp lệ (yêu cầu 10 chữ số VN hoặc chuẩn quốc tế có +)");
    }

    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return toast.error("Email không hợp lệ");
    }

    setSubmitting(true);
    try {
      await apiPost(`/api/jobs/${selectedJob.id}/apply`, {
        fullname: trimmedName,
        phone: form.phone.trim(),
        email: form.email.trim(),
        store_id: form.store_id ? Number(form.store_id) : null,
        cv_url: form.cv_url.trim() || null,
      });

      toast.success("Nộp hồ sơ ứng tuyển thành công!", {
        description: "Bộ phận Tuyển dụng sẽ liên hệ bạn qua SĐT/Email trong vòng 3 ngày làm việc.",
      });
      setSelectedJob(null);
      setForm((prev) => ({
        ...prev,
        fullname: "",
        phone: "",
        email: "",
        cv_url: "",
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nộp hồ sơ thất bại, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Tuyển dụng"
        title="Cùng pha nên vị tươi mới"
        desc="Chúng tôi tìm những người yêu nguyên liệu thật và thích chăm sóc khách hàng."
      />

      {loading ? (
        <div className="container-page py-20 flex items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin mr-2" /> Đang tải cơ hội việc làm…
        </div>
      ) : jobs.length === 0 ? (
        <div className="container-page py-16 sm:py-24 text-center">
          <div className="mx-auto max-w-md bg-card rounded-2xl border p-8 shadow-sm space-y-4">
            <div className="bg-primary/10 text-primary mx-auto grid size-16 place-items-center rounded-2xl">
              <Briefcase className="size-8" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold">
              Hiện tại chưa có công việc ứng tuyển
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Chúng tôi hiện chưa mở đợt tuyển dụng mới. Hãy theo dõi website và fanpage Trà Trái Cây Tô để
              cập nhật cơ hội việc làm sớm nhất nhé!
            </p>
          </div>
        </div>
      ) : (
        <div className="container-page grid gap-6 py-10 md:grid-cols-2">
          {jobs.map((j) => (
            <article
              key={j.id}
              className="bg-card rounded-2xl border p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl shrink-0">
                    <Briefcase className="size-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-lg sm:text-xl font-bold truncate">{j.title}</h2>
                    <Badge variant="secondary" className="mt-1 rounded-full text-xs font-normal">
                      {j.type}
                    </Badge>
                  </div>
                </div>

                <dl className="mt-5 space-y-3 text-sm">
                  <div>
                    <dt className="font-semibold text-foreground flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                      <Sparkles className="size-3.5 text-primary" /> Mô tả công việc
                    </dt>
                    <dd className="text-muted-foreground mt-1 leading-relaxed">{j.description}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                      <Sparkles className="size-3.5 text-primary" /> Yêu cầu ứng viên
                    </dt>
                    <dd className="text-muted-foreground mt-1 leading-relaxed">{j.requirements}</dd>
                  </div>
                  {j.benefits && (
                    <div>
                      <dt className="font-semibold text-foreground flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                        <Gift className="size-3.5 text-primary" /> Quyền lợi & Đãi ngộ
                      </dt>
                      <dd className="text-muted-foreground mt-1 leading-relaxed">{j.benefits}</dd>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <dt className="text-xs text-muted-foreground">Mức lương & Thu nhập</dt>
                    <dd className="text-primary font-bold text-base sm:text-lg mt-0.5">{j.salary}</dd>
                  </div>
                </dl>
              </div>

              <Button
                variant="hero"
                className="mt-6 w-full font-semibold"
                onClick={() => handleOpenApply(j)}
              >
                Ứng tuyển ngay
              </Button>
            </article>
          ))}
        </div>
      )}

      {/* Modal Nộp Hồ Sơ */}
      <Dialog open={!!selectedJob} onOpenChange={(v) => !v && setSelectedJob(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Nộp hồ sơ · <span className="text-primary">{selectedJob?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-3.5" onSubmit={handleApplySubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="fullname">Họ và tên *</Label>
              <Input
                id="fullname"
                required
                placeholder="VD: Nguyễn Minh Trang"
                value={form.fullname}
                onChange={(e) => setForm({ ...form, fullname: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">Viết hoa chữ cái đầu (VD: Trần Văn Nam)</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Số điện thoại *</Label>
                <Input
                  id="phone"
                  required
                  inputMode="tel"
                  placeholder="09xx xxx xxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="ban@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            {stores.length > 0 && (
              <div className="space-y-1.5">
                <Label>Chi nhánh mong muốn làm việc</Label>
                <Select
                  value={form.store_id}
                  onValueChange={(val) => setForm({ ...form, store_id: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn chi nhánh" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.district}, {s.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="link">Link CV online (Google Drive / Notion / TopCV)</Label>
              <Input
                id="link"
                placeholder="https://drive.google.com/..."
                value={form.cv_url}
                onChange={(e) => setForm({ ...form, cv_url: e.target.value })}
              />
            </div>

            <Button type="submit" variant="hero" className="w-full font-semibold" disabled={submitting}>
              {submitting ? "Đang gửi hồ sơ…" : "Gửi hồ sơ ứng tuyển"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
