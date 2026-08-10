import { useState } from 'react';
import { Printer, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  type ActivePrinterConfig,
} from '@/lib/auto-print';

type PrinterPairingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSaved?: () => void;
};

export function PrinterPairingModal({ open, onOpenChange, onConfigSaved }: PrinterPairingModalProps) {
  const [config, setConfig] = useState<ActivePrinterConfig | null>(() => getActivePrinterConfig());
  const [mode, setMode] = useState<'kiosk' | 'ble'>(config?.mode || 'kiosk');
  const [testing, setTesting] = useState(false);

  const handleTestPrint = () => {
    setTesting(true);
    const ok = testPrintTicket();
    setTesting(false);
    if (ok) {
      toast.success('Đã gửi lệnh in thử mẫu thành công! Kiểm tra giấy nhả ra tại máy in.');
      const newConfig: ActivePrinterConfig = {
        mode,
        device_name: mode === 'kiosk' ? 'Máy in Nhiệt Kiosk 80mm (USB/Driver)' : 'Máy in Bluetooth BLE',
        configured_at: new Date().toISOString(),
      };
      setConfig(newConfig);
      setActivePrinterConfig(newConfig);
      onConfigSaved?.();
    } else {
      toast.error('Lỗi khi bắn lệnh in thử. Vui lòng kiểm tra cáp máy in hoặc trình duyệt.');
    }
  };

  const handleSave = () => {
    const newConfig: ActivePrinterConfig = {
      mode,
      device_name: mode === 'kiosk' ? 'Máy in Nhiệt Kiosk 80mm (USB/Driver)' : 'Máy in Bluetooth BLE',
      configured_at: new Date().toISOString(),
    };
    setConfig(newConfig);
    setActivePrinterConfig(newConfig);
    toast.success('Đã lưu cấu hình máy in!');
    onConfigSaved?.();
    onOpenChange(false);
  };

  const handleClear = () => {
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
              {config ? (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  Đã cấu hình
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1.5">
                  <AlertCircle className="size-3.5" />
                  Chưa cấu hình
                </Badge>
              )}
            </div>
            {config && (
              <div className="text-xs space-y-1">
                <p className="font-semibold text-foreground">{config.device_name}</p>
                <p className="text-muted-foreground text-[11px]">
                  Cấu hình lúc: {new Date(config.configured_at).toLocaleString('vi-VN')}
                </p>
              </div>
            )}
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
                <RefreshCw className="size-5 mb-1" />
                Bluetooth BLE
                <span className="text-[10px] font-normal text-muted-foreground mt-0.5">(Cửa hàng di động)</span>
              </button>
            </div>
          </div>

          {/* Test Print Section */}
          <div className="rounded-xl border p-3 space-y-2 bg-card">
            <p className="text-xs font-semibold">Xác nhận hoạt động máy in:</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs font-medium"
              disabled={testing}
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
          ) : <div />}
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
