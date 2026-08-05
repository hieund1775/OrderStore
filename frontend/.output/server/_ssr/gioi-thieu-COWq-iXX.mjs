import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as PageHeader } from "./PageHeader-4GMedA0k.mjs";
import { t as story_default } from "./story-CfETKZ6E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/gioi-thieu-COWq-iXX.js
var import_jsx_runtime = require_jsx_runtime();
var timeline = [
	{
		year: "2018",
		title: "Quầy trà đầu tiên",
		desc: "Một xe trà nhỏ trên đường Nguyễn Huệ với 6 công thức."
	},
	{
		year: "2020",
		title: "Chuẩn hóa công thức",
		desc: "Xây dựng quy trình ủ trà 4 tiếng và sơ chế trái cây tại quầy."
	},
	{
		year: "2023",
		title: "48 chi nhánh",
		desc: "Có mặt tại TP.HCM, Hà Nội, Đà Nẵng cùng hệ thống giao hàng riêng."
	},
	{
		year: "2026",
		title: "Hi-Tea Detox",
		desc: "Ra mắt dòng trà ít đường, tập trung vào sức khỏe."
	}
];
function About() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Giới thiệu",
			title: "Câu chuyện Trà & Trái cây tươi",
			desc: "Chúng tôi tin một ly trà ngon bắt đầu từ nguyên liệu thật: lá trà ủ mới và trái cây cắt tay mỗi ngày."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "container-page grid items-center gap-10 py-14 md:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: story_default,
				alt: "Sơ chế trái cây tươi tại quầy pha chế",
				loading: "lazy",
				width: 1024,
				height: 768,
				className: "rounded-3xl object-cover"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl font-extrabold",
						children: "Nguyên liệu thật, vị thật"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-sm leading-relaxed",
						children: "Lục trà lài và ô long được nhập trực tiếp từ Thái Nguyên và Bảo Lộc, ủ theo mẻ nhỏ mỗi 4 tiếng để giữ hương. Trái cây được đặt theo mùa: dâu Đà Lạt, cam Cao Phong, xoài Cát Chu, vải Lục Ngạn."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground text-sm leading-relaxed",
						children: "Chúng tôi không dùng siro cô đặc hay chất bảo quản. Mọi mẻ trà chưa bán hết trong ngày đều được loại bỏ — đó là cam kết bất di bất dịch của Trà Trái Cây Tô."
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "bg-secondary/50 border-y py-14",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "container-page",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display mb-8 text-center text-2xl font-extrabold",
					children: "Hành trình của chúng tôi"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-4",
					children: timeline.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card rounded-2xl border p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-primary font-display text-2xl font-extrabold",
								children: t.year
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 font-semibold",
								children: t.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-muted-foreground mt-1 text-sm",
								children: t.desc
							})
						]
					}, t.year))
				})]
			})
		})
	] });
}
//#endregion
export { About as component };
