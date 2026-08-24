import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";

export const Route = createFileRoute("/admin/tuyen-dung")({
  head: () => ({
    meta: [
      { title: "Quản lý tuyển dụng & Ứng viên | Admin Trà Trái Cây Tô" },
      {
        name: "description",
        content: "Đăng tin tuyển dụng và quản lý hồ sơ ứng viên trực tuyến.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecruitmentAdminPage,
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

type Application = {
  id: number;
  job_id: number;
  job_title: string;
  job_type: string | null;
  store_id: number | null;
  store_name: string;
  fullname: string;
  phone: string;
  email: string;
  cv_url: string | null;
  status: "Mới" | "Đang xem xét" | "Phỏng vấn" | "Trúng tuyển" | "Từ chối";
  note: string | null;
  created_at: string;
};

const PRESET_JOBS = [
  {
    title: "Nhân viên Pha Chế (Barista Trà Trái Cây)",
    type: "Toàn thời gian",
    salary: "7 – 9 triệu + thưởng doanh số",
    description:
      "Pha chế trà trái cây theo công thức chuẩn, sơ chế trái cây tươi sạch mỗi ngày, giữ vệ sinh khu vực quầy bar.",
    requirements:
      "Từ 18 tuổi, ưu tiên có 3-6 tháng kinh nghiệm F&B/pha chế, nhanh nhẹn, trung thực, cẩn thận.",
    benefits:
      "Thưởng KPI doanh số, phụ cấp gửi xe, giảm 30% thức uống toàn chuỗi, cơ hội thăng tiến Trưởng ca.",
  },
  {
    title: "Thu Ngân",
    type: "Toàn thời gian / Ca linh hoạt",
    salary: "6.5 – 8 triệu",
    description:
      "Chào đón khách hàng, tiếp nhận đơn đặt món, thanh toán tiền mặt/QR/thẻ, tư vấn chương trình khuyến mãi.",
    requirements:
      "Giao tiếp hoạt bát, tươi cười, cẩn thận trong quản lý tiền mặt và hóa đơn, biết dùng máy POS.",
    benefits:
      "Thưởng doanh số chi nhánh, đồng phục miễn phí, môi trường làm việc trẻ trung, năng động.",
  },
  {
    title: "Quản Lý Cửa Hàng",
    type: "Toàn thời gian",
    salary: "12 – 18 triệu",
    description:
      "Điều hành toàn diện hoạt động chi nhánh: doanh thu, nhân sự, dịch vụ khách hàng, kiểm soát nguyên vật liệu và vệ sinh an toàn thực phẩm.",
    requirements:
      "Tối thiểu 1 năm kinh nghiệm quản lý cửa hàng F&B/chuỗi trà sữa, kỹ năng đào tạo và truyền cảm hứng cho nhân viên.",
    benefits:
      "Thưởng doanh thu tháng/quý hấp dẫn, đóng BHXH đầy đủ, thưởng Lễ Tết, lộ trình phát triển Quản lý vùng.",
  },
  {
    title: "Nhân Viên Phục Vụ / Part-time",
    type: "Bán thời gian / Xoay ca",
    salary: "25.000đ – 30.000đ/giờ",
    description:
      "Bưng bê món, dọn dẹp bàn ghế, hỗ trợ quầy pha chế và giữ gìn không gian quán sạch sẽ, thoáng mát.",
    requirements:
      "Chăm chỉ, nhanh nhẹn, lễ phép, đăng ký tối thiểu 4 ca/tuần (mỗi ca 4 - 6 tiếng).",
    benefits:
      "Hỗ trợ sắp xếp lịch làm theo lịch học, thưởng chuyên cần, miễn phí nước uống trong ca làm việc.",
  },
];

const emptyJobForm = {
  title: "",
  type: "Toàn thời gian",
  salary: "",
  description: "",
  requirements: "",
  benefits: "",
  is_active: true,
};

const appStatusBadgeTone: Record<string, string> = {
  "Mới": "bg-blue-100 text-blue-800 border-blue-200",
  "Đang xem xét": "bg-amber-100 text-amber-800 border-amber-200",
  "Phỏng vấn": "bg-purple-100 text-purple-800 border-purple-200",
  "Trúng tuyển": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Từ chối": "bg-rose-100 text-rose-800 border-rose-200",
};

function RecruitmentAdminPage() {
  const [activeTab, setActiveTab] = useState("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal tạo/sửa tin tuyển dụng
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [savingJob, setSavingJob] = useState(false);
  const [jobForm, setJobForm] = useState(emptyJobForm);

  // Modal xóa tin tuyển dụng
  const [deleteJobDialogOpen, setDeleteJobDialogOpen] = useState(false);
  const [selectedJobToDelete, setSelectedJobToDelete] = useState<Job | null>(null);
  const [deletingJob, setDeletingJob] = useState(false);

  // Modal chi tiết & cập nhật trạng thái ứng viên
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [appStatusInput, setAppStatusInput] = useState<Application["status"]>("Mới");
  const [appNoteInput, setAppNoteInput] = useState("");
  const [savingAppStatus, setSavingAppStatus] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsData, appsData] = await Promise.all([
        apiGet<Job[]>("/admin/jobs"),
        apiGet<Application[]>("/admin/job-applications"),
      ]);
      setJobs(jobsData);
      setApplications(appsData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được dữ liệu tuyển dụng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handlePickPreset(indexStr: string) {
    if (indexStr === "custom") {
      setJobForm(emptyJobForm);
      return;
    }
    const idx = Number(indexStr);
    const preset = PRESET_JOBS[idx];
    if (preset) {
      setJobForm({
        title: preset.title,
        type: preset.type,
        salary: preset.salary,
        description: preset.description,
        requirements: preset.requirements,
        benefits: preset.benefits,
        is_active: true,
      });
    }
  }

  function openCreateJob() {
    setEditingJob(null);
    setJobForm(emptyJobForm);
    setJobDialogOpen(true);
  }

  function openEditJob(job: Job) {
    setEditingJob(job);
    setJobForm({
      title: job.title,
      type: job.type,
      salary: job.salary,
      description: job.description,
      requirements: job.requirements,
      benefits: job.benefits || "",
      is_active: job.is_active,
    });
    setJobDialogOpen(true);
  }

  async function saveJob() {
    if (!jobForm.title.trim()) return toast.error("Nhập tiêu đề công việc");
    if (!jobForm.type.trim()) return toast.error("Chọn hoặc nhập hình thức làm việc");
    if (!jobForm.salary.trim()) return toast.error("Nhập mức lương");
    if (!jobForm.description.trim()) return toast.error("Nhập mô tả công việc");
    if (!jobForm.requirements.trim()) return toast.error("Nhập yêu cầu công việc");

    setSavingJob(true);
    try {
      if (editingJob) {
        await apiPut(`/admin/jobs/${editingJob.id}`, jobForm);
        toast.success("Đã cập nhật tin tuyển dụng");
      } else {
        await apiPost("/admin/jobs", jobForm);
        toast.success("Đã đăng tin tuyển dụng mới");
      }
      setJobDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu tin tuyển dụng thất bại");
    } finally {
      setSavingJob(false);
    }
  }

  async function toggleJobActive(job: Job, active: boolean) {
    try {
      await apiPut(`/admin/jobs/${job.id}`, { is_active: active });
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, is_active: active } : j)));
      toast.success(active ? "Đã mở tuyển vị trí này" : "Đã tạm đóng tuyển vị trí này");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật trạng thái thất bại");
    }
  }

  function openDeleteJob(job: Job) {
    setSelectedJobToDelete(job);
    setDeleteJobDialogOpen(true);
  }

  async function confirmDeleteJob() {
    if (!selectedJobToDelete) return;
    setDeletingJob(true);
    try {
      await apiDelete(`/admin/jobs/${selectedJobToDelete.id}`);
      toast.success(`Đã xóa tin tuyển dụng "${selectedJobToDelete.title}"`);
      setDeleteJobDialogOpen(false);
      setSelectedJobToDelete(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa tin tuyển dụng thất bại");
    } finally {
      setDeletingJob(false);
    }
  }

  function openAppDetail(app: Application) {
    setSelectedApp(app);
    setAppStatusInput(app.status);
    setAppNoteInput(app.note || "");
    setAppModalOpen(true);
  }

  async function saveAppStatus() {
    if (!selectedApp) return;
    setSavingAppStatus(true);
    try {
      await apiPatch(`/admin/job-applications/${selectedApp.id}/status`, {
        status: appStatusInput,
        note: appNoteInput,
      });
      toast.success("Đã cập nhật trạng thái hồ sơ ứng viên");
      setAppModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật trạng thái hồ sơ thất bại");
    } finally {
      setSavingAppStatus(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Tuyển dụng & Ứng viên"
        desc="Quản lý các vị trí tuyển dụng chuỗi cửa hàng và xét duyệt hồ sơ ứng tuyển"
        actions={
          <Button onClick={openCreateJob}>
            <Plus className="size-4" /> Đăng tin tuyển dụng
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="jobs" className="gap-2 font-semibold">
            <Briefcase className="size-4" /> Tin tuyển dụng ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2 font-semibold">
            <Users className="size-4" /> Hồ sơ ứng tuyển ({applications.length})
          </TabsTrigger>
        </TabsList>

        {/* ═══════════ TAB 1: TIN TUYỂN DỤNG ═══════════ */}
        <TabsContent value="jobs">
          <Card className="shadow-soft overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Đang tải danh sách…</div>
            ) : jobs.length === 0 ? (
              <div className="py-16 text-center">
                <Briefcase className="text-muted-foreground mx-auto mb-2 size-8" />
                <p className="font-semibold">Chưa có tin tuyển dụng nào</p>
                <p className="text-muted-foreground text-sm">
                  Bấm "Đăng tin tuyển dụng" để chọn mẫu vị trí hoặc tự tạo tin mới.
                </p>
              </div>
            ) : (
              <div>
                {/* MOBILE JOB CARDS (< 768px) */}
                <div className="md:hidden space-y-3 p-3">
                  {jobs.map((j) => (
                    <div
                      key={j.id}
                      className={`bg-card rounded-2xl border p-4 shadow-sm space-y-3 transition-opacity ${
                        j.is_active ? "" : "opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b pb-2.5">
                        <div>
                          <p className="font-bold text-base text-foreground">{j.title}</p>
                          <p className="text-primary font-bold text-xs mt-0.5">{j.salary}</p>
                        </div>
                        <div className="shrink-0">
                          {j.is_active ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold"
                            >
                              🟢 Đang mở tuyển
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                              ⚪ Tạm đóng
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Hình thức:</span>
                          <Badge variant="secondary" className="text-[11px] h-5 px-2">
                            {j.type}
                          </Badge>
                        </div>
                        {j.description && (
                          <p className="text-muted-foreground line-clamp-2">{j.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-dashed gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={j.is_active}
                            onCheckedChange={(v) => toggleJobActive(j, v)}
                            aria-label={`Bật/tắt tuyển ${j.title}`}
                          />
                          <span className="text-xs text-muted-foreground font-medium">
                            {j.is_active ? "Đang mở" : "Đã đóng"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2.5 text-xs font-semibold"
                            onClick={() => openEditJob(j)}
                            aria-label={`Sửa tin ${j.title}`}
                          >
                            <Pencil className="size-3.5 mr-1" /> Sửa
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteJob(j)}
                            aria-label={`Xóa tin ${j.title}`}
                          >
                            <Trash2 className="size-3.5 mr-1" /> Xóa
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESKTOP & TABLET TABLE (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vị trí công việc</TableHead>
                        <TableHead>Hình thức</TableHead>
                        <TableHead>Mức lương</TableHead>
                        <TableHead className="hidden lg:table-cell">Yêu cầu chính</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((j) => (
                        <TableRow key={j.id} className={j.is_active ? "" : "opacity-60"}>
                          <TableCell>
                            <p className="font-semibold text-sm sm:text-base">{j.title}</p>
                            <p className="text-muted-foreground text-xs line-clamp-1">{j.description}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal text-xs">
                              {j.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-primary text-xs sm:text-sm">
                            {j.salary}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden text-xs lg:table-cell max-w-xs truncate">
                            {j.requirements}
                          </TableCell>
                          <TableCell>
                            {j.is_active ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs"
                              >
                                🟢 Đang mở tuyển
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                                ⚪ Tạm đóng
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Switch
                                checked={j.is_active}
                                onCheckedChange={(v) => toggleJobActive(j, v)}
                                aria-label={`Bật/tắt tuyển ${j.title}`}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditJob(j)}
                                aria-label={`Sửa tin ${j.title}`}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => openDeleteJob(j)}
                                aria-label={`Xóa tin ${j.title}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ═══════════ TAB 2: HỒ SƠ ỨNG VIÊN ═══════════ */}
        <TabsContent value="applications">
          <Card className="shadow-soft overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Đang tải hồ sơ…</div>
            ) : applications.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="text-muted-foreground mx-auto mb-2 size-8" />
                <p className="font-semibold">Chưa có hồ sơ ứng tuyển nào</p>
                <p className="text-muted-foreground text-sm">
                  Khi ứng viên nộp hồ sơ qua trang Tuyển dụng của website, thông tin sẽ xuất hiện tại đây.
                </p>
              </div>
            ) : (
              <div>
                {/* MOBILE CANDIDATE CARDS (< 768px) */}
                <div className="md:hidden space-y-3 p-3">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="bg-card rounded-2xl border p-4 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-b pb-2.5">
                        <div>
                          <p className="font-bold text-base text-foreground">{app.fullname}</p>
                          <p className="text-xs font-semibold text-primary">{app.job_title}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`border text-xs font-semibold shrink-0 ${
                            appStatusBadgeTone[app.status] || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {app.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Số điện thoại</span>
                          <a
                            href={`tel:${app.phone}`}
                            className="font-medium text-foreground underline hover:text-primary"
                          >
                            {app.phone}
                          </a>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Chi nhánh</span>
                          <span className="font-medium text-foreground truncate block">{app.store_name}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground block text-[11px]">Email</span>
                          <span className="font-medium text-foreground truncate block">{app.email}</span>
                        </div>
                        {app.cv_url && (
                          <div className="col-span-2 pt-1">
                            <a
                              href={app.cv_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 font-semibold text-xs"
                            >
                              <FileText className="size-3.5" /> Xem File CV đính kèm ➔
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-dashed">
                        <span className="text-[11px] text-muted-foreground">
                          Nộp: {app.created_at ? new Date(app.created_at).toLocaleDateString("vi-VN") : "—"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold"
                          onClick={() => openAppDetail(app)}
                        >
                          <Eye className="size-3.5 mr-1" /> Xem & Duyệt
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESKTOP & TABLET TABLE (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ứng viên</TableHead>
                        <TableHead>Vị trí ứng tuyển</TableHead>
                        <TableHead className="hidden md:table-cell">Chi nhánh</TableHead>
                        <TableHead className="hidden lg:table-cell">Hồ sơ / CV</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="hidden sm:table-cell">Ngày nộp</TableHead>
                        <TableHead className="text-right">Chi tiết</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell>
                            <p className="font-semibold text-sm">{app.fullname}</p>
                            <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                              <span className="flex items-center gap-1">
                                <Phone className="size-3" /> {app.phone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="size-3" /> {app.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{app.job_title}</p>
                            {app.job_type && (
                              <span className="text-muted-foreground text-xs">{app.job_type}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                            {app.store_name}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs">
                            {app.cv_url ? (
                              <a
                                href={app.cv_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1 font-medium"
                              >
                                <FileText className="size-3.5" /> Xem CV <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic">Không đính kèm</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`border text-xs font-semibold ${
                                appStatusBadgeTone[app.status] || "bg-muted text-muted-foreground"
                              }`}
                            >
                              {app.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                            {app.created_at ? new Date(app.created_at).toLocaleDateString("vi-VN") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => openAppDetail(app)}>
                              <Eye className="size-3.5 mr-1" /> Xem & Duyệt
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════ MODAL TẠO / SỬA TIN TUYỂN DỤNG ═══════════ */}
      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJob ? "Sửa tin tuyển dụng" : "Đăng tin tuyển dụng mới"}</DialogTitle>
          </DialogHeader>

          {!editingJob && (
            <div className="bg-muted/40 rounded-xl border p-3.5 space-y-1.5">
              <Label className="text-xs font-semibold text-primary">
                Chọn mẫu vị trí có sẵn (hoặc tự nhập tùy chỉnh bên dưới)
              </Label>
              <Select onValueChange={handlePickPreset}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="-- Chọn mẫu 4 công việc --" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_JOBS.map((preset, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      📋 Mẫu {idx + 1}: {preset.title}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">✍️ Tự nhập vị trí mới</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="job-title">Vị trí tuyển dụng *</Label>
              <Input
                id="job-title"
                placeholder="VD: Nhân viên Pha Chế (Barista)"
                value={jobForm.title}
                onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="job-type">Hình thức làm việc *</Label>
              <Select
                value={jobForm.type}
                onValueChange={(val) => setJobForm({ ...jobForm, type: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Toàn thời gian">Toàn thời gian (Full-time)</SelectItem>
                  <SelectItem value="Bán thời gian">Bán thời gian (Part-time)</SelectItem>
                  <SelectItem value="Bán thời gian / Xoay ca">Bán thời gian / Xoay ca</SelectItem>
                  <SelectItem value="Toàn thời gian / Ca linh hoạt">Toàn thời gian / Ca linh hoạt</SelectItem>
                  <SelectItem value="Ca linh hoạt">Ca linh hoạt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="job-salary">Mức lương *</Label>
              <Input
                id="job-salary"
                placeholder="VD: 7 – 9 triệu + thưởng doanh số"
                value={jobForm.salary}
                onChange={(e) => setJobForm({ ...jobForm, salary: e.target.value })}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="job-desc">Mô tả công việc *</Label>
              <Textarea
                id="job-desc"
                rows={3}
                placeholder="Nhiệm vụ chính hàng ngày của nhân viên..."
                value={jobForm.description}
                onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="job-req">Yêu cầu công việc *</Label>
              <Textarea
                id="job-req"
                rows={3}
                placeholder="Độ tuổi, kinh nghiệm, kỹ năng cần có..."
                value={jobForm.requirements}
                onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="job-benefits">Quyền lợi & Đãi ngộ</Label>
              <Textarea
                id="job-benefits"
                rows={2}
                placeholder="Thưởng doanh số, phụ cấp, giảm giá thức uống, cơ hội thăng tiến..."
                value={jobForm.benefits}
                onChange={(e) => setJobForm({ ...jobForm, benefits: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between sm:col-span-2 border rounded-xl p-3 bg-muted/20">
              <div>
                <p className="font-semibold text-sm">Mở tuyển dụng ngay</p>
                <p className="text-muted-foreground text-xs">
                  Khi bật, tin tuyển dụng sẽ hiển thị trực tiếp trên trang chủ và trang tuyển dụng khách hàng.
                </p>
              </div>
              <Switch
                checked={jobForm.is_active}
                onCheckedChange={(v) => setJobForm({ ...jobForm, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setJobDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={saveJob} disabled={savingJob}>
              {savingJob ? "Đang lưu…" : editingJob ? "Cập nhật" : "Đăng tin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ MODAL XÁC NHẬN XÓA TIN TUYỂN DỤNG ═══════════ */}
      <Dialog open={deleteJobDialogOpen} onOpenChange={setDeleteJobDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa tin tuyển dụng</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn có chắc chắn muốn xóa tin tuyển dụng{" "}
            <strong className="text-foreground">{selectedJobToDelete?.title}</strong>? Thao tác này sẽ xóa
            tin và các hồ sơ liên quan.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteJobDialogOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={confirmDeleteJob} disabled={deletingJob}>
              {deletingJob ? "Đang xóa..." : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ MODAL CHI TIẾT & DUYỆT ỨNG VIÊN ═══════════ */}
      <Dialog open={appModalOpen} onOpenChange={setAppModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết hồ sơ ứng viên</DialogTitle>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4 text-sm">
              <div className="bg-muted/30 rounded-xl p-3 space-y-2 border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-foreground">{selectedApp.fullname}</span>
                  <Badge
                    variant="outline"
                    className={`border font-semibold ${
                      appStatusBadgeTone[selectedApp.status] || ""
                    }`}
                  >
                    {selectedApp.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>
                    <strong>SĐT:</strong>{" "}
                    <a href={`tel:${selectedApp.phone}`} className="text-primary hover:underline">
                      {selectedApp.phone}
                    </a>
                  </p>
                  <p>
                    <strong>Email:</strong>{" "}
                    <a href={`mailto:${selectedApp.email}`} className="text-primary hover:underline">
                      {selectedApp.email}
                    </a>
                  </p>
                  <p>
                    <strong>Vị trí:</strong> {selectedApp.job_title}
                  </p>
                  <p>
                    <strong>Chi nhánh:</strong> {selectedApp.store_name}
                  </p>
                </div>
                {selectedApp.cv_url && (
                  <div className="pt-1">
                    <a
                      href={selectedApp.cv_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 font-medium text-xs"
                    >
                      <FileText className="size-3.5" /> Mở liên kết CV ứng viên <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="app-status">Cập nhật trạng thái duyệt hồ sơ</Label>
                <Select
                  value={appStatusInput}
                  onValueChange={(val) => setAppStatusInput(val as Application["status"])}
                >
                  <SelectTrigger id="app-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mới">🔵 Mới tiếp nhận</SelectItem>
                    <SelectItem value="Đang xem xét">🟡 Đang xem xét hồ sơ</SelectItem>
                    <SelectItem value="Phỏng vấn">🟣 Mời phỏng vấn</SelectItem>
                    <SelectItem value="Trúng tuyển">🟢 Trúng tuyển / Nhận việc</SelectItem>
                    <SelectItem value="Từ chối">🔴 Chưa phù hợp / Từ chối</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="app-note">Ghi chú tuyển dụng / Phỏng vấn</Label>
                <Textarea
                  id="app-note"
                  rows={3}
                  placeholder="Ghi chú đánh giá, thời gian hẹn phỏng vấn, mức lương thỏa thuận..."
                  value={appNoteInput}
                  onChange={(e) => setAppNoteInput(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAppModalOpen(false)}>
              Đóng
            </Button>
            <Button onClick={saveAppStatus} disabled={savingAppStatus}>
              {savingAppStatus ? "Đang lưu…" : "Lưu trạng thái"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
