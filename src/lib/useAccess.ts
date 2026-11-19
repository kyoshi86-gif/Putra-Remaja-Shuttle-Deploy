import { useEffect, useState } from "react";
import { hasAccess } from "./hasAccess";

/**
 * Hook gating tombol aksi: satu panggilan untuk banyak kode permission.
 *
 * const can = useAccess(["units.create", "units.edit"] as const);
 * can["units.create"] -> boolean
 *
 * ponytail: hasil default `{}` (semua false) sampai pengecekan selesai —
 * aman (tombol tersembunyi dulu) sebelum permission ter-resolve.
 */
export function useAccess<K extends string>(
  codes: readonly K[],
): Record<K, boolean> {
  const [perm, setPerm] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    Promise.all(codes.map((code) => hasAccess(code))).then((values) => {
      if (!alive) return;
      setPerm(Object.fromEntries(codes.map((code, i) => [code, values[i]])));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join(",")]);

  return perm as Record<K, boolean>;
}
