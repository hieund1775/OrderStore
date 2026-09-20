import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getProvinces,
  getDistricts,
  getWards,
  formatDeliveryAddress,
  saveLastDeliveryLocation,
  getLastDeliveryLocation,
} from '@/lib/vietnam-addresses';

export interface DeliveryAddressSelectorProps {
  value: string;
  onChange: (fullAddress: string, isComplete: boolean) => void;
  disabled?: boolean;
}

export function DeliveryAddressSelector({
  value: _value,
  onChange,
  disabled = false,
}: DeliveryAddressSelectorProps) {
  const provinces = useMemo(() => getProvinces(), []);

  const [provinceCode, setProvinceCode] = useState<number | null>(null);
  const [districtCode, setDistrictCode] = useState<number | null>(null);
  const [wardCode, setWardCode] = useState<number | null>(null);
  const [street, setStreet] = useState('');

  // Load saved location on mount
  useEffect(() => {
    const saved = getLastDeliveryLocation();
    if (saved) {
      setProvinceCode(saved.provinceCode);
      setDistrictCode(saved.districtCode);
      setWardCode(saved.wardCode);
      setStreet(saved.street || '');
    }
  }, []);

  const districts = useMemo(() => {
    return getDistricts(provinceCode);
  }, [provinceCode]);

  const wards = useMemo(() => {
    return getWards(provinceCode, districtCode);
  }, [provinceCode, districtCode]);

  const selectedProvinceName = useMemo(() => {
    return provinces.find((p) => p.code === provinceCode)?.name || '';
  }, [provinces, provinceCode]);

  const selectedDistrictName = useMemo(() => {
    return districts.find((d) => d.code === districtCode)?.name || '';
  }, [districts, districtCode]);

  const selectedWardName = useMemo(() => {
    return wards.find((w) => w.code === wardCode)?.name || '';
  }, [wards, wardCode]);

  const fullAddress = useMemo(() => {
    return formatDeliveryAddress({
      street,
      ward: selectedWardName,
      district: selectedDistrictName,
      province: selectedProvinceName,
    });
  }, [street, selectedWardName, selectedDistrictName, selectedProvinceName]);

  const isComplete = Boolean(
    provinceCode != null &&
    districtCode != null &&
    wardCode != null &&
    street.trim().length >= 3,
  );

  // Notify parent on change
  useEffect(() => {
    onChange(fullAddress, isComplete);
    if (isComplete && provinceCode != null && districtCode != null && wardCode != null) {
      saveLastDeliveryLocation({
        provinceCode,
        districtCode,
        wardCode,
        street: street.trim(),
      });
    }
  }, [fullAddress, isComplete, provinceCode, districtCode, wardCode, street, onChange]);

  const handleProvinceChange = (codeStr: string) => {
    const code = Number(codeStr);
    setProvinceCode(code);
    setDistrictCode(null);
    setWardCode(null);
  };

  const handleDistrictChange = (codeStr: string) => {
    const code = Number(codeStr);
    setDistrictCode(code);
    setWardCode(null);
  };

  const handleWardChange = (codeStr: string) => {
    const code = Number(codeStr);
    setWardCode(code);
  };

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <MapPin className="size-3.5 text-primary" /> Địa chỉ giao hàng
          <span className="text-destructive">*</span>
        </Label>
        <span className="text-[11px] text-muted-foreground">
          Dữ liệu chuẩn 63 Tỉnh Thành
        </span>
      </div>

      {/* 3 CẤP HÀNH CHÍNH LIÊN HOÀN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Tỉnh / Thành phố */}
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            Tỉnh / Thành phố <span className="text-destructive">*</span>
          </Label>
          <Select
            value={provinceCode != null ? String(provinceCode) : undefined}
            onValueChange={handleProvinceChange}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-xs w-full bg-background">
              <SelectValue placeholder="Chọn Tỉnh/Thành..." />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {provinces.map((p) => (
                <SelectItem key={p.code} value={String(p.code)} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quận / Huyện */}
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            Quận / Huyện <span className="text-destructive">*</span>
          </Label>
          <Select
            value={districtCode != null ? String(districtCode) : undefined}
            onValueChange={handleDistrictChange}
            disabled={disabled || provinceCode == null}
          >
            <SelectTrigger className="h-9 text-xs w-full bg-background">
              <SelectValue
                placeholder={
                  provinceCode == null
                    ? 'Chọn Tỉnh/Thành trước'
                    : 'Chọn Quận/Huyện...'
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {districts.map((d) => (
                <SelectItem key={d.code} value={String(d.code)} className="text-xs">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Phường / Xã */}
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            Phường / Xã / Thị trấn <span className="text-destructive">*</span>
          </Label>
          <Select
            value={wardCode != null ? String(wardCode) : undefined}
            onValueChange={handleWardChange}
            disabled={disabled || districtCode == null}
          >
            <SelectTrigger className="h-9 text-xs w-full bg-background">
              <SelectValue
                placeholder={
                  districtCode == null
                    ? 'Chọn Quận/Huyện trước'
                    : 'Chọn Phường/Xã...'
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {wards.map((w) => (
                <SelectItem key={w.code} value={String(w.code)} className="text-xs">
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SỐ NHÀ, TÊN ĐƯỜNG, KHU PHỐ / TÒA NHÀ */}
      <div className="space-y-1">
        <Label htmlFor="delivery-street" className="text-[11px] font-medium text-muted-foreground">
          Số nhà, tên đường, khu phố / tòa nhà <span className="text-destructive">*</span>
        </Label>
        <Input
          id="delivery-street"
          placeholder="VD: 123 Lê Lợi, Căn hộ A12-04 Tòa nhà Landmark..."
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          disabled={disabled}
          className="h-9 text-xs bg-background"
        />
      </div>

      {/* XEM TRƯỚC ĐỊA CHỈ HOÀN CHỈNH */}
      {fullAddress ? (
        <div
          className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 transition-all ${
            isComplete
              ? 'bg-emerald-500/5 border-emerald-500/30 text-foreground'
              : 'bg-amber-500/5 border-amber-500/30 text-muted-foreground'
          }`}
        >
          {isComplete ? (
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs text-foreground break-words leading-relaxed">
              {fullAddress}
            </p>
            {!isComplete && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                Vui lòng chọn đầy đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã và nhập số nhà/tên đường.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
