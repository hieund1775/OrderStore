import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cart-BwPSPLo8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CartContext = (0, import_react.createContext)(null);
function CartProvider({ children }) {
	const [items, setItems] = (0, import_react.useState)([]);
	const [wishlist, setWishlist] = (0, import_react.useState)(["tra-dau-tay"]);
	const value = (0, import_react.useMemo)(() => {
		const count = items.reduce((s, i) => s + i.qty, 0);
		const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
		return {
			items,
			count,
			subtotal,
			wishlist,
			addItem: (item) => setItems((prev) => {
				const key = [
					item.productId,
					item.size,
					item.base,
					item.sugar,
					item.ice,
					item.toppings.join("|")
				].join("__");
				if (prev.find((p) => p.key === key)) return prev.map((p) => p.key === key ? {
					...p,
					qty: p.qty + item.qty
				} : p);
				return [...prev, {
					...item,
					key
				}];
			}),
			removeItem: (key) => setItems((prev) => prev.filter((p) => p.key !== key)),
			setQty: (key, qty) => setItems((prev) => qty <= 0 ? prev.filter((p) => p.key !== key) : prev.map((p) => p.key === key ? {
				...p,
				qty
			} : p)),
			clear: () => setItems([]),
			toggleWishlist: (id) => setWishlist((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])
		};
	}, [items, wishlist]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartContext.Provider, {
		value,
		children
	});
}
function useCart() {
	const ctx = (0, import_react.useContext)(CartContext);
	if (!ctx) throw new Error("useCart must be used inside CartProvider");
	return ctx;
}
//#endregion
export { useCart as n, CartProvider as t };
