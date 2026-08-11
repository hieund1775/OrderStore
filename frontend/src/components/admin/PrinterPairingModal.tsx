import { useState } from 'react';
import { Printer, CheckCircle2, AlertCircle, Bluetooth, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  getActivePrinterConfig,
  setActivePrinterConfig,
  testPrintTicket,
  printTestTicketViaBLE,
  type ActivePrinterConfig,
} from '@/lib/auto-print';
import {
  scanAndConnectBLEPrinter,
  getConnectedPrinter,
  disconnectBLEPrinter,
  isWebBluetoothSupported,
  type BLEPrinterInfo,
} from '@/lib/ble-print';
import type { EscPosEncoding } from '@/lib/escpos';

type PrinterPairingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSaved?: () => void;
};

export function PrinterPairingModal({ open, onOpenChange, onConfigSaved }: PrinterPairingModalProps) {
  const [config, setConfig] = useState<ActivePrinterConfig | null>(() => getActivePrinterConfig());
  const [mode, setMode] = useState<'kiosk' | 'ble'>(config?.mode || 'kiosk');
  const [encoding, setEncoding] = useState<EscPosEncoding>(config?.encoding || 'cp1258');
  const [deviceName, setDeviceName] = useState<string>(
    config?.device_name || (config?.mode === 'ble' ? 'Xprinter XP-P300 (BLE)' : 'Xprinter XP-Q808 (USB 80mm)'),
  );
  const [connected, setConnected] = useState<BLEPrinterInfo | null>(() => getConnectedPrinter());
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);

  const bleSupported = isWebBluetoothSupported();

  const handleScan = async () => {
    if (!bleSupported) {
      toast.error('Trình duyệt không hỗ trợ Web Bluetooth. Hãy dùng Chrome/Edge và mở qua HTTPS/localhost.');
      return;
    }
    setScanning(true);
    try {
      const info = await scanAndConnectBLEPrinter();
      setConnected(info);
      setDeviceName(info.name);
      toast.success('Đã kết nối máy in Bluetooth: ' + info.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể kết nối máy in Bluetooth.');
    } finally {
      setScanning(false);
    }
  };

  const handleDisconnect = () => {
    disconnectBLEPrinter();
    setConnected(null);
    toast.info('Đã ngắt kết nối máy in Bluetooth.');
  };

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      if (mode === 'ble') {
        if (!bleSupported || !connected) {
          toast.error('Vui lòng kết nối máy in Bluetooth trước khi in thử.');
          return;
        }
        const ok = await printTestTicketViaBLE();
        if (ok) {
          toast.success('Đã gửi lệnh in thử qua Bluetooth! Kiểm tra giấy nhả ra tại máy in.');
        } else {
          toast.error('Lỗi khi in thử qua Bluetooth. Kiểm tra kết nối máy in.');
        }
      } else {
        const ok = testPrintTicket();
        if (ok) {
          toast.success('Đã gửi lệnh in thử mẫu thành công! Kiểm tra giấy nhả ra tại máy in.');
        } else {
          toast.error('Lỗi khi bắn lệnh in thử. Vui lòng kiểm tra cáp máy in hoặc trình duyệt.');
        }
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const finalName =
      deviceName.trim() ||
      (mode === 'kiosk' ? 'Xprinter XP-Q808 (USB 80mm)' : connected?.name || 'Xprinter XP-P300 (BLE)');
    const newConfig: ActivePrinterConfig = {
      mode,
      device_name: finalName,
      device_id: connected?.id,
      encoding,
      configured_at: new Date().toISOString(),
    };
    setConfig(newConfig);
    setActivePrinterConfig(newConfig);
    toast.success('Đã lưu kết nối máy in: ' + finalName);
    onConfigSaved?.();
    onOpenChange(false);
  };

  const handleClear = () => {
    handleDisconnect();
    setConfig(null);
    setActivePrinterConfig(null);
    toast.info('Đã xóa cấu hình máy in');
    onConfigSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Printer className="size-5 text-primary" />
            Nhận diện & Cấu hình Máy in KDS
          </DialogTitle>
          <DialogDescription className="text-xs">
            Xác nhận máy in đang cắm ở quầy và in thử 1 bản mẫu trước khi bật công tắc tự động in đơn mới.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Box */}
          <div className="rounded-xl border p-3 bg-muted/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Trạng thái nhận diện:</span>
              {(mode === 'ble' && connected) || (mode === 'kiosk' && config) ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  Đã sẵn sàng
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1.5">
                  <AlertCircle className="size-3.5" />
                  Chưa kết nối
                </Badge>
              )}
            </div>
            {(mode === 'ble' && connected) || (mode === 'kiosk' && config) ? (
              <div className="text-xs space-y-1">
                <p className="font-semibold text-foreground">{mode === 'ble' ? connected?.name : config?.device_name}</p>
                <p className="text-muted-foreground text-[11px]">
                  {mode === 'ble' && connected ? 'ID thiết bị: ' + connected.id : ''}
                </p>
              </div>
            ) : null}
          </div>

          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Chọn cổng / Phương thức kết nối:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('kiosk')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  mode === 'kiosk'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                    : 'border-border hover:bg-accent text-muted-foreground'
                }`}
              >
                <Printer className="size-5 mb-1" />
                USB / Kiosk Silent
                <span className="text-[10px] font-normal text-muted-foreground mt-0.5">(Khuyên dùng - 0ms)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('ble')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  mode === 'ble'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                    : 'border-border hover:bg-accent text-muted-foreground'
                }`}
              >
                <Bluetooth className="size-5 mb-1" />
                Bluetooth BLE
                <span className="text-[10px] font-normal text-muted-foreground mt-0.5">(Cửa hàng di động)</span>
              </button>
            </div>
          </div>

          {/* BLE Scan & Connect */}
          {mode === 'ble' && (
            <div className="rounded-xl border p-3.5 space-y-3 bg-card relative overflow-hidden transition-all shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <span className="relative flex h-3 w-3">
                      {scanning ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </>
                      ) : connected ? (
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-emerald-500/50 shadow-sm"></span>
                      ) : (
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs font-semibold">Kết nối Máy in Bluetooth BLE:</p>
                </div>
                {connected && (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[10px] gap-1">
                    📶 Tín hiệu tốt
                  </Badge>
                )}
              </div>

              {!bleSupported ? (
                <p className="text-[11px] text-amber-600 font-medium bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                  ⚠️ Trình duyệt này không hỗ trợ Web Bluetooth. Dùng Chrome/Edge bản mới, mở qua HTTPS hoặc localhost để kết nối máy in BLE.
                </p>
              ) : (
                <>
                  {/* Radar Wave Animation Container */}
                  {scanning && (
                    <div className="my-2 py-4 flex flex-col items-center justify-center rounded-xl bg-primary/5 border border-primary/20 relative overflow-hidden animate-fade-in">
                      <div className="relative flex items-center justify-center">
                        <div className="absolute w-20 h-20 rounded-full border border-primary/30 animate-ping opacity-50"></div>
                        <div className="absolute w-14 h-14 rounded-full border border-primary/40 animate-pulse"></div>
                        <div className="p-3 rounded-full bg-primary/20 text-primary z-10">
                          <Bluetooth className="size-6 animate-bounce" />
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-primary mt-3">Đang phát sóng Bluetooth tìm kiếm máy in...</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Vui lòng chọn máy in của tiệm ở khung trình duyệt hiện lên</p>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant={connected ? "outline" : "hero"}
                    size="sm"
                    className="w-full text-xs font-medium h-9 shadow-sm gap-2"
                    disabled={scanning}
                    onClick={handleScan}
                  >
                    <Bluetooth className={`size-4 ${scanning ? "animate-spin" : "text-primary"}`} />
                    {scanning ? 'Đang quét sóng & chờ kết nối...' : connected ? '🔄 Đổi máy in Bluetooth khác...' : '🔍 Quét & Kết nối Bluetooth'}
                  </Button>

                  {connected ? (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5" />
                          {connected.name}
                        </span>
                        <p className="text-[10px] text-muted-foreground">ID: {connected.id}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                        onClick={handleDisconnect}
                      >
                        <Unplug className="size-3.5 mr-1" /> Ngắt kết nối
                      </Button>
                    </div>
                  ) : !scanning ? (
                    <div className="text-[11px] text-muted-foreground bg-muted/50 p-2.5 rounded-lg border space-y-1">
                      <p className="font-medium text-foreground">💡 Hướng dẫn nhanh cho thu ngân:</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-[10.5px]">
                        <li>Bật nguồn máy in nhiệt Bluetooth (Xprinter / GOOJPRT / Birch).</li>
                        <li>Bấm nút <strong className="text-primary">"Quét & Kết nối Bluetooth"</strong> phía trên.</li>
                        <li>Chọn đúng tên máy in trong cửa sổ hiển thị của trình duyệt.</li>
                      </ol>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}

          {/* Device Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên / Model máy in của tiệm:</label>
            <Input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="VD: Xprinter XP-Q808 hoặc GOOJPRT PT-210"
              className="h-8 text-xs font-medium"
            />
            <p className="text-[11px] text-muted-foreground">
              * Tên này sẽ hiển thị trực tiếp ở thanh Header KDS để nhân viên dễ dàng nhận diện đúng máy.
            </p>
          </div>

          {/* Encoding Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Mã tiếng Việt khi in:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEncoding('cp1258')}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                  encoding === 'cp1258'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border hover:bg-accent text-muted-foreground'
                }`}
              >
                Tiếng Việt có dấu (CP1258)
              </button>
              <button
                type="button"
                onClick={() => setEncoding('ascii')}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                  encoding === 'ascii'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border hover:bg-accent text-muted-foreground'
                }`}
              >
                Không dấu (in được mọi máy)
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Nếu máy in không hiển thị đúng dấu tiếng Việt, chuyển sang "Không dấu" để in chắc chắn.
            </p>
          </div>

          {/* Test Print Section */}
          <div className="rounded-xl border p-3 space-y-2 bg-card">
            <p className="text-xs font-semibold">Xác nhận hoạt động máy in:</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs font-medium"
              disabled={testing || (mode === 'ble' && !connected)}
              onClick={handleTestPrint}
            >
              <Printer className="size-3.5 mr-1.5 text-primary" />
              {testing ? 'Đang gửi lệnh in thử...' : '🖨️ In thử 1 bản mẫu (Test Print)'}
            </Button>
            <p className="text-[11px] text-muted-foreground italic text-center">
              * Bấm nút để in thử 1 Ticket Bếp mẫu. Bản in thử không ảnh hưởng tới đơn hàng thật.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          {config ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="text-xs text-destructive">
              Xóa cấu hình
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="button" variant="hero" size="sm" onClick={handleSave}>
              Lưu máy in
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
