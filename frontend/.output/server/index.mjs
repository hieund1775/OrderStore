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
	"/assets/admin-DppBt0wk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a02-Deig2l+afdkRHFW8kxXtYG7moeA\"",
		"mtime": "2026-08-10T08:07:13.461Z",
		"size": 10754,
		"path": "../public/assets/admin-DppBt0wk.js"
	},
	"/assets/admin.bep-BKdAVhc1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"55b4-Fjj2pVLfvwESh89bCCyA333lqgM\"",
		"mtime": "2026-08-10T08:07:13.464Z",
		"size": 21940,
		"path": "../public/assets/admin.bep-BKdAVhc1.js"
	},
	"/assets/admin.chi-nhanh-XTAVdGs0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"475b-o5WhuyV5j5Zf8ZWeglxkZPZ3g+E\"",
		"mtime": "2026-08-10T08:07:13.465Z",
		"size": 18267,
		"path": "../public/assets/admin.chi-nhanh-XTAVdGs0.js"
	},
	"/assets/admin.index-DOHgROIi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4098-Bi2L+Gc4mXQjX2/mk2rdsoQgRKE\"",
		"mtime": "2026-08-10T08:07:13.465Z",
		"size": 16536,
		"path": "../public/assets/admin.index-DOHgROIi.js"
	},
	"/assets/admin.cai-dat-B1gcU710.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e16-xlDuB/aIpxfB6E7ijGJjuwK0BAU\"",
		"mtime": "2026-08-10T08:07:13.464Z",
		"size": 7702,
		"path": "../public/assets/admin.cai-dat-B1gcU710.js"
	},
	"/assets/admin.khuyen-mai-CSwoWvdX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2395-vJIWtvUi/uMhDpSdWWkenHPtZGk\"",
		"mtime": "2026-08-10T08:07:13.466Z",
		"size": 9109,
		"path": "../public/assets/admin.khuyen-mai-CSwoWvdX.js"
	},
	"/assets/admin.don-hang-CrfJwFam.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a8a-DRAnxeBOtArNnb/lMXMiYqPo9qE\"",
		"mtime": "2026-08-10T08:07:13.465Z",
		"size": 14986,
		"path": "../public/assets/admin.don-hang-CrfJwFam.js"
	},
	"/assets/admin.login-T8T87hhG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d52-2wB7IllmUYWWjlIpWwk+DzCE+i8\"",
		"mtime": "2026-08-10T08:07:13.468Z",
		"size": 3410,
		"path": "../public/assets/admin.login-T8T87hhG.js"
	},
	"/assets/admin.thong-bao-CmHn7oT7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"aec-auR85oMaFC/DajNqaY8WGOkkg+g\"",
		"mtime": "2026-08-10T08:07:13.469Z",
		"size": 2796,
		"path": "../public/assets/admin.thong-bao-CmHn7oT7.js"
	},
	"/assets/admin.vi-tri-BzvfsnXE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2fcf-2okAHoh5D5OVCtfCMjvBVVKCF2s\"",
		"mtime": "2026-08-10T08:07:13.470Z",
		"size": 12239,
		"path": "../public/assets/admin.vi-tri-BzvfsnXE.js"
	},
	"/assets/admin.thuc-don-C5_zDaQo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4d68-3I4D/2gyx19yAw0caAXx02zqetY\"",
		"mtime": "2026-08-10T08:07:13.469Z",
		"size": 19816,
		"path": "../public/assets/admin.thuc-don-C5_zDaQo.js"
	},
	"/assets/AdminUI-DkVJ7dd7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6f4-bybaheyct/IfU5FQ0iTAfeT8Mck\"",
		"mtime": "2026-08-10T08:07:13.459Z",
		"size": 1780,
		"path": "../public/assets/AdminUI-DkVJ7dd7.js"
	},
	"/robots.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"19-yHADZo6lKl+mSNPU9098EiqzPCE\"",
		"mtime": "2026-08-05T16:13:16.073Z",
		"size": 25,
		"path": "../public/robots.txt"
	},
	"/assets/alert-dialog-C5Kx2WOH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e4e-XJtEQdkov7yGaEcwV+Qie7KdG08\"",
		"mtime": "2026-08-10T08:07:13.470Z",
		"size": 3662,
		"path": "../public/assets/alert-dialog-C5Kx2WOH.js"
	},
	"/assets/arrow-right-xOcmp9wA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-IusRR3iuMIPeu+C6dPSa7X8DeS0\"",
		"mtime": "2026-08-10T08:07:13.471Z",
		"size": 153,
		"path": "../public/assets/arrow-right-xOcmp9wA.js"
	},
	"/assets/bike-Bzm1mk3G.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"114-6YtT2vvD+CRNAeUs9VJDPYUIFAU\"",
		"mtime": "2026-08-10T08:07:13.472Z",
		"size": 276,
		"path": "../public/assets/bike-Bzm1mk3G.js"
	},
	"/assets/card-BFzAVi_b.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"439-ExdlNudCWiSc8pdpl4Fm0irjdPQ\"",
		"mtime": "2026-08-10T08:07:13.497Z",
		"size": 1081,
		"path": "../public/assets/card-BFzAVi_b.js"
	},
	"/assets/browser-_bfep-6z.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5cd9-rupb159DZ5zntLdsBT/QbqGaBuA\"",
		"mtime": "2026-08-10T08:07:13.472Z",
		"size": 23769,
		"path": "../public/assets/browser-_bfep-6z.js"
	},
	"/assets/circle-BsmNDFnC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"76-w26m9jE5VW99dINvHbk3nrct29I\"",
		"mtime": "2026-08-10T08:07:13.509Z",
		"size": 118,
		"path": "../public/assets/circle-BsmNDFnC.js"
	},
	"/assets/chevron-right-5vP800zS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"76-cmibWjhNwaLhFMYSUPTq6PDRVpQ\"",
		"mtime": "2026-08-10T08:07:13.501Z",
		"size": 118,
		"path": "../public/assets/chevron-right-5vP800zS.js"
	},
	"/assets/chef-hat-CgUEigNM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"128-CwbILnzCVixy0CIuOHWcnvUc/B8\"",
		"mtime": "2026-08-10T08:07:13.499Z",
		"size": 296,
		"path": "../public/assets/chef-hat-CgUEigNM.js"
	},
	"/assets/clock-hVAygmRl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9d-BLUNwop6n9Mz7gyL6jPb4UyUQ+E\"",
		"mtime": "2026-08-10T08:07:13.513Z",
		"size": 157,
		"path": "../public/assets/clock-hVAygmRl.js"
	},
	"/assets/circle-x-DP966XK6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c3-0wP6w4P6ZS0L4IDHXZbRWlSzHbQ\"",
		"mtime": "2026-08-10T08:07:13.510Z",
		"size": 195,
		"path": "../public/assets/circle-x-DP966XK6.js"
	},
	"/assets/admin.bao-cao-D6S7NaAW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b6ac0-nIBRfRum7EydmNGIY8QpZpiJbhQ\"",
		"mtime": "2026-08-10T08:07:13.462Z",
		"size": 748224,
		"path": "../public/assets/admin.bao-cao-D6S7NaAW.js"
	},
	"/assets/cua-hang-CQk7WZsD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24af-LFNuOxsteFm8c/x2V2cdDOVVsvE\"",
		"mtime": "2026-08-10T08:07:13.514Z",
		"size": 9391,
		"path": "../public/assets/cua-hang-CQk7WZsD.js"
	},
	"/assets/cup-soda-Cn4XYN2_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"135-QpU4xRprBc0LUI+eF34UCVVQPBs\"",
		"mtime": "2026-08-10T08:07:13.515Z",
		"size": 309,
		"path": "../public/assets/cup-soda-Cn4XYN2_.js"
	},
	"/assets/data-CR9wjOxo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"be9d-I149pqJ9PbHD55KFzYBxCaiHVa0\"",
		"mtime": "2026-08-10T08:07:13.515Z",
		"size": 48797,
		"path": "../public/assets/data-CR9wjOxo.js"
	},
	"/assets/dist-Bgoq3Kt5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ef-u5YXTV9TtQIYCanvUrer9wRF3zw\"",
		"mtime": "2026-08-10T08:07:13.524Z",
		"size": 751,
		"path": "../public/assets/dist-Bgoq3Kt5.js"
	},
	"/assets/dist-BXcNqds1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1cc1-1k4YgQbUpf+MLxdcWjQfilrxGMw\"",
		"mtime": "2026-08-10T08:07:13.517Z",
		"size": 7361,
		"path": "../public/assets/dist-BXcNqds1.js"
	},
	"/assets/dist-DMpfotVH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a9-SNrZaxTtv7/TdmDkJ7BcMDiRG5Q\"",
		"mtime": "2026-08-10T08:07:13.527Z",
		"size": 681,
		"path": "../public/assets/dist-DMpfotVH.js"
	},
	"/assets/dist-CMcSEpF5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10aa-5l4HfORGeZZWsQ9J38Y4SDQWUHE\"",
		"mtime": "2026-08-10T08:07:13.526Z",
		"size": 4266,
		"path": "../public/assets/dist-CMcSEpF5.js"
	},
	"/assets/dist-DXQ4x22e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"130a-LNfeJUn2qYdTt1sAwyRTPH/E9h8\"",
		"mtime": "2026-08-10T08:07:13.528Z",
		"size": 4874,
		"path": "../public/assets/dist-DXQ4x22e.js"
	},
	"/assets/dist-DzZ3GmS_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"64a3-hK0ElnRlDYvWPbYYa8HdC8CaRzE\"",
		"mtime": "2026-08-10T08:07:13.529Z",
		"size": 25763,
		"path": "../public/assets/dist-DzZ3GmS_.js"
	},
	"/assets/dist-mEOMHUgE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d55-/9pkdnStIhw7wIK0DbpsZp9LTtc\"",
		"mtime": "2026-08-10T08:07:13.529Z",
		"size": 7509,
		"path": "../public/assets/dist-mEOMHUgE.js"
	},
	"/assets/download-QDMlzli8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc-Miz+IlfN2L7hnoNc0X3qgyV7iFE\"",
		"mtime": "2026-08-10T08:07:13.530Z",
		"size": 220,
		"path": "../public/assets/download-QDMlzli8.js"
	},
	"/assets/es2015-B4sSiKHa.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5895-Ap/0WYNaJW9rWg1pE3+Gu4Ag/vY\"",
		"mtime": "2026-08-10T08:07:13.531Z",
		"size": 22677,
		"path": "../public/assets/es2015-B4sSiKHa.js"
	},
	"/assets/dropdown-menu-DFQ7hnFo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12ca7-OfQkTgmv6CBtAemSg1/DJGTbjdM\"",
		"mtime": "2026-08-10T08:07:13.530Z",
		"size": 76967,
		"path": "../public/assets/dropdown-menu-DFQ7hnFo.js"
	},
	"/assets/gioi-thieu-BYim9Pke.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6e-V/EHfqcgP9N8QBDfv88nwMOLaQc\"",
		"mtime": "2026-08-10T08:07:13.535Z",
		"size": 2670,
		"path": "../public/assets/gioi-thieu-BYim9Pke.js"
	},
	"/assets/ho-so-zpoAQtYE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"29f3-Cs3/+T14Uqlq2/aIOpegrFKFffA\"",
		"mtime": "2026-08-10T08:07:13.541Z",
		"size": 10739,
		"path": "../public/assets/ho-so-zpoAQtYE.js"
	},
	"/assets/InBillModal-DC90ZSmT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a5a-s+z9OU6xzjTY1WKUdOXmxn6anlw\"",
		"mtime": "2026-08-10T08:07:13.460Z",
		"size": 6746,
		"path": "../public/assets/InBillModal-DC90ZSmT.js"
	},
	"/assets/generateCategoricalChart-BkthnArN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a4dc-4Qgdk3josky+UDMHTxcbTQuPS+4\"",
		"mtime": "2026-08-10T08:07:13.531Z",
		"size": 369884,
		"path": "../public/assets/generateCategoricalChart-BkthnArN.js"
	},
	"/assets/jsx-runtime-By8HlURe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b3-IA0XiFuRY0cUsIlFJWjLIFoOPrI\"",
		"mtime": "2026-08-10T08:07:13.549Z",
		"size": 435,
		"path": "../public/assets/jsx-runtime-By8HlURe.js"
	},
	"/assets/html2canvas-BswC5BpG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b8d-Gs4ApUtpd/B+5SV8XeHRaoGcry8\"",
		"mtime": "2026-08-10T08:07:13.542Z",
		"size": 199565,
		"path": "../public/assets/html2canvas-BswC5BpG.js"
	},
	"/assets/label-D1EZqVFN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2d8-J1EAc/+R+Ucb4R2H7eeECeRDr0o\"",
		"mtime": "2026-08-10T08:07:13.549Z",
		"size": 728,
		"path": "../public/assets/label-D1EZqVFN.js"
	},
	"/assets/hero-tea-CnZJmeVT.jpg": {
		"type": "image/jpeg",
		"etag": "\"35ab9-fAn9o0p9bLh0YgurYW9qZK6r9dA\"",
		"mtime": "2026-08-10T08:07:13.735Z",
		"size": 219833,
		"path": "../public/assets/hero-tea-CnZJmeVT.jpg"
	},
	"/assets/index-vh-t_kPv.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3af7-hJRdDJQQrsTdSxJ69xb7a611WZ4\"",
		"mtime": "2026-08-10T08:07:13.736Z",
		"size": 15095,
		"path": "../public/assets/index-vh-t_kPv.css"
	},
	"/assets/index-DmA2FKLP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"598ee-G1XgRMW8tPqS9aLfo1jt53j8CFg\"",
		"mtime": "2026-08-10T08:07:13.459Z",
		"size": 366830,
		"path": "../public/assets/index-DmA2FKLP.js"
	},
	"/assets/index.es-Q_nM81TE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24fb9-n/nY8HTaymaxmUMumGdMznUtc3c\"",
		"mtime": "2026-08-10T08:07:13.542Z",
		"size": 151481,
		"path": "../public/assets/index.es-Q_nM81TE.js"
	},
	"/assets/leaf-D92Y11Sw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fd-C4f2CEHzwmVcI8/Vx8Rt/eTPe4A\"",
		"mtime": "2026-08-10T08:07:13.561Z",
		"size": 253,
		"path": "../public/assets/leaf-D92Y11Sw.js"
	},
	"/assets/loader-circle-ChDeYwDn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"84-cP0WgDGFjTtuMkulzy/ZrC9lG4U\"",
		"mtime": "2026-08-10T08:07:13.600Z",
		"size": 132,
		"path": "../public/assets/loader-circle-ChDeYwDn.js"
	},
	"/assets/link-DHfoYJFr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5b6e-yhei0/IwtpGrZyhwoJDI6kRkcoY\"",
		"mtime": "2026-08-10T08:07:13.600Z",
		"size": 23406,
		"path": "../public/assets/link-DHfoYJFr.js"
	},
	"/assets/leaflet-src-AD9ZoK5_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2455b-mE/M9aQb7obISMbNaGyDSoxgSvc\"",
		"mtime": "2026-08-10T08:07:13.596Z",
		"size": 148827,
		"path": "../public/assets/leaflet-src-AD9ZoK5_.js"
	},
	"/assets/menu-BwCTM4g8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"19ea-g5b+vv52MWBEzR23TXkcZf63YyI\"",
		"mtime": "2026-08-10T08:07:13.601Z",
		"size": 6634,
		"path": "../public/assets/menu-BwCTM4g8.js"
	},
	"/assets/p-dao-vai-GXWXa8My.jpg": {
		"type": "image/jpeg",
		"etag": "\"6eee-xdxTiUSu0HDKMLMoh7byHRN0PvI\"",
		"mtime": "2026-08-10T08:07:13.738Z",
		"size": 28398,
		"path": "../public/assets/p-dao-vai-GXWXa8My.jpg"
	},
	"/assets/p-cam-sa-DfgrSZ0R.jpg": {
		"type": "image/jpeg",
		"etag": "\"59e0-AKBlLB23+cNWo5mDHti3BFNgCKc\"",
		"mtime": "2026-08-10T08:07:13.737Z",
		"size": 23008,
		"path": "../public/assets/p-cam-sa-DfgrSZ0R.jpg"
	},
	"/assets/p-dau-tay-CUKEpxcf.jpg": {
		"type": "image/jpeg",
		"etag": "\"657f-GM/xVISXEG5K+ZZL/a9IfU4s0ZI\"",
		"mtime": "2026-08-10T08:07:13.740Z",
		"size": 25983,
		"path": "../public/assets/p-dau-tay-CUKEpxcf.jpg"
	},
	"/assets/PageHeader-GpKH_LDp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23e-gABu8B7BLpcxt/8Q+g16S+bZbZk\"",
		"mtime": "2026-08-10T08:07:13.460Z",
		"size": 574,
		"path": "../public/assets/PageHeader-GpKH_LDp.js"
	},
	"/assets/p-dua-hau-DL5uHyXj.jpg": {
		"type": "image/jpeg",
		"etag": "\"9d24-0HoBk39hGhxZh5mxKc4swpW/szk\"",
		"mtime": "2026-08-10T08:07:13.742Z",
		"size": 40228,
		"path": "../public/assets/p-dua-hau-DL5uHyXj.jpg"
	},
	"/assets/pencil-BKC0ibmQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"108-1pFu2yGctFjyrvSE0YuHfHT61Ec\"",
		"mtime": "2026-08-10T08:07:13.601Z",
		"size": 264,
		"path": "../public/assets/pencil-BKC0ibmQ.js"
	},
	"/assets/plus-DdxCbsMD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8d-RHgwsHWU1twVPCi/yimM/4kTEjk\"",
		"mtime": "2026-08-10T08:07:13.605Z",
		"size": 141,
		"path": "../public/assets/plus-DdxCbsMD.js"
	},
	"/assets/p-nho-CErz7lW6.jpg": {
		"type": "image/jpeg",
		"etag": "\"9e1e-kR94MRkC3Crm6dUsQPVlU0Hlqs8\"",
		"mtime": "2026-08-10T08:07:13.742Z",
		"size": 40478,
		"path": "../public/assets/p-nho-CErz7lW6.jpg"
	},
	"/assets/p-xoai-BfC_UYuj.jpg": {
		"type": "image/jpeg",
		"etag": "\"49f0-/KQiArwQoq3LaxmPdVtWSdEsadQ\"",
		"mtime": "2026-08-10T08:07:13.743Z",
		"size": 18928,
		"path": "../public/assets/p-xoai-BfC_UYuj.jpg"
	},
	"/assets/ProductCard-DONJ2abi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"620f-ZUrbjFPSxX+zY2Y4gQIyhgLVav8\"",
		"mtime": "2026-08-10T08:07:13.461Z",
		"size": 25103,
		"path": "../public/assets/ProductCard-DONJ2abi.js"
	},
	"/assets/radio-group-aAC_Qj3P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"184f-gSsX2QVk+ZtxGS88MyWwwrVo1Ws\"",
		"mtime": "2026-08-10T08:07:13.607Z",
		"size": 6223,
		"path": "../public/assets/radio-group-aAC_Qj3P.js"
	},
	"/assets/react-dom-CLfoRMMW.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dff-opcypsTHWymQU+ZyWA1/sdM0Kr0\"",
		"mtime": "2026-08-10T08:07:13.607Z",
		"size": 3583,
		"path": "../public/assets/react-dom-CLfoRMMW.js"
	},
	"/assets/purify.es-Bwt4ulIK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6a00-0LDmIFETtaeAWgn0JzNU4gyTehA\"",
		"mtime": "2026-08-10T08:07:13.605Z",
		"size": 27136,
		"path": "../public/assets/purify.es-Bwt4ulIK.js"
	},
	"/assets/redirect-1Dss4sOM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"216-AhfiXwQqYdLrM+uQAOtPHfIddmI\"",
		"mtime": "2026-08-10T08:07:13.607Z",
		"size": 534,
		"path": "../public/assets/redirect-1Dss4sOM.js"
	},
	"/assets/rolldown-runtime-QTnfLwEv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b6-wnqLLSlp3SaE+lbe74bKNe5Rpds\"",
		"mtime": "2026-08-10T08:07:13.607Z",
		"size": 694,
		"path": "../public/assets/rolldown-runtime-QTnfLwEv.js"
	},
	"/assets/routes-BKf260aG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d6c-tziJtnVU88zOh6NyRLgh6TecziA\"",
		"mtime": "2026-08-10T08:07:13.609Z",
		"size": 7532,
		"path": "../public/assets/routes-BKf260aG.js"
	},
	"/assets/shield-check-DFAlqaau.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"134-4yK1r08GZLmcgTK8z//6VlbkgLE\"",
		"mtime": "2026-08-10T08:07:13.609Z",
		"size": 308,
		"path": "../public/assets/shield-check-DFAlqaau.js"
	},
	"/assets/star-D0CCCSbk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1cc-GF/yKnXO40r9VdDb8bAQWVnI+OQ\"",
		"mtime": "2026-08-10T08:07:13.609Z",
		"size": 460,
		"path": "../public/assets/star-D0CCCSbk.js"
	},
	"/assets/store-ud7lyTgY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e6-B7Q0haujAiLxiQ3bRYV8jqfk5k8\"",
		"mtime": "2026-08-10T08:07:13.609Z",
		"size": 486,
		"path": "../public/assets/store-ud7lyTgY.js"
	},
	"/assets/story-CEK2DH46.jpg": {
		"type": "image/jpeg",
		"etag": "\"162b2-AFImYOtq2Ng5nHTZRjVlc39URvw\"",
		"mtime": "2026-08-10T08:07:13.744Z",
		"size": 90802,
		"path": "../public/assets/story-CEK2DH46.jpg"
	},
	"/assets/story-PP6pLy4S.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"32-B7D5CnnrQ3O0OwTrRW0rmolIrxI\"",
		"mtime": "2026-08-10T08:07:13.611Z",
		"size": 50,
		"path": "../public/assets/story-PP6pLy4S.js"
	},
	"/assets/switch-BG_30y_M.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1104-StXv4sGC1AAgwQRvYXDLJ/bfndc\"",
		"mtime": "2026-08-10T08:07:13.617Z",
		"size": 4356,
		"path": "../public/assets/switch-BG_30y_M.js"
	},
	"/assets/table-DMIBqpWD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"697-wXsOAlAOy637cnDNO6IccxElB/g\"",
		"mtime": "2026-08-10T08:07:13.628Z",
		"size": 1687,
		"path": "../public/assets/table-DMIBqpWD.js"
	},
	"/assets/tabs-2iB0wOrp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e21-218nGuMpbvZrvnlLmA6G/1FejuQ\"",
		"mtime": "2026-08-10T08:07:13.632Z",
		"size": 3617,
		"path": "../public/assets/tabs-2iB0wOrp.js"
	},
	"/assets/textarea-aajD0x9F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"232-gipPp3YVfcQacTuGD1fxBOgxp5E\"",
		"mtime": "2026-08-10T08:07:13.637Z",
		"size": 562,
		"path": "../public/assets/textarea-aajD0x9F.js"
	},
	"/assets/styles-BxSi9g7C.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"195b2-5MRQwJApQ70ew6rAJTLKgK1Q/FE\"",
		"mtime": "2026-08-10T08:07:13.745Z",
		"size": 103858,
		"path": "../public/assets/styles-BxSi9g7C.css"
	},
	"/assets/thanh-toan-I9LdTIlm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b15-Wfz9q9kawpjGzHVBTn3jt2KP7GM\"",
		"mtime": "2026-08-10T08:07:13.639Z",
		"size": 11029,
		"path": "../public/assets/thanh-toan-I9LdTIlm.js"
	},
	"/assets/theo-doi-don-BsNSP_7x.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"277f-fEmsoDHVZ3d8aUJBWGa5R5tCfbU\"",
		"mtime": "2026-08-10T08:07:13.641Z",
		"size": 10111,
		"path": "../public/assets/theo-doi-don-BsNSP_7x.js"
	},
	"/assets/ticket-DUY3jz4P.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"135-fLIrSPTJoyEgsm2BU87/Mk6Lyi0\"",
		"mtime": "2026-08-10T08:07:13.642Z",
		"size": 309,
		"path": "../public/assets/ticket-DUY3jz4P.js"
	},
	"/assets/triangle-alert-C6hV8SZ4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"273-NAeiWDWyuDVgBnjeAt9HjCPfUd4\"",
		"mtime": "2026-08-10T08:07:13.650Z",
		"size": 627,
		"path": "../public/assets/triangle-alert-C6hV8SZ4.js"
	},
	"/assets/tuyen-dung-B1vo3ylj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10af-Ewk3prtcCIDaPIgk4ugJtzxKpLA\"",
		"mtime": "2026-08-10T08:07:13.658Z",
		"size": 4271,
		"path": "../public/assets/tuyen-dung-B1vo3ylj.js"
	},
	"/assets/typeof-B5XbjTb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f-yPXEOGyFHb1Ws7OoWyWNEEBz4mQ\"",
		"mtime": "2026-08-10T08:07:13.659Z",
		"size": 271,
		"path": "../public/assets/typeof-B5XbjTb1.js"
	},
	"/assets/upload-B68HLfCJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"da-J6sdoRLl+PW3SMsWWAfpxB6yvfA\"",
		"mtime": "2026-08-10T08:07:13.729Z",
		"size": 218,
		"path": "../public/assets/upload-B68HLfCJ.js"
	},
	"/assets/useMatch--Fl-2zAJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b8-0cxwbb55RpkC1Y80lpGCcwDpFso\"",
		"mtime": "2026-08-10T08:07:13.731Z",
		"size": 696,
		"path": "../public/assets/useMatch--Fl-2zAJ.js"
	},
	"/assets/useRouter-C1gxlJkU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bc-3HoXKTcAdSfosaMraXtIvljuiVo\"",
		"mtime": "2026-08-10T08:07:13.732Z",
		"size": 188,
		"path": "../public/assets/useRouter-C1gxlJkU.js"
	},
	"/assets/x-C09S-mUY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8e-BXYLG/qwrm8vxf4pBctXFUoW59A\"",
		"mtime": "2026-08-10T08:07:13.733Z",
		"size": 142,
		"path": "../public/assets/x-C09S-mUY.js"
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
