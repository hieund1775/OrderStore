import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import storyImg from "@/assets/story.jpg";

export const Route = createFileRoute("/gioi-thieu")({
  head: () => ({
    meta: [
      { title: "Câu chuyện Trà & Trái cây tươi — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Hành trình của Trà Trái Cây Tô: trà ủ mới mỗi ngày, trái cây tuyển chọn tại vườn và cam kết không chất bảo quản.",
      },
      { property: "og:title", content: "Câu chuyện Trà & Trái cây tươi — Trà Trái Cây Tô" },
      { property: "og:description", content: "Trà đậm vị pha trong ngày, 100% trái cây tươi." },
    ],
  }),
  component: About,
});

const timeline = [
  {
    year: "2018",
    title: "Quầy trà đầu tiên",
    desc: "Một xe trà nhỏ trên đường Nguyễn Huệ với 6 công thức.",
  },
  {
    year: "2020",
    title: "Chuẩn hóa công thức",
    desc: "Xây dựng quy trình ủ trà 4 tiếng và sơ chế trái cây tại quầy.",
  },
  {
    year: "2023",
    title: "48 chi nhánh",
    desc: "Có mặt tại TP.HCM, Hà Nội, Đà Nẵng cùng hệ thống giao hàng riêng.",
  },
  {
    year: "2026",
    title: "Hi-Tea Detox",
    desc: "Ra mắt dòng trà ít đường, tập trung vào sức khỏe.",
  },
];

function About() {
  return (
    <>
      <PageHeader
        eyebrow="Giới thiệu"
        title="Câu chuyện Trà & Trái cây tươi"
        desc="Chúng tôi tin một ly trà ngon bắt đầu từ nguyên liệu thật: lá trà ủ mới và trái cây cắt tay mỗi ngày."
      />

      <section className="container-page grid items-center gap-10 py-14 md:grid-cols-2">
        <img
          src={storyImg}
          alt="Sơ chế trái cây tươi tại quầy pha chế"
          loading="lazy"
          width={1024}
          height={768}
          className="rounded-3xl object-cover"
        />
        <div className="space-y-4">
          <h2 className="font-display text-2xl font-extrabold">Nguyên liệu thật, vị thật</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Lục trà lài và ô long được nhập trực tiếp từ Thái Nguyên và Bảo Lộc, ủ theo mẻ nhỏ mỗi 4
            tiếng để giữ hương. Trái cây được đặt theo mùa: dâu Đà Lạt, cam Cao Phong, xoài Cát Chu,
            vải Lục Ngạn.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Chúng tôi không dùng siro cô đặc hay chất bảo quản. Mọi mẻ trà chưa bán hết trong ngày
            đều được loại bỏ — đó là cam kết bất di bất dịch của Trà Trái Cây Tô.
          </p>
        </div>
      </section>

      <section className="bg-secondary/50 border-y py-14">
        <div className="container-page">
          <h2 className="font-display mb-8 text-center text-2xl font-extrabold">
            Hành trình của chúng tôi
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
            {timeline.map((t) => (
              <div key={t.year} className="bg-card rounded-2xl border p-5">
                <p className="text-primary font-display text-2xl font-extrabold">{t.year}</p>
                <p className="mt-2 font-semibold">{t.title}</p>
                <p className="text-muted-foreground mt-1 text-sm">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
