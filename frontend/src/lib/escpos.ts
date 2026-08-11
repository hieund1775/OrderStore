// ESC/POS printer command builder + Vietnamese (CP1258) text encoding.
// Dùng cho in nhiệt qua Bluetooth BLE (và các phương thức gửi byte thô sau này).

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// CP1258 (Windows-1258) — bảng mã tiếng Việt
// CP1258 mã hoá chữ Việt có dấu bằng chữ cái gốc + dấu thanh dạng combining mark:
//   huyền 0xCC, hỏi 0xD2, ngã 0xDE, sắc 0xEC, nặng 0xF2
const CP1258: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
  0x00a0: 0xa0,
  0x00a1: 0xa1,
  0x00a2: 0xa2,
  0x00a3: 0xa3,
  0x00a4: 0xa4,
  0x00a5: 0xa5,
  0x00a6: 0xa6,
  0x00a7: 0xa7,
  0x00a8: 0xa8,
  0x00a9: 0xa9,
  0x00aa: 0xaa,
  0x00ab: 0xab,
  0x00ac: 0xac,
  0x00ad: 0xad,
  0x00ae: 0xae,
  0x00af: 0xaf,
  0x00b0: 0xb0,
  0x00b1: 0xb1,
  0x00b2: 0xb2,
  0x00b3: 0xb3,
  0x00b4: 0xb4,
  0x00b5: 0xb5,
  0x00b6: 0xb6,
  0x00b7: 0xb7,
  0x00b8: 0xb8,
  0x00b9: 0xb9,
  0x00ba: 0xba,
  0x00bb: 0xbb,
  0x00bc: 0xbc,
  0x00bd: 0xbd,
  0x00be: 0xbe,
  0x00bf: 0xbf,
  0x00c0: 0xc0, // À
  0x00c1: 0xc1, // Á
  0x00c2: 0xc2, // Â
  0x0102: 0xc3, // Ă
  0x00c4: 0xc4, // Ä
  0x00c5: 0xc5, // Å
  0x00c6: 0xc6, // Æ
  0x00c7: 0xc7, // Ç
  0x00c8: 0xc8, // È
  0x00c9: 0xc9, // É
  0x00ca: 0xca, // Ê
  0x00cb: 0xcb, // Ë
  0x0300: 0xcc, // combining grave (huyền)
  0x00cd: 0xcd, // Í
  0x00ce: 0xce, // Î
  0x00cf: 0xcf, // Ï
  0x0110: 0xd0, // Đ
  0x00d1: 0xd1, // Ñ
  0x0309: 0xd2, // combining hook above (hỏi)
  0x00d3: 0xd3, // Ó
  0x00d4: 0xd4, // Ô
  0x01a0: 0xd5, // Ơ
  0x00d6: 0xd6, // Ö
  0x00d7: 0xd7, // ×
  0x00d8: 0xd8, // Ø
  0x00d9: 0xd9, // Ù
  0x00da: 0xda, // Ú
  0x00db: 0xdb, // Û
  0x00dc: 0xdc, // Ü
  0x01af: 0xdd, // Ư
  0x0303: 0xde, // combining tilde (ngã)
  0x00df: 0xdf, // ß
  0x00e0: 0xe0, // à
  0x00e1: 0xe1, // á
  0x00e2: 0xe2, // â
  0x0103: 0xe3, // ă
  0x00e4: 0xe4, // ä
  0x00e5: 0xe5, // å
  0x00e6: 0xe6, // æ
  0x00e7: 0xe7, // ç
  0x00e8: 0xe8, // è
  0x00e9: 0xe9, // é
  0x00ea: 0xea, // ê
  0x00eb: 0xeb, // ë
  0x0301: 0xec, // combining acute (sắc)
  0x00ed: 0xed, // í
  0x00ee: 0xee, // î
  0x00ef: 0xef, // ï
  0x0111: 0xf0, // đ
  0x00f1: 0xf1, // ñ
  0x0323: 0xf2, // combining dot below (nặng)
  0x00f3: 0xf3, // ó
  0x00f4: 0xf4, // ô
  0x01a1: 0xf5, // ơ
  0x00f6: 0xf6, // ö
  0x00f7: 0xf7, // ÷
  0x00f8: 0xf8, // ø
  0x00f9: 0xf9, // ù
  0x00fa: 0xfa, // ú
  0x00fb: 0xfb, // û
  0x00fc: 0xfc, // ü
  0x01b0: 0xfd, // ư
  0x20ab: 0xfe, // ₫
  0x00ff: 0xff, // ÿ
};

export type EscPosEncoding = "cp1258" | "ascii";

export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tryDecomposeAndEncode(cp: number, out: number[]): boolean {
  const decomposed = String.fromCodePoint(cp).normalize("NFD");
  const tmp: number[] = [];
  for (const part of Array.from(decomposed)) {
    const p = part.codePointAt(0)!;
    const mapped = CP1258[p];
    if (mapped !== undefined) tmp.push(mapped);
    else if (p < 0x80) tmp.push(p);
    else if (p >= 0x300 && p <= 0x36f) continue; // dấu không có trong CP1258 → bỏ
    else return false;
  }
  out.push(...tmp);
  return true;
}

export function encodeCP1258(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0)!;
    const direct = CP1258[cp];
    if (direct !== undefined) {
      out.push(direct);
      continue;
    }
    if (cp < 0x80) {
      out.push(cp);
      continue;
    }
    if (cp <= 0x24f && tryDecomposeAndEncode(cp, out)) continue;
    if (cp >= 0x300 && cp <= 0x36f) continue;
    out.push(0x3f); // fallback '?'
  }
  return new Uint8Array(out);
}

export function encodeText(text: string, encoding: EscPosEncoding): Uint8Array {
  return encoding === "ascii" ? new TextEncoder().encode(stripDiacritics(text)) : encodeCP1258(text);
}

// ── ESC/POS commands ─────────────────────────────────────────────────────────

export type EscPosLine = {
  text: string;
  bold?: boolean;
  center?: boolean;
  double?: boolean;
};

function initPrinter(): Uint8Array {
  return new Uint8Array([ESC, 0x40]); // ESC @
}

function feedAndCut(lineCount = 4): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < lineCount; i++) out.push(LF);
  out.push(GS, 0x56, 0x42, 0x00); // full cut
  return new Uint8Array(out);
}

export function buildEscPosDocument(lines: EscPosLine[], encoding: EscPosEncoding = "cp1258"): Uint8Array {
  const out: number[] = [];
  out.push(...initPrinter());
  for (const line of lines) {
    if (line.bold) out.push(ESC, 0x45, 0x01);
    if (line.double) out.push(GS, 0x21, 0x11); // double width + height
    if (line.center) out.push(ESC, 0x61, 0x01);
    out.push(...encodeText(line.text, encoding));
    out.push(LF);
    if (line.center) out.push(ESC, 0x61, 0x00);
    if (line.bold) out.push(ESC, 0x45, 0x00);
    if (line.double) out.push(GS, 0x21, 0x00);
  }
  out.push(...feedAndCut());
  return new Uint8Array(out);
}

// ── Kitchen ticket builder (giống generateReceiptHtml nhưng dạng ESC/POS) ───

export function buildKitchenTicketEscPos(order: any, encoding: EscPosEncoding = "cp1258"): Uint8Array {
  const items = Array.isArray(order.items) ? order.items : [];
  const storeName = order.store_name || "Trà Trái Cây Tô";
  const orderCode = order.order_code || "TP123456";
  const orderType = order.order_type || "Take-away";
  const locationName = order.location_name || (order.table_id ? `Bàn ${order.table_id}` : null);
  const customerName = order.customer_name || "Khách hàng";
  const customerPhone = order.customer_phone || "";
  const deliveryAddr = order.delivery_addr || "";
  const createdAt = order.created_at || new Date().toISOString();
  const total = order.total || order.subtotal || 0;

  const lines: EscPosLine[] = [
    { text: "TEAPLUS - KITCHEN TICKET", center: true, bold: true, double: true },
    { text: storeName, center: true },
    { text: `MÃ ĐƠN: ${orderCode}`, center: true, bold: true },
    { text: "" },
    { text: `Thời gian: ${createdAt}` },
    { text: `Hình thức: ${orderType}` },
  ];
  if (locationName) lines.push({ text: `Vị trí bàn: ${locationName}` });
  lines.push({ text: `Khách hàng: ${customerName}${customerPhone ? ` (${customerPhone})` : ""}` });
  if (deliveryAddr) lines.push({ text: `Địa chỉ: ${deliveryAddr}` });
  lines.push({ text: "" });

  for (const it of items) {
    const name = it.product_name || it.name || "Món";
    const qty = it.qty || 1;
    lines.push({ text: `${qty}× ${name}`, bold: true });
    const opts: string[] = [];
    if (it.size_label || it.size) opts.push(`Size ${it.size_label || it.size}`);
    if (it.sugar_level) opts.push(`${it.sugar_level} đường`);
    if (it.ice_level) opts.push(`${it.ice_level} đá`);
    if (opts.length) lines.push({ text: `  ${opts.join(" · ")}` });
    if (Array.isArray(it.toppings) && it.toppings.length > 0) {
      const tops = it.toppings.map((t: any) => (typeof t === "string" ? t : t.name)).join(", ");
      lines.push({ text: `  + ${tops}` });
    }
    if (it.note) lines.push({ text: `  Ghi chú: ${it.note}` });
  }

  lines.push({ text: "" });
  lines.push({ text: `Tổng cộng: ${new Intl.NumberFormat("vi-VN").format(total)}₫`, bold: true });
  lines.push({ text: "" });
  lines.push({ text: "--- Chúc quý khách ngon miệng! ---", center: true });

  return buildEscPosDocument(lines, encoding);
}

export function buildTestTicketEscPos(encoding: EscPosEncoding = "cp1258"): Uint8Array {
  const lines: EscPosLine[] = [
    { text: "TEAPLUS - KITCHEN TICKET", center: true, bold: true, double: true },
    { text: "(TEST PRINT)", center: true, bold: true },
    { text: "" },
    { text: "Máy in: Xprinter XP-P300 (BLE)", center: true },
    { text: "" },
    { text: "1× Trà Cam Sả Mật Ong (Mẫu In)", bold: true },
    { text: "  Size L · 100% đường · 70% đá" },
    { text: "  + Trân Châu Đen, Kem Cheese" },
    { text: "  Ghi chú: Bản in thử hệ thống máy in KDS" },
    { text: "" },
    { text: "Tổng cộng: 55.000₫", bold: true },
    { text: "" },
    { text: "--- Kiểm tra máy thành công! ---", center: true },
  ];
  return buildEscPosDocument(lines, encoding);
}
