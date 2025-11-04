// utils/time.ts
export function toWIBDateString(date: Date, format: "iso" | "display" = "iso"): string {
  // Konversi dari UTC ke WIB (UTC+7)
  const utc = date.getTime();
  const wibDate = new Date(utc + 7 * 60 * 60 * 1000); // tambah 7 jam dari UTC

  const yyyy = wibDate.getUTCFullYear();
  const mm = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(wibDate.getUTCDate()).padStart(2, "0");

  if (format === "display") return `${dd}-${mm}-${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

export function getWIBTimestamp(format: "display" | "iso" = "display"): string {
  const utc = new Date().getTime();
  const wib = new Date(utc + 7 * 60 * 60 * 1000); // UTC+7

  const yyyy = wib.getUTCFullYear();
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const min = String(wib.getUTCMinutes()).padStart(2, "0");
  const ss = String(wib.getUTCSeconds()).padStart(2, "0");

  if (format === "iso") return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
}

export function getWIBTimestampFromUTC(utcString: string): string {
  const utc = new Date(utcString).getTime();
  const wib = new Date(utc + 7 * 60 * 60 * 1000);

  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = wib.getUTCFullYear();
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const min = String(wib.getUTCMinutes()).padStart(2, "0");
  const ss = String(wib.getUTCSeconds()).padStart(2, "0");

  return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
}

export function toWIBTimeString(waktu: string): string {
  const [hh, mm, ss] = waktu.split(":");
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}`;
}