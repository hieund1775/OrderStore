export function parseHours(h: string) {
  const m = h.match(/\d{1,2}:\d{2}/g);
  return { open: m?.[0] ?? "07:00", close: m?.[1] ?? "22:00" };
}

function toMinutes(t: string) {
  const [h, min] = t.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(min) ? h * 60 + min : 0;
}

export function isStoreOpen(hours: string, now = new Date()) {
  const { open, close } = parseHours(hours);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = toMinutes(open);
  const closeMin = toMinutes(close);
  return nowMin >= openMin && nowMin <= closeMin;
}