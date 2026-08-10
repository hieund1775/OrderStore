globalThis.__nitro_main__ = import.meta.url;
import { n as HTTPError, r as defineLazyEventHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { t as HookableCore } from "./_libs/hookable.mjs";
import { r as FastResponse } from "./_libs/h3-v2+rou3+srvx.mjs";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/favicon.ico": {
		"type": "image/vnd.microsoft.icon",
		"etag": "\"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk\"",
		"mtime": "2026-08-05T16:13:16.071Z",
		"size": 0,
		"path": "../public/favicon.ico"
	},
	"/assets/admin.bep-TW_wUNGw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5838-NWSMBs9x61CLuZvXmC3jFtXGLmY\"",
		"mtime": "2026-08-10T09:01:57.918Z",
		"size": 22584,
		"path": "../public/assets/admin.bep-TW_wUNGw.js"
	},
	"/assets/admin-AzI5rm33.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a02-iBeCzKmaR4akwKjFRUlS8BhMyGQ\"",
		"mtime": "2026-08-10T09:01:57.915Z",
		"size": 10754,
		"path": "../public/assets/admin-AzI5rm33.js"
	},
	"/assets/admin.cai-dat-BgjC-NKn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e16-LQTuDqfIVUJG8Yt7XpUjMeQ7MoQ\"",
		"mtime": "2026-08-10T09:01:57.918Z",
		"size": 7702,
		"path": "../public/assets/admin.cai-dat-BgjC-NKn.js"
	},
	"/assets/admin.don-hang-C9yclzuH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3ada-8vAaXPFO1GWv4zE9ZSXgFofVE34\"",
		"mtime": "2026-08-10T09:01:57.921Z",
		"size": 15066,
		"path": "../public/assets/admin.don-hang-C9yclzuH.js"
	},
	"/assets/admin.index-CDtW-Tvw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4098-m/f8n23V/bzAwQW/5vbOmtKdKpg\"",
		"mtime": "2026-08-10T09:01:57.923Z",
		"size": 16536,
		"path": "../public/assets/admin.index-CDtW-Tvw.js"
	},
	"/assets/admin.chi-nhanh-DKgsp5t0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"475b-xcoTlGKywx2rDqLzV6Kpagz7u70\"",
		"mtime": "2026-08-10T09:01:57.920Z",
		"size": 18267,
		"path": "../public/assets/admin.chi-nhanh-DKgsp5t0.js"
	},
	"/assets/admin.login-Dm011ONT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d52-4Cb9cQdk1Q1UwTYPSUYdB1UvJ14\"",
		"mtime": "2026-08-10T09:01:57.925Z",
		"size": 3410,
		"path": "../public/assets/admin.login-Dm011ONT.js"
	},
	"/robots.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"19-yHADZo6lKl+mSNPU9098EiqzPCE\"",
		"mtime": "2026-08-05T16:13:16.073Z",
		"size": 25,
		"path": "../public/robots.txt"
	},
	"/assets/admin.khuyen-mai-BaKZbwbZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2395-WQrilpFnOf9cSgjJeE2GJleHP2U\"",
		"mtime": "2026-08-10T09:01:57.924Z",
		"size": 9109,
		"path": "../public/assets/admin.khuyen-mai-BaKZbwbZ.js"
	},
	"/assets/admin.thong-bao-B4QDv4ET.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"aec-zfb5B1iQez1YHp0ww7m0XdzkEZE\"",
		"mtime": "2026-08-10T09:01:57.926Z",
		"size": 2796,
		"path": "../public/assets/admin.thong-bao-B4QDv4ET.js"
	},
	"/assets/admin.thuc-don-BmVR93ck.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4d68-0N8TaT62mIhtia7hTESS0xMCt2g\"",
		"mtime": "2026-08-10T09:01:58.017Z",
		"size": 19816,
		"path": "../public/assets/admin.thuc-don-BmVR93ck.js"
	},
	"/assets/AdminUI-DkVJ7dd7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6f4-bybaheyct/IfU5FQ0iTAfeT8Mck\"",
		"mtime": "2026-08-10T09:01:57.911Z",
		"size": 1780,
		"path": "../public/assets/AdminUI-DkVJ7dd7.js"
	},
	"/assets/admin.vi-tri-Cqa0gMvM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2fcf-j62vIUZFpmruMcd6Y+IiNPYjkao\"",
		"mtime": "2026-08-10T09:01:58.018Z",
		"size": 12239,
		"path": "../public/assets/admin.vi-tri-Cqa0gMvM.js"
	},
	"/assets/alert-dialog-C5Kx2WOH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e4e-XJtEQdkov7yGaEcwV+Qie7KdG08\"",
		"mtime": "2026-08-10T09:01:58.018Z",
		"size": 3662,
		"path": "../public/assets/alert-dialog-C5Kx2WOH.js"
	},
	"/assets/arrow-right-xOcmp9wA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-IusRR3iuMIPeu+C6dPSa7X8DeS0\"",
		"mtime": "2026-08-10T09:01:58.024Z",
		"size": 153,
		"path": "../public/assets/arrow-right-xOcmp9wA.js"
	},
	"/assets/bike-Bzm1mk3G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"114-6YtT2vvD+CRNAeUs9VJDPYUIFAU\"",
		"mtime": "2026-08-10T09:01:58.025Z",
		"size": 276,
		"path": "../public/assets/bike-Bzm1mk3G.js"
	},
	"/assets/browser-_bfep-6z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5cd9-rupb159DZ5zntLdsBT/QbqGaBuA\"",
		"mtime": "2026-08-10T09:01:58.025Z",
		"size": 23769,
		"path": "../public/assets/browser-_bfep-6z.js"
	},
	"/assets/chevron-right-5vP800zS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"76-cmibWjhNwaLhFMYSUPTq6PDRVpQ\"",
		"mtime": "2026-08-10T09:01:58.028Z",
		"size": 118,
		"path": "../public/assets/chevron-right-5vP800zS.js"
	},
	"/assets/circle-BsmNDFnC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"76-w26m9jE5VW99dINvHbk3nrct29I\"",
		"mtime": "2026-08-10T09:01:58.028Z",
		"size": 118,
		"path": "../public/assets/circle-BsmNDFnC.js"
	},
	"/assets/card-BFzAVi_b.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"439-ExdlNudCWiSc8pdpl4Fm0irjdPQ\"",
		"mtime": "2026-08-10T09:01:58.026Z",
		"size": 1081,
		"path": "../public/assets/card-BFzAVi_b.js"
	},
	"/assets/chef-hat-CgUEigNM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"128-CwbILnzCVixy0CIuOHWcnvUc/B8\"",
		"mtime": "2026-08-10T09:01:58.027Z",
		"size": 296,
		"path": "../public/assets/chef-hat-CgUEigNM.js"
	},
	"/assets/clock-hVAygmRl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9d-BLUNwop6n9Mz7gyL6jPb4UyUQ+E\"",
		"mtime": "2026-08-10T09:01:58.031Z",
		"size": 157,
		"path": "../public/assets/clock-hVAygmRl.js"
	},
	"/assets/circle-x-DP966XK6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c3-0wP6w4P6ZS0L4IDHXZbRWlSzHbQ\"",
		"mtime": "2026-08-10T09:01:58.030Z",
		"size": 195,
		"path": "../public/assets/circle-x-DP966XK6.js"
	},
	"/assets/admin.bao-cao-D67zeKio.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b6ac0-VM0wrR8uo0yB/xttBEiFhza2HGc\"",
		"mtime": "2026-08-10T09:01:57.917Z",
		"size": 748224,
		"path": "../public/assets/admin.bao-cao-D67zeKio.js"
	},
	"/assets/cua-hang-2-cL4Th7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24af-vgJHMoK4fPn6YgAxCBPlZcXgrUw\"",
		"mtime": "2026-08-10T09:01:58.032Z",
		"size": 9391,
		"path": "../public/assets/cua-hang-2-cL4Th7.js"
	},
	"/assets/cup-soda-Cn4XYN2_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"135-QpU4xRprBc0LUI+eF34UCVVQPBs\"",
		"mtime": "2026-08-10T09:01:58.033Z",
		"size": 309,
		"path": "../public/assets/cup-soda-Cn4XYN2_.js"
	},
	"/assets/data-CR9wjOxo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"be9d-I149pqJ9PbHD55KFzYBxCaiHVa0\"",
		"mtime": "2026-08-10T09:01:58.033Z",
		"size": 48797,
		"path": "../public/assets/data-CR9wjOxo.js"
	},
	"/assets/dist-Bgoq3Kt5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ef-u5YXTV9TtQIYCanvUrer9wRF3zw\"",
		"mtime": "2026-08-10T09:01:58.038Z",
		"size": 751,
		"path": "../public/assets/dist-Bgoq3Kt5.js"
	},
	"/assets/dist-BXcNqds1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1cc1-1k4YgQbUpf+MLxdcWjQfilrxGMw\"",
		"mtime": "2026-08-10T09:01:58.033Z",
		"size": 7361,
		"path": "../public/assets/dist-BXcNqds1.js"
	},
	"/assets/dist-CMcSEpF5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10aa-5l4HfORGeZZWsQ9J38Y4SDQWUHE\"",
		"mtime": "2026-08-10T09:01:58.038Z",
		"size": 4266,
		"path": "../public/assets/dist-CMcSEpF5.js"
	},
	"/assets/dist-DMpfotVH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a9-SNrZaxTtv7/TdmDkJ7BcMDiRG5Q\"",
		"mtime": "2026-08-10T09:01:58.039Z",
		"size": 681,
		"path": "../public/assets/dist-DMpfotVH.js"
	},
	"/assets/dist-DXQ4x22e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"130a-LNfeJUn2qYdTt1sAwyRTPH/E9h8\"",
		"mtime": "2026-08-10T09:01:58.040Z",
		"size": 4874,
		"path": "../public/assets/dist-DXQ4x22e.js"
	},
	"/assets/dist-DzZ3GmS_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"64a3-hK0ElnRlDYvWPbYYa8HdC8CaRzE\"",
		"mtime": "2026-08-10T09:01:58.042Z",
		"size": 25763,
		"path": "../public/assets/dist-DzZ3GmS_.js"
	},
	"/assets/dist-mEOMHUgE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d55-/9pkdnStIhw7wIK0DbpsZp9LTtc\"",
		"mtime": "2026-08-10T09:01:58.043Z",
		"size": 7509,
		"path": "../public/assets/dist-mEOMHUgE.js"
	},
	"/assets/download-QDMlzli8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc-Miz+IlfN2L7hnoNc0X3qgyV7iFE\"",
		"mtime": "2026-08-10T09:01:58.043Z",
		"size": 220,
		"path": "../public/assets/download-QDMlzli8.js"
	},
	"/assets/es2015-B4sSiKHa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5895-Ap/0WYNaJW9rWg1pE3+Gu4Ag/vY\"",
		"mtime": "2026-08-10T09:01:58.049Z",
		"size": 22677,
		"path": "../public/assets/es2015-B4sSiKHa.js"
	},
	"/assets/dropdown-menu-DFQ7hnFo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12ca7-OfQkTgmv6CBtAemSg1/DJGTbjdM\"",
		"mtime": "2026-08-10T09:01:58.047Z",
		"size": 76967,
		"path": "../public/assets/dropdown-menu-DFQ7hnFo.js"
	},
	"/assets/gioi-thieu-BYim9Pke.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6e-V/EHfqcgP9N8QBDfv88nwMOLaQc\"",
		"mtime": "2026-08-10T09:01:58.050Z",
		"size": 2670,
		"path": "../public/assets/gioi-thieu-BYim9Pke.js"
	},
	"/assets/ho-so-BybNJBvS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"29f3-GYVbzZKN35WhgTMW1S5svBkW7KY\"",
		"mtime": "2026-08-10T09:01:58.055Z",
		"size": 10739,
		"path": "../public/assets/ho-so-BybNJBvS.js"
	},
	"/assets/html2canvas-BswC5BpG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b8d-Gs4ApUtpd/B+5SV8XeHRaoGcry8\"",
		"mtime": "2026-08-10T09:01:58.056Z",
		"size": 199565,
		"path": "../public/assets/html2canvas-BswC5BpG.js"
	},
	"/assets/generateCategoricalChart-BkthnArN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a4dc-4Qgdk3josky+UDMHTxcbTQuPS+4\"",
		"mtime": "2026-08-10T09:01:58.050Z",
		"size": 369884,
		"path": "../public/assets/generateCategoricalChart-BkthnArN.js"
	},
	"/assets/InBillModal-BZasIKDc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b1f-yIN+37/VWjdWBIDHh1LSiFNMjKM\"",
		"mtime": "2026-08-10T09:01:57.911Z",
		"size": 6943,
		"path": "../public/assets/InBillModal-BZasIKDc.js"
	},
	"/assets/index.es-Q_nM81TE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24fb9-n/nY8HTaymaxmUMumGdMznUtc3c\"",
		"mtime": "2026-08-10T09:01:58.059Z",
		"size": 151481,
		"path": "../public/assets/index.es-Q_nM81TE.js"
	},
	"/assets/jsx-runtime-By8HlURe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b3-IA0XiFuRY0cUsIlFJWjLIFoOPrI\"",
		"mtime": "2026-08-10T09:01:58.060Z",
		"size": 435,
		"path": "../public/assets/jsx-runtime-By8HlURe.js"
	},
	"/assets/label-D1EZqVFN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2d8-J1EAc/+R+Ucb4R2H7eeECeRDr0o\"",
		"mtime": "2026-08-10T09:01:58.062Z",
		"size": 728,
		"path": "../public/assets/label-D1EZqVFN.js"
	},
	"/assets/index-vh-t_kPv.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3af7-hJRdDJQQrsTdSxJ69xb7a611WZ4\"",
		"mtime": "2026-08-10T09:01:58.215Z",
		"size": 15095,
		"path": "../public/assets/index-vh-t_kPv.css"
	},
	"/assets/hero-tea-CnZJmeVT.jpg": {
		"type": "image/jpeg",
		"etag": "\"35ab9-fAn9o0p9bLh0YgurYW9qZK6r9dA\"",
		"mtime": "2026-08-10T09:01:58.211Z",
		"size": 219833,
		"path": "../public/assets/hero-tea-CnZJmeVT.jpg"
	},
	"/assets/index-CKABFSl8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"599a7-mur1+LyUvAQcaaOOHGYhec87CoE\"",
		"mtime": "2026-08-10T09:01:57.910Z",
		"size": 367015,
		"path": "../public/assets/index-CKABFSl8.js"
	},
	"/assets/leaf-D92Y11Sw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fd-C4f2CEHzwmVcI8/Vx8Rt/eTPe4A\"",
		"mtime": "2026-08-10T09:01:58.063Z",
		"size": 253,
		"path": "../public/assets/leaf-D92Y11Sw.js"
	},
	"/assets/link-DHfoYJFr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5b6e-yhei0/IwtpGrZyhwoJDI6kRkcoY\"",
		"mtime": "2026-08-10T09:01:58.097Z",
		"size": 23406,
		"path": "../public/assets/link-DHfoYJFr.js"
	},
	"/assets/leaflet-src-AD9ZoK5_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2455b-mE/M9aQb7obISMbNaGyDSoxgSvc\"",
		"mtime": "2026-08-10T09:01:58.083Z",
		"size": 148827,
		"path": "../public/assets/leaflet-src-AD9ZoK5_.js"
	},
	"/assets/menu-DWCNnWvv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19ea-x5ygmTPOGO2WaWWfYhJHmCYOiCo\"",
		"mtime": "2026-08-10T09:01:58.111Z",
		"size": 6634,
		"path": "../public/assets/menu-DWCNnWvv.js"
	},
	"/assets/loader-circle-ChDeYwDn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"84-cP0WgDGFjTtuMkulzy/ZrC9lG4U\"",
		"mtime": "2026-08-10T09:01:58.098Z",
		"size": 132,
		"path": "../public/assets/loader-circle-ChDeYwDn.js"
	},
	"/assets/p-cam-sa-DfgrSZ0R.jpg": {
		"type": "image/jpeg",
		"etag": "\"59e0-AKBlLB23+cNWo5mDHti3BFNgCKc\"",
		"mtime": "2026-08-10T09:01:58.216Z",
		"size": 23008,
		"path": "../public/assets/p-cam-sa-DfgrSZ0R.jpg"
	},
	"/assets/p-dao-vai-GXWXa8My.jpg": {
		"type": "image/jpeg",
		"etag": "\"6eee-xdxTiUSu0HDKMLMoh7byHRN0PvI\"",
		"mtime": "2026-08-10T09:01:58.218Z",
		"size": 28398,
		"path": "../public/assets/p-dao-vai-GXWXa8My.jpg"
	},
	"/assets/p-dau-tay-CUKEpxcf.jpg": {
		"type": "image/jpeg",
		"etag": "\"657f-GM/xVISXEG5K+ZZL/a9IfU4s0ZI\"",
		"mtime": "2026-08-10T09:01:58.219Z",
		"size": 25983,
		"path": "../public/assets/p-dau-tay-CUKEpxcf.jpg"
	},
	"/assets/p-dua-hau-DL5uHyXj.jpg": {
		"type": "image/jpeg",
		"etag": "\"9d24-0HoBk39hGhxZh5mxKc4swpW/szk\"",
		"mtime": "2026-08-10T09:01:58.227Z",
		"size": 40228,
		"path": "../public/assets/p-dua-hau-DL5uHyXj.jpg"
	},
	"/assets/PageHeader-GpKH_LDp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23e-gABu8B7BLpcxt/8Q+g16S+bZbZk\"",
		"mtime": "2026-08-10T09:01:57.912Z",
		"size": 574,
		"path": "../public/assets/PageHeader-GpKH_LDp.js"
	},
	"/assets/p-nho-CErz7lW6.jpg": {
		"type": "image/jpeg",
		"etag": "\"9e1e-kR94MRkC3Crm6dUsQPVlU0Hlqs8\"",
		"mtime": "2026-08-10T09:01:58.228Z",
		"size": 40478,
		"path": "../public/assets/p-nho-CErz7lW6.jpg"
	},
	"/assets/pencil-BKC0ibmQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"108-1pFu2yGctFjyrvSE0YuHfHT61Ec\"",
		"mtime": "2026-08-10T09:01:58.111Z",
		"size": 264,
		"path": "../public/assets/pencil-BKC0ibmQ.js"
	},
	"/assets/p-xoai-BfC_UYuj.jpg": {
		"type": "image/jpeg",
		"etag": "\"49f0-/KQiArwQoq3LaxmPdVtWSdEsadQ\"",
		"mtime": "2026-08-10T09:01:58.228Z",
		"size": 18928,
		"path": "../public/assets/p-xoai-BfC_UYuj.jpg"
	},
	"/assets/plus-DdxCbsMD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8d-RHgwsHWU1twVPCi/yimM/4kTEjk\"",
		"mtime": "2026-08-10T09:01:58.112Z",
		"size": 141,
		"path": "../public/assets/plus-DdxCbsMD.js"
	},
	"/assets/ProductCard-DfiAHNrE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"620f-RJooSU2MuCVgHdRWB41Pf3bBI3k\"",
		"mtime": "2026-08-10T09:01:57.912Z",
		"size": 25103,
		"path": "../public/assets/ProductCard-DfiAHNrE.js"
	},
	"/assets/purify.es-Bwt4ulIK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6a00-0LDmIFETtaeAWgn0JzNU4gyTehA\"",
		"mtime": "2026-08-10T09:01:58.130Z",
		"size": 27136,
		"path": "../public/assets/purify.es-Bwt4ulIK.js"
	},
	"/assets/radio-group-aAC_Qj3P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"184f-gSsX2QVk+ZtxGS88MyWwwrVo1Ws\"",
		"mtime": "2026-08-10T09:01:58.131Z",
		"size": 6223,
		"path": "../public/assets/radio-group-aAC_Qj3P.js"
	},
	"/assets/react-dom-CLfoRMMW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dff-opcypsTHWymQU+ZyWA1/sdM0Kr0\"",
		"mtime": "2026-08-10T09:01:58.132Z",
		"size": 3583,
		"path": "../public/assets/react-dom-CLfoRMMW.js"
	},
	"/assets/redirect-1Dss4sOM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"216-AhfiXwQqYdLrM+uQAOtPHfIddmI\"",
		"mtime": "2026-08-10T09:01:58.133Z",
		"size": 534,
		"path": "../public/assets/redirect-1Dss4sOM.js"
	},
	"/assets/rolldown-runtime-QTnfLwEv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b6-wnqLLSlp3SaE+lbe74bKNe5Rpds\"",
		"mtime": "2026-08-10T09:01:58.133Z",
		"size": 694,
		"path": "../public/assets/rolldown-runtime-QTnfLwEv.js"
	},
	"/assets/routes-Cs5ofe2g.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d6c-1ir3Zv5dh85naBDCGAs40Fa2UT0\"",
		"mtime": "2026-08-10T09:01:58.135Z",
		"size": 7532,
		"path": "../public/assets/routes-Cs5ofe2g.js"
	},
	"/assets/shield-check-DFAlqaau.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"134-4yK1r08GZLmcgTK8z//6VlbkgLE\"",
		"mtime": "2026-08-10T09:01:58.157Z",
		"size": 308,
		"path": "../public/assets/shield-check-DFAlqaau.js"
	},
	"/assets/star-D0CCCSbk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1cc-GF/yKnXO40r9VdDb8bAQWVnI+OQ\"",
		"mtime": "2026-08-10T09:01:58.158Z",
		"size": 460,
		"path": "../public/assets/star-D0CCCSbk.js"
	},
	"/assets/store-ud7lyTgY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e6-B7Q0haujAiLxiQ3bRYV8jqfk5k8\"",
		"mtime": "2026-08-10T09:01:58.158Z",
		"size": 486,
		"path": "../public/assets/store-ud7lyTgY.js"
	},
	"/assets/story-CEK2DH46.jpg": {
		"type": "image/jpeg",
		"etag": "\"162b2-AFImYOtq2Ng5nHTZRjVlc39URvw\"",
		"mtime": "2026-08-10T09:01:58.235Z",
		"size": 90802,
		"path": "../public/assets/story-CEK2DH46.jpg"
	},
	"/assets/story-PP6pLy4S.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"32-B7D5CnnrQ3O0OwTrRW0rmolIrxI\"",
		"mtime": "2026-08-10T09:01:58.160Z",
		"size": 50,
		"path": "../public/assets/story-PP6pLy4S.js"
	},
	"/assets/switch-BG_30y_M.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1104-StXv4sGC1AAgwQRvYXDLJ/bfndc\"",
		"mtime": "2026-08-10T09:01:58.172Z",
		"size": 4356,
		"path": "../public/assets/switch-BG_30y_M.js"
	},
	"/assets/table-DMIBqpWD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"697-wXsOAlAOy637cnDNO6IccxElB/g\"",
		"mtime": "2026-08-10T09:01:58.173Z",
		"size": 1687,
		"path": "../public/assets/table-DMIBqpWD.js"
	},
	"/assets/styles-BxSi9g7C.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"195b2-5MRQwJApQ70ew6rAJTLKgK1Q/FE\"",
		"mtime": "2026-08-10T09:01:58.236Z",
		"size": 103858,
		"path": "../public/assets/styles-BxSi9g7C.css"
	},
	"/assets/tabs-2iB0wOrp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e21-218nGuMpbvZrvnlLmA6G/1FejuQ\"",
		"mtime": "2026-08-10T09:01:58.179Z",
		"size": 3617,
		"path": "../public/assets/tabs-2iB0wOrp.js"
	},
	"/assets/thanh-toan-BL7jHBhh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b15-RNGylyZBl0hlQ26rj5z94Jd7Hko\"",
		"mtime": "2026-08-10T09:01:58.181Z",
		"size": 11029,
		"path": "../public/assets/thanh-toan-BL7jHBhh.js"
	},
	"/assets/theo-doi-don-DRtVohq3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"277f-p6+gOUxTLJWmaRLDJfWO0JBGMgA\"",
		"mtime": "2026-08-10T09:01:58.190Z",
		"size": 10111,
		"path": "../public/assets/theo-doi-don-DRtVohq3.js"
	},
	"/assets/ticket-DUY3jz4P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"135-fLIrSPTJoyEgsm2BU87/Mk6Lyi0\"",
		"mtime": "2026-08-10T09:01:58.191Z",
		"size": 309,
		"path": "../public/assets/ticket-DUY3jz4P.js"
	},
	"/assets/triangle-alert-C6hV8SZ4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"273-NAeiWDWyuDVgBnjeAt9HjCPfUd4\"",
		"mtime": "2026-08-10T09:01:58.196Z",
		"size": 627,
		"path": "../public/assets/triangle-alert-C6hV8SZ4.js"
	},
	"/assets/textarea-aajD0x9F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"232-gipPp3YVfcQacTuGD1fxBOgxp5E\"",
		"mtime": "2026-08-10T09:01:58.180Z",
		"size": 562,
		"path": "../public/assets/textarea-aajD0x9F.js"
	},
	"/assets/tuyen-dung-V1H2dRWf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10af-JqUH6kqT1w1gFVCGU1FSMsVvutA\"",
		"mtime": "2026-08-10T09:01:58.197Z",
		"size": 4271,
		"path": "../public/assets/tuyen-dung-V1H2dRWf.js"
	},
	"/assets/typeof-B5XbjTb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f-yPXEOGyFHb1Ws7OoWyWNEEBz4mQ\"",
		"mtime": "2026-08-10T09:01:58.197Z",
		"size": 271,
		"path": "../public/assets/typeof-B5XbjTb1.js"
	},
	"/assets/upload-B68HLfCJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"da-J6sdoRLl+PW3SMsWWAfpxB6yvfA\"",
		"mtime": "2026-08-10T09:01:58.203Z",
		"size": 218,
		"path": "../public/assets/upload-B68HLfCJ.js"
	},
	"/assets/useMatch--Fl-2zAJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b8-0cxwbb55RpkC1Y80lpGCcwDpFso\"",
		"mtime": "2026-08-10T09:01:58.205Z",
		"size": 696,
		"path": "../public/assets/useMatch--Fl-2zAJ.js"
	},
	"/assets/x-C09S-mUY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8e-BXYLG/qwrm8vxf4pBctXFUoW59A\"",
		"mtime": "2026-08-10T09:01:58.210Z",
		"size": 142,
		"path": "../public/assets/x-C09S-mUY.js"
	},
	"/assets/useRouter-C1gxlJkU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bc-3HoXKTcAdSfosaMraXtIvljuiVo\"",
		"mtime": "2026-08-10T09:01:58.210Z",
		"size": 188,
		"path": "../public/assets/useRouter-C1gxlJkU.js"
	}
};
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_4_UnOo = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_4_UnOo
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
[].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new FastResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function useNitroHooks() {
	const nitroApp = useNitroApp();
	const hooks = nitroApp.hooks;
	if (hooks) return hooks;
	return nitroApp.hooks = new HookableCore();
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs
function createHandler(hooks) {
	const nitroApp = useNitroApp();
	const nitroHooks = useNitroHooks();
	return {
		async fetch(request, env, context) {
			globalThis.__env__ = env;
			augmentReq(request, {
				env,
				context
			});
			const ctxExt = {};
			const url = new URL(request.url);
			if (hooks.fetch) {
				const res = await hooks.fetch(request, env, context, url, ctxExt);
				if (res) return res;
			}
			return await nitroApp.fetch(request);
		},
		scheduled(controller, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:scheduled", {
				controller,
				env,
				context
			}) || Promise.resolve());
		},
		email(message, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:email", {
				message,
				event: message,
				env,
				context
			}) || Promise.resolve());
		},
		queue(batch, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:queue", {
				batch,
				event: batch,
				env,
				context
			}) || Promise.resolve());
		},
		tail(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:tail", {
				traces,
				env,
				context
			}) || Promise.resolve());
		},
		trace(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:trace", {
				traces,
				env,
				context
			}) || Promise.resolve());
		}
	};
}
function augmentReq(cfReq, ctx) {
	const req = cfReq;
	req.ip = cfReq.headers.get("cf-connecting-ip") || void 0;
	req.runtime ??= { name: "cloudflare" };
	req.runtime.cloudflare = {
		...req.runtime.cloudflare,
		...ctx
	};
	req.waitUntil = ctx.context?.waitUntil.bind(ctx.context);
}
//#endregion
//#region node_modules/nitro/dist/presets/cloudflare/runtime/cloudflare-module.mjs
var cloudflare_module_default = createHandler({ fetch(cfRequest, env, context, url) {
	if (env.ASSETS && isPublicAssetURL(url.pathname)) return env.ASSETS.fetch(cfRequest);
} });
//#endregion
export { cloudflare_module_default as default };
