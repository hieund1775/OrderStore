// Web Bluetooth ESC/POS printer connection — quét, ghép, ghi dữ liệu thật.
// Chỉ hoạt động trên Chrome/Edge (HTTPS hoặc localhost). Firefox/Safari không hỗ trợ.

export type BLEPrinterInfo = {
  id: string;
  name: string;
};

const BLE_DEVICE_KEY = "teaplus_ble_device";

// Các profile BLE phổ biến của máy in nhiệt ESC/POS (SPP-over-BLE, Nordic UART, FFF0...)
const PRINTER_PROFILES: Array<{ service: string; write: string }> = [
  // Profile phổ biến nhất (Xprinter / nhiều máy 58-80mm): 49535343-...
  { service: "49535343-fe7d-4ae5-8fa9-9fafd205e455", write: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
  // Nordic UART Service (NUS)
  { service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e" },
  // Profile FF00/FF02 (một số máy Xprinter/GOOJPRT)
  { service: "0000ff00-0000-1000-8000-00805f9b34fb", write: "0000ff02-0000-1000-8000-00805f9b34fb" },
  // Profile FFF0/FFF2
  { service: "0000fff0-0000-1000-8000-00805f9b34fb", write: "0000fff2-0000-1000-8000-00805f9b34fb" },
];

// Minimal Web Bluetooth types (chưa cài @types/web-bluetooth)
type AnyBluetooth = any;

let device: AnyBluetooth = null;
let server: AnyBluetooth = null;
let writeCharacteristic: AnyBluetooth = null;

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).bluetooth;
}

export function getConnectedPrinter(): BLEPrinterInfo | null {
  if (device) return { id: device.id, name: device.name || "Máy in Bluetooth" };
  return null;
}

export function getLastBLEDevice(): BLEPrinterInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BLE_DEVICE_KEY);
    return raw ? (JSON.parse(raw) as BLEPrinterInfo) : null;
  } catch {
    return null;
  }
}

function persistDevice(info: BLEPrinterInfo) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BLE_DEVICE_KEY, JSON.stringify(info));
  } catch {
    /* ignore */
  }
}

async function discoverWriteCharacteristic(gattServer: AnyBluetooth): Promise<AnyBluetooth | null> {
  // 1. Thử các profile đã biết trước
  for (const profile of PRINTER_PROFILES) {
    try {
      const service = await gattServer.getPrimaryService(profile.service);
      const characteristic = await service.getCharacteristic(profile.write);
      if (characteristic && (characteristic.properties?.write || characteristic.properties?.writeWithoutResponse)) {
        return characteristic;
      }
    } catch {
      /* profile không tồn tại trên thiết bị này → thử profile kế tiếp */
    }
  }

  // 2. Fallback: quét toàn bộ service, tìm characteristic ghi được đầu tiên
  try {
    const services = await gattServer.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        const writable = characteristics.find(
          (c: AnyBluetooth) => c.properties?.write || c.properties?.writeWithoutResponse,
        );
        if (writable) return writable;
      } catch {
        /* bỏ qua service không đọc được */
      }
    }
  } catch {
    /* không liệt kê được dịch vụ */
  }
  return null;
}

async function connectGATT() {
  if (!device?.gatt) throw new Error("Thiết bị không có GATT — có thể không phải máy in BLE.");
  server = await device.gatt.connect();
  writeCharacteristic = await discoverWriteCharacteristic(server);
  if (!writeCharacteristic) {
    throw new Error("Không tìm thấy kênh in ESC/POS trên thiết bị này.");
  }
}

export async function scanAndConnectBLEPrinter(): Promise<BLEPrinterInfo> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Trình duyệt không hỗ trợ Web Bluetooth. Hãy dùng Chrome/Edge bản mới và mở qua HTTPS/localhost.");
  }

  const bluetooth = (navigator as any).bluetooth;
  const optionalServices = Array.from(new Set(PRINTER_PROFILES.map((p) => p.service)));

  const requested = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices,
  });

  device = requested;
  await connectGATT();

  const info: BLEPrinterInfo = { id: device.id, name: device.name || "Máy in Bluetooth" };
  persistDevice(info);
  return info;
}

export async function printBLEBytes(bytes: Uint8Array): Promise<void> {
  if (!writeCharacteristic) {
    throw new Error("Chưa kết nối máy in Bluetooth.");
  }
  const chunkSize = 100;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (writeCharacteristic.writeValueWithoutResponse) {
      await writeCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await writeCharacteristic.writeValue(chunk);
    }
  }
}

export function disconnectBLEPrinter() {
  try {
    if (device?.gatt?.connected) device.gatt.disconnect();
  } catch {
    /* ignore */
  }
  device = null;
  server = null;
  writeCharacteristic = null;
}
