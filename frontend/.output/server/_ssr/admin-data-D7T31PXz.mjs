import { h as stores } from "./data-BKElHwIS.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-data-D7T31PXz.js
var adminBranches = [{
	id: "all",
	name: "Tất cả chi nhánh"
}, ...stores.map((s) => ({
	id: s.id,
	name: s.name
}))];
var adminRoles = [
	{
		id: "super",
		label: "Super Admin",
		desc: "Toàn quyền quản trị hệ thống"
	},
	{
		id: "manager",
		label: "Store Manager",
		desc: "Quản lý chi nhánh được phân quyền"
	},
	{
		id: "kitchen",
		label: "Kitchen Staff",
		desc: "Màn hình bếp (KDS Mode)"
	},
	{
		id: "cashier",
		label: "Cashier Staff",
		desc: "Ghi nhận đơn tại quầy (POS Mode)"
	}
];
var kpis = [
	{
		id: "revenue",
		label: "Doanh thu tạm tính",
		value: "42.680.000₫",
		delta: "+12,4%",
		tone: "primary"
	},
	{
		id: "orders",
		label: "Đơn hoàn thành",
		value: "318",
		delta: "+8,1%",
		tone: "leaf"
	},
	{
		id: "cancel",
		label: "Tỷ lệ hủy đơn",
		value: "2,8%",
		delta: "-0,6%",
		tone: "berry"
	},
	{
		id: "cups",
		label: "Tổng ly đã bán",
		value: "764",
		delta: "+15,2%",
		tone: "primary"
	}
];
var urgentKpis = [
	{
		id: "paused",
		label: "Món đang tạm ngưng",
		value: 2,
		tone: "danger",
		to: "/admin/thuc-don"
	},
	{
		id: "prep",
		label: "Đơn đang chuẩn bị",
		value: 7,
		tone: "info",
		to: "/admin/bep"
	},
	{
		id: "late",
		label: "Đơn giao trễ",
		value: 1,
		tone: "danger",
		to: "/admin/don-hang"
	}
];
var hourlyRevenue = [
	{
		hour: "07h",
		value: 1200
	},
	{
		hour: "09h",
		value: 2600
	},
	{
		hour: "11h",
		value: 4900
	},
	{
		hour: "13h",
		value: 3800
	},
	{
		hour: "15h",
		value: 6800
	},
	{
		hour: "17h",
		value: 7400
	},
	{
		hour: "19h",
		value: 5600
	},
	{
		hour: "21h",
		value: 3100
	}
];
var adminOrders = [
	{
		id: "VX26072801",
		customer: "Nguyễn Minh Anh",
		phone: "0903 118 226",
		branch: "Trà Trái Cây Tô – Nguyễn Huệ",
		type: "Delivery",
		payment: "MoMo",
		status: "Chờ xác nhận",
		total: 158e3,
		time: "15:24",
		minutes: 3,
		items: [{
			name: "Trà Dâu Tây Lài Thơm",
			qty: 2,
			options: "Size L · 50% đường · 70% đá · Thạch nha đam"
		}, {
			name: "Trà Cam Sả Mật Ong",
			qty: 1,
			options: "Size M · 30% đường · 100% đá"
		}]
	},
	{
		id: "VX26072802",
		customer: "Trần Quốc Bảo",
		phone: "0987 442 019",
		branch: "Trà Trái Cây Tô – Võ Văn Tần",
		type: "Take-away",
		payment: "VietQR",
		status: "Đang chuẩn bị",
		total: 104e3,
		time: "15:18",
		minutes: 9,
		items: [{
			name: "Ô Long Đào Vải",
			qty: 1,
			options: "Size M · 70% đường · Trân châu trắng"
		}, {
			name: "Hi-Tea Nho Nha Đam",
			qty: 1,
			options: "Size L · 0% đường · Đá riêng"
		}]
	},
	{
		id: "VX26072803",
		customer: "Lê Thu Hà",
		phone: "0912 776 350",
		branch: "Trà Trái Cây Tô – Phú Mỹ Hưng",
		type: "POS",
		payment: "COD",
		status: "Đang chuẩn bị",
		total: 232e3,
		time: "15:02",
		minutes: 17,
		items: [{
			name: "Trà Tuyết Dưa Hấu Táo",
			qty: 3,
			options: "Size L · 50% đường · Trái cây dầm"
		}, {
			name: "Trà Xoài Chanh Dây",
			qty: 1,
			options: "Size M · 100% đường"
		}]
	},
	{
		id: "VX26072804",
		customer: "Phạm Gia Huy",
		phone: "0934 220 118",
		branch: "Trà Trái Cây Tô – Nguyễn Huệ",
		type: "Delivery",
		payment: "ZaloPay",
		status: "Đang giao",
		total: 96e3,
		time: "14:47",
		minutes: 26,
		items: [{
			name: "Trà Cam Sả Mật Ong",
			qty: 2,
			options: "Size L · 30% đường · Aloe Vera"
		}]
	},
	{
		id: "VX26072805",
		customer: "Đỗ Khánh Linh",
		phone: "0977 615 402",
		branch: "Trà Trái Cây Tô – Hoàn Kiếm",
		type: "Take-away",
		payment: "VietQR",
		status: "Hoàn thành",
		total: 143e3,
		time: "14:12",
		minutes: 42,
		items: [{
			name: "Trà Dâu Tây Lài Thơm",
			qty: 2,
			options: "Size M · 70% đường · Macchiato"
		}]
	},
	{
		id: "VX26072806",
		customer: "Vũ Nhật Nam",
		phone: "0961 338 274",
		branch: "Trà Trái Cây Tô – Hải Châu",
		type: "Delivery",
		payment: "COD",
		status: "Đã hủy",
		total: 58e3,
		time: "13:55",
		minutes: 60,
		items: [{
			name: "Trà Tuyết Dưa Hấu Táo",
			qty: 1,
			options: "Size L · 50% đường"
		}]
	}
];
var menuCategories = [
	{
		id: "c1",
		name: "Trà Trái Cây Tươi",
		items: 12,
		visible: true
	},
	{
		id: "c2",
		name: "Trà Đậm Vị",
		items: 8,
		visible: true
	},
	{
		id: "c3",
		name: "Trà Trái Cây Tuyết",
		items: 6,
		visible: true
	},
	{
		id: "c4",
		name: "Hi-Tea Detox",
		items: 5,
		visible: true
	},
	{
		id: "c5",
		name: "Bánh Ngọt Ăn Kèm",
		items: 9,
		visible: false
	}
];
var optionGroups = [
	{
		id: "o1",
		name: "Size",
		values: ["M (Chuẩn)", "L (+10.000₫)"]
	},
	{
		id: "o2",
		name: "Cốt trà",
		values: [
			"Lục Trà Lài",
			"Trà Ô Long",
			"Trà Đen"
		]
	},
	{
		id: "o3",
		name: "Độ ngọt",
		values: [
			"0%",
			"30%",
			"50%",
			"70%",
			"100%"
		]
	},
	{
		id: "o4",
		name: "Mức đá",
		values: [
			"Không đá",
			"30%",
			"50%",
			"70%",
			"100%",
			"Đá riêng"
		]
	},
	{
		id: "o5",
		name: "Topping / Sốt",
		values: [
			"Trái cây dầm",
			"Thạch nha đam",
			"Macchiato"
		]
	},
	{
		id: "o6",
		name: "Nước đóng lon",
		values: ["Pepsi Có Đường", "Pepsi Không Đường (Zero Sugar)"]
	}
];
var adminNotifications = [
	{
		id: "an1",
		type: "order",
		title: "Đơn online mới VX26072801",
		time: "1 phút trước",
		tone: "info"
	},
	{
		id: "an2",
		type: "stock",
		title: "Dưa hấu đã hết hàng tại Q7",
		time: "12 phút trước",
		tone: "danger"
	},
	{
		id: "an3",
		type: "stock",
		title: "Dâu tây còn 20% tại Q1",
		time: "40 phút trước",
		tone: "warn"
	},
	{
		id: "an4",
		type: "voucher",
		title: "Voucher SNOW30 sắp hết lượt dùng",
		time: "2 giờ trước",
		tone: "warn"
	},
	{
		id: "an5",
		type: "staff",
		title: "Yêu cầu duyệt tài khoản nhân viên mới",
		time: "Hôm qua",
		tone: "info"
	},
	{
		id: "an6",
		type: "payment",
		title: "Lỗi cổng thanh toán ZaloPay (mã 502)",
		time: "Hôm qua",
		tone: "danger"
	}
];
var adminAccounts = [
	{
		id: "u1",
		name: "Nguyễn Hoàng Quân",
		email: "quan@tratraicayto.vn",
		role: "Super Admin",
		branch: "Toàn hệ thống",
		active: true
	},
	{
		id: "u2",
		name: "Trần Bảo Ngọc",
		email: "ngoc@tratraicayto.vn",
		role: "Store Manager",
		branch: "Nguyễn Huệ",
		active: true
	},
	{
		id: "u3",
		name: "Lý Thanh Tùng",
		email: "tung@tratraicayto.vn",
		role: "Cashier Staff",
		branch: "Võ Văn Tần",
		active: true
	},
	{
		id: "u4",
		name: "Hồ Mai Chi",
		email: "chi@tratraicayto.vn",
		role: "Kitchen Staff",
		branch: "Phú Mỹ Hưng",
		active: false
	}
];
var auditLogs = [
	{
		id: "l1",
		user: "quan@tratraicayto.vn",
		action: "Cập nhật giá sản phẩm",
		detail: "Trà Cam Sả: 42.000₫ → 45.000₫",
		time: "27/07 14:52",
		ip: "113.185.44.2",
		device: "Chrome · macOS"
	},
	{
		id: "l2",
		user: "ngoc@tratraicayto.vn",
		action: "Tạm ngưng bán món",
		detail: "Trà Tuyết Dưa Hấu: Đang bán → Tạm ngưng",
		time: "27/07 13:20",
		ip: "171.244.10.88",
		device: "Safari · iPad"
	},
	{
		id: "l3",
		user: "quan@tratraicayto.vn",
		action: "Tạo khuyến mãi",
		detail: "Flash Sale 15h Vàng",
		time: "26/07 09:11",
		ip: "113.185.44.2",
		device: "Chrome · macOS"
	},
	{
		id: "l4",
		user: "tung@tratraicayto.vn",
		action: "Hủy đơn hàng",
		detail: "VX26072806 – lý do: khách báo hủy",
		time: "26/07 08:04",
		ip: "14.161.7.19",
		device: "Chrome · Windows"
	}
];
//#endregion
export { adminRoles as a, kpis as c, urgentKpis as d, adminOrders as i, menuCategories as l, adminBranches as n, auditLogs as o, adminNotifications as r, hourlyRevenue as s, adminAccounts as t, optionGroups as u };
