import { fmtDateTime, vnd } from './data';
import { buildKitchenTicketEscPos, buildTestTicketEscPos, type EscPosEncoding } from './escpos';
import { getConnectedPrinter, isWebBluetoothSupported, printBLEBytes } from './ble-print';

const ACTIVE_PRINTER_KEY = 'teaplus_active_printer';
const AUTO_PRINT_KEY = 'teaplus_auto_print_enabled';
const PRINTED_ORDERS_KEY = 'teaplus_printed_orders';

export type ActivePrinterConfig = {
  mode: 'kiosk' | 'ble';
  device_name: string;
  device_id?: string;
  encoding?: EscPosEncoding;
  configured_at: string;
};

export function getActivePrinterConfig(): ActivePrinterConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_PRINTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActivePrinterConfig(config: ActivePrinterConfig | null) {
  if (typeof window === 'undefined') return;
  if (config) {
    localStorage.setItem(ACTIVE_PRINTER_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(ACTIVE_PRINTER_KEY);
  }
}

export function isAutoPrintEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTO_PRINT_KEY) === 'true';
}

export function setAutoPrintEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTO_PRINT_KEY, enabled ? 'true' : 'false');
}

export function getPrintedOrders(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRINTED_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isOrderPrinted(orderCode: string): boolean {
  const list = getPrintedOrders();
  return list.includes(orderCode);
}

export function markOrderPrinted(orderCode: string) {
  if (typeof window === 'undefined') return;
  const list = getPrintedOrders();
  if (!list.includes(orderCode)) {
    const updated = [orderCode, ...list].slice(0, 100); // Lưu tối đa 100 đơn gần nhất
    localStorage.setItem(PRINTED_ORDERS_KEY, JSON.stringify(updated));
  }
}

export function generateReceiptHtml(order: any): string {
  const items = order.items || [];
  const storeName = order.store_name || 'Trà Trái Cây Tô';
  const orderCode = order.order_code || 'TP123456';
  const orderType = order.order_type || 'Take-away';
  const locationName = order.location_name || (order.table_id ? `Bàn ${order.table_id}` : null);
  const customerName = order.customer_name || 'Khách hàng';
  const customerPhone = order.customer_phone || '';
  const deliveryAddr = order.delivery_addr || '';
  const createdAt = order.created_at ? fmtDateTime(order.created_at) : fmtDateTime(new Date().toISOString());
  const total = order.total || order.subtotal || 0;

  const itemsTable = items
    .map(
      (it: any) => `
    <tr>
      <td style="padding: 4px 0; font-weight: bold;">${it.product_name || it.name}</td>
      <td style="text-align: center; padding: 4px 0;">x${it.qty || 1}</td>
      <td style="text-align: right; padding: 4px 0;">${vnd(it.line_total || it.itemTotal || (it.price * (it.qty || 1)))}</td>
    </tr>
    ${
      it.size_label || it.size
        ? `<tr><td colspan="3" style="font-size: 11px; color: #555; padding-bottom: 2px;">Size: ${it.size_label || it.size} ${it.sugar_level ? `· ${it.sugar_level} đường` : ''} ${it.ice_level ? `· ${it.ice_level} đá` : ''}</td></tr>`
        : ''
    }
    ${
      it.toppings && it.toppings.length > 0
        ? `<tr><td colspan="3" style="font-size: 11px; color: #555; padding-bottom: 2px;">+ ${Array.isArray(it.toppings) ? it.toppings.map((t: any) => (typeof t === 'string' ? t : t.name)).join(', ') : ''}</td></tr>`
        : ''
    }
    ${it.note ? `<tr><td colspan="3" style="font-size: 11px; color: #d97706; font-style: italic;">Ghi chú: ${it.note}</td></tr>` : ''}
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ticket Bếp - ${orderCode}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body {
          font-family: Arial, sans-serif;
          width: 72mm;
          margin: 0 auto;
          font-size: 12px;
          color: #000;
          line-height: 1.3;
        }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
        .title { font-size: 16px; font-weight: bold; margin: 0; }
        .subtitle { font-size: 11px; color: #333; margin-top: 2px; }
        .badge { display: inline-block; background: #000; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; }
        .info { margin-bottom: 8px; font-size: 11px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .total { border-top: 1px dashed #000; padding-top: 6px; font-size: 14px; font-weight: bold; text-align: right; }
        .footer { text-align: center; font-size: 10px; margin-top: 12px; border-top: 1px solid #000; padding-top: 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">TEAPLUS - KITCHEN TICKET</h1>
        <div class="subtitle">${storeName}</div>
        <div style="margin-top: 4px;">
          <span class="badge">MÃ ĐƠN: ${orderCode}</span>
        </div>
      </div>
      <div class="info">
        <div><strong>Thời gian:</strong> ${createdAt}</div>
        <div><strong>Hình thức:</strong> ${orderType}</div>
        ${locationName ? `<div><strong>Vị trí bàn:</strong> ${locationName}</div>` : ''}
        <div><strong>Khách hàng:</strong> ${customerName} ${customerPhone ? `(${customerPhone})` : ''}</div>
        ${deliveryAddr ? `<div><strong>Địa chỉ:</strong> ${deliveryAddr}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left;">Món</th>
            <th style="text-align: center;">SL</th>
            <th style="text-align: right;">Tiền</th>
          </tr>
        </thead>
        <tbody>
          ${itemsTable}
        </tbody>
      </table>
      <div class="total">
        Tổng cộng: ${vnd(total)}
      </div>
      <div class="footer">
        --- Chúc quý khách ngon miệng! ---
      </div>
    </body>
    </html>
  `;
}

export function silentPrintTicket(order: any): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const orderCode = order.order_code || String(order.id);
    markOrderPrinted(orderCode);

    const config = getActivePrinterConfig();
    if (config?.mode === 'ble') {
      // In qua Bluetooth thật (ESC/POS) — thực hiện bất đồng bộ
      void printTicketViaBLE(order);
      return true;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return false;

    doc.open();
    doc.write(generateReceiptHtml(order));
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);

    return true;
  } catch (err) {
    console.error('Lỗi khi tự động in ticket bếp:', err);
    return false;
  }
}

export async function printTicketViaBLE(order: any): Promise<boolean> {
  const config = getActivePrinterConfig();
  if (!config || config.mode !== 'ble') return false;
  if (!isWebBluetoothSupported() || !getConnectedPrinter()) {
    console.warn('Máy in Bluetooth chưa được kết nối — bỏ qua in tự động cho đơn này.');
    return false;
  }
  try {
    const bytes = buildKitchenTicketEscPos(order, config.encoding || 'cp1258');
    await printBLEBytes(bytes);
    return true;
  } catch (err) {
    console.error('Lỗi khi in qua Bluetooth:', err);
    return false;
  }
}

export function testPrintTicket(): boolean {
  if (typeof window === 'undefined') return false;
  const config = getActivePrinterConfig();
  if (config?.mode === 'ble') {
    void printTestTicketViaBLE();
    return true;
  }
  const sampleOrder = {
    id: 9999,
    order_code: 'TEST-PRINT',
    order_type: 'Tại quầy',
    location_name: 'Bàn Test 01',
    customer_name: 'Khách In Thử',
    customer_phone: '0900000000',
    store_name: 'Trà Trái Cây Tô – Mẫu In Thử',
    created_at: new Date().toISOString(),
    items: [
      {
        product_name: 'Trà Cam Sả Mật Ong (Mẫu In)',
        qty: 1,
        size_label: 'L',
        sugar_level: '100%',
        ice_level: '70%',
        toppings: ['Trân Châu Đen', 'Kem Cheese'],
        note: 'Bản in thử nghiệm hệ thống máy in KDS',
        line_total: 55000,
      },
    ],
    total: 55000,
  };

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return false;

    doc.open();
    doc.write(generateReceiptHtml(sampleOrder));
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);

    return true;
  } catch (err) {
    console.error('Lỗi khi in thử bản mẫu:', err);
    return false;
  }
}

export async function printTestTicketViaBLE(): Promise<boolean> {
  const config = getActivePrinterConfig();
  if (!config || config.mode !== 'ble') return false;
  if (!isWebBluetoothSupported() || !getConnectedPrinter()) return false;
  try {
    const bytes = buildTestTicketEscPos(config.encoding || 'cp1258');
    await printBLEBytes(bytes);
    return true;
  } catch (err) {
    console.error('Lỗi khi in thử qua Bluetooth:', err);
    return false;
  }
}
