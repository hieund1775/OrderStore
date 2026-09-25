export interface DeviceInfo {
  label: string;
  isServer: boolean;
}

export function parseDeviceUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua || ua.trim() === '') {
    return { label: '—', isServer: false };
  }
  const cleanUa = ua.trim();
  if (
    cleanUa === 'node' ||
    cleanUa.toLowerCase().includes('node') ||
    cleanUa.toLowerCase().includes('axios') ||
    cleanUa.toLowerCase().includes('undici') ||
    cleanUa.toLowerCase().includes('postman')
  ) {
    return { label: 'Hệ thống tự động (Server)', isServer: true };
  }

  let os = 'Khác';
  if (/windows/i.test(cleanUa)) os = 'Windows';
  else if (/macintosh|mac os/i.test(cleanUa)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(cleanUa)) os = 'iOS';
  else if (/android/i.test(cleanUa)) os = 'Android';
  else if (/linux/i.test(cleanUa)) os = 'Linux';

  let browser = 'Trình duyệt';
  if (/edg\//i.test(cleanUa)) browser = 'Edge';
  else if (/chrome|crios/i.test(cleanUa) && !/edg\//i.test(cleanUa)) browser = 'Chrome';
  else if (/safari/i.test(cleanUa) && !/chrome|crios/i.test(cleanUa)) browser = 'Safari';
  else if (/firefox|fxios/i.test(cleanUa)) browser = 'Firefox';

  return { label: `${os} - ${browser}`, isServer: false };
}

export function formatAuditAction(
  action: string,
  productMap?: Map<number, string>,
  branchMap?: Map<number, string>,
): string {
  if (!action) return '—';
  let text = action;
  text = text.replace(/(?:món|sản phẩm)\s*#?(\d+)/gi, (match, idStr) => {
    const id = Number(idStr);
    const prodName = productMap?.get(id);
    return prodName ? `món "${prodName}"` : match;
  });
  text = text.replace(/\(store(?:_id)?\s*(\d+)\)/gi, (match, storeIdStr) => {
    const storeId = Number(storeIdStr);
    const storeName = branchMap?.get(storeId);
    return storeName ? `(Chi nhánh ${storeName})` : match;
  });
  return text;
}

export function formatAuditDetail(
  detail: string | null | undefined,
  branchMap?: Map<number, string>,
  productMap?: Map<number, string>,
): string {
  if (!detail || detail.trim() === '') return '—';

  let text = detail;

  // Case 1: is_available: false, removed_wishlists: 2, notified: 2
  if (/is_available:\s*(false|true)/i.test(text)) {
    const isAvail = /is_available:\s*true/i.test(text);
    const removedMatch = text.match(/removed_wishlists:\s*(\d+)/i);
    const notifiedMatch = text.match(/notified:\s*(\d+)/i);

    const removedCount = removedMatch ? Number(removedMatch[1]) : 0;
    const notifiedCount = notifiedMatch ? Number(notifiedMatch[1]) : 0;

    if (!isAvail) {
      const parts = ['Ẩn món (Ngừng bán)'];
      if (removedCount > 0) parts.push(`gỡ khỏi ${removedCount} danh sách yêu thích`);
      if (notifiedCount > 0) parts.push(`gửi thông báo đến ${notifiedCount} khách hàng`);
      return parts.join(', ');
    } else {
      return 'Mở bán lại món ăn';
    }
  }

  // Case 2: (store 2) or (store_id 2) -> (Chi nhánh Bình Thạnh - D2)
  text = text.replace(/\(store(?:_id)?\s*(\d+)\)/gi, (match, storeIdStr) => {
    const storeId = Number(storeIdStr);
    const storeName = branchMap?.get(storeId);
    return storeName ? `(${storeName})` : match;
  });

  // Case 3: Rotate table checkout QR #10
  text = text.replace(/Rotate table checkout QR #?(\d+)/gi, (_, id) => `Tạo lại mã QR checkout cho bàn #${id}`);

  // Case 4: Map any remaining món #id or product #id
  text = text.replace(/(?:món|sản phẩm)\s*#?(\d+)/gi, (match, idStr) => {
    const id = Number(idStr);
    const prodName = productMap?.get(id);
    return prodName ? `"${prodName}"` : match;
  });

  return text;
}
