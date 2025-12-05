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

const today = format(new Date(), "yyyy-MM-dd");

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
    biayaEtoll: 0,
  });

  // date range state for picker (keperluan UI)
  const [range, setRange] = useState<Range[]>([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  // Sinkronkan range UI dengan startDate dan endDate
  useEffect(() => {
    setRange([
      {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        key: "selection",
      },
    ]);
  }, [startDate, endDate]);

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
    const pageSize = 1000;
    let allRows: KasRow[] = [];
    let from = 0;
    let to = pageSize - 1;
    let hasMore = true;

    // 🔄 Loop ambil semua batch histori kas_harian
    while (hasMore) {
      const { data: rows, error } = await supabase
        .from("kas_harian")
        .select("*")
        .order("tanggal", { ascending: true })
        .order("waktu", { ascending: true })
        .order("urutan", { ascending: true })
        .range(from, to);

      if (error) {
        console.error("❌ Gagal ambil histori kas_harian:", error.message);
        break;
      }

      if (rows && rows.length > 0) {
        allRows = [...allRows, ...(rows as KasRow[])];
        from += pageSize;
        to += pageSize;
        hasMore = rows.length === pageSize; // kalau kurang dari 10k berarti sudah habis
      } else {
        hasMore = false;
      }
    }

    // urutkan defensif berdasarkan tanggal+waktu
    const sortedAll = [...allRows].sort((a, b) => {
      const tA = new Date(`${a.tanggal} ${a.waktu ?? "00:00:00"}`).getTime();
      const tB = new Date(`${b.tanggal} ${b.waktu ?? "00:00:00"}`).getTime();
      return tA - tB;
    });

    // inject saldo untuk semua transaksi (mulai dari 0)
    const injectedAll = injectSaldoKeData(sortedAll, 0);

    // hitung saldo awal (saldo terakhir sebelum startDate)
    const saldoAwalValid = getSaldoAwalDariHistori(injectedAll, startDate);

    // fallback: apabila histori ada tetapi semua saldo_akhir null
    let saldoAwal = saldoAwalValid;
    const historiExist = injectedAll.length > 0;
    const semuaTanpaSaldo =
      historiExist &&
      injectedAll.every(
        (r) => r.saldo_akhir === null || r.saldo_akhir === undefined
      );
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

      // Biaya Etoll (dari premi_driver)
      const { data: etollData, error: etollError } = await supabase
        .from("premi_driver")
        .select("biaya_etoll")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);

      if (etollError) console.error("Biaya EToll fetch error:", etollError.message);

      const biayaEtoll = etollData?.reduce((t, r) => t + (r.biaya_etoll || 0), 0) || 0;

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
        biayaEtoll,
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
  <div id="print-root" className="p-6 max-w-3xl mx-auto bg-white min-h-screen">

    <h1 className="text-3xl font-bold mb-6 text-gray-800 tracking-wide">
      Ringkasan Kasir
    </h1>

    {/* DATE RANGE */}
    <div className="flex gap-6 mb-8">
      <div ref={triggerRef}>
        <label className="font-semibold text-gray-700">Date range: </label>
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-[240px] cursor-pointer bg-white shadow-sm hover:bg-gray-100 transition"
        />

        {showPicker &&
          createPortal(
            <div
              ref={pickerRef}
              className="z-50 shadow-2xl border bg-white p-2 rounded-xl"
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
                <button 
                 onClick={() => setShowPicker(false)}
                 className="px-4 py-1.5 bg-green-600 text-white rounded-lg shadow hover:bg-green-700">
                  Apply
                </button>
                <button
                  onClick={() => setShowPicker(false)}
                  className="px-4 py-1.5 bg-gray-300 rounded-lg shadow hover:bg-gray-400"
                >
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
      <div 
        id="print-area"
        className="bg-white shadow-lg rounded-2xl p-6 space-y-8 border border-gray-200">

        {/* SALDO AWAL */}
        <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-green-500 to-green-400 text-white shadow-md">
          <span className="text-lg font-semibold">A. Saldo Awal</span>
          <span className="text-xl font-bold">{formatCurrency(summary.saldoAwal)}</span>
        </div>

        {/* KAS MASUK */}
        <div className="bg-gray-100 rounded-xl p-4 shadow-inner">
          <h2 className="font-bold mb-3 text-gray-800 text-lg">B. Komponen Kas Masuk</h2>

          <div className="flex justify-between py-1">
            <span>Potongan Driver</span>
            <span className="font-semibold text-blue-700">{formatCurrency(summary.potonganDriver)}</span>
          </div>

          <div className="flex justify-between py-1">
            <span>Kas Masuk</span>
            <span className="font-semibold text-blue-700">{formatCurrency(summary.kasMasuk)}</span>
          </div>

          <div className="flex justify-between font-semibold border-t border-gray-300 mt-2 pt-2 text-gray-800">
            <span>Sub Total</span>
            <span className="text-blue-800">
              {formatCurrency(summary.potonganDriver + summary.kasMasuk)}
            </span>
          </div>
        </div>

        {/* KAS KELUAR */}
        <div className="bg-gray-100 rounded-xl p-4 shadow-inner">
          <h2 className="font-bold mb-3 text-gray-800 text-lg">C. Komponen Kas Keluar</h2>

          <div className="flex justify-between py-1">
            <span>Uang Saku Driver</span>
            <span className="font-semibold text-red-700">{formatCurrency(summary.uangSaku)}</span>
          </div>

          <div className="flex justify-between py-1">
            <span>Premi Driver</span>
            <span className="font-semibold text-red-700">{formatCurrency(summary.premiDriver)}</span>
          </div>

          <div className="flex justify-between py-1">
            <span>Perpal</span>
            <span className="font-semibold text-red-700">{formatCurrency(summary.perpalDriver)}</span>
          </div>

          <div className="flex justify-between py-1">
            <span>Kasbon</span>
            <span className="font-semibold text-red-700">{formatCurrency(summary.kasbon)}</span>
          </div>

          <div className="flex justify-between py-1">
            <span>Kas Keluar</span>
            <span className="font-semibold text-red-700">{formatCurrency(summary.kasKeluar)}</span>
          </div>

          <div className="flex justify-between font-semibold border-t border-gray-300 mt-2 pt-2 text-gray-800">
            <span>Sub Total</span>
            <span className="text-red-800">
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

        {/* SALDO AKHIR */}
        <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 text-white shadow-lg">
          <span className="text-lg font-bold">D. Saldo Akhir (A + B - C)</span>
          <span className="text-2xl font-extrabold">
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

        {/* REALISASI */}
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <h2 className="font-bold mb-3 text-gray-800 text-lg">Laporan Realisasi</h2>

          <div className="flex justify-between py-1">
            <span>Realisasi Saku</span>
            <span className="font-semibold text-purple-700">{formatCurrency(summary.realisasiSaku)}</span>
          </div>

          <div className="flex justify-between py-1">
            <span>Realisasi Kasbon</span>
            <span className="font-semibold text-purple-700">{formatCurrency(summary.realisasiKasbon)}</span>
          </div>

          <div className="flex justify-between font-bold border-t border-gray-300 mt-2 pt-2 text-gray-900">
            <span>Total Realisasi</span>
            <span className="text-purple-800">
              {formatCurrency(summary.realisasiSaku + summary.realisasiKasbon)}
            </span>
          </div>
        </div>
        {/* LAPORAN BIAYA ETOLL */}
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <h2 className="font-bold mb-3 text-gray-800 text-lg">Laporan Biaya EToll (Non Tunai)</h2>

            <div className="flex justify-between py-1">
              <span>Total Biaya EToll</span>
              <span className="font-semibold text-orange-700">
                {formatCurrency(summary.biayaEtoll || 0)}
              </span>
            </div>
          </div>
      </div>
    )}

    <style>
    {`
    @media print {

      /* Atur ukuran halaman */
      @page {
        size: A4;
        margin: 10mm;
      }

      /* Sembunyikan selain print-root */
      body * {
        visibility: hidden !important;
      }

      #print-root, #print-root * {
        visibility: visible !important;
      }

      /* Geser ke pojok kiri atas dan scale 130% biar pas 1 halaman */
      #print-root {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        transform: scale(1.20);
        transform-origin: top left;
      }

      /* Warna tetap tampil */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      body {
        background: #ffffff !important;
      }
    }
    `}
    </style>
  </div>
);
}