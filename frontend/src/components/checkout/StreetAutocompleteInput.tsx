import React, { useState, useEffect, useRef } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchStreetSuggestions } from '@/lib/vietnam-addresses';

export interface StreetAutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  province?: string;
  district?: string;
  ward?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}

export function StreetAutocompleteInput({
  id,
  value,
  onChange,
  placeholder = 'VD: 123 Lê Lợi, Căn hộ A12-04...',
  province,
  district,
  ward,
  disabled = false,
  className = '',
  maxLength = 30,
}: StreetAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const fetchSuggestions = async (val: string) => {
    const trimmed = (val || '').trim();
    // Bóc tách nếu người dùng đã gõ số nhà trước
    const streetPart = trimmed.replace(/^(\d+[\w/.-]*\s+)/, '').trim();
    if (streetPart.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const results = await searchStreetSuggestions(trimmed, { province, district, ward });
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    onChange(nextVal);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchSuggestions(nextVal);
    }, 350);
  };

  const handleSelectSuggestion = (selectedRoad: string) => {
    // Nếu trước đó người dùng đã gõ số nhà (ví dụ "123 Le"), giữ lại "123 "
    const houseNumberMatch = value.match(/^(\d+[\w/.-]*\s+)/);
    let finalVal = selectedRoad;
    if (houseNumberMatch) {
      finalVal = `${houseNumberMatch[1]}${selectedRoad}`;
    }

    onChange(finalVal);
    setSuggestions([]);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={handleChange}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            // Trì hoãn một chút để sự kiện onMouseDown của suggestion kích hoạt trước khi blur đóng dropdown
            setTimeout(() => setShowDropdown(false), 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className={`${className} ${loading ? 'pr-9' : ''}`}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-muted-foreground pointer-events-none" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg text-popover-foreground">
          <li className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Gợi ý tên đường
          </li>
          {suggestions.map((road, idx) => (
            <li key={`${road}-${idx}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectSuggestion(road);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-muted focus:bg-muted transition-colors"
              >
                <MapPin className="size-3.5 text-primary shrink-0" />
                <span className="truncate">{road}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
