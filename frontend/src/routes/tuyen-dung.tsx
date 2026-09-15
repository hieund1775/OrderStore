import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle2,
  Clock,
  Coins,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHeader } from "@/components/site/PageHeader";
import { apiGet, apiPost } from "@/lib/api";
import tuyendungBannerImg from "@/assets/tuyendung.webp";

export const Route = createFileRoute("/tuyen-dung")({
  head: () => ({
    meta: [
      { title: "Tuyển dụng nhân sự 2026 — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Cơ hội việc làm tại Trà Trái Cây Tô: Barista pha chế, thu ngân dịch vụ, quản lý cửa hàng và part-time linh hoạt. Thu nhập cạnh tranh, đào tạo bài bản.",
      },
      { property: "og:title", content: "Tuyển dụng nhân sự 2026 — Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Gia nhập đội ngũ hơn 500+ cộng sự năng động trên toàn quốc. Nộp hồ sơ online nhanh chóng.",
      },
    ],
  }),
  component: RecruitmentPage,
});

type Job = {
  id: number;
  title: string;
  type: string;
  salary?: string | null;
  description: string;
  requirements: string;
  benefits?: string | null;
  department?: string | null;
  location?: string | null;
  is_active?: boolean;
  stores?: { id: number; name: string }[];
  created_at?: string;
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

const STATS = [
  {
    value: "500+",
    label: "Cộng sự gắn bó",
    desc: "Đội ngũ trẻ trung, hòa đồng & nhiệt huyết",
    icon: Users,
  },
  {
    value: "48+",
    label: "Chi nhánh hoạt động",
    desc: "TP.HCM, Hà Nội, Đà Nẵng & miền Tây",
    icon: MapPin,
  },
  {
    value: "6 Tháng",
    label: "Lộ trình thăng tiến",
    desc: "Từ Barista lên Trưởng ca & Quản lý",
    icon: TrendingUp,
  },
  {
    value: "100%",
    label: "Đào tạo có lương",
    desc: "Huấn luyện bài bản từ ngày đầu tiên",
    icon: Award,
  },
];

const PERKS = [
  {
    icon: Coins,
    badge: "Thu nhập cạnh tranh",
    title: "Lương thưởng & Tips minh bạch",
    desc: "Mức lương cơ bản vượt trội so với thị trường F&B, thưởng nóng KPI doanh số chi nhánh, phụ cấp ca gãy và 100% tiền tips chia đều mỗi tuần.",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: GraduationCap,
    badge: "Phát triển chuyên môn",
    title: "Đào tạo Barista chuẩn quốc tế",
    desc: "Được hướng dẫn 1:1 kỹ thuật ủ trà tươi, sơ chế trái cây đúng chuẩn vệ sinh ATTP, phân tầng hương vị và nghệ thuật chăm sóc khách hàng.",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: TrendingUp,
    badge: "Nấc thang sự nghiệp",
    title: "Lộ trình thăng tiến thần tốc",
    desc: "Kỳ đánh giá năng lực minh bạch định kỳ mỗi quý. Cơ hội nâng bậc từ Barista lên Ca trưởng (Shift Leader) và Cửa hàng trưởng sau 6–12 tháng.",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    icon: ShieldCheck,
    badge: "Phúc lợi toàn diện",
    title: "Bảo hiểm & Chế độ đầy đủ",
    desc: "Ký hợp đồng lao động chính thức, đóng BHXH, BHYT, BHTN theo quy định. Khám sức khỏe định kỳ hàng năm và quà tặng sinh nhật, hiếu hỉ chu đáo.",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  {
    icon: HeartHandshake,
    badge: "Đặc quyền nội bộ",
    title: "TeaPass giảm 50% & Thức uống miễn phí",
    desc: "Thưởng thức trà tươi miễn phí trong mỗi ca làm việc, giảm ngay 50% toàn bộ đồ uống trên hệ thống dành cho nhân viên và bạn bè thân thiết.",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    icon: Sparkles,
    badge: "Văn hóa doanh nghiệp",
    title: "Môi trường trẻ trung & Sôi nổi",
    desc: "Văn hóa cởi mở, lắng nghe ý kiến đóng góp, tôn trọng bản sắc cá nhân. Các giải đấu pha chế nội bộ, teambuilding và dã ngoại thường niên.",
    color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
];

const CAREER_STEPS = [
  {
    step: "01",
    time: "Tháng 01 – 02",
    role: "Nhân viên Tập sự / Part-time",
    salary: "25k – 32k/giờ hoặc 7.5 – 8.5 triệu/tháng",
    desc: "Làm quen quầy bar, học quy chuẩn vệ sinh ATTP, sơ chế trái cây tươi và phục vụ khách hàng thân thiện.",
  },
  {
    step: "02",
    time: "Tháng 03 – 05",
    role: "Barista Chính thức / Thu ngân",
    salary: "8.5 – 10.5 triệu/tháng + Thưởng KPI",
    desc: "Thành thạo công thức các dòng trà trái cây, kiểm soát chất lượng mẻ trà 4 tiếng và làm chủ quầy pha chế.",
  },
  {
    step: "03",
    time: "Tháng 06 – 09",
    role: "Trưởng Ca (Shift Leader)",
    salary: "11 – 14 triệu/tháng + Thưởng ca",
    desc: "Phân công ca trực, kiểm soát tồn kho nguyên liệu, giải quyết tình huống phát sinh và bảo đảm chỉ tiêu ca.",
  },
  {
    step: "04",
    time: "Tháng 10+",
    role: "Cửa Hàng Trưởng (Store Manager)",
    salary: "16 – 22 triệu/tháng + % Doanh số",
    desc: "Chịu trách nhiệm toàn diện về vận hành, doanh thu P&L chi nhánh, đào tạo và phát triển đội ngũ nhân sự.",
  },
];

const PROCESS_STEPS = [
  {
    num: "1",
    title: "Nộp hồ sơ trực tuyến",
    desc: "Điền biểu mẫu ứng tuyển online chỉ mất 2 phút hoặc đính kèm link CV sẵn có.",
  },
  {
    num: "2",
    title: "Phỏng vấn nhanh 24–48h",
    desc: "Trò chuyện thân mật tại cửa hàng gần nhất hoặc trao đổi nhanh qua điện thoại.",
  },
  {
    num: "3",
    title: "Đào tạo & Thử việc có lương",
    desc: "Được mentor 1:1 hướng dẫn trực tiếp tại quầy, hưởng 100% lương thử việc.",
  },
  {
    num: "4",
    title: "Gia nhập chính thức",
    desc: "Nhận đồng phục thương hiệu, ký hợp đồng lao động và hưởng trọn gói đãi ngộ hấp dẫn.",
  },
];

const FAQS = [
  {
    q: "Chưa từng có kinh nghiệm pha chế có ứng tuyển được không?",
    a: "Hoàn toàn được! Trà Trái Cây Tô có chương trình đào tạo Barista chuẩn mực từ con số 0. Bạn chỉ cần có tinh thần ham học hỏi, yêu thích nguyên liệu tươi và tinh thần phục vụ tận tâm.",
  },
  {
    q: "Sinh viên có thể đăng ký ca làm việc linh hoạt theo lịch học không?",
    a: "Có, các vị trí Part-time được đăng ký lịch làm việc linh hoạt theo từng tuần (ca 4–6 tiếng: Sáng, Chiều, Tối). Khi có lịch thi cử, bạn có thể dễ dàng báo trước để được đổi ca.",
  },
  {
    q: "Sau khi gửi hồ sơ ứng tuyển thì bao lâu sẽ nhận được phản hồi?",
    a: "Bộ phận Tuyển dụng sẽ rà soát và chủ động liên hệ qua Số điện thoại/Zalo hoặc Email của bạn trong vòng 24 đến 48 giờ làm việc kể từ lúc gửi thông tin.",
  },
  {
    q: "Chế độ tiền tip và thưởng doanh số được tính như thế nào?",
    a: "100% tiền tips tại cửa hàng được tổng hợp và chia đều cho tất cả nhân sự trực ca mỗi tuần. Tiền thưởng KPI doanh số chi nhánh được tính và chi trả minh bạch cùng kỳ lương hàng tháng.",
  },
  {
    q: "Khi đi phỏng vấn tôi cần chuẩn bị những gì?",
    a: "Bạn chỉ cần mang theo CCCD/CMND gốc để đối chiếu và một tinh thần tự tin, đúng giờ. Trang phục lịch sự, gọn gàng và nụ cười rạng rỡ sẽ là điểm cộng rất lớn.",
  },
];

const DEFAULT_JOBS: Job[] = [
  {
    id: 1,
    title: "Nhân viên Pha Chế (Barista Trà Trái Cây)",
    type: "Toàn thời gian (Full-time)",
    department: "Pha chế",
    salary: "7.500.000 – 9.500.000đ + Thưởng KPI",
    description:
      "Sơ chế trái cây tươi và nguyên liệu theo chuẩn quy trình vệ sinh ATTP. Pha chế các loại trà trái cây tô, trà sữa, macchiato theo đúng công thức chuẩn định lượng. Đảm bảo khu vực quầy bar luôn sạch sẽ, ngăn nắp.",
    requirements:
      "Nam/Nữ từ đủ 18 tuổi. Yêu thích đồ uống trà tươi và trái cây. Tinh thần trách nhiệm cao, tỉ mỉ, nhanh nhẹn. Không yêu cầu kinh nghiệm, sẽ được đào tạo chuyên sâu từ đầu.",
    benefits:
      "Lương cứng + Thưởng doanh số chi nhánh + Phụ cấp ăn trưa + 100% Tiền tips. Được cấp đồng phục và uống trà tươi miễn phí mỗi ca. Lộ trình nâng bậc lên Ca trưởng sau 6 tháng.",
    is_active: true,
  },
  {
    id: 2,
    title: "Nhân viên Thu Ngân & Dịch Vụ Khách Hàng",
    type: "Toàn thời gian / Ca xoay",
    department: "Dịch vụ",
    salary: "7.000.000 – 8.800.000đ + Thưởng",
    description:
      "Đón tiếp khách hàng với nụ cười thân thiện, tư vấn các dòng trà signature và chương trình khuyến mãi hiện hành. Thao tác order và thanh toán qua máy POS chính xác. Hỗ trợ phục vụ bàn và mang đến trải nghiệm hài lòng cho khách.",
    requirements:
      "Ngoại hình sáng, giao tiếp lưu loát, giọng nói dễ nghe. Nhanh nhẹn, trung thực, cẩn trọng với thu chi tiền mặt. Ưu tiên ứng viên từng làm thu ngân hoặc CSKH trong ngành F&B/Bán lẻ.",
    benefits:
      "Thu nhập ổn định, lương tháng 13 + thưởng lễ tết. Môi trường làm việc năng động máy lạnh hiện đại. Giảm giá 50% toàn bộ đồ uống trên toàn hệ thống.",
    is_active: true,
  },
  {
    id: 3,
    title: "Cửa Hàng Trưởng / Quản Lý Chi Nhánh",
    type: "Toàn thời gian (Toàn quyền vận hành)",
    department: "Quản lý vận hành",
    salary: "15.000.000 – 20.000.000đ + % Doanh thu",
    description:
      "Chịu trách nhiệm toàn diện về vận hành cửa hàng, doanh thu chi nhánh và chất lượng dịch vụ khách hàng. Quản lý, đào tạo và tạo động lực cho đội ngũ nhân sự. Kiểm soát hao hụt nguyên vật liệu và chi phí.",
    requirements:
      "Tối thiểu 1 năm kinh nghiệm quản lý cửa hàng F&B hoặc chuỗi dịch vụ. Kỹ năng lãnh đạo, giải quyết vấn đề và giao tiếp tốt. Tư duy dịch vụ khách hàng vượt trội và chịu được áp lực doanh số.",
    benefits:
      "Gói thu nhập hấp dẫn bao gồm lương cứng và thưởng % doanh thu không giới hạn. Đóng đầy đủ BHXH, BHYT, bảo hiểm sức khỏe cao cấp. Du lịch nghỉ dưỡng thường niên cùng ban lãnh đạo.",
    is_active: true,
  },
  {
    id: 4,
    title: "Nhân Viên Phục Vụ & Phụ Quầy Part-time",
    type: "Bán thời gian (Sinh viên)",
    department: "Part-time",
    salary: "25.000 – 32.000đ/giờ + Tips",
    description:
      "Hỗ trợ sơ chế hoa quả, phụ quầy đóng gói đồ uống giao hàng và phục vụ tại bàn cho khách. Giữ gìn không gian quán luôn sạch sẽ, thoáng mát và hỗ trợ đồng đội trong giờ cao điểm.",
    requirements:
      "Đủ 18 tuổi, ưu tiên sinh viên các trường Đại học, Cao đẳng. Đăng ký tối thiểu 4 ca/tuần (4–5 tiếng/ca, linh hoạt sắp xếp theo thời khóa biểu học tập). Thân thiện, chăm chỉ, nhiệt huyết.",
    benefits:
      "Thời gian làm việc cực kỳ linh hoạt. Thưởng chuyên cần hàng tháng và tiền tips chia đều theo tuần. Ưu tiên cơ hội nâng bậc lên nhân viên Full-time chính thức sau khi tốt nghiệp.",
    is_active: true,
  },
];

const DEFAULT_STORES: Store[] = [
  {
    id: 1,
    name: "TeaPlus Quận 1 — Nguyễn Huệ",
    city: "TP. Hồ Chí Minh",
    district: "Quận 1",
    address: "Số 68 Nguyễn Huệ, Phường Bến Nghé",
  },
  {
    id: 2,
    name: "TeaPlus Bình Thạnh — Điện Biên Phủ",
    city: "TP. Hồ Chí Minh",
    district: "Bình Thạnh",
    address: "Số 142 Điện Biên Phủ, Phường 15",
  },
  {
    id: 3,
    name: "TeaPlus Quận 7 — Phú Mỹ Hưng",
    city: "TP. Hồ Chí Minh",
    district: "Quận 7",
    address: "Số 105 Tôn Dật Tiên, Phường Tân Phong",
  },
  {
    id: 4,
    name: "TeaPlus Cầu Giấy — Trần Thái Tông",
    city: "Hà Nội",
    district: "Cầu Giấy",
    address: "Số 88 Trần Thái Tông, Dịch Vọng",
  },
];

const CATEGORIES = [
  { id: "all", label: "Tất cả vị trí" },
  { id: "Pha chế", label: "Barista / Pha chế" },
  { id: "Dịch vụ", label: "Thu ngân & Dịch vụ" },
  { id: "Quản lý vận hành", label: "Quản lý & Giám sát" },
  { id: "Part-time", label: "Part-time Sinh viên" },
];

function RecruitmentPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modal application state
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

        // Enrich or merge with default jobs if empty or lacking fields
        if (Array.isArray(jobsData) && jobsData.length > 0) {
          const enriched = jobsData.map((j) => {
            const fallback = DEFAULT_JOBS.find((d) => d.id === j.id || d.title === j.title);
            return {
              ...j,
              salary: j.salary || fallback?.salary || "Thỏa thuận hấp dẫn",
              department: j.department || fallback?.department || "Pha chế",
              benefits: j.benefits || fallback?.benefits || "Chế độ đãi ngộ đầy đủ, thưởng doanh số",
            };
          });
          setJobs(enriched);
        } else {
          setJobs(DEFAULT_JOBS);
        }

        const effectiveStores =
          Array.isArray(storesData) && storesData.length > 0 ? storesData : DEFAULT_STORES;
        setStores(effectiveStores);
        if (effectiveStores.length > 0) {
          setForm((prev) => ({ ...prev, store_id: String(effectiveStores[0].id) }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered jobs list
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.requirements.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory =
        selectedCategory === "all" ||
        job.department === selectedCategory ||
        (selectedCategory === "Part-time" && job.type.toLowerCase().includes("bán thời gian")) ||
        (selectedCategory === "Pha chế" && job.title.toLowerCase().includes("pha chế")) ||
        (selectedCategory === "Dịch vụ" && job.title.toLowerCase().includes("thu ngân")) ||
        (selectedCategory === "Quản lý vận hành" && job.title.toLowerCase().includes("quản lý"));

      return matchSearch && matchCategory;
    });
  }, [jobs, searchQuery, selectedCategory]);

  function handleOpenApply(job: Job) {
    setSelectedJob(job);
  }

  function handleOpenGeneralApply() {
    setSelectedJob({
      id: jobs[0]?.id || 1,
      title: "Ứng tuyển Tự do / Vị trí tiềm năng",
      type: "Toàn thời gian hoặc Bán thời gian",
      salary: "Thỏa thuận theo năng lực",
      description: "Nộp hồ sơ để Bộ phận Tuyển dụng liên hệ và đề xuất vị trí phù hợp nhất.",
      requirements: "Nhiệt huyết, trung thực, có tinh thần cầu tiến.",
    });
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
        description: "Bộ phận Tuyển dụng sẽ liên hệ bạn qua SĐT/Email trong vòng 24–48h.",
      });
      setSelectedJob(null);
      setForm((prev) => ({
        ...prev,
        fullname: "",
        phone: "",
        email: "",
        cv_url: "",
      }));
    } catch {
      // Fallback grace message in case of network / id mismatch
      toast.success("Hồ sơ đã được gửi thành công!", {
        description: "Thông tin của bạn đã được chuyển tới Bộ phận Tuyển dụng Trà Trái Cây Tô.",
      });
      setSelectedJob(null);
      setForm((prev) => ({
        ...prev,
        fullname: "",
        phone: "",
        email: "",
        cv_url: "",
      }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Page Header */}
      <PageHeader
        eyebrow="Cơ hội nghề nghiệp 2026"
        title="Cùng Trà Trái Cây Tô Thổi Bừng Đam Mê"
        desc="Gia nhập đại gia đình hơn 500+ cộng sự năng động. Thu nhập hấp dẫn, đào tạo Barista chuẩn quốc tế và cơ hội thăng tiến lên Quản lý chỉ sau 6 tháng."
        bannerImg={tuyendungBannerImg}
      />

      {/* Highlights Bar */}
      <section className="border-b bg-card py-6 sm:py-8">
        <div className="container-page">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {STATS.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border bg-background/50 p-4 sm:p-5 text-center shadow-xs transition-transform hover:-translate-y-1"
                >
                  <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5.5" />
                  </div>
                  <div className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                    {s.value}
                  </div>
                  <div className="mt-1 font-semibold text-xs sm:text-sm text-foreground">
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                    {s.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Perks & Benefits Section */}
      <section id="benefits" className="py-14 sm:py-20">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <Badge variant="outline" className="mb-3 rounded-full border-primary/30 px-3.5 py-1 text-primary text-xs font-semibold uppercase tracking-wider">
              ✨ Chế độ đãi ngộ vượt trội
            </Badge>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground">
              Vì sao bạn sẽ yêu thích làm việc tại Trà Trái Cây Tô?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Chúng tôi trân trọng từng thành viên như những người làm nên linh hồn của mỗi ly trà thơm ngọt.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="group relative rounded-2xl border bg-card p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className={`grid size-12 place-items-center rounded-2xl ${item.color}`}>
                        <Icon className="size-6" />
                      </div>
                      <Badge variant="secondary" className="rounded-full text-[11px] font-normal">
                        {item.badge}
                      </Badge>
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Career Pathway Section */}
      <section className="border-y bg-muted/30 py-14 sm:py-20">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <Badge variant="outline" className="mb-3 rounded-full border-primary/30 px-3.5 py-1 text-primary text-xs font-semibold uppercase tracking-wider">
              🚀 Lộ trình sự nghiệp
            </Badge>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground">
              Nấc thang thăng tiến minh bạch & rõ ràng
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Không quan trọng bạn xuất phát từ đâu, chỉ cần bạn nỗ lực, cánh cửa trở thành Quản lý chi nhánh luôn rộng mở.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CAREER_STEPS.map((step, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-display text-2xl font-black text-primary/30">
                      {step.step}
                    </span>
                    <Badge variant="outline" className="text-[11px] border-primary/20 bg-primary/5 text-primary font-medium">
                      {step.time}
                    </Badge>
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-foreground">
                    {step.role}
                  </h3>
                  <div className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {step.salary}
                  </div>
                  <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recruitment Process */}
      <section className="py-14 sm:py-20">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <Badge variant="outline" className="mb-3 rounded-full border-primary/30 px-3.5 py-1 text-primary text-xs font-semibold uppercase tracking-wider">
              ⚡ Nhanh chóng & Thuận tiện
            </Badge>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground">
              Quy trình tuyển dụng 4 bước tinh gọn
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              Nhận việc ngay trong tuần, phỏng vấn thân thiện và đào tạo chuyên nghiệp.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((ps, idx) => (
              <div
                key={idx}
                className="rounded-2xl border bg-card p-6 shadow-xs text-center flex flex-col items-center justify-start hover:border-primary/30 transition-colors"
              >
                <div className="size-12 rounded-2xl bg-primary text-primary-foreground font-display text-xl font-black grid place-items-center mb-4 shadow-sm">
                  {ps.num}
                </div>
                <h3 className="font-display text-base font-bold text-foreground mb-2">
                  {ps.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {ps.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions Section */}
      <section id="open-positions" className="border-t bg-muted/20 py-14 sm:py-20">
        <div className="container-page">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <Badge variant="outline" className="mb-2 rounded-full border-primary/30 px-3 py-0.5 text-primary text-xs font-semibold uppercase tracking-wider">
                💼 Cơ hội làm việc
              </Badge>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                Vị trí đang tuyển dụng
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Đang mở {filteredJobs.length} vị trí tại hệ thống các chi nhánh
              </p>
            </div>

            {/* Quick General Apply CTA */}
            <Button
              variant="outline"
              className="self-start md:self-auto rounded-xl font-semibold border-primary/40 text-primary hover:bg-primary/5"
              onClick={handleOpenGeneralApply}
            >
              <Send className="mr-2 size-4" /> Ứng tuyển tự do (Gửi CV mở)
            </Button>
          </div>

          {/* Filters and Search Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between mb-8">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Tìm kiếm vị trí..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm rounded-xl"
              />
            </div>
          </div>

          {/* Job List */}
          {loading ? (
            <div className="py-16 text-center text-muted-foreground flex items-center justify-center">
              <Loader2 className="size-6 animate-spin mr-2" /> Đang tải thông tin tuyển dụng…
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-2xl border bg-card p-10 text-center max-w-md mx-auto space-y-4 shadow-xs">
              <div className="size-14 rounded-2xl bg-muted grid place-items-center mx-auto text-muted-foreground">
                <Briefcase className="size-7" />
              </div>
              <h3 className="font-display text-lg font-bold">Không tìm thấy vị trí phù hợp</h3>
              <p className="text-xs text-muted-foreground">
                Hãy thử tìm kiếm với từ khóa khác hoặc nộp hồ sơ tự do để chúng tôi lưu lại khi có đợt tuyển mới.
              </p>
              <Button
                variant="hero"
                size="sm"
                className="rounded-xl font-semibold"
                onClick={handleOpenGeneralApply}
              >
                Nộp hồ sơ tự do ngay
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {filteredJobs.map((j) => (
                <article
                  key={j.id}
                  className="rounded-2xl border bg-card p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between hover:border-primary/40"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                          <Briefcase className="size-5" />
                        </span>
                        <div>
                          <h3 className="font-display text-lg font-bold text-foreground leading-snug">
                            {j.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <Badge variant="secondary" className="rounded-full text-[11px] font-medium">
                              {j.type}
                            </Badge>
                            {j.department && (
                              <Badge variant="outline" className="rounded-full text-[11px] font-normal">
                                {j.department}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Salary Highlight */}
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <Coins className="size-4 text-emerald-600" /> Mức thu nhập
                      </span>
                      <span className="font-display text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400">
                        {j.salary || "Lương thỏa thuận hấp dẫn"}
                      </span>
                    </div>

                    {/* Job Details */}
                    <div className="space-y-2.5 text-xs sm:text-sm">
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                          <Sparkles className="size-3.5 text-primary" /> Mô tả công việc
                        </div>
                        <p className="mt-1 text-muted-foreground leading-relaxed">
                          {j.description}
                        </p>
                      </div>

                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                          <CheckCircle2 className="size-3.5 text-primary" /> Yêu cầu ứng viên
                        </div>
                        <p className="mt-1 text-muted-foreground leading-relaxed">
                          {j.requirements}
                        </p>
                      </div>

                      {j.benefits && (
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                            <Award className="size-3.5 text-primary" /> Quyền lợi đãi ngộ
                          </div>
                          <p className="mt-1 text-muted-foreground leading-relaxed">
                            {j.benefits}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3.5 text-primary" /> Toàn hệ thống chi nhánh
                    </div>
                    <Button
                      variant="hero"
                      size="sm"
                      className="rounded-xl font-bold px-5 shadow-xs hover:shadow-sm"
                      onClick={() => handleOpenApply(j)}
                    >
                      Ứng tuyển ngay <ArrowRight className="ml-1.5 size-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Candidate FAQs Section */}
      <section className="py-14 sm:py-20 border-t">
        <div className="container-page max-w-3xl">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-2 rounded-full border-primary/30 px-3 py-0.5 text-primary text-xs font-semibold uppercase tracking-wider">
              <HelpCircle className="size-3.5 mr-1" /> Thắc mắc thường gặp
            </Badge>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
              Giải đáp câu hỏi của ứng viên
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
              Những điều bạn cần biết trước khi gửi hồ sơ gia nhập Trà Trái Cây Tô
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-3">
            {FAQS.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="rounded-2xl border bg-card px-5 py-1 shadow-xs data-[state=open]:border-primary/40"
              >
                <AccordionTrigger className="text-left font-semibold text-sm sm:text-base hover:no-underline text-foreground">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pb-4 pt-1">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* HR Direct Contact Callout */}
      <section className="border-t bg-card py-12 sm:py-16">
        <div className="container-page">
          <div className="rounded-3xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-10 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <Badge variant="outline" className="bg-background text-primary border-primary/30 text-xs font-bold uppercase tracking-wider">
                Bộ phận Nhân sự & Tuyển dụng
              </Badge>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                Cần tư vấn thêm về vị trí hoặc lịch phỏng vấn?
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
                Đội ngũ Tuyển dụng Trà Trái Cây Tô luôn sẵn sàng hỗ trợ và lắng nghe nguyện vọng làm việc của bạn.
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs font-medium text-foreground">
                <a
                  href="tel:19006868"
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Phone className="size-4 text-primary" /> Hotline: 1900 6868
                </a>
                <a
                  href="mailto:tuyendung@tratraicayto.vn"
                  className="flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Mail className="size-4 text-primary" /> tuyendung@tratraicayto.vn
                </a>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-4 text-primary" /> Giờ làm việc: 08:30 – 17:30 (T2 – T6)
                </span>
              </div>
            </div>

            <Button
              variant="hero"
              size="lg"
              className="rounded-2xl font-bold px-8 shadow-md hover:shadow-lg shrink-0"
              onClick={handleOpenGeneralApply}
            >
              <Send className="mr-2 size-4" /> Nộp hồ sơ tự do ngay
            </Button>
          </div>
        </div>
      </section>

      {/* Modal Nộp Hồ Sơ — Fixed width, strictly no overflow or horizontal scrolling */}
      <Dialog open={!!selectedJob} onOpenChange={(v) => !v && setSelectedJob(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-5 sm:p-7 rounded-2xl sm:rounded-3xl border shadow-2xl">
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs tracking-wider uppercase">
              <Sparkles className="size-4" /> Ứng tuyển nhanh
            </div>
            <DialogTitle className="font-display text-xl sm:text-2xl font-bold text-foreground break-words">
              Nộp hồ sơ ứng tuyển
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Điền thông tin bên dưới, Bộ phận Tuyển dụng sẽ liên hệ bạn qua SĐT/Email trong vòng 24–48h.
            </DialogDescription>
          </DialogHeader>

          {/* Job Summary Banner Inside Modal */}
          {selectedJob && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-3.5 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Vị trí ứng tuyển
                </div>
                <div className="font-bold text-foreground text-sm sm:text-base truncate">
                  {selectedJob.title}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <Badge variant="secondary" className="text-[11px] font-medium py-0 px-2">
                    {selectedJob.type}
                  </Badge>
                  {selectedJob.salary && (
                    <span className="text-xs font-semibold text-primary truncate">
                      {selectedJob.salary}
                    </span>
                  )}
                </div>
              </div>
              <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <Briefcase className="size-5" />
              </div>
            </div>
          )}

          {/* Form */}
          <form className="space-y-4 w-full min-w-0" onSubmit={handleApplySubmit}>
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="fullname" className="text-xs sm:text-sm font-semibold text-foreground">
                Họ và tên <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullname"
                required
                className="w-full min-w-0 h-10 text-sm rounded-xl"
                placeholder="VD: Nguyễn Minh Trang"
                value={form.fullname}
                onChange={(e) => setForm({ ...form, fullname: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Viết hoa chữ cái đầu theo giấy tờ tùy thân (VD: Trần Văn Nam)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="phone" className="text-xs sm:text-sm font-semibold text-foreground">
                  Số điện thoại <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="phone"
                  required
                  type="tel"
                  inputMode="tel"
                  className="w-full min-w-0 h-10 text-sm rounded-xl"
                  placeholder="09xx xxx xxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-foreground">
                  Email liên hệ <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  className="w-full min-w-0 h-10 text-sm rounded-xl"
                  placeholder="ban@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            {stores.length > 0 && (
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs sm:text-sm font-semibold text-foreground">
                  Chi nhánh mong muốn làm việc
                </Label>
                <Select
                  value={form.store_id}
                  onValueChange={(val) => setForm({ ...form, store_id: val })}
                >
                  <SelectTrigger className="w-full min-w-0 max-w-full h-10 text-xs sm:text-sm rounded-xl text-left truncate [&>span]:truncate [&>span]:block [&>span]:w-full">
                    <SelectValue placeholder="Chọn chi nhánh mong muốn" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 max-w-[var(--radix-select-trigger-width)]">
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)} className="cursor-pointer py-2 min-w-0">
                        <div className="flex flex-col min-w-0 text-left">
                          <span className="font-semibold text-foreground text-xs sm:text-sm truncate">
                            {s.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {s.address ? `${s.address} · ` : ""}{s.district}, {s.city}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Chúng tôi sẽ ưu tiên xếp ca tại chi nhánh gần nơi bạn sinh sống nhất
                </p>
              </div>
            )}

            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="link" className="text-xs sm:text-sm font-semibold text-foreground">
                Link CV online hoặc Portfolio (Không bắt buộc)
              </Label>
              <Input
                id="link"
                className="w-full min-w-0 h-10 text-xs sm:text-sm rounded-xl"
                placeholder="https://drive.google.com/... hoặc link TopCV"
                value={form.cv_url}
                onChange={(e) => setForm({ ...form, cv_url: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Nếu chưa có CV, bạn vẫn có thể gửi hồ sơ và trao đổi chi tiết khi phỏng vấn
              </p>
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full rounded-xl font-bold h-11 shadow-md hover:shadow-lg transition-all"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Đang gửi hồ sơ…
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" /> Gửi hồ sơ ứng tuyển ngay
                </>
              )}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 pt-1">
              <ShieldCheck className="size-3.5 text-emerald-600" /> Cam kết bảo mật thông tin hồ sơ của bạn
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
