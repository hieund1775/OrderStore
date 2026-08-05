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
		"mtime": "2026-07-27T16:39:56.105Z",
		"size": 0,
		"path": "../public/favicon.ico"
	},
	"/assets/admin-Bfjsp5QJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24e2-VHmSQ3OHvucs8WoI9qAiSs+ivkE\"",
		"mtime": "2026-08-05T15:26:32.016Z",
		"size": 9442,
		"path": "../public/assets/admin-Bfjsp5QJ.js"
	},
	"/assets/admin-data-xVmn_gBu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"45a-3NhazCeHHCL3kOaByXpK26fOWok\"",
		"mtime": "2026-08-05T15:26:32.016Z",
		"size": 1114,
		"path": "../public/assets/admin-data-xVmn_gBu.js"
	},
	"/robots.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"19-yHADZo6lKl+mSNPU9098EiqzPCE\"",
		"mtime": "2026-07-27T16:39:56.106Z",
		"size": 25,
		"path": "../public/robots.txt"
	},
	"/assets/admin.don-hang-CbfKsjk3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"34ab-LLaAHjpiwZCdZqYsXEq2tzGFyRE\"",
		"mtime": "2026-08-05T15:26:32.022Z",
		"size": 13483,
		"path": "../public/assets/admin.don-hang-CbfKsjk3.js"
	},
	"/assets/admin.bep-Dk6o1qC4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"22e5-CpNFdDPHvEZX3A8ROu2haMYXy4Y\"",
		"mtime": "2026-08-05T15:26:32.019Z",
		"size": 8933,
		"path": "../public/assets/admin.bep-Dk6o1qC4.js"
	},
	"/assets/admin.chi-nhanh-C8ZNGoma.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"437d-xweL4NncZcKLCXwJFeSd5kH748s\"",
		"mtime": "2026-08-05T15:26:32.021Z",
		"size": 17277,
		"path": "../public/assets/admin.chi-nhanh-C8ZNGoma.js"
	},
	"/assets/admin.cai-dat-BdBBS2M4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e30-yY8jiCnCtFwxQE+anoo+v5nwSpc\"",
		"mtime": "2026-08-05T15:26:32.020Z",
		"size": 7728,
		"path": "../public/assets/admin.cai-dat-BdBBS2M4.js"
	},
	"/assets/admin.index-CizTiC4T.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"40af-hcBHbHzZEy0FUbKzN5uMa5cWQ70\"",
		"mtime": "2026-08-05T15:26:32.022Z",
		"size": 16559,
		"path": "../public/assets/admin.index-CizTiC4T.js"
	},
	"/assets/admin.khuyen-mai-PZq9vGG0.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2397-WoSL2V9efFDTtOmUpSod7YysBkw\"",
		"mtime": "2026-08-05T15:26:32.023Z",
		"size": 9111,
		"path": "../public/assets/admin.khuyen-mai-PZq9vGG0.js"
	},
	"/assets/admin.login-CmTEudjC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c33-ypexyOKAMpr/unPSS88h95lCk14\"",
		"mtime": "2026-08-05T15:26:32.024Z",
		"size": 3123,
		"path": "../public/assets/admin.login-CmTEudjC.js"
	},
	"/assets/admin.thuc-don-DzYTQJxc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"284f-u9bziluADqXboQTDQiukjnK20Ak\"",
		"mtime": "2026-08-05T15:26:32.026Z",
		"size": 10319,
		"path": "../public/assets/admin.thuc-don-DzYTQJxc.js"
	},
	"/assets/admin.thong-bao-HZsqHWDC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b0b-Us+2KhjelA/Lmzg74fOM+9JRpDA\"",
		"mtime": "2026-08-05T15:26:32.024Z",
		"size": 2827,
		"path": "../public/assets/admin.thong-bao-HZsqHWDC.js"
	},
	"/assets/admin.vi-tri-BrcK53u6.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f44-7DN/uTzKH1Zs6+/NSoHaVnN9WYE\"",
		"mtime": "2026-08-05T15:26:32.027Z",
		"size": 8004,
		"path": "../public/assets/admin.vi-tri-BrcK53u6.js"
	},
	"/assets/arrow-right-BUvKrnma.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9b-pbVBLHqFmhhqGKHTuOV6ig/dGOY\"",
		"mtime": "2026-08-05T15:26:32.028Z",
		"size": 155,
		"path": "../public/assets/arrow-right-BUvKrnma.js"
	},
	"/assets/AdminUI-BAwXJWeg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6f6-0PteHXENUEjVMXGVwqTUNb2ypQI\"",
		"mtime": "2026-08-05T15:26:32.006Z",
		"size": 1782,
		"path": "../public/assets/AdminUI-BAwXJWeg.js"
	},
	"/assets/alert-dialog-OvyuW8F_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e46-yyKarUZbQ3yn/STx6ZiuUSkBE7I\"",
		"mtime": "2026-08-05T15:26:32.027Z",
		"size": 3654,
		"path": "../public/assets/alert-dialog-OvyuW8F_.js"
	},
	"/assets/bike-CJ5XM0D-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"116-vxE/ReCBoZOA9X9iS37eXbzeFfQ\"",
		"mtime": "2026-08-05T15:26:32.030Z",
		"size": 278,
		"path": "../public/assets/bike-CJ5XM0D-.js"
	},
	"/assets/browser-DtZcc0fk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5cdb-nGHlfeIGf2dJ26/wuJ1+0Aoz47c\"",
		"mtime": "2026-08-05T15:26:32.030Z",
		"size": 23771,
		"path": "../public/assets/browser-DtZcc0fk.js"
	},
	"/assets/button-ZXrziPDy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9f91-L2DeyaRR826EHyNgKcc4kLi0fUk\"",
		"mtime": "2026-08-05T15:26:32.031Z",
		"size": 40849,
		"path": "../public/assets/button-ZXrziPDy.js"
	},
	"/assets/card-DSODHHR1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"43b-GVmd+xy0n6O/ieWAPUCgDZjFXoQ\"",
		"mtime": "2026-08-05T15:26:32.031Z",
		"size": 1083,
		"path": "../public/assets/card-DSODHHR1.js"
	},
	"/assets/chevron-right-nMPsonTR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"78-SPDbikshnvXnynFnpxPwA/fF3NE\"",
		"mtime": "2026-08-05T15:26:32.034Z",
		"size": 120,
		"path": "../public/assets/chevron-right-nMPsonTR.js"
	},
	"/assets/chef-hat-BzsPycDN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12a-NW5+amITqv2Y18/JB4FCRhPF2Zk\"",
		"mtime": "2026-08-05T15:26:32.033Z",
		"size": 298,
		"path": "../public/assets/chef-hat-BzsPycDN.js"
	},
	"/assets/check-VE3FbcFH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"72-35UhJ49nFOCqKN7+RTWNvCwepVo\"",
		"mtime": "2026-08-05T15:26:32.033Z",
		"size": 114,
		"path": "../public/assets/check-VE3FbcFH.js"
	},
	"/assets/admin.bao-cao-B2dX3Lpm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b6ac2-XrueBXGHMtZOhtEZ8itS66NeTg8\"",
		"mtime": "2026-08-05T15:26:32.018Z",
		"size": 748226,
		"path": "../public/assets/admin.bao-cao-B2dX3Lpm.js"
	},
	"/assets/circle-BDzs9PeI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"78-Y0GZ94lln8oM5MF5j9YrMV4pAdQ\"",
		"mtime": "2026-08-05T15:26:32.034Z",
		"size": 120,
		"path": "../public/assets/circle-BDzs9PeI.js"
	},
	"/assets/circle-x-C_Ww6CZD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c5-w/0erjVFBvL4b+HVFas8qFo21eU\"",
		"mtime": "2026-08-05T15:26:32.035Z",
		"size": 197,
		"path": "../public/assets/circle-x-C_Ww6CZD.js"
	},
	"/assets/clock-Bzo8EPvD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9f-cShMgoBw3gpjbXz3QTWOvjqis8M\"",
		"mtime": "2026-08-05T15:26:32.036Z",
		"size": 159,
		"path": "../public/assets/clock-Bzo8EPvD.js"
	},
	"/assets/cua-hang-8LsOtoYk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2540-v/OBz+h1OYm8AxwPp0VGoAS5QWs\"",
		"mtime": "2026-08-05T15:26:32.036Z",
		"size": 9536,
		"path": "../public/assets/cua-hang-8LsOtoYk.js"
	},
	"/assets/cup-soda-NM2HYDEz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"137-gH0n+HbOhIQeg3ARRpnAJTCoG6w\"",
		"mtime": "2026-08-05T15:26:32.037Z",
		"size": 311,
		"path": "../public/assets/cup-soda-NM2HYDEz.js"
	},
	"/assets/dist-B8WVr20-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"64a5-+P3jUUItXc5pwg9Bu+etkuLMxtA\"",
		"mtime": "2026-08-05T15:26:32.038Z",
		"size": 25765,
		"path": "../public/assets/dist-B8WVr20-.js"
	},
	"/assets/dist-BAdZ12BI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d57-6wF4+alwXtYnTBV2DGhs00akKLw\"",
		"mtime": "2026-08-05T15:26:32.039Z",
		"size": 7511,
		"path": "../public/assets/dist-BAdZ12BI.js"
	},
	"/assets/dist-BTMevNpK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2f1-JIZEJeibdKtbLTxxdDewGsxIt0g\"",
		"mtime": "2026-08-05T15:26:32.040Z",
		"size": 753,
		"path": "../public/assets/dist-BTMevNpK.js"
	},
	"/assets/dist-CAxVc-MT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1cc3-91l1wbd7ZQQz6AXR3wPaEWhtDWg\"",
		"mtime": "2026-08-05T15:26:32.041Z",
		"size": 7363,
		"path": "../public/assets/dist-CAxVc-MT.js"
	},
	"/assets/dist-DnOImGU7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ab-i6eaWrSBDIXdv7DqRlokxylYKoo\"",
		"mtime": "2026-08-05T15:26:32.042Z",
		"size": 683,
		"path": "../public/assets/dist-DnOImGU7.js"
	},
	"/assets/dist-DYc_tYwr2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10ac-fWLIw2KvbcLIiqWalPt89rfTzp0\"",
		"mtime": "2026-08-05T15:26:32.041Z",
		"size": 4268,
		"path": "../public/assets/dist-DYc_tYwr2.js"
	},
	"/assets/dist-zCakQl13.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"130c-dPW65qGOTq7t04dRsEj5lb1sA/4\"",
		"mtime": "2026-08-05T15:26:32.045Z",
		"size": 4876,
		"path": "../public/assets/dist-zCakQl13.js"
	},
	"/assets/download-BOPGi5Iu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"de-PdOIri13UoPz0dlAjJUW2gP5JXU\"",
		"mtime": "2026-08-05T15:26:32.046Z",
		"size": 222,
		"path": "../public/assets/download-BOPGi5Iu.js"
	},
	"/assets/dropdown-menu-BqeoJ8vc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"12ccb-2wK/HXDi0kZkNowfQJFlbfIB54s\"",
		"mtime": "2026-08-05T15:26:32.047Z",
		"size": 77003,
		"path": "../public/assets/dropdown-menu-BqeoJ8vc.js"
	},
	"/assets/es2015-DCgWZHAS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5840-AqKUXrwmyd119FbFlucz5RLyDAQ\"",
		"mtime": "2026-08-05T15:26:32.048Z",
		"size": 22592,
		"path": "../public/assets/es2015-DCgWZHAS.js"
	},
	"/assets/gioi-thieu-BYim9Pke.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6e-V/EHfqcgP9N8QBDfv88nwMOLaQc\"",
		"mtime": "2026-08-05T15:26:32.049Z",
		"size": 2670,
		"path": "../public/assets/gioi-thieu-BYim9Pke.js"
	},
	"/assets/ho-so-t50T6KAN.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2303-SUrSUcWXSps17UkVHH3zceI1v0E\"",
		"mtime": "2026-08-05T15:26:32.050Z",
		"size": 8963,
		"path": "../public/assets/ho-so-t50T6KAN.js"
	},
	"/assets/InBillModal-DLLKGI6Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a98-qVCC3vi7DSYnvcGGT1MnOZxPhXk\"",
		"mtime": "2026-08-05T15:26:32.006Z",
		"size": 6808,
		"path": "../public/assets/InBillModal-DLLKGI6Q.js"
	},
	"/assets/hero-tea-CnZJmeVT.jpg": {
		"type": "image/jpeg",
		"etag": "\"35ab9-fAn9o0p9bLh0YgurYW9qZK6r9dA\"",
		"mtime": "2026-08-05T15:26:32.086Z",
		"size": 219833,
		"path": "../public/assets/hero-tea-CnZJmeVT.jpg"
	},
	"/assets/index-vh-t_kPv.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"3af7-hJRdDJQQrsTdSxJ69xb7a611WZ4\"",
		"mtime": "2026-08-05T15:26:32.087Z",
		"size": 15095,
		"path": "../public/assets/index-vh-t_kPv.css"
	},
	"/assets/html2canvas-BswC5BpG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b8d-Gs4ApUtpd/B+5SV8XeHRaoGcry8\"",
		"mtime": "2026-08-05T15:26:32.051Z",
		"size": 199565,
		"path": "../public/assets/html2canvas-BswC5BpG.js"
	},
	"/assets/generateCategoricalChart-D1_EuOus.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a4de-xnht7vDSNkxxLATe+pIxC7iaIDs\"",
		"mtime": "2026-08-05T15:26:32.048Z",
		"size": 369886,
		"path": "../public/assets/generateCategoricalChart-D1_EuOus.js"
	},
	"/assets/index.es-Q_nM81TE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24fb9-n/nY8HTaymaxmUMumGdMznUtc3c\"",
		"mtime": "2026-08-05T15:26:32.053Z",
		"size": 151481,
		"path": "../public/assets/index.es-Q_nM81TE.js"
	},
	"/assets/index-Bj2wN2Vm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"58b49-9bFAWM5itjLIMw5JnlobIOXOYMA\"",
		"mtime": "2026-08-05T15:26:32.005Z",
		"size": 363337,
		"path": "../public/assets/index-Bj2wN2Vm.js"
	},
	"/assets/jsx-runtime-By8HlURe.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b3-IA0XiFuRY0cUsIlFJWjLIFoOPrI\"",
		"mtime": "2026-08-05T15:26:32.054Z",
		"size": 435,
		"path": "../public/assets/jsx-runtime-By8HlURe.js"
	},
	"/assets/label-yMssT5pM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2d5-RE5OOs8t30+ZvKbpDh/7LGjAJqw\"",
		"mtime": "2026-08-05T15:26:32.055Z",
		"size": 725,
		"path": "../public/assets/label-yMssT5pM.js"
	},
	"/assets/leaf-tUSGAPpD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ff-KGMqNO/uGF0FRwbmX0fImekEquQ\"",
		"mtime": "2026-08-05T15:26:32.055Z",
		"size": 255,
		"path": "../public/assets/leaf-tUSGAPpD.js"
	},
	"/assets/link-CrFEYmeg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5b70-JHE9TB45Wwe7Do9G4xpTgs7gxCQ\"",
		"mtime": "2026-08-05T15:26:32.058Z",
		"size": 23408,
		"path": "../public/assets/link-CrFEYmeg.js"
	},
	"/assets/leaflet-src-AD9ZoK5_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2455b-mE/M9aQb7obISMbNaGyDSoxgSvc\"",
		"mtime": "2026-08-05T15:26:32.056Z",
		"size": 148827,
		"path": "../public/assets/leaflet-src-AD9ZoK5_.js"
	},
	"/assets/loader-circle-yg7Wz1u1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86-cnFcJtsaA5bej6sS/eWWK+UXy7Y\"",
		"mtime": "2026-08-05T15:26:32.059Z",
		"size": 134,
		"path": "../public/assets/loader-circle-yg7Wz1u1.js"
	},
	"/assets/menu-CoDcGlvK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1584-eLa4E/hMI0M1BniFgNFGiTIagok\"",
		"mtime": "2026-08-05T15:26:32.059Z",
		"size": 5508,
		"path": "../public/assets/menu-CoDcGlvK.js"
	},
	"/assets/p-dao-vai-GXWXa8My.jpg": {
		"type": "image/jpeg",
		"etag": "\"6eee-xdxTiUSu0HDKMLMoh7byHRN0PvI\"",
		"mtime": "2026-08-05T15:26:32.089Z",
		"size": 28398,
		"path": "../public/assets/p-dao-vai-GXWXa8My.jpg"
	},
	"/assets/p-cam-sa-DfgrSZ0R.jpg": {
		"type": "image/jpeg",
		"etag": "\"59e0-AKBlLB23+cNWo5mDHti3BFNgCKc\"",
		"mtime": "2026-08-05T15:26:32.088Z",
		"size": 23008,
		"path": "../public/assets/p-cam-sa-DfgrSZ0R.jpg"
	},
	"/assets/p-dau-tay-CUKEpxcf.jpg": {
		"type": "image/jpeg",
		"etag": "\"657f-GM/xVISXEG5K+ZZL/a9IfU4s0ZI\"",
		"mtime": "2026-08-05T15:26:32.090Z",
		"size": 25983,
		"path": "../public/assets/p-dau-tay-CUKEpxcf.jpg"
	},
	"/assets/p-dua-hau-DL5uHyXj.jpg": {
		"type": "image/jpeg",
		"etag": "\"9d24-0HoBk39hGhxZh5mxKc4swpW/szk\"",
		"mtime": "2026-08-05T15:26:32.091Z",
		"size": 40228,
		"path": "../public/assets/p-dua-hau-DL5uHyXj.jpg"
	},
	"/assets/p-xoai-BfC_UYuj.jpg": {
		"type": "image/jpeg",
		"etag": "\"49f0-/KQiArwQoq3LaxmPdVtWSdEsadQ\"",
		"mtime": "2026-08-05T15:26:32.092Z",
		"size": 18928,
		"path": "../public/assets/p-xoai-BfC_UYuj.jpg"
	},
	"/assets/p-nho-CErz7lW6.jpg": {
		"type": "image/jpeg",
		"etag": "\"9e1e-kR94MRkC3Crm6dUsQPVlU0Hlqs8\"",
		"mtime": "2026-08-05T15:26:32.092Z",
		"size": 40478,
		"path": "../public/assets/p-nho-CErz7lW6.jpg"
	},
	"/assets/PageHeader-GpKH_LDp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23e-gABu8B7BLpcxt/8Q+g16S+bZbZk\"",
		"mtime": "2026-08-05T15:26:32.008Z",
		"size": 574,
		"path": "../public/assets/PageHeader-GpKH_LDp.js"
	},
	"/assets/pencil-DE4wsxto.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10a-wyRYxsb7jSU1scLCRe7QD5nrWiM\"",
		"mtime": "2026-08-05T15:26:32.060Z",
		"size": 266,
		"path": "../public/assets/pencil-DE4wsxto.js"
	},
	"/assets/plus-4qfCqOf-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8f-7smBvwcOlL5aRri///qvnCKQ6yA\"",
		"mtime": "2026-08-05T15:26:32.061Z",
		"size": 143,
		"path": "../public/assets/plus-4qfCqOf-.js"
	},
	"/assets/ProductCard-BnOibNEE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"620f-5swpLBdLX20I7vjDfkRhh50ljZY\"",
		"mtime": "2026-08-05T15:26:32.009Z",
		"size": 25103,
		"path": "../public/assets/ProductCard-BnOibNEE.js"
	},
	"/assets/purify.es-Bwt4ulIK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6a00-0LDmIFETtaeAWgn0JzNU4gyTehA\"",
		"mtime": "2026-08-05T15:26:32.061Z",
		"size": 27136,
		"path": "../public/assets/purify.es-Bwt4ulIK.js"
	},
	"/assets/radio-group-woo_RXGv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1852-fZec/AP3SUPixBo8ra/U1OXlRWY\"",
		"mtime": "2026-08-05T15:26:32.063Z",
		"size": 6226,
		"path": "../public/assets/radio-group-woo_RXGv.js"
	},
	"/assets/react-dom-iO_URkTX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e01-V5UFnCAmy0HV/7ryw6V8KbUw+g0\"",
		"mtime": "2026-08-05T15:26:32.064Z",
		"size": 3585,
		"path": "../public/assets/react-dom-iO_URkTX.js"
	},
	"/assets/redirect-1Dss4sOM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"216-AhfiXwQqYdLrM+uQAOtPHfIddmI\"",
		"mtime": "2026-08-05T15:26:32.065Z",
		"size": 534,
		"path": "../public/assets/redirect-1Dss4sOM.js"
	},
	"/assets/rolldown-runtime-QTnfLwEv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b6-wnqLLSlp3SaE+lbe74bKNe5Rpds\"",
		"mtime": "2026-08-05T15:26:32.066Z",
		"size": 694,
		"path": "../public/assets/rolldown-runtime-QTnfLwEv.js"
	},
	"/assets/routes-CVVUIxjg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d69-MJ2CTIXY5cW/azZa7LRbAGNV318\"",
		"mtime": "2026-08-05T15:26:32.066Z",
		"size": 7529,
		"path": "../public/assets/routes-CVVUIxjg.js"
	},
	"/assets/shield-check-CtMm5Xey.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"136-wWtmXWhyipQUqQMffX/ffu+5syE\"",
		"mtime": "2026-08-05T15:26:32.067Z",
		"size": 310,
		"path": "../public/assets/shield-check-CtMm5Xey.js"
	},
	"/assets/star-Ch7rniDj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ce-VDwjj5NNAaZQ4KKztpvXmEJYhmM\"",
		"mtime": "2026-08-05T15:26:32.068Z",
		"size": 462,
		"path": "../public/assets/star-Ch7rniDj.js"
	},
	"/assets/store-Dd-eZ1Rx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e8-jQdHKZX9JEtcXAHWwYEoZe5fRtM\"",
		"mtime": "2026-08-05T15:26:32.069Z",
		"size": 488,
		"path": "../public/assets/store-Dd-eZ1Rx.js"
	},
	"/assets/store-hours-D4lvO5fM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"151-hUoEqlEubFTQnQQeiARIsjnr+J8\"",
		"mtime": "2026-08-05T15:26:32.070Z",
		"size": 337,
		"path": "../public/assets/store-hours-D4lvO5fM.js"
	},
	"/assets/story-CEK2DH46.jpg": {
		"type": "image/jpeg",
		"etag": "\"162b2-AFImYOtq2Ng5nHTZRjVlc39URvw\"",
		"mtime": "2026-08-05T15:26:32.093Z",
		"size": 90802,
		"path": "../public/assets/story-CEK2DH46.jpg"
	},
	"/assets/story-PP6pLy4S.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"32-B7D5CnnrQ3O0OwTrRW0rmolIrxI\"",
		"mtime": "2026-08-05T15:26:32.070Z",
		"size": 50,
		"path": "../public/assets/story-PP6pLy4S.js"
	},
	"/assets/switch-XkF0RxyM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1106-VKVNXRm9xS4rYcO7ER8DPQlqrI0\"",
		"mtime": "2026-08-05T15:26:32.071Z",
		"size": 4358,
		"path": "../public/assets/switch-XkF0RxyM.js"
	},
	"/assets/table-DvoqI-qf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"699-D3oyAG0REnC2oGvZSJbpCwBoWCU\"",
		"mtime": "2026-08-05T15:26:32.072Z",
		"size": 1689,
		"path": "../public/assets/table-DvoqI-qf.js"
	},
	"/assets/styles-CTwUXTk1.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"17dc4-Klpp3rOQVXtqhtRwmW3SrRCoQ78\"",
		"mtime": "2026-08-05T15:26:32.095Z",
		"size": 97732,
		"path": "../public/assets/styles-CTwUXTk1.css"
	},
	"/assets/tabs-DPGThjpf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e24-lRoKVoVjvE0lLQ0p54OYXkGNOeE\"",
		"mtime": "2026-08-05T15:26:32.073Z",
		"size": 3620,
		"path": "../public/assets/tabs-DPGThjpf.js"
	},
	"/assets/textarea-Bbmdy3ky.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"234-e50VT3+WdAk1pHLsr/vu5asJyc4\"",
		"mtime": "2026-08-05T15:26:32.074Z",
		"size": 564,
		"path": "../public/assets/textarea-Bbmdy3ky.js"
	},
	"/assets/thanh-toan-DofSDfOQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b1c-UybIZj2MaKOmhPfVU46P79ZlmhU\"",
		"mtime": "2026-08-05T15:26:32.076Z",
		"size": 11036,
		"path": "../public/assets/thanh-toan-DofSDfOQ.js"
	},
	"/assets/theo-doi-don-DYHgR0m1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"25e6-bIPk9nF41WDlGNaI4DlGipCV5sM\"",
		"mtime": "2026-08-05T15:26:32.077Z",
		"size": 9702,
		"path": "../public/assets/theo-doi-don-DYHgR0m1.js"
	},
	"/assets/ticket-BjJLCX5V.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"137-m7UKxPnra10SrwCCnOdmmW7WOlM\"",
		"mtime": "2026-08-05T15:26:32.078Z",
		"size": 311,
		"path": "../public/assets/ticket-BjJLCX5V.js"
	},
	"/assets/triangle-alert-3fb2YlCy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"275-XqwcHTy3jyRM+kSpEnJeQwUDuw0\"",
		"mtime": "2026-08-05T15:26:32.080Z",
		"size": 629,
		"path": "../public/assets/triangle-alert-3fb2YlCy.js"
	},
	"/assets/tuyen-dung-CBFBoklH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10b1-XlfW3hMeAH6gKwf+APnsycI0HzM\"",
		"mtime": "2026-08-05T15:26:32.081Z",
		"size": 4273,
		"path": "../public/assets/tuyen-dung-CBFBoklH.js"
	},
	"/assets/typeof-B5XbjTb1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f-yPXEOGyFHb1Ws7OoWyWNEEBz4mQ\"",
		"mtime": "2026-08-05T15:26:32.082Z",
		"size": 271,
		"path": "../public/assets/typeof-B5XbjTb1.js"
	},
	"/assets/useRouter-DbA1Oj9h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"be-f0+JgPx30kLVvwJzwUKv5SUUHZI\"",
		"mtime": "2026-08-05T15:26:32.084Z",
		"size": 190,
		"path": "../public/assets/useRouter-DbA1Oj9h.js"
	},
	"/assets/useMatch-BjV2uhKh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2ba-Vk9tKp/hB6SERiAwC6xnra4OoCg\"",
		"mtime": "2026-08-05T15:26:32.083Z",
		"size": 698,
		"path": "../public/assets/useMatch-BjV2uhKh.js"
	},
	"/assets/upload-phCcoW6j.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc-CDzrgR1LN3B0fdsIUHGgAhzzMRE\"",
		"mtime": "2026-08-05T15:26:32.082Z",
		"size": 220,
		"path": "../public/assets/upload-phCcoW6j.js"
	},
	"/assets/x-KFw41sMv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"90-noJrPq/7QTg+4k1ro3o+qBF8iUI\"",
		"mtime": "2026-08-05T15:26:32.084Z",
		"size": 144,
		"path": "../public/assets/x-KFw41sMv.js"
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
