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
	"/assets/admin-data-B0TrbBd1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"178f-QVYiHkeWP/2D2lgYEYC9Nw0BZVk\"",
		"mtime": "2026-08-05T09:27:14.062Z",
		"size": 6031,
		"path": "../public/assets/admin-data-B0TrbBd1.js"
	},
	"/assets/admin-DKWhir7E.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2470-SRgU82evsL3hZMoG4mjKfTaNN8s\"",
		"mtime": "2026-08-05T09:27:14.062Z",
		"size": 9328,
		"path": "../public/assets/admin-DKWhir7E.js"
	},
	"/assets/admin.bao-cao-DpN_7Ghc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8032-UQXMbr2wC9leEqEZR9dYJlaRz2Q\"",
		"mtime": "2026-08-05T09:27:14.062Z",
		"size": 32818,
		"path": "../public/assets/admin.bao-cao-DpN_7Ghc.js"
	},
	"/robots.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"19-yHADZo6lKl+mSNPU9098EiqzPCE\"",
		"mtime": "2026-07-27T16:39:56.106Z",
		"size": 25,
		"path": "../public/robots.txt"
	},
	"/assets/admin.cai-dat-BExjWIDG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a49-oHvGYsvNiQeMPpEG3d7vjf5yLFU\"",
		"mtime": "2026-08-05T09:27:14.065Z",
		"size": 6729,
		"path": "../public/assets/admin.cai-dat-BExjWIDG.js"
	},
	"/assets/admin.bep-QPhSjCx2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"22b3-A2DkO8DKmZYWAzFu5yXp2Z5ER3E\"",
		"mtime": "2026-08-05T09:27:14.064Z",
		"size": 8883,
		"path": "../public/assets/admin.bep-QPhSjCx2.js"
	},
	"/assets/admin.chi-nhanh-Lp4TJdwq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7d3-bByVUWJdxj4Y9xB2orEpcZqpebQ\"",
		"mtime": "2026-08-05T09:27:14.065Z",
		"size": 2003,
		"path": "../public/assets/admin.chi-nhanh-Lp4TJdwq.js"
	},
	"/assets/admin.don-hang-DazAgxHQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"227b-kF1aNQxce2jsou6PqMj0PsEOXqw\"",
		"mtime": "2026-08-05T09:27:14.065Z",
		"size": 8827,
		"path": "../public/assets/admin.don-hang-DazAgxHQ.js"
	},
	"/assets/admin.khuyen-mai-EeeHrx5F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"235a-OHN4z38fubJDu791WlEBR4Hd0PY\"",
		"mtime": "2026-08-05T09:27:14.066Z",
		"size": 9050,
		"path": "../public/assets/admin.khuyen-mai-EeeHrx5F.js"
	},
	"/assets/admin.thong-bao-CkmeATmO.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8b5-11GL3psmqozTy+5J1MQNxAC+6nw\"",
		"mtime": "2026-08-05T09:27:14.067Z",
		"size": 2229,
		"path": "../public/assets/admin.thong-bao-CkmeATmO.js"
	},
	"/assets/admin.index-YpOLSWKr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3a06-0SuxCNCGE6o7lZLazCEhHlBMCkU\"",
		"mtime": "2026-08-05T09:27:14.066Z",
		"size": 14854,
		"path": "../public/assets/admin.index-YpOLSWKr.js"
	},
	"/assets/admin.login-CaRa_5dr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"cb1-0ChqLwKa2oVeTb6lvO1A/iM9xgM\"",
		"mtime": "2026-08-05T09:27:14.067Z",
		"size": 3249,
		"path": "../public/assets/admin.login-CaRa_5dr.js"
	},
	"/assets/AdminUI-C6EoAZuK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6f9-lLZhivF5I1wi5pL3UwTsHLXxa6c\"",
		"mtime": "2026-08-05T09:27:14.060Z",
		"size": 1785,
		"path": "../public/assets/AdminUI-C6EoAZuK.js"
	},
	"/assets/admin.vi-tri-Bskq-kw3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c0d-oQxk2/78gHf+UUEQkYnFm7VVLWM\"",
		"mtime": "2026-08-05T09:27:14.068Z",
		"size": 11277,
		"path": "../public/assets/admin.vi-tri-Bskq-kw3.js"
	},
	"/assets/arrow-right-CYrRtQpw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-Czsuzosp+FoMLM6WZjVFkgYFUsk\"",
		"mtime": "2026-08-05T09:27:14.068Z",
		"size": 153,
		"path": "../public/assets/arrow-right-CYrRtQpw.js"
	},
	"/assets/admin.thuc-don-pywHF-Xl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"179d-TLWuWXNV83VflWf8T6Kmb5B5U+o\"",
		"mtime": "2026-08-05T09:27:14.067Z",
		"size": 6045,
		"path": "../public/assets/admin.thuc-don-pywHF-Xl.js"
	},
	"/assets/browser-45kE1EfX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5cd4-JpTJchUtMLSGJINvzi61qgmAY5s\"",
		"mtime": "2026-08-05T09:27:14.069Z",
		"size": 23764,
		"path": "../public/assets/browser-45kE1EfX.js"
	},
	"/assets/bike-BHpcBTkv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"114-F1chikUL/bZfOBSWN4+9iKtOcSI\"",
		"mtime": "2026-08-05T09:27:14.069Z",
		"size": 276,
		"path": "../public/assets/bike-BHpcBTkv.js"
	},
	"/assets/card-BU3zyden.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"408-Rllx7ybbqQmc1P8NgBXh6IWk8B4\"",
		"mtime": "2026-08-05T09:27:14.070Z",
		"size": 1032,
		"path": "../public/assets/card-BU3zyden.js"
	},
	"/assets/chef-hat-D4oujngB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"128-bwbPd6/jA4fNxqVEME3WN0oyZUg\"",
		"mtime": "2026-08-05T09:27:14.070Z",
		"size": 296,
		"path": "../public/assets/chef-hat-D4oujngB.js"
	},
	"/assets/clock-L-0aQUXT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9d-+03RS49mlfio6eH9udCfMoVwyhU\"",
		"mtime": "2026-08-05T09:27:14.071Z",
		"size": 157,
		"path": "../public/assets/clock-L-0aQUXT.js"
	},
	"/assets/cua-hang-BfUkhnul.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"109a-ANQVawe3JrBF2Y51z99p5MRgfak\"",
		"mtime": "2026-08-05T09:27:14.071Z",
		"size": 4250,
		"path": "../public/assets/cua-hang-BfUkhnul.js"
	},
	"/assets/data-B50EgDTh.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bcfe-RChCB8cqDvQF5dYhngiAo1GdLYY\"",
		"mtime": "2026-08-05T09:27:14.071Z",
		"size": 48382,
		"path": "../public/assets/data-B50EgDTh.js"
	},
	"/assets/dist-7Oc3j3yL.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2be-OgQWGk/3uzuTA6fJrOPqWYHKhzA\"",
		"mtime": "2026-08-05T09:27:14.072Z",
		"size": 702,
		"path": "../public/assets/dist-7Oc3j3yL.js"
	},
	"/assets/dist-BZaJveMw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"111c-1qqH9DZ0RSrbEmR5Lpf4fucZv/0\"",
		"mtime": "2026-08-05T09:27:14.072Z",
		"size": 4380,
		"path": "../public/assets/dist-BZaJveMw.js"
	},
	"/assets/download-DrwiDYhq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dc-B3VB8hihw0/37ihWmxrdBJgW0aE\"",
		"mtime": "2026-08-05T09:27:14.073Z",
		"size": 220,
		"path": "../public/assets/download-DrwiDYhq.js"
	},
	"/assets/dist-CeJ2QF9A.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c92-FI1PvrjrCm9CN4+cB8CppfmF2ow\"",
		"mtime": "2026-08-05T09:27:14.073Z",
		"size": 3218,
		"path": "../public/assets/dist-CeJ2QF9A.js"
	},
	"/assets/gioi-thieu-Cj6r3_3e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6e-Lndq/d9tUhQgzoqHzLIviMJhUa0\"",
		"mtime": "2026-08-05T09:27:14.075Z",
		"size": 2670,
		"path": "../public/assets/gioi-thieu-Cj6r3_3e.js"
	},
	"/assets/ho-so-DhDUT5oV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"22d7-472kqn1uK9ABuwP48ZY3KA7C7IY\"",
		"mtime": "2026-08-05T09:27:14.076Z",
		"size": 8919,
		"path": "../public/assets/ho-so-DhDUT5oV.js"
	},
	"/assets/InBillModal-OPt7s-Rv.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a48-3iheRZqQfllqq1w1pjka3XcWSnQ\"",
		"mtime": "2026-08-05T09:27:14.060Z",
		"size": 6728,
		"path": "../public/assets/InBillModal-OPt7s-Rv.js"
	},
	"/assets/label-DqT9xD6N.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a7-W1mPz7SMj+0dN8uA257jL9QzmT0\"",
		"mtime": "2026-08-05T09:27:14.077Z",
		"size": 679,
		"path": "../public/assets/label-DqT9xD6N.js"
	},
	"/assets/jsx-runtime-DUAcabCT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"42a-6CWT3JsIzkgrrMo5qQ6L1UWEbvM\"",
		"mtime": "2026-08-05T09:27:14.076Z",
		"size": 1066,
		"path": "../public/assets/jsx-runtime-DUAcabCT.js"
	},
	"/assets/leaf-BmL-bvLM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"fd-2G0CGjLDGgV564iT2sT05b/lgv4\"",
		"mtime": "2026-08-05T09:27:14.077Z",
		"size": 253,
		"path": "../public/assets/leaf-BmL-bvLM.js"
	},
	"/assets/generateCategoricalChart-CUq6-9J8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a4d5-qoUtU2IkypScOg6afKAo8+Yr0Ro\"",
		"mtime": "2026-08-05T09:27:14.073Z",
		"size": 369877,
		"path": "../public/assets/generateCategoricalChart-CUq6-9J8.js"
	},
	"/assets/hero-tea-CnZJmeVT.jpg": {
		"type": "image/jpeg",
		"etag": "\"35ab9-fAn9o0p9bLh0YgurYW9qZK6r9dA\"",
		"mtime": "2026-08-05T09:27:14.089Z",
		"size": 219833,
		"path": "../public/assets/hero-tea-CnZJmeVT.jpg"
	},
	"/assets/link-CeQ40v7S.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5b47-w4YgJ7Bv+2Y+/ieLJRiaaHnAuW8\"",
		"mtime": "2026-08-05T09:27:14.077Z",
		"size": 23367,
		"path": "../public/assets/link-CeQ40v7S.js"
	},
	"/assets/loader-circle-C3oYyDal.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"84-sa9O4iXHA0mEHZMDGmRMa1KMP6E\"",
		"mtime": "2026-08-05T09:27:14.078Z",
		"size": 132,
		"path": "../public/assets/loader-circle-C3oYyDal.js"
	},
	"/assets/menu-DAXVRbVQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1531-plVUy/7ddsh5duuGP0WRtfbIoLU\"",
		"mtime": "2026-08-05T09:27:14.078Z",
		"size": 5425,
		"path": "../public/assets/menu-DAXVRbVQ.js"
	},
	"/assets/p-cam-sa-DfgrSZ0R.jpg": {
		"type": "image/jpeg",
		"etag": "\"59e0-AKBlLB23+cNWo5mDHti3BFNgCKc\"",
		"mtime": "2026-08-05T09:27:14.090Z",
		"size": 23008,
		"path": "../public/assets/p-cam-sa-DfgrSZ0R.jpg"
	},
	"/assets/p-dao-vai-GXWXa8My.jpg": {
		"type": "image/jpeg",
		"etag": "\"6eee-xdxTiUSu0HDKMLMoh7byHRN0PvI\"",
		"mtime": "2026-08-05T09:27:14.090Z",
		"size": 28398,
		"path": "../public/assets/p-dao-vai-GXWXa8My.jpg"
	},
	"/assets/p-dua-hau-DL5uHyXj.jpg": {
		"type": "image/jpeg",
		"etag": "\"9d24-0HoBk39hGhxZh5mxKc4swpW/szk\"",
		"mtime": "2026-08-05T09:27:14.091Z",
		"size": 40228,
		"path": "../public/assets/p-dua-hau-DL5uHyXj.jpg"
	},
	"/assets/p-dau-tay-CUKEpxcf.jpg": {
		"type": "image/jpeg",
		"etag": "\"657f-GM/xVISXEG5K+ZZL/a9IfU4s0ZI\"",
		"mtime": "2026-08-05T09:27:14.091Z",
		"size": 25983,
		"path": "../public/assets/p-dau-tay-CUKEpxcf.jpg"
	},
	"/assets/p-nho-CErz7lW6.jpg": {
		"type": "image/jpeg",
		"etag": "\"9e1e-kR94MRkC3Crm6dUsQPVlU0Hlqs8\"",
		"mtime": "2026-08-05T09:27:14.092Z",
		"size": 40478,
		"path": "../public/assets/p-nho-CErz7lW6.jpg"
	},
	"/assets/p-xoai-BfC_UYuj.jpg": {
		"type": "image/jpeg",
		"etag": "\"49f0-/KQiArwQoq3LaxmPdVtWSdEsadQ\"",
		"mtime": "2026-08-05T09:27:14.092Z",
		"size": 18928,
		"path": "../public/assets/p-xoai-BfC_UYuj.jpg"
	},
	"/assets/PageHeader-GIFbw5-q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23e-pNwKHk5NML1Ax8FWy+GdP1OmAl8\"",
		"mtime": "2026-08-05T09:27:14.060Z",
		"size": 574,
		"path": "../public/assets/PageHeader-GIFbw5-q.js"
	},
	"/assets/pencil-BR4HrUj8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"108-3Q2HxyVUM3WCh7gxa4co8G8kH/k\"",
		"mtime": "2026-08-05T09:27:14.079Z",
		"size": 264,
		"path": "../public/assets/pencil-BR4HrUj8.js"
	},
	"/assets/ProductCard-DXoa3QCz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"619f-MTY+IAcOfiYYm3crLaU/1cx/No0\"",
		"mtime": "2026-08-05T09:27:14.061Z",
		"size": 24991,
		"path": "../public/assets/ProductCard-DXoa3QCz.js"
	},
	"/assets/plus-CZKxIY1S.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8d-Oa0TuGkVeZA+/ydXzgYVQOBlKKo\"",
		"mtime": "2026-08-05T09:27:14.079Z",
		"size": 141,
		"path": "../public/assets/plus-CZKxIY1S.js"
	},
	"/assets/index-BgTwecpi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"79124-/iEq9qMwab9PfXbU1itlKUezSp4\"",
		"mtime": "2026-08-05T09:27:14.059Z",
		"size": 495908,
		"path": "../public/assets/index-BgTwecpi.js"
	},
	"/assets/radio-group-CAxSV9L9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"17e3-eY9XOwY6PWxGvwt9KU15UarWNTY\"",
		"mtime": "2026-08-05T09:27:14.080Z",
		"size": 6115,
		"path": "../public/assets/radio-group-CAxSV9L9.js"
	},
	"/assets/react-dom-BDxQlJx7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dfa-T5e0Wflpb+Biuk6mXG8PO/z16R4\"",
		"mtime": "2026-08-05T09:27:14.080Z",
		"size": 3578,
		"path": "../public/assets/react-dom-BDxQlJx7.js"
	},
	"/assets/shield-check-QpD_zliB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"134-u3/bgbIB0UB0I0JrBkqupoGmWLM\"",
		"mtime": "2026-08-05T09:27:14.082Z",
		"size": 308,
		"path": "../public/assets/shield-check-QpD_zliB.js"
	},
	"/assets/routes-BrU4aJty.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d6c-Mm/YSZ+ZcNiXjtz7d9z6r/JwbvE\"",
		"mtime": "2026-08-05T09:27:14.080Z",
		"size": 7532,
		"path": "../public/assets/routes-BrU4aJty.js"
	},
	"/assets/store-Kw7cR3uf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e6-xEBv2/VRoWEYvNui2ADgha+RHiw\"",
		"mtime": "2026-08-05T09:27:14.082Z",
		"size": 486,
		"path": "../public/assets/store-Kw7cR3uf.js"
	},
	"/assets/star-DqkqAU0c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1cc-/unbF/LB4jrSSJ4Cp19DquDARJ0\"",
		"mtime": "2026-08-05T09:27:14.082Z",
		"size": 460,
		"path": "../public/assets/star-DqkqAU0c.js"
	},
	"/assets/story-PP6pLy4S.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"32-B7D5CnnrQ3O0OwTrRW0rmolIrxI\"",
		"mtime": "2026-08-05T09:27:14.083Z",
		"size": 50,
		"path": "../public/assets/story-PP6pLy4S.js"
	},
	"/assets/story-CEK2DH46.jpg": {
		"type": "image/jpeg",
		"etag": "\"162b2-AFImYOtq2Ng5nHTZRjVlc39URvw\"",
		"mtime": "2026-08-05T09:27:14.092Z",
		"size": 90802,
		"path": "../public/assets/story-CEK2DH46.jpg"
	},
	"/assets/switch-xPyZZIlR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10d9-FCoqv/ZKr3C0zR+vb/EDJvMnzSY\"",
		"mtime": "2026-08-05T09:27:14.083Z",
		"size": 4313,
		"path": "../public/assets/switch-xPyZZIlR.js"
	},
	"/assets/table-CjDcpXeq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"666-+ZSSXA5+8OHIznBz+neR7XWfeE8\"",
		"mtime": "2026-08-05T09:27:14.085Z",
		"size": 1638,
		"path": "../public/assets/table-CjDcpXeq.js"
	},
	"/assets/tabs-DdGdeARk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"df6-9gHMFwyPUYua1mEIxX6G/HdizdY\"",
		"mtime": "2026-08-05T09:27:14.085Z",
		"size": 3574,
		"path": "../public/assets/tabs-DdGdeARk.js"
	},
	"/assets/textarea-BBjhH9QD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"201-LwN7xInU4M1wckJXg8N5kvHUTcc\"",
		"mtime": "2026-08-05T09:27:14.086Z",
		"size": 513,
		"path": "../public/assets/textarea-BBjhH9QD.js"
	},
	"/assets/theo-doi-don-mIsfFioq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10f0-AA5Gd0Uzj3Vlb6xyW86hAJomkQY\"",
		"mtime": "2026-08-05T09:27:14.086Z",
		"size": 4336,
		"path": "../public/assets/theo-doi-don-mIsfFioq.js"
	},
	"/assets/ticket-D5wLbj0X.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"135-IEfgptEgR0v3BSpNKUs2iNbH8v8\"",
		"mtime": "2026-08-05T09:27:14.087Z",
		"size": 309,
		"path": "../public/assets/ticket-D5wLbj0X.js"
	},
	"/assets/styles-yK_Vevxt.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"17922-ixWexZEb3uqQDlRGnA0J6M8jhuk\"",
		"mtime": "2026-08-05T09:27:14.093Z",
		"size": 96546,
		"path": "../public/assets/styles-yK_Vevxt.css"
	},
	"/assets/timer-CcIaeEl3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ee-BGqsUr1ARTLMtXnOKN4P7PlWecw\"",
		"mtime": "2026-08-05T09:27:14.087Z",
		"size": 494,
		"path": "../public/assets/timer-CcIaeEl3.js"
	},
	"/assets/thanh-toan-CKbhozuE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"290e-ciB1QcNzkmf/KLA8T9hO1d44sfg\"",
		"mtime": "2026-08-05T09:27:14.086Z",
		"size": 10510,
		"path": "../public/assets/thanh-toan-CKbhozuE.js"
	},
	"/assets/triangle-alert-B608FwJ5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"273-cbISp0FY2XyDH+T/MVqpwGsiGnY\"",
		"mtime": "2026-08-05T09:27:14.087Z",
		"size": 627,
		"path": "../public/assets/triangle-alert-B608FwJ5.js"
	},
	"/assets/tuyen-dung-Djow5yFx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1079-RVWpJSctIhhe7unKYoIoPNZ00uk\"",
		"mtime": "2026-08-05T09:27:14.088Z",
		"size": 4217,
		"path": "../public/assets/tuyen-dung-Djow5yFx.js"
	},
	"/assets/upload-83zfB7N1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"da-ry8NyUx6PsDCTyhzOyFhENjfisA\"",
		"mtime": "2026-08-05T09:27:14.088Z",
		"size": 218,
		"path": "../public/assets/upload-83zfB7N1.js"
	},
	"/assets/useRouter-CWbWvRWu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b7-ui3axPBpwBN2RI4zA88593zjag4\"",
		"mtime": "2026-08-05T09:27:14.089Z",
		"size": 183,
		"path": "../public/assets/useRouter-CWbWvRWu.js"
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
