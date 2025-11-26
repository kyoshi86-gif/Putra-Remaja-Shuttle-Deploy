// src/pages/Kaskasir.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getSaldoAwalDariHistori, injectSaldoKeData } from "../utils/finance";
import type { KasRow } from "../utils/types";
import { createPortal } from "react-dom";
import { DateRangePicker } from "react-date-range";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import type { Range, RangeKeyDict } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

const today = new Date().toISOString().split("T")[0];

export default function KasKasir() {
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const [summary, setSummary] = useState({
    saldoAwal: 0,
    uangSaku: 0,
    premiDriver: 0,
    perpalDriver: 0,
    potonganDriver: 0,
    realisasiSaku: 0,
    kasMasuk: 0,
    kasKeluar: 0,
    kasbon: 0,
    realisasiKasbon: 0,
  });

  // date range state for picker (keperluan UI)
  const [range, setRange] = useState<Range[]>([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  const pickerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [pickerStyle, setPickerStyle] = useState({ top: 0, left: 0 });

  useEffect(() => {
    // position & outside click handler
    if (showPicker && pickerRef.current && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPickerStyle({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });

      function handleClickOutside(e: MouseEvent) {
        const t = e.target as Node;
        if (
          pickerRef.current &&
          !pickerRef.current.contains(t) &&
          triggerRef.current &&
          !triggerRef.current.contains(t)
        ) {
          setShowPicker(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPicker]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1) ambil semua histori kas_harian (dipakai untuk inject saldo & hitung saldo awal)
      const { data: allRows, error: allError } = await supabase
        .from("kas_harian")
        .select("*")
        .order("tanggal", { ascending: true })
        .order("waktu", { ascending: true })
        .order("urutan", { ascending: true });

      if (allError) {
        console.error("❌ Gagal ambil histori kas_harian:", allError.message);
      }

      const all: KasRow[] = (allRows ?? []) as KasRow[];

      // urutkan defensif berdasarkan tanggal+waktu
      const sortedAll = [...all].sort((a, b) => {
        const tA = new Date(`${a.tanggal} ${a.waktu ?? "00:00:00"}`).getTime();
        const tB = new Date(`${b.tanggal} ${b.waktu ?? "00:00:00"}`).getTime();
        return tA - tB;
      });

      // inject saldo untuk semua transaksi (mulai dari 0)
      const injectedAll = injectSaldoKeData(sortedAll, 0);

      // hitung saldo awal (saldo terakhir sebelum startDate)
      // getSaldoAwalDariHistori menerima tanggal string (yyyy-mm-dd)
      const saldoAwalValid = getSaldoAwalDariHistori(injectedAll, startDate);

      // fallback: apabila histori ada tetapi semua saldo_akhir null, inject lagi dan ambil akhir
      let saldoAwal = saldoAwalValid;
      const historiExist = injectedAll.length > 0;
      const semuaTanpaSaldo = historiExist && injectedAll.every((r) => r.saldo_akhir === null || r.saldo_akhir === undefined);
      if (historiExist && semuaTanpaSaldo) {
        const inj = injectSaldoKeData(sortedAll, 0);
        saldoAwal = inj.at(-1)?.saldo_akhir ?? 0;
      }

      // 2) ambil summary lain (berdasarkan tanggal range)
      // Uang Saku Driver (kredit)
      const { data: uangSakuData } = await supabase
        .from("kas_harian")
        .select("nominal")
        .eq("sumber_tabel", "uang_saku_driver")
        .eq("jenis_transaksi", "kredit")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      const uangSaku = (uangSakuData ?? []).reduce(
        (t, r: { nominal: number | null }) => t + (r.nominal ?? 0),
        0
        );

      // Premi Driver (kredit)
      const { data: premiData } = await supabase
        .from("kas_harian")
        .select("nominal")
        .eq("sumber_tabel", "premi_driver")
        .eq("jenis_transaksi", "kredit")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      const premiDriver = premiData?.reduce((t, r) => t + (r.nominal || 0), 0) || 0;

      // Potongan Driver (debet)
      const { data: potonganData } = await supabase
        .from("kas_harian")
        .select("nominal")
        .eq("sumber_tabel", "potongan")
        .eq("jenis_transaksi", "debet")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      const potonganDriver = potonganData?.reduce((t, r) => t + (r.nominal || 0), 0) || 0;

      // Perpal (kredit)
      const { data: perpalData } = await supabase
        .from("kas_harian")
        .select("nominal")
        .eq("sumber_tabel", "perpal")
        .eq("jenis_transaksi", "kredit")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      const perpalDriver = perpalData?.reduce((t, r) => t + (r.nominal || 0), 0) || 0;

      // Realisasi Saku (sumber = realisasi_saku_item)
      const { data: realSakuData } = await supabase
        .from("kas_harian")
        .select("nominal")
        .eq("sumber_tabel", "realisasi_saku_item")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      const realisasiSaku = realSakuData?.reduce((t, r) => t + (r.nominal || 0), 0) || 0;

      // Kas Masuk (debet) - ambil null atau kasbon_realisasi_sisa
      const { data: masukData, error: masukError } = await supabase
        .from("kas_harian")
        .select("nominal")
        .eq("jenis_transaksi", "debet")
        .or("sumber_tabel.is.null,sumber_tabel.eq.kasbon_realisasi_sisa")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      if (masukError) console.error("❌ Kas Masuk fetch error:", masukError.message);
      const kasMasuk = masukData?.reduce((t, r) => t + (r.nominal || 0), 0) || 0;

      // Kas Keluar (kredit, sumber_tabel null)
      const { data: keluarData } = await supabase
        .from("kas_harian")
        .select("nominal")
        .eq("jenis_transaksi", "kredit")
        .is("sumber_tabel", null)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      const kasKeluar = keluarData?.reduce((t, r) => t + (r.nominal || 0), 0) || 0;

      // Kasbon (tabel kasbon -> jumlah_kasbon)
      const { data: kasbonData, error: kasbonError } = await supabase
        .from("kasbon")
        .select("jumlah_kasbon")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      if (kasbonError) console.error("Kasbon fetch error:", kasbonError.message);
      const kasbon = kasbonData?.reduce((t, r) => t + (r.jumlah_kasbon || 0), 0) || 0;

      // Realisasi Kasbon (tabel kasbon_realisasi -> nominal)
      const { data: realKasbonData } = await supabase
        .from("kasbon_realisasi")
        .select("nominal")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      const realisasiKasbon = realKasbonData?.reduce((t, r) => t + (r.nominal || 0), 0) || 0;

      // simpan ringkasan
      setSummary({
        saldoAwal,
        uangSaku,
        premiDriver,
        perpalDriver,
        potonganDriver,
        realisasiSaku,
        kasMasuk,
        kasKeluar,
        kasbon,
        realisasiKasbon,
      });
    } catch (err: unknown) {
      console.error("fetchData error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Ringkasan Kasir</h1>

      {/* DATE RANGE */}
      <div className="flex gap-6 mb-8">
        <div ref={triggerRef}>
          <label className="font-semibold">Date range: </label>
          <input
            type="text"
            readOnly
            value={
              range[0]?.startDate && range[0]?.endDate
                ? `${format(range[0].startDate as Date, "dd-MM-yyyy", { locale: id })} - ${format(
                    range[0].endDate as Date,
                    "dd-MM-yyyy",
                    { locale: id }
                  )}`
                : ""
            }
            onClick={() => setShowPicker(true)}
            className="border border-gray-300 rounded px-2 py-1 text-sm leading-normal w-[240px] cursor-pointer"
          />

          {showPicker &&
            createPortal(
              <div
                ref={pickerRef}
                className="z-50 shadow-lg border bg-white p-2"
                style={{
                  position: "fixed",
                  top: pickerStyle.top,
                  left: pickerStyle.left,
                }}
              >
                <DateRangePicker
                  className="custom-datepicker"
                  onChange={(ranges: RangeKeyDict) => {
                    const selection = ranges.selection;
                    if (selection?.startDate && selection?.endDate) {
                        setRange([{ ...selection, key: "selection" }]);
                      // update tanggal yang dipakai untuk summary
                      setStartDate(format(selection.startDate, "yyyy-MM-dd"));
                      setEndDate(format(selection.endDate, "yyyy-MM-dd"));
                    }
                  }}
                  moveRangeOnFirstSelection={false}
                  showMonthAndYearPickers={true}
                  staticRanges={[]}
                  inputRanges={[]}
                  months={1}
                  ranges={range}
                  direction="horizontal"
                  locale={id}
                  preventSnapRefocus={true}
                  calendarFocus="forwards"
                />
                <div className="flex justify-end mt-2 space-x-2">
                  <button onClick={() => setShowPicker(false)} className="px-3 py-1 bg-green-600 text-white rounded">
                    Apply
                  </button>
                  <button onClick={() => setShowPicker(false)} className="px-3 py-1 bg-gray-300 rounded">
                    Cancel
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>
      </div>

      {/* LAPORAN */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white shadow rounded p-6 space-y-6">
          {/* A. SALDO AWAL */}
          <div className="flex justify-between border-b pb-2 text-lg font-bold">
            <span>A. Saldo Awal</span>
            <span>{formatCurrency(summary.saldoAwal)}</span>
          </div>

          {/* B. KOMPONEN KAS MASUK */}
          <div>
            <h2 className="font-bold mb-2">B. Komponen Kas Masuk</h2>
            <div className="flex justify-between">
              <span>Potongan Driver</span>
              <span>{formatCurrency(summary.potonganDriver)}</span>
            </div>
            <div className="flex justify-between">
              <span>Kas Masuk</span>
              <span>{formatCurrency(summary.kasMasuk)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Sub Total</span>
              <span>{formatCurrency(summary.potonganDriver + summary.kasMasuk)}</span>
            </div>
          </div>

          {/* C. KOMPONEN KAS KELUAR */}
          <div>
            <h2 className="font-bold mb-2">C. Komponen Kas Keluar</h2>

            <div className="flex justify-between">
              <span>Uang Saku Driver</span>
              <span>{formatCurrency(summary.uangSaku)}</span>
            </div>

            <div className="flex justify-between">
              <span>Premi Driver</span>
              <span>{formatCurrency(summary.premiDriver)}</span>
            </div>

            <div className="flex justify-between">
              <span>Perpal</span>
              <span>{formatCurrency(summary.perpalDriver)}</span>
            </div>

            <div className="flex justify-between">
              <span>Kasbon</span>
              <span>{formatCurrency(summary.kasbon)}</span>
            </div>

            <div className="flex justify-between">
              <span>Kas Keluar</span>
              <span>{formatCurrency(summary.kasKeluar)}</span>
            </div>

            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Sub Total</span>
              <span>
                {formatCurrency(
                  summary.uangSaku +
                    summary.premiDriver +
                    summary.perpalDriver +
                    summary.kasbon +
                    summary.kasKeluar
                )}
              </span>
            </div>
          </div>

          {/* D. SALDO AKHIR */}
          <div className="flex justify-between text-lg font-bold border-t pt-3">
            <span>D. Saldo Akhir ( A + B - C )</span>
            <span>
              {formatCurrency(
                summary.saldoAwal +
                  (summary.potonganDriver + summary.kasMasuk) -
                  (summary.uangSaku +
                    summary.premiDriver +
                    summary.perpalDriver +
                    summary.kasbon +
                    summary.kasKeluar)
              )}
            </span>
          </div>

          {/* TOTAL REALISASI */}
          <div className="mt-6">
            <h2 className="font-bold mb-2">Laporan Realisasi</h2>

            <div className="flex justify-between">
              <span>Realisasi Saku</span>
              <span>{formatCurrency(summary.realisasiSaku)}</span>
            </div>

            <div className="flex justify-between">
              <span>Realisasi Kasbon</span>
              <span>{formatCurrency(summary.realisasiKasbon)}</span>
            </div>

            <div className="flex justify-between font-bold border-t pt-2">
              <span>Total Realisasi</span>
              <span>{formatCurrency(summary.realisasiSaku + summary.realisasiKasbon)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}