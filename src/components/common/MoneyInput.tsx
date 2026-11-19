// ============================================================================
// MONEY INPUT — input uang dengan format ribuan otomatis + desimal
// ============================================================================
// - Menampilkan pemisah ribuan otomatis (id-ID: 1.000.000).
// - Titik (.) ATAU koma (,) di keyboard keduanya diterima sebagai desimal.
// - Maksimal 2 desimal; lebih dari itu dibulatkan.
// - Nilai dikomit (parse ke number) saat blur / Enter.
// - Edit ditangani dengan "diff-aware" terhadap canonical murni, sehingga
//   titik ribuan TIDAK pernah salah diterjemahkan sebagai titik desimal.
// ============================================================================
import { useEffect, useRef, useState } from "react";

const MAX_DECIMALS = 2;

const isDigit = (ch: string) => ch >= "0" && ch <= "9";

/** Ubah string (mis. hasil paste) -> canonical (digit + maks 1 titik). */
function sanitizeTyped(raw: string): string {
  let canon = "";
  let seenDot = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (isDigit(ch)) {
      canon += ch;
    } else if ((ch === "." || ch === ",") && !seenDot) {
      canon += ".";
      seenDot = true;
    }
  }
  return enforceLimits(canon);
}

/** Rapikan canonical: buang karakter aneh, maks 1 titik, maks 2 desimal. */
function enforceLimits(s: string): string {
  s = s.replace(/[^\d.]/g, "");
  const dotIdx = s.indexOf(".");
  let ip: string;
  let dp: string;
  if (dotIdx === -1) {
    ip = s;
    dp = "";
  } else {
    ip = s.slice(0, dotIdx);
    dp = s.slice(dotIdx + 1).replace(/\./g, "").slice(0, MAX_DECIMALS);
  }
  ip = ip.replace(/^0+(?=\d)/, "");
  if (dp !== "") return `${ip}.${dp}`;
  // Pertahankan titik di akhir jika pengguna masih mengetik desimal.
  if (s.endsWith(".")) return ip + ".";
  return ip;
}

/** canonical -> tampilan ber-ribuan (id-ID). */
function formatCanonical(canon: string): string {
  if (canon === "") return "";
  const dotIdx = canon.indexOf(".");
  const intPart = dotIdx === -1 ? canon : canon.slice(0, dotIdx);
  const decPart = dotIdx === -1 ? "" : canon.slice(dotIdx + 1);
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (dotIdx === -1) return intFormatted;
  // Jika belum ada digit desimal (masih mengetik), tampilkan koma di akhir.
  return `${intFormatted},${decPart}`;
}

/** canonical -> number (bulatkan 2 desimal). */
function canonToNumber(canon: string): number {
  if (canon === "" || canon === ".") return 0;
  const n = Number(canon);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** number -> canonical awal. */
function numberToCanon(value: number): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "";
  let s = String(n);
  if (s.includes("e")) s = n.toFixed(MAX_DECIMALS);
  return s;
}

/**
 * Bangun peta korespondensi display <-> canon.
 * - d2c[i] = index di canonical utk karakter display[i] (digit / koma desimal),
 *   atau -1 jika karakter itu titik ribuan (tidak ada padanan di canonical).
 * - c2d[j] = index di display utk karakter canonical[j].
 */
type Maps = { d2c: number[]; c2d: number[] };

function buildMaps(display: string): Maps {
  const d2c: number[] = [];
  const c2d: number[] = [];
  let ci = 0;
  for (let i = 0; i < display.length; i++) {
    const ch = display[i];
    if (isDigit(ch)) {
      d2c.push(ci);
      c2d.push(i);
      ci++;
    } else if (ch === ",") {
      // Koma desimal di tampilan = titik di canonical.
      d2c.push(ci);
      c2d.push(i);
      ci++;
    } else {
      d2c.push(-1); // titik ribuan
    }
  }
  return { d2c, c2d };
}

/**
 * Terapkan edit (maks 1 kontigu) dari tampilan lama -> raw baru.
 * Mengembalikan canonical baru + posisi kursor (dalam canonical).
 */
function applyEdit(
  prevCanon: string,
  prevDisplay: string,
  raw: string,
): { canon: string; posCanon: number } {
  if (raw === prevDisplay) {
    return { canon: prevCanon, posCanon: prevCanon.length };
  }
  const { d2c } = buildMaps(prevDisplay);

  // Cari titik paling awal yang beda.
  let diff = 0;
  const n = Math.min(raw.length, prevDisplay.length);
  while (diff < n && raw[diff] === prevDisplay[diff]) diff++;

  const insertAtCanon = (p: number) => {
    if (p < d2c.length && d2c[p] >= 0) return d2c[p];
    return prevCanon.length;
  };

  if (raw.length > prevDisplay.length) {
    // Insert (ketik / paste).
    const added = raw.slice(diff, diff + (raw.length - prevDisplay.length));
    const addCanon = sanitizeTyped(added);
    const atCanon = insertAtCanon(diff);
    const next = prevCanon.slice(0, atCanon) + addCanon + prevCanon.slice(atCanon);
    const canon = enforceLimits(next);
    return { canon, posCanon: atCanon + addCanon.length };
  }

  if (raw.length < prevDisplay.length) {
    // Hapus.
    const removedLen = prevDisplay.length - raw.length;
    const delStart = diff;
    const delEnd = diff + removedLen;
    // Kumpulkan index canonical yang harus dihapus.
    const toRemove = new Set<number>();
    for (let i = delStart; i < delEnd; i++) {
      if (d2c[i] >= 0) toRemove.add(d2c[i]);
    }
    const atCanon = Math.min(insertAtCanon(delStart), prevCanon.length);
    let next = "";
    for (let i = 0; i < prevCanon.length; i++) {
      if (!toRemove.has(i)) next += prevCanon[i];
    }
    const canon = enforceLimits(next);
    return { canon, posCanon: Math.min(atCanon, canon.length) };
  }

  // Panjang sama -> penggantian (jarang): sanitize penuh.
  const canon = enforceLimits(sanitizeTyped(raw));
  return { canon, posCanon: canon.length };
}

interface MoneyInputProps {
  value: number;
  onCommit: (v: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function MoneyInput({
  value,
  onCommit,
  placeholder,
  className,
  disabled,
}: MoneyInputProps) {
  const [canon, setCanon] = useState<string>(() => numberToCanon(value));
  const canonRef = useRef(canon);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCommittedRef = useRef<number>(value);

  useEffect(() => {
    canonRef.current = canon;
  }, [canon]);

  // Sinkronisasi dari luar (mis. reset form / edit load).
  // JANGAN menimpa yang sedang diketik selama input masih fokus,
  // supaya nilai debit/kredit tidak hilang saat Tab berpindah field.
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) return;
    const next = numberToCanon(value);
    setCanon(next);
    canonRef.current = next;
    lastCommittedRef.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target as HTMLInputElement;
    const raw = el.value;
    const prevDisplay = formatCanonical(canonRef.current);

    const { canon: nextCanon, posCanon } = applyEdit(
      canonRef.current,
      prevDisplay,
      raw,
    );

    canonRef.current = nextCanon;
    setCanon(nextCanon);

    // Pulihkan kursor.
    requestAnimationFrame(() => {
      if (el === document.activeElement) {
        const display = formatCanonical(nextCanon);
        const { c2d } = buildMaps(display);
        const pos = c2d[posCanon] ?? display.length;
        const clamped = Math.min(pos, display.length);
        el.setSelectionRange(clamped, clamped);
      }
    });
  };

  const commit = () => {
    const v = canonToNumber(canonRef.current);
    // Jangan kirim commit bila nilainya tidak berubah dari state terakhir.
    // Ini mencegah field kosong yang "dilewati" saat Tab mengirim 0 dan
    // memicu logika reset di halaman Jurnal (debit hilang).
    if (Math.abs(v - lastCommittedRef.current) < 0.005) return;
    lastCommittedRef.current = v;
    onCommit(v);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={
        className ?? "border px-2 py-1 rounded w-[120px] text-right"
      }
      placeholder={placeholder}
      disabled={disabled}
      value={formatCanonical(canon)}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
