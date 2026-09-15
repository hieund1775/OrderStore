import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Coffee,
  Compass,
  Droplets,
  Flame,
  HeartHandshake,
  Leaf,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/site/PageHeader";
import bannerIntroImg from "@/assets/banner-anh-gioithieu.jpg";
import storyImg from "@/assets/story.jpg";
import cuahangImg from "@/assets/cuahang.jpg";

export const Route = createFileRoute("/gioi-thieu")({
  head: () => ({
    meta: [
      { title: "Câu chuyện Trà & Trái cây tươi — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Hành trình của Trà Trái Cây Tô: trà ủ mới mỗi 4 tiếng, 100% trái cây tươi bản địa sơ chế tại quầy và cam kết không siro cô đặc.",
      },
      { property: "og:title", content: "Câu chuyện Trà & Trái cây tươi — Trà Trái Cây Tô" },
      {
        property: "og:description",
        content: "Trà đậm vị pha trong ngày, 100% trái cây tươi từ nông trại Việt.",
      },
    ],
  }),
  component: About,
});

const stats = [
  {
    value: "48+",
    label: "Chi nhánh trên toàn quốc",
    desc: "Có mặt tại TP.HCM, Hà Nội & Đà Nẵng",
    icon: MapPin,
  },
  {
    value: "100%",
    label: "Trái cây tươi sơ chế",
    desc: "Cắt gọt mới tại quầy mỗi sớm mai",
    icon: Leaf,
  },
  {
    value: "4 Tiếng",
    label: "Chu kỳ ủ trà tối đa",
    desc: "Mẻ trà mới liên tục, giữ trọn hương vị",
    icon: Clock,
  },
  {
    value: "4.9 ★",
    label: "Mức độ hài lòng",
    desc: "Hơn 250.000+ ly phục vụ mỗi tháng",
    icon: Star,
  },
];

const farms = [
  {
    region: "Bảo Lộc & Thái Nguyên",
    badge: "Vùng đất trà danh tiếng",
    title: "Cốt Lục Trà Lài & Trà Ô Long Mộc",
    desc: "Thu hái một tôm hai lá lúc sương sớm, sao sấy bán thủ công và ướp hoa lài tươi 3 lần tạo hậu vị thanh thoát, ngọt sâu nơi cuống họng.",
    emoji: "🍵",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    region: "Đà Lạt — Lâm Đồng",
    badge: "Canh tác tiêu chuẩn VietGAP",
    title: "Dâu Tây Hữu Cơ Dầm Tươi",
    desc: "Những trái dâu giống New Zealand chín mọng tự nhiên trên giàn treo cao, cuống xanh tươi rói, chuyển thẳng về quầy pha chế trước giờ mở cửa.",
    emoji: "🍓",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    region: "Cao Lãnh & Gia Lai",
    badge: "Vùng cây ăn trái nhiệt đới",
    title: "Xoài Cát Chu & Chanh Dây Vàng",
    desc: "Thịt xoài Cát Chu vàng óng, dẻo thơm ngào ngạt kết hợp cùng vị chua thanh đặc sắc của chanh dây tạo nên dòng trà nhiệt đới rực rỡ sắc màu.",
    emoji: "🥭",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    region: "Hòa Bình & Tiền Giang",
    badge: "Nông sản hữu cơ thanh lọc",
    title: "Cam Vàng & Tinh Dầu Sả Chanh",
    desc: "Tép cam mọng nước giàu vitamin C hòa quyện cùng sả chanh tươi đập dập, mang lại cảm giác sảng khoái và thanh lọc cơ thể nhẹ nhàng.",
    emoji: "🍊",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
];

const steps = [
  {
    step: "01",
    title: "Tuyển chọn & Sơ chế tại quầy",
    time: "05:00 – 06:30 mỗi sáng",
    desc: "Trái cây giao đến tiệm được khử khuẩn bằng nước ion kiềm, phân loại kỹ lưỡng và cắt gọt thủ công ngay trước mắt thực khách.",
    icon: Sprout,
  },
  {
    step: "02",
    title: "Chiết xuất cốt trà mẻ nhỏ",
    time: "Ủ mới mỗi 4 tiếng",
    desc: "Cân định lượng lá trà chuẩn xác đến từng gram, hãm ở nhiệt độ vàng 85°C – 92°C để giữ trọn vẹn chất chống oxy hóa Polyphenol quý giá.",
    icon: Droplets,
  },
  {
    step: "03",
    title: "Lắc lạnh Shaker cùng hoa quả",
    time: "Pha mới từng ly theo khẩu vị",
    desc: "Kỹ thuật lắc tay chuyên nghiệp giúp cốt trà quyện đều cùng mật ong và tép trái cây mà không làm nát múi, giữ nguyên kết cấu giòn mọng.",
    icon: UtensilsCrossed,
  },
  {
    step: "04",
    title: "Đóng gói giữ lạnh & Giao nhanh",
    time: "Cam kết trong 25 phút",
    desc: "Đóng seal màng nắp kép chống tràn, bảo quản đá riêng theo yêu cầu, giao đến tay bạn trọn vẹn hương vị tươi mát như tại quán.",
    icon: PackageCheck,
  },
];

const coreValues = [
  {
    icon: Sprout,
    title: "Tôn vinh nông sản quê hương",
    desc: "Hợp tác trực tiếp và bao tiêu sản phẩm giá tốt cùng bà con nông dân tại các nông trại sạch trên khắp mọi miền đất nước.",
  },
  {
    icon: ShieldCheck,
    title: "An toàn vệ sinh tuyệt đối",
    desc: "Đạt chứng nhận ATVSTP toàn diện. Quy trình pha chế mở công khai giúp bạn hoàn toàn an tâm khi thưởng thức mỗi ly trà.",
  },
  {
    icon: HeartHandshake,
    title: "Cá nhân hóa khẩu vị",
    desc: "Tự do chọn 5 mức đường, 5 mức đá, cốt lục trà hoặc ô long cùng đa dạng topping tươi ngon theo đúng sở thích riêng của bạn.",
  },
  {
    icon: Compass,
    title: "Trách nhiệm vì cộng đồng xanh",
    desc: "Tiên phong chuyển đổi sang ly giấy tự hủy, ống hút bã mía phân hủy sinh học và giảm thiểu tối đa rác thải nhựa một lần.",
  },
];

const timeline = [
  {
    year: "2018",
    title: "Khởi nguồn từ một xe trà nhỏ",
    desc: "Chiếc xe trà gỗ nhỏ trên vỉa hè đường Nguyễn Huệ với 6 công thức trà trái cây mộc mạc làm nức lòng giới trẻ Sài Gòn.",
    badge: "Khởi nghiệp",
  },
  {
    year: "2020",
    title: "Chuẩn hóa quy trình ủ trà 4 tiếng",
    desc: "Đột phá với cam kết hủy bỏ trà cũ sau 4 tiếng và mở rộng 10 chi nhánh khang trang đầu tiên tại các quận trung tâm TP.HCM.",
    badge: "Chuẩn hóa",
  },
  {
    year: "2023",
    title: "Phủ sóng Thủ đô & Miền Trung",
    desc: "Có mặt tại Hà Nội và Đà Nẵng, cán mốc 48 chi nhánh cùng hệ thống giao hàng riêng biệt đảm bảo đồ uống luôn tươi mát.",
    badge: "Vươn mình",
  },
  {
    year: "2026",
    title: "Dẫn đầu xu hướng Hi-Tea Detox",
    desc: "Ra mắt dòng trà thảo mộc kết hợp trái cây không đường, ứng dụng đặt trước thông minh và hệ thống tích điểm thành viên đa nền tảng.",
    badge: "Đổi mới",
  },
];

function About() {
  return (
    <>
      {/* Hero Page Header with Rich Background */}
      <PageHeader
        eyebrow="Câu chuyện thương hiệu"
        title="Vị trà nguyên bản từ nông trại Việt"
        desc="Chúng tôi tin một ly trà ngon bắt đầu từ nguyên liệu thật: lá trà ủ mới mỗi 4 tiếng và 100% trái cây cắt tay tại quầy mỗi ngày."
        bannerImg={bannerIntroImg}
      />

      {/* Floating Stats Bar */}
      <section className="container-page -mt-8 relative z-10">
        <div className="bg-card grid gap-4 rounded-3xl border p-6 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-4">
              <span className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl">
                <s.icon className="size-6" />
              </span>
              <div>
                <p className="font-display text-primary text-2xl font-black md:text-3xl leading-none">
                  {s.value}
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">{s.label}</p>
                <p className="text-muted-foreground text-xs">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Brand Origin Story */}
      <section className="container-page grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <div className="relative">
          <div className="overflow-hidden rounded-3xl shadow-lg border">
            <img
              src={storyImg}
              alt="Sơ chế trái cây tươi và trà lá rời tại quầy pha chế Trà Trái Cây Tô"
              loading="lazy"
              width={1024}
              height={768}
              className="w-full object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>
          {/* Floating Quote Card */}
          <div className="bg-card/95 backdrop-blur-md absolute -bottom-6 -right-2 md:-right-6 max-w-xs rounded-2xl border p-4 shadow-xl hidden sm:block">
            <p className="text-primary text-xs font-bold uppercase tracking-wider">
              Cam kết từ tâm
            </p>
            <p className="mt-1 text-xs italic text-foreground leading-relaxed">
              &ldquo;Một ly trà ngon không thể vội vã — nó bắt đầu từ giọt mồ hôi của người nông dân và sự tỉ mỉ của người pha chế.&rdquo;
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Flame className="size-3.5" />
            </span>
            <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
              Hành trình khởi nguồn
            </p>
          </div>

          <h2 className="font-display text-2xl font-extrabold leading-tight md:text-4xl text-foreground">
            Mỗi ly trà bắt đầu từ 5 giờ sáng
          </h2>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Năm 2018, chúng tôi bắt đầu từ một góc phố nhỏ tại Sài Gòn. Nhìn thấy thị trường ngập tràn
            những ly trà pha sẵn bằng siro công nghiệp, bột béo và hương liệu tổng hợp, chúng tôi
            tự hỏi: <span className="font-semibold text-foreground">&ldquo;Tại sao một đất nước có vùng nguyên liệu trà danh tiếng và hoa quả nhiệt đới trù phú như Việt Nam lại không có một thương hiệu trà tươi đúng nghĩa?&rdquo;</span>
          </p>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Từ trăn trở ấy, <strong className="text-foreground font-bold">Trà Trái Cây Tô</strong> ra đời. Chúng tôi
            kiên định nói KHÔNG với siro cô đặc, KHÔNG chất bảo quản và KHÔNG để trà qua đêm. Mọi
            mẻ trà đều được ủ mới mỗi 4 tiếng từ lá trà tươi Thái Nguyên, Bảo Lộc và cắt gọt hoa quả
            ngay tại quầy.
          </p>

          <div className="space-y-3 pt-2">
            {[
              "100% Trái cây tươi cắt thủ công tại quầy mỗi ngày, không siro hóa chất",
              "Trà ủ mẻ nhỏ ở nhiệt độ chuẩn 85°C – 92°C, hết 4 tiếng là hủy bỏ",
              "Vị ngọt thanh từ mật ong hoa rừng nguyên chất và đường mía hữu cơ",
            ].map((text, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle2 className="text-primary size-5 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fresh Farms & Ingredients Source */}
      <section className="bg-secondary/40 border-y py-16 md:py-24">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sprout className="size-3.5" />
              </span>
              <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
                Bản đồ nguyên liệu sạch
              </p>
            </div>
            <h2 className="font-display mt-2 text-2xl font-extrabold md:text-4xl">
              Nông trại xanh & Nguồn nguyên liệu thật
            </h2>
            <p className="text-muted-foreground mt-3 text-sm md:text-base">
              Hợp tác trực tiếp cùng bà con nông dân để mang những thức quả chín mọng từ miệt vườn đến tận tay bạn.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {farms.map((f) => (
              <div
                key={f.title}
                className="bg-card group relative flex flex-col justify-between overflow-hidden rounded-3xl border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{f.emoji}</span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground">
                      {f.badge}
                    </span>
                  </div>
                  <p className="text-primary mt-4 text-xs font-bold uppercase tracking-wider">
                    {f.region}
                  </p>
                  <h3 className="font-display mt-1 text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                    {f.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-dashed flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CheckCircle2 className="size-4" />
                  Đạt chuẩn VietGAP
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Craft Process (4 Steps) */}
      <section className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Coffee className="size-3.5" />
            </span>
            <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
              Nghệ thuật pha chế
            </p>
          </div>
          <h2 className="font-display mt-2 text-2xl font-extrabold md:text-4xl">
            Quy trình 4 bước tạo nên ly trà hoàn hảo
          </h2>
          <p className="text-muted-foreground mt-3 text-sm md:text-base">
            Sự kết hợp giữa công thức độc quyền và thao tác thủ công chuẩn xác trong từng mililit.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.step}
              className="bg-card relative flex flex-col justify-between rounded-3xl border p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-primary/30 text-4xl font-black">
                    {step.step}
                  </span>
                  <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-2xl">
                    <step.icon className="size-5" />
                  </span>
                </div>
                <h3 className="font-display mt-4 text-base font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="text-amber-700 dark:text-amber-400 mt-1 text-[11px] font-semibold">
                  ⏱ {step.time}
                </p>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Values Section */}
      <section className="bg-secondary/40 border-y py-16 md:py-24">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Award className="size-3.5" />
              </span>
              <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
                Kim chỉ nam
              </p>
            </div>
            <h2 className="font-display mt-2 text-2xl font-extrabold md:text-4xl">
              4 Giá trị cốt lõi của chúng tôi
            </h2>
            <p className="text-muted-foreground mt-3 text-sm md:text-base">
              Những cam kết định hình phong cách phục vụ và chất lượng của Trà Trái Cây Tô mỗi ngày.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {coreValues.map((v) => (
              <div key={v.title} className="bg-card rounded-3xl border p-6 shadow-sm">
                <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-2xl">
                  <v.icon className="size-6" />
                </span>
                <h3 className="font-display mt-4 text-lg font-bold text-foreground">
                  {v.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Timeline Journey */}
      <section className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="size-3.5" />
            </span>
            <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
              Cột mốc đáng nhớ
            </p>
          </div>
          <h2 className="font-display mt-2 text-2xl font-extrabold md:text-4xl">
            Hành trình phát triển (2018 — 2026)
          </h2>
          <p className="text-muted-foreground mt-3 text-sm md:text-base">
            Từng bước nỗ lực bền bỉ để đưa trà trái cây tươi bản địa đến gần hơn với hàng triệu người yêu trà.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {timeline.map((t) => (
            <div
              key={t.year}
              className="bg-card group relative flex flex-col justify-between rounded-3xl border p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-primary text-3xl font-black">
                    {t.year}
                  </span>
                  <Badge variant="outline" className="text-[11px] font-bold">
                    {t.badge}
                  </Badge>
                </div>
                <h3 className="font-display group-hover:text-primary mt-4 text-base font-bold transition-colors">
                  {t.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  {t.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Store Space Experience */}
      <section className="bg-secondary/40 border-y py-16 md:py-24">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-3.5" />
              </span>
              <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
                Không gian tiệm trà
              </p>
            </div>

            <h2 className="font-display text-2xl font-extrabold md:text-4xl leading-tight">
              Điểm hẹn thanh mát cho những buổi gặp gỡ
            </h2>

            <p className="text-muted-foreground text-sm leading-relaxed">
              Mỗi cửa hàng trong hệ thống 48 chi nhánh đều được thiết kế với phong cách mở, ngập tràn
              ánh sáng tự nhiên và hương thơm thoang thoảng của tinh dầu cam sả và trà hoa lài.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              {[
                { title: "Khu vực làm việc tiện nghi", desc: "Trang bị ổ cắm điện và wifi cáp quang tốc độ cao" },
                { title: "Không gian máy lạnh mát mẻ", desc: "Nhiệt độ 23°C dễ chịu, chỗ ngồi êm ái thoải mái" },
                { title: "Quầy Pick-up mang đi riêng", desc: "Lấy đồ uống trong 1 phút không cần xếp hàng" },
                { title: "Chỗ đỗ xe rộng rãi", desc: "Có bảo vệ trực hỗ trợ đỗ xe máy và ô tô thuận tiện" },
              ].map((item, idx) => (
                <div key={idx} className="bg-card rounded-2xl border p-4 shadow-sm">
                  <p className="text-sm font-bold text-foreground">{item.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Button asChild variant="default" size="lg" className="font-bold">
                <Link to="/cua-hang">
                  Khám phá 48 chi nhánh gần bạn <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border shadow-xl">
            <img
              src={cuahangImg}
              alt="Không gian cửa hàng hiện đại và tươi mát tại Trà Trái Cây Tô"
              loading="lazy"
              width={1024}
              height={768}
              className="w-full object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="container-page py-16 md:py-20">
        <div className="gradient-warm text-primary-foreground relative overflow-hidden rounded-3xl p-8 md:p-14 text-center shadow-xl">
          <div className="mx-auto max-w-2xl space-y-4 relative z-10">
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Thưởng thức ngay hôm nay
            </span>
            <h2 className="font-display text-2xl font-black md:text-4xl text-white">
              Sẵn sàng trải nghiệm ly trà trái cây tươi mát?
            </h2>
            <p className="text-sm md:text-base opacity-90 max-w-lg mx-auto">
              Đặt món trực tuyến giao nhanh trong 25 phút hoặc ghé tiệm gần nhất để thưởng thức cùng bạn bè!
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-card text-foreground hover:bg-card/90 font-extrabold shadow-md">
                <Link to="/menu">
                  Đặt món online ngay <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="bg-white/20 text-white hover:bg-white/30 font-bold border-white/30 border">
                <Link to="/cua-hang">
                  Tìm tiệm gần bạn
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
