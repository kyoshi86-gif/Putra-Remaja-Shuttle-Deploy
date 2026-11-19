// ======================================================================
// HELPER UANG / ANGKA GLOBAL
// ======================================================================
// Aturan proyek: semua nominal uang & harga maksimal 2 desimal.
// Lebih dari 2 desimal → dibulatkan (round) ke 2 desimal.
// ======================================================================

export const MAX_MONEY_DECIMALS = 2;

/**
 * Bulatkan angka ke maksimal 2 desimal.
 * Menerima number, string, null, undefined.
 */
export function roundMoney(
  value: number | string | null | undefined,
): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Sanitasi string input angka menjadi string bersih
 * dengan maksimal 2 desimal.
 *
 * Terima format: "3.14", "3,14", "3.14159", "1.000,5", dst.
 * - Koma dan titik sama-sama diterima sebagai pemisah desimal,
 *   tapi titik ribuan diabaikan.
 */
export function sanitizeMoneyInput(raw: string): string {
  if (raw == null) return "";
  let s = raw.trim();
  if (s === "") return "";

  // Normalisasi: koma → titik sebagai desimal.
  s = s.replace(/,/g, ".");

  // Buang semua karakter selain digit dan titik.
  s = s.replace(/[^\d.]/g, "");

  // Hanya boleh satu titik desimal.
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    const intPart = s.slice(0, firstDot);
    let decPart = s.slice(firstDot + 1).replace(/\./g, "");
    decPart = decPart.slice(0, MAX_MONEY_DECIMALS);
    // Pertahankan titik di akhir (masih mengetik desimal),
    // mis. "1." → tetap "1.", bukan "1", biar bisa lanjut ketik "1.5".
    s = decPart ? `${intPart}.${decPart}` : intPart + ".";
  }

  return s;
}

/**
 * Parse string input menjadi angka, lalu bulatkan ke 2 desimal.
 */
export function parseMoneyInput(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, ".").replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? roundMoney(n) : 0;
}

/**
 * Format angka dengan pemisah ribuan id-ID, maksimal 2 desimal.
 */
export function formatMoney(
  value: number | string | null | undefined,
  opts: { decimals?: number } = {},
): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: opts.decimals ?? MAX_MONEY_DECIMALS,
  }).format(n);
}
