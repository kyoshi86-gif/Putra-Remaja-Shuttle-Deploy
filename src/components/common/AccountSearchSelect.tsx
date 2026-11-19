import { useEffect, useRef, useState } from "react";

export interface AccountLike {
  id: string;
  code: string;
  name: string;
}

interface AccountSearchSelectProps {
  accounts: AccountLike[];
  value: string | null | undefined;
  onChange: (accountId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Combobox pencarian akun yang reusable.
 * - Search otomatis (ketik untuk filter, cocok dengan kode / nama).
 * - Navigasi: ↑/↓, PageUp/PageDown, Home/End, Enter untuk memilih.
 * - Tab / Shift+Tab berpindah field secara normal, TANPA menghapus akun
 *   yang sudah terpilih (label tetap tampil saat kembali).
 */
export default function AccountSearchSelect({
  accounts,
  value,
  onChange,
  placeholder = "-- PILIH AKUN --",
  disabled = false,
  autoFocus = false,
  className,
}: AccountSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = accounts.find((a) => a.id === value) ?? null;

  const filtered = query.trim() === "" ? accounts : accounts.filter((a) =>
    `${a.code} ${a.name}`.toLowerCase().includes(query.toLowerCase())
  );

  // Tutup saat klik di luar.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset sorotan saat daftar berubah.
  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  function pick(acc: AccountLike) {
    onChange(acc.id);
    setOpen(false);
    setQuery("");
    setHighlightIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const len = filtered.length;
    let idx = highlightIndex;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        idx = len === 0 ? 0 : (idx + 1) % len;
        setHighlightIndex(idx);
        break;
      case "ArrowUp":
        e.preventDefault();
        idx = len === 0 ? 0 : (idx - 1 + len) % len;
        setHighlightIndex(idx);
        break;
      case "PageDown":
        e.preventDefault();
        idx = len === 0 ? 0 : Math.min(idx + 5, len - 1);
        setHighlightIndex(idx);
        break;
      case "PageUp":
        e.preventDefault();
        idx = Math.max(idx - 5, 0);
        setHighlightIndex(idx);
        break;
      case "Home":
        e.preventDefault();
        setHighlightIndex(0);
        break;
      case "End":
        e.preventDefault();
        setHighlightIndex(Math.max(len - 1, 0));
        break;
      case "Enter":
        if (open && filtered[idx]) {
          e.preventDefault();
          pick(filtered[idx]);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
      case "Tab":
        // Biarkan browser berpindah field; cukup tutup dropdown.
        // JANGAN menghapus label yang sudah terpilih.
        setOpen(false);
        break;
      default:
        break;
    }
  }

  // Scroll item yang disorot agar selalu terlihat.
  useEffect(() => {
    if (!open) return;
    const el = rootRef.current?.querySelector<HTMLElement>(
      `[data-idx="${highlightIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  // Tampilkan label terpilih selama user belum mengetik query baru.
  const displayValue = query !== "" ? query : selected ? `${selected.code} - ${selected.name}` : "";

  return (
    <div ref={rootRef} className={`relative w-full ${className ?? ""}`}>
      <input
        type="text"
        disabled={disabled}
        autoFocus={autoFocus}
        className="border px-2 py-1 rounded w-full"
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <div className="absolute z-20 bg-white border w-full max-h-48 overflow-auto shadow rounded mt-1">
          {filtered.length === 0 && (
            <div className="px-2 py-1 text-gray-400 text-sm">
              Tidak ditemukan
            </div>
          )}
          {filtered.map((a, idx) => (
            <div
              key={a.id}
              data-idx={idx}
              onMouseEnter={() => setHighlightIndex(idx)}
              onClick={() => pick(a)}
              className={`px-2 py-1 cursor-pointer text-sm ${
                idx === highlightIndex ? "bg-blue-200" : "hover:bg-blue-100"
              }`}
            >
              {a.code} {a.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
