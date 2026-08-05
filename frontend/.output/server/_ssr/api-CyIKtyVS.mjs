//#region node_modules/.nitro/vite/services/ssr/assets/api-CyIKtyVS.js
var API_URL = "http://localhost:5000";
var TOKEN_KEY = "teaplus_admin_token";
function getToken() {
	if (typeof window === "undefined") return null;
	return window.localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
	window.localStorage.setItem(TOKEN_KEY, token);
}
async function apiFetch(path, options = {}) {
	const headers = {
		"Content-Type": "application/json",
		...options.headers
	};
	const token = getToken();
	if (token) headers.Authorization = `Bearer ${token}`;
	const res = await fetch(`${API_URL}${path}`, {
		...options,
		headers
	});
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		const message = data?.error || data?.message || `Lỗi ${res.status}`;
		throw new ApiError(res.status, message, data);
	}
	return data;
}
var ApiError = class extends Error {
	status;
	data;
	constructor(status, message, data) {
		super(message);
		this.status = status;
		this.data = data;
	}
};
var apiGet = (path) => apiFetch(path);
var apiPost = (path, body) => apiFetch(path, {
	method: "POST",
	body: JSON.stringify(body)
});
var apiPatch = (path, body) => apiFetch(path, {
	method: "PATCH",
	body: JSON.stringify(body)
});
var apiPut = (path, body) => apiFetch(path, {
	method: "PUT",
	body: JSON.stringify(body)
});
var apiDelete = (path) => apiFetch(path, { method: "DELETE" });
//#endregion
export { apiPut as a, apiPost as i, apiGet as n, getToken as o, apiPatch as r, setToken as s, apiDelete as t };
