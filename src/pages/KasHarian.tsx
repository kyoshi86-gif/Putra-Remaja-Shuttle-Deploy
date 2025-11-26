// src/pages/KasHarian.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload, FiPrinter } from "react-icons/fi";
import { exportTableToExcel, type ColumnConfig } from "../utils/exportTableToExcel";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { DateRangePicker } from "react-date-range";
import { createPortal } from "react-dom";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { getSaldoAwalDariHistori, injectSaldoKeData } from "../utils/finance";
import { insertWithAutoNomor } from "../lib/dbUtils"; // pastikan path sesuai
import { toWIBDateString, getWIBTimestampFromUTC, toWIBTimeString } from "../utils/time";
import type { KasRow } from "../utils/types";
import type { UangSakuFormData }  from "../components/forms/PopupUangSakuDriver";
import type { Range } from "react-date-range";
import PopupUangSakuDriver from "../components/forms/PopupUangSakuDriver";
import { getCustomUserId } from "../lib/authUser";

// === Fix TS: deklarasi properti custom untuk Window ===
declare global {
  interface Window {
    __extraCashOpnameHTML__?: string;
  }
}

// --- helper untuk export excel ---
export const toDate = (v: unknown): Date | "" => {
  if (!v) return ""; // ⛔ null, undefined, empty string
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? "" : d;
};

export default function KasHarian() {
  // Data
  const [data, setData] = useState<KasRow[]>([]);
  const [, setFiltered] = useState<KasRow[]>([]);
  const [dataWithSaldo, setDataWithSaldo] = useState<KasRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saldoAwalHistori, setSaldoAwalHistori] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  // Untuk Pop Up UangSakuDriver
  const [formSource, setFormSource] = useState<"kas_harian" | "uang_saku_driver">("kas_harian"); //edit tr uangsakudriver
  const [sjSearch, setSjSearch] = useState("");
  const [sjList] = useState<{ id?: number; no_surat_jalan: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  // Untuk ambil user di localstorage

  const handleSelectSj = (sj: { no_surat_jalan: string }) => {
    setSjSearch(sj.no_surat_jalan);
    setShowDropdown(false);
  };

  //-- ambil user dari localstorage --
 interface CustomUser {
    id: string;
    name?: string;
    email?: string;
  }

  const [customUser, setCustomUser] = useState<CustomUser | null>(null);

  // === AMBIL USER LOGIN DARI LOCALSTORAGE ===
  useEffect(() => {
    const storedUser = localStorage.getItem("custom_user");
    if (storedUser) {
      try {
        setCustomUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Gagal parsing user:", err);
      }
    }
  }, []);

  // Search & Filter
  const [filterBy, setFilterBy] = useState<
    "bukti_transaksi" | "waktu" | "keterangan" | "nominal" | "user_id" | "updated_at"
  >("bukti_transaksi");
  const [q, setQ] = useState("");

  const [range, setRange] = useState<Range[]>([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  // Fetch all data (tanpa filter Supabase)
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from("kas_harian")
        .select("*")
        .order("tanggal", { ascending: true })
        .order("waktu", { ascending: true })
        .order("urutan", { ascending: true })

      if (error) throw error;

      const hasil = (rows || []) as KasRow[];
      setData(hasil);

      // ⛔ Jangan ubah range di sini — biarkan tetap default hari ini
      // Jika ingin tombol "Tampilkan Semua", bisa buat handler terpisah
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Gagal ambil data kas: " + message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter + inject saldo (FINAL)
  useEffect(() => {
    const startStr = toWIBDateString(range[0].startDate ?? new Date());
    const endStr = toWIBDateString(range[0].endDate ?? new Date());

    // 1️⃣ Urutkan berdasarkan tanggal + waktu
    const sorted = [...data].sort((a, b) => {
      const tA = new Date(a.tanggal + " " + (a.waktu ?? "00:00:00")).getTime();
      const tB = new Date(b.tanggal + " " + (b.waktu ?? "00:00:00")).getTime();
      return tA - tB;
    });

    // 2️⃣ INJECT SALDO UNTUK SEMUA DATA (sekali saja)
    const injectedAll = injectSaldoKeData(sorted, 0);

    // =========================================
    // 🟦 LOGGER: pengecekan urutan & saldo akhir
    // =========================================
    //-- LOG ==>console.group("🔍 LOG SALDO SEMUA TRANSAKSI");

    //-- LOG ==>injectedAll.forEach((r, i) => {
    //-- LOG ==>  console.log(
    //-- LOG ==>    `${i + 1}. ${r.tanggal} ${r.waktu} | ${r.jenis_transaksi} | ${r.nominal?.toLocaleString()} | saldo_awal=${r.saldo_awal?.toLocaleString()} → saldo_akhir=${r.saldo_akhir?.toLocaleString()} | bukti=${r.bukti_transaksi}`
    //-- LOG ==>  );
    //-- LOG ==>});

    // Temukan saldo akhir tanggal 21
    //-- LOG ==>const last21 = injectedAll
    //-- LOG ==>  .filter(r => r.tanggal === "2025-11-21")
    //-- LOG ==>  .at(-1);

    // Temukan transaksi pertama tanggal 22
    //-- LOG ==>const first22 = injectedAll
    //-- LOG ==>  .filter(r => r.tanggal === "2025-11-22")
    //-- LOG ==>  .at(0);

    //-- LOG ==>console.log("🔵 SALDO AKHIR 21:", last21?.saldo_akhir);
    //-- LOG ==>console.log("🟢 SALDO AWAL 22 :", first22?.saldo_awal);

    //-- LOG ==>if (last21?.saldo_akhir !== first22?.saldo_awal) {
    //-- LOG ==>  console.warn("❗ SELISIH TERDETEKSI antara 21 → 22");
    //-- LOG ==>  console.log("👉 Perbedaan:",
    //-- LOG ==>    (first22?.saldo_awal ?? 0) - (last21?.saldo_akhir ?? 0)
    //-- LOG ==>  );
    //-- LOG ==>  console.log("🔍 Transaksi pertama tanggal 22: ", first22);
    //-- LOG ==>}

    //-- LOG ==>console.groupEnd();

    // 3️⃣ Saldo hari kemarin

    //-- LOG ==>console.log("📌 Hitung saldo kemarin berdasarkan dataKas & tanggalAwal =", startStr);

    const saldoKemarin = getSaldoAwalDariHistori(injectedAll, startStr);
    setSaldoAwalHistori(saldoKemarin);


    // 4️⃣ Filter rentang tanggal
    const startTime = new Date(`${startStr} 00:00:00`);
    const endTime   = new Date(`${endStr} 23:59:59`);

    const filteredRange = injectedAll.filter((r) => {
      const dt = new Date(`${r.tanggal} ${r.waktu ?? "00:00:00"}`);
      return dt >= startTime && dt <= endTime;
    });

    // 5️⃣ Filter keyword
    let filteredKeyword = filteredRange;
    const keyword = q.toLowerCase().trim();

    if (keyword) {
      filteredKeyword = filteredRange.filter((r) => {
        switch (filterBy) {
          case "bukti_transaksi":
            return r.bukti_transaksi?.toLowerCase().includes(keyword);
          case "waktu":
            return r.created_at?.toLowerCase().includes(keyword);
          case "keterangan":
            return r.keterangan?.toLowerCase().includes(keyword);
          case "nominal":
            return String(r.nominal ?? "").toLowerCase().includes(keyword);
          case "user_id":
            return (r.user_id ?? "").toLowerCase().includes(keyword);
          case "updated_at":
            return (r.updated_at ?? "").toLowerCase().includes(keyword);
          default:
            return true;
        }
      });
    }

    // 6️⃣ Inject saldo untuk data dalam range
    const injectedFinal = injectSaldoKeData(filteredKeyword, saldoKemarin);
    // =========================================
    // 🟩 LOGGER DATA TAMPILAN RENTANG TANGGAL
    // =========================================
    //-- LOG ==>console.group("📘 LOG DATA RENTANG TANGGAL");
    //-- LOG ==>console.log("Saldo Kemarin:", saldoKemarin);

    //-- LOG ==>injectedFinal.forEach((r, i) => {
    //-- LOG ==>  console.log(
    //-- LOG ==>    `${i + 1}. ${r.tanggal} ${r.waktu} | ${r.jenis_transaksi} | ${r.nominal} | awal=${r.saldo_awal} akhir=${r.saldo_akhir} | bukti=${r.bukti_transaksi}`
    //-- LOG ==>  );
    //-- LOG ==>});

    //-- LOG ==>console.groupEnd();


    // 7️⃣ Set state
    setFiltered(filteredKeyword);
    setDataWithSaldo(injectedFinal);
    setCurrentPage(1);
  }, [data, q, filterBy, range]);

  // Modal form
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"add_debet" | "add_kredit" | "edit">("add_debet");
  const defaultForm: Partial<KasRow> = {
    waktu: "new Date().toTimeString().slice(0, 8)",
    bukti_transaksi: "",
    keterangan: "",
    jenis_transaksi: "debet",
    nominal: 0,
    user_id: null,
    sumber_id: null,
    sumber_tabel: null,
  };
  const [formData, setFormData] = useState<Partial<KasRow>>(defaultForm);

  //-- untuk uangsakudriver --
  const defaultUangSakuForm: UangSakuFormData = {
    id: 0,
    sumber_id: 0,
    tanggal: "",
    waktu: "",
    no_uang_saku: "",
    no_surat_jalan: "",
    tanggal_berangkat: "",
    tanggal_kembali: "",
    driver: "",
    crew: "",
    no_polisi: "",
    kode_unit: "",
    kode_rute: "",
    bbm: 0,
    uang_makan: 0,
    parkir: 0,
    jumlah: 0,
    kartu_etoll: "",
    jenis_transaksi: "debet",
    user_id: "",
    keterangan: "",
  };

  const [formUangSaku, setFormUangSaku] = useState<UangSakuFormData>(defaultUangSakuForm);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  
  // Pagination logic
  const totalPages = 1; // karena semua data ditampilkan pada 1 halaman
  const paginatedData = dataWithSaldo;

  // Popup Cash Opname
  const [showCashOpname, setShowCashOpname] = useState(false);

  // Data Cash Opname
  const [cashOpnameRows, setCashOpnameRows] = useState([
    { nominal: 100000, qty: "" },
    { nominal: 50000, qty: "" },
    { nominal: 20000, qty: "" },
    { nominal: 10000, qty: "" },
    { nominal: 5000, qty: "" },
    { nominal: 2000, qty: "" },
    { nominal: 1000, qty: "" },
  ]);


  //-- Reset form Cash Opname --
  const resetCashOpname = () => {
    setCashOpnameRows([
      { nominal: 100000, qty: "" },
      { nominal: 50000, qty: "" },
      { nominal: 20000, qty: "" },
      { nominal: 10000, qty: "" },
      { nominal: 5000, qty: "" },
      { nominal: 2000, qty: "" },
      { nominal: 1000, qty: "" },
    ]);
    
    setBrankas("");
    setCheckerName("");
  };

  const [brankas, setBrankas] = useState("")
  const [checkerName, setCheckerName] = useState(""); // nama pemeriksa
  const [pendingPrintRange, setPendingPrintRange] = useState<{ start: Date; end: Date } | null>(null);

  // select all checkbox behavior
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selected.length > 0 && selected.length < paginatedData.length;
    }
  }, [selected, paginatedData]);

  const handleSelectAll = () => {
    if (selected.length === paginatedData.length) setSelected([]);
    else setSelected(paginatedData.map((p) => String(p.id)));
  };

  const handleSelect = (id: string) =>
  setSelected((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );

  // Delete selected
  const handleDeleteSelected = async () => {
    if (selected.length === 0) return alert("Pilih data terlebih dahulu!");
    if (!confirm("Yakin ingin hapus data terpilih?")) return;

    const { data: rows, error: fetchError } = await supabase
      .from("kas_harian")
      .select("*")
      .in("id", selected);

    if (fetchError) {
      alert("❌ Gagal ambil data kas_harian: " + fetchError.message);
      return;
    }

    const premiTransaksi = new Set<string>();
    const uangSakuIds: number[] = [];
    const kasIds: string[] = [];

    for (const row of rows || []) {
      kasIds.push(row.id);

      if (row.sumber_tabel === "premi_driver" && row.bukti_transaksi) {
        premiTransaksi.add(row.bukti_transaksi);
      }

      if (row.sumber_tabel === "uang_saku_driver" && row.sumber_id) {
        uangSakuIds.push(row.sumber_id);
      }
    }

    // 🔥 Hapus semua kas_harian dengan bukti_transaksi dari premi_driver
    if (premiTransaksi.size > 0) {
      const noPDs = Array.from(premiTransaksi);

      const { error: deleteKasPD } = await supabase
        .from("kas_harian")
        .delete()
        .in("bukti_transaksi", noPDs)
        .in("sumber_tabel", ["premi_driver", "perpal", "potongan", "realisasi_saku_header", "realisasi_saku_sisa", "realisasi_saku_item"]);

      if (deleteKasPD) {
        alert("❌ Gagal hapus kas_harian premi_driver: " + deleteKasPD.message);
        return;
      }

      const { error: deletePremi } = await supabase
        .from("premi_driver")
        .delete()
        .in("no_premi_driver", noPDs);

      if (deletePremi) {
        alert("❌ Gagal hapus premi_driver: " + deletePremi.message);
        return;
      }

      window.dispatchEvent(new Event("refresh-premi-driver"));
    }

    // 🔥 Hapus sumber uang_saku_driver jika ada
    if (uangSakuIds.length > 0) {
      const { error: deleteSaku } = await supabase
        .from("uang_saku_driver")
        .delete()
        .in("id", uangSakuIds);

      if (deleteSaku) {
        alert("❌ Gagal hapus uang_saku_driver: " + deleteSaku.message);
        return;
      }
    }

    // 🔥 Hapus kas_harian biasa
    const { error: deleteKas } = await supabase
      .from("kas_harian")
      .delete()
      .in("id", kasIds);

    if (deleteKas) {
      alert("❌ Gagal hapus kas_harian: " + deleteKas.message);
    } else {
      setSelected([]);
      fetchData();
    }
  };

  // Export Excel (Set Manual sesuai frontend)
  const handleExportExcel = () => {
    console.log("🔍 Sample row:", dataWithSaldo[0]);

    const columns: ColumnConfig[] = [
    { label: "Tanggal", key: "tanggal", type: "date", format: toDate, formatString: "dd/mm/yyyy" },
    { label: "Waktu", key: "waktu" },
    { label: "No Bukti", key: "bukti_transaksi" },
    { label: "Keterangan", key: "keterangan" },
    {
      label: "Debet",
      key: "nominal",
      type: "currency",
      format: (v: unknown, r?: Record<string, unknown>) => r?.jenis_transaksi === "debet" ? v : ""
    },
    {
      label: "Kredit",
      key: "nominal",
      type: "currency",
      format: (v: unknown, r?: Record<string, unknown>) => r?.jenis_transaksi === "kredit" ? v : ""
    },
    { label: "Saldo", key: "saldo_akhir", type: "currency" },
    { label: "Created At", key: "created_at", type: "date", format: toDate, formatString: "dd/mm/yyyy hh:mm:ss" },
    { label: "User ID", key: "user_id" },
    { label: "Updated At", key: "updated_at", type: "date", format: toDate, formatString: "dd/mm/yyyy hh:mm:ss" },
  ];

    const sampleRow = dataWithSaldo[0];
    const normalized = columns.map((col) => {
      let val = sampleRow[col.key as keyof typeof sampleRow];
      if (col.format) val = col.format(val, sampleRow);
      if (col.type === "date") {
        const d = new Date(val as string | number | Date);
        return isNaN(d.getTime()) ? "" : d;
      }
      if (col.type === "currency") {
        return typeof val === "number" ? val : Number(val) || "";
      }
      return val ?? "";
    });

    console.log("🔍 Normalized row:", normalized);

    exportTableToExcel(dataWithSaldo, {
      filename: "KasHarian.xlsx",
      sheetName: "Kas Harian",
      columns,
      prependRows: [
        { keterangan: "Saldo Awal", saldo_akhir: saldoAwalHistori }
      ],
      appendRows: [
        { keterangan: "Saldo Akhir", saldo_akhir: dataWithSaldo.at(-1)?.saldo_akhir }
      ]
    });
  };

  // ganti seluruh handlePrint dengan ini
  const handlePrint = (startDate: Date, endDate: Date) => {
    const table = document.querySelector("table");
    if (!table) return alert("Tabel tidak ditemukan!");

    const clonedTable = table.cloneNode(true) as HTMLElement;

    const removeColumns = (tableEl: HTMLElement) => {
      const ths = Array.from(tableEl.querySelectorAll("thead th"));
      const removeIndexes: number[] = [];

      ths.forEach((th, i) => {
        const text = (th.textContent || "").toLowerCase().trim();
        const hasCheckbox = !!th.querySelector("input[type='checkbox']");
        if (hasCheckbox || text === "aksi" || text === "jenis" || text === "waktu" || text === "user id" || text === "updated at") {
          removeIndexes.push(i);
        }
      });

      tableEl.querySelectorAll("tr").forEach((tr) => {
        removeIndexes.sort((a, b) => b - a).forEach((idx) => {
          tr.children[idx]?.remove();
        });
      });
    };
    removeColumns(clonedTable);

    let dateRange = "Date range tidak tersedia";
    try {
      if (startDate && endDate) {
        dateRange = `${format(startDate, "dd MMM yy")} - ${format(endDate, "dd MMM yy")}`;
      }
    } catch {}

    const htmlContent = `
        <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print Kas Harian</title>
          <style>
            @page { size: A4 portrait; margin: 6mm; }
            html, body {
              margin: 0;
              padding: 0;
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed; /* penting agar width kolom dipatuhi */
              line-height: 1 !important;
              overflow-wrap: anywhere !important;
              word-break: keep-all !important;
            }

            /* 🧩 Atur proporsi kolom */
            table colgroup col:nth-child(1) { width: 12%; }   /* tanggal */
            table colgroup col:nth-child(2) { width: 12%; }   /* no bukti */
            table colgroup col:nth-child(3) { width: 50%; }  /* keterangan */
            table colgroup col:nth-child(4) { width: 12%; }  /* debet */
            table colgroup col:nth-child(5) { width: 12%; }  /* kredit */
            table colgroup col:nth-child(6) { width: 12%; }  /* saldo */

            thead th {
              border: 1px solid #000 !important;
              padding: 2px 4px !important;
              background: #fff !important;
              color: #000 !important;
              font-weight: bold !important;
              text-align: center !important;
              font-size: 12px !important;
              line-height: 1 !important;
            }

            table td {
              border: 1px solid #000 !important;
              padding: 2px 4px !important;
              line-height: 1 !important;
              vertical-align: middle !important;
              font-size: 12px !important;
              text-align: center !important;
            }

            td.tengah, th.tengah { text-align: center !important; }
            td.kanan, th.kanan { text-align: right !important; }
            td.text-left, th.text-left, td.keterangan { text-align: left !important; }

            td.kanan { white-space: nowrap; }

            button, input[type="checkbox"], .no-print { display: none !important; }

            tbody tr:nth-child(even) td { background: #fafafa !important; }

            h2 {
              text-align: center;
              margin: 4px 0 6px 0;
              font-size: 16px;
            }

            .daterange {
              margin: 0 0 6px 4px;
              font-size: 12px;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <h2>Kas Harian</h2>
          <div class="daterange">Date range : ${dateRange}</div>
          <table>
            <colgroup>
              <col /><col /><col /><col /><col /><col />
            </colgroup>
          ${clonedTable.innerHTML}
        </table>

        ${window.__extraCashOpnameHTML__ ?? ""}
      `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("Popup diblokir!");

    const finalHTML = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cetak Kas Harian</title>
          <style>
            @page { size: A4 portrait; margin: 6mm; }
            body { font-family: Arial; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #000; padding: 2px 4px; font-size: 12px; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(finalHTML);
    printWindow.document.close();

    window.__extraCashOpnameHTML__ = undefined; // reset

    printWindow.onload = () => {
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    };
  };

  //--- Print with Cash Opname ---
  const handlePrintWithCashOpname = () => {
    if (!pendingPrintRange) return;

    // === hitung total fisik cash opname ===
    const totalFisik = cashOpnameRows.reduce(
      (sum, r) => sum + r.nominal * (Number(r.qty) || 0),
      0
    );

    // pastikan saldoAkhir tidak null
    const rawSaldoAkhir =
      dataWithSaldo.length > 0
        ? dataWithSaldo[dataWithSaldo.length - 1].saldo_akhir
        : 0;

    const saldoAkhir = rawSaldoAkhir ?? 0;

    // KONVERSI BRANKAS dari input (yang sudah diformat 1.000.000)
    const brankasValue = Number(brankas.replace(/[^\d]/g, "")) || 0;

    // hitung selisih
    const selisih = saldoAkhir - totalFisik - brankasValue;

    const toNumber = (val: string | number | null) =>
      Number(String(val).replace(/[^\d]/g, "")) || 0;

    const extraContent = `
      <div style="margin-top:20px; display:flex; justify-content:space-between;">
        <div style="text-align:center; width:45%;">
          Dibuat Oleh:<br><br><br><br><br>
          Kasir<br>${customUser?.name || ""}
        </div>
        <div style="text-align:center; width:45%;">
          Diperiksa Oleh:<br><br><br><br><br>
          Accounting
        </div>

        <div style="width:41%;">
          <table style="width:100%; border-collapse:collapse;" border="1">
            <tr><th colspan="3">CASH OPNAME</th></tr>
            <tr><th colspan="3">${new Date().toLocaleDateString("id-ID")}</th></tr>
            <tr><th colspan="2">Saldo Akhir</th><th>${saldoAkhir.toLocaleString("id-ID")}</th></tr>
            ${cashOpnameRows
              .map(
                r => `
                  <tr>
                    <td>${r.nominal.toLocaleString("id-ID")}</td>
                    <td>${r.qty}</td>
                    <td>${(r.nominal * Number(r.qty || 0)).toLocaleString("id-ID")}</td>
                  </tr>`
              )
              .join("")}
            <tr><th colspan="2">Jumlah Fisik</th><th>${totalFisik.toLocaleString("id-ID")}</th></tr>
           <tr>
            <th colspan="2">Brankas</th>
            <th>${toNumber(brankas).toLocaleString("id-ID")}</th>
          </tr>
            <tr><th colspan="2">Selisih</th><th>${selisih.toLocaleString("id-ID")}</th></tr>
          </table>
        </div>
      </div>

      <div style="margin-top:10px; text-align:right;">
        Check Cash Opname Oleh:<br><br><br><br><br>
        ${checkerName || " "}
      </div>
    `;

    // simpan ke window untuk digunakan handlePrint
    window.__extraCashOpnameHTML__ = extraContent;

    resetCashOpname();
    setShowCashOpname(false);

    handlePrint(pendingPrintRange.start, pendingPrintRange.end);
  };

  // Open form for Kas Masuk / Keluar
  const openForm = (mode: "add_debet" | "add_kredit", row?: KasRow) => {
    setFormSource("kas_harian"); // ✅ reset sumber form
    setFormMode(mode);

    const now = new Date();
    const todayStr =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");
    const timeStr = now.toTimeString().split(" ")[0]; // 'HH:MM:SS'

    if (row) {
      setFormData({
        ...row,
        tanggal: row.tanggal || todayStr,
        waktu: row.waktu || timeStr,
      });
    } else {
      setFormData({
        tanggal: todayStr,
        waktu: timeStr,
        jenis_transaksi: mode === "add_debet" ? "debet" : "kredit",
        bukti_transaksi: "",
        keterangan: "",
        nominal: 0,
        user_id: null,
      });
    }

    setShowForm(true);
  };

  const [isSaving, setIsSaving] = useState(false);

  // Save form (insert or update)
  const handleSave = async () => {
    if (isSaving) return; // ⛔ cegah double klik
    setIsSaving(true);
    try {
      // Basic validation
      if (!formData.tanggal || !formData.nominal) {
        alert("Tanggal dan Nominal wajib diisi.");
        return;
      }

      // Ambil saldo terakhir
      const { error: saldoError } = await supabase
        .from("kas_harian")
        .select("*")
        .order("tanggal", { ascending: false })
        .order("id", { ascending: false })
        .limit(1);

      if (saldoError) throw saldoError;

      const saldoAwal = data?.[0]?.saldo_akhir ?? 0;
      const nominal = Number(formData.nominal) || 0;
      const isDebet =
        formMode === "edit"
          ? formData.jenis_transaksi === "debet"
          : formMode === "add_debet";

      const saldoAkhir = isDebet ? saldoAwal + nominal : saldoAwal - nominal;

      const currentUserId = getCustomUserId();


      const payload = {
        tanggal: formData.tanggal,
        waktu: formData.waktu,
        bukti_transaksi: formData.bukti_transaksi?.trim() || "",
        keterangan: formData.keterangan || "",
        jenis_transaksi: isDebet ? "debet" : "kredit",
        nominal,
        saldo_awal: saldoAwal,
        saldo_akhir: saldoAkhir,
        user_id: currentUserId, // ✅ sekarang ambil dari custom_users
        sumber_id: formData.sumber_id ?? null,
        sumber_tabel: formData.sumber_tabel ?? null,
        updated_at: new Date().toISOString(),
      };

      if (formMode === "edit" && formData.id) {
        const { error } = await supabase
          .from("kas_harian")
          .update(payload)
          .eq("id", formData.id);
        if (error) throw error;

        // Sinkronisasi ke uang_saku_driver jika sumbernya cocok
        if (formData.sumber_tabel === "uang_saku_driver" && formData.sumber_id) {
          const { error: updateSakuError } = await supabase
            .from("uang_saku_driver")
            .update({
              tanggal: formData.tanggal,
              no_uang_saku: formData.bukti_transaksi,
              bbm: formData.bbm,
              uang_makan: formData.uang_makan,
              parkir: formData.parkir,
              jumlah: formData.jumlah,
              kartu_etoll: formData.kartu_etoll,
              no_surat_jalan: formData.no_surat_jalan,
              user_id: currentUserId,
            })
            .eq("id", formData.sumber_id);

          if (updateSakuError) {
            alert("❌ Gagal update Uang Saku Driver: " + updateSakuError.message);
          }
        }

        alert("Data berhasil diupdate.");
      } else {
        // Tambahkan nomor otomatis jika bukti_transaksi kosong
        const prefix = isDebet ? "BM-" : "BK-";

        const result = await insertWithAutoNomor({
          table: "kas_harian",
          prefix,
          data: payload,
          nomorField: "bukti_transaksi",
          tanggal: formData.tanggal,
        });

        if (!result.success) {
          throw new Error(result.error);
        }

        alert(`Data berhasil disimpan dengan No Bukti: ${result.nomor}`);
      }

      setShowForm(false);
      setFormData(defaultForm);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Gagal simpan: " + message);
    } finally {
      setIsSaving(false); // ✅ buka kunci submit
    }
  };

  // --- Handler: Edit Kas yang berasal dari uang_saku_driver ---
  const handleEditKas = async (kasRow: KasRow) => {
    // ⛔ Blokir edit untuk transaksi dari premi_driver
    if (kasRow.sumber_tabel === "premi_driver") {
      alert("Silahkan edit di halaman premi driver.");
      return;
    }

    // 🔁 Edit untuk uang_saku_driver
    if (kasRow.sumber_tabel === "uang_saku_driver" && kasRow.sumber_id) {
      const { data, error } = await supabase
        .from("uang_saku_driver")
        .select("*")
        .eq("id", kasRow.sumber_id)
        .single();

      if (error || !data) {
        alert("❌ Data Uang Saku Driver tidak ditemukan.");
        return;
      }

      setFormUangSaku({
        ...data,
        id: kasRow.id,
        sumber_id: kasRow.sumber_id,
        sumber_tabel: kasRow.sumber_tabel,
        bukti_transaksi: kasRow.bukti_transaksi,
        jenis_transaksi: kasRow.jenis_transaksi,
        nominal: kasRow.nominal,
        user_id: kasRow.user_id ?? "",
        keterangan: kasRow.keterangan ?? "",
        tanggal: kasRow.tanggal,
        waktu: kasRow.waktu ?? "",
      });

      setFormMode("edit");
      setFormSource("uang_saku_driver");
      setShowForm(true);
      return;
    }

    // ✅ Edit transaksi kas_harian biasa
    setFormData({ ...kasRow });
    setFormMode("edit");
    setFormSource("kas_harian");
    setShowForm(true);
  };

  // --- Handler: Single Delete Kas dan sumbernya jika dari uang_saku_driver ---
  const handleDeleteKas = async (kasRow: KasRow) => {
    if (!confirm("Yakin ingin hapus transaksi ini?")) return;

    // 🔥 Jika sumber premi_driver, hapus semua baris kas_harian dengan bukti_transaksi yang sama
    if (kasRow.sumber_tabel === "premi_driver" && kasRow.bukti_transaksi) {
      // 1️⃣ Ambil semua baris kas_harian dengan bukti_transaksi yang sama
      const { data: relatedKas, error: fetchError } = await supabase
        .from("kas_harian")
        .select("id")
        .eq("bukti_transaksi", kasRow.bukti_transaksi)
        .in("sumber_tabel", ["premi_driver", "perpal", "potongan", "realisasi_saku_header", "realisasi_saku_sisa", "realisasi_saku_item"]);

      if (fetchError) {
        alert("❌ Gagal ambil transaksi terkait: " + fetchError.message);
        return;
      }

      const kasIds = relatedKas?.map((row) => row.id) ?? [];

      // 2️⃣ Hapus semua baris kas_harian terkait
      if (kasIds.length > 0) {
        const { error: deleteKasError } = await supabase
          .from("kas_harian")
          .delete()
          .in("id", kasIds);

        if (deleteKasError) {
          alert("❌ Gagal hapus kas_harian: " + deleteKasError.message);
          return;
        }
      }

      // 3️⃣ Hapus baris premi_driver yang sesuai
      const { error: deletePremiError } = await supabase
        .from("premi_driver")
        .delete()
        .eq("no_premi_driver", kasRow.bukti_transaksi);

      if (deletePremiError) {
        alert("❌ Gagal hapus Premi Driver: " + deletePremiError.message);
        return;
      }

      window.dispatchEvent(new Event("refresh-premi-driver"));
      await fetchData(); // refresh kas_harian
      return;
    }

    // 🔥 Jika sumber uang_saku_driver, hapus baris terkait
    if (kasRow.sumber_tabel === "uang_saku_driver" && kasRow.sumber_id) {
      const { error: deleteSakuError } = await supabase
        .from("uang_saku_driver")
        .delete()
        .eq("id", kasRow.sumber_id);

      if (deleteSakuError) {
        alert("❌ Gagal hapus Uang Saku Driver: " + deleteSakuError.message);
        return;
      }
    }

    // ✅ Hapus baris kas_harian biasa
    const { error: deleteKasError } = await supabase
      .from("kas_harian")
      .delete()
      .eq("id", kasRow.id);

    if (deleteKasError) {
      alert("❌ Gagal hapus Kas Harian: " + deleteKasError.message);
    } else {
      await fetchData(); // refresh kas_harian
    }
  };

  // ESC untuk semua popup (form utama & cash opname)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      // Tutup Cash Opname jika terbuka
      if (showCashOpname) {
        resetCashOpname();
        setShowCashOpname(false);
        return;
      }

      // Tutup Form Utama jika terbuka
      if (showForm) {
        setShowForm(false);
        setFormData(defaultForm);
        return;
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showCashOpname, showForm]);

  // formatting helper for display (ID locale)
  const fmt = (n: number | null | undefined) =>
    n === null || n === undefined || Number.isNaN(n) ? "" : Number(n).toLocaleString("id-ID");

    // Fungsi Date Picker
    const pickerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [pickerStyle, setPickerStyle] = useState({ top: 0, left: 0 });

   useEffect(() => {
  if (showPicker && pickerRef.current && triggerRef.current) {
    // Hitung posisi datepicker relatif terhadap trigger
    const rect = triggerRef.current.getBoundingClientRect();
    setPickerStyle({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
    });

    // Handler untuk klik di luar
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
        ) {
            setShowPicker(false);
        }
       }

    // Pasang listener
    document.addEventListener("mousedown", handleClickOutside);

    // Bersihkan saat unmount atau showPicker berubah
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
        };
    }
    }, [showPicker]);

    // ✅ Dengarkan event refresh dari PremiDriver
    useEffect(() => {
      const handleRefresh = () => {
        console.log("🔄 Refresh data Kas Harian dari PremiDriver");
        fetchData();
      };
      window.addEventListener("refresh-kas-harian", handleRefresh);
      return () => window.removeEventListener("refresh-kas-harian", handleRefresh);
    }, []);

  return (
    <div className="p-4 bg-white rounded shadow">
    {/* Range Tanggal box */}
    <div className="flex fw-full pr-8 flex flex-wrap justify-between items-center mb-4 gap-3 lex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
    <div ref={triggerRef}>
      <label className="font-semibold">Date range: </label>
      <input
        type="text" 
        readOnly
        value={
          range[0]?.startDate && range[0]?.endDate
            ? `${format(range[0].startDate, "dd-MM-yyyy", { locale: id })} - ${format(range[0].endDate, "dd-MM-yyyy", { locale: id })}`
            : ""
        }
        onClick={() => setShowPicker(true)}
        className="border border-gray-300 rounded px-2 py-1 text-sm leading-normal w-[220px] cursor-pointer"
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
              onChange={(ranges) => {
                const selection = ranges.selection;
                if (selection?.startDate && selection?.endDate) {
                  setRange([
                    {
                      ...selection,
                      key: "selection",
                    },
                  ]);
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
                <button onClick={() => setShowPicker(false)} className="px-3 py-1 bg-green-600 text-white rounded">Apply</button>
                <button onClick={() => setShowPicker(false)} className="px-3 py-1 bg-gray-300 rounded">Cancel</button>
            </div>
            </div>,
            document.body
          )}
       </div>

          {/* Filter pencarian */}
          <div className="flex items-center gap-2">
            <select
              value={filterBy}
              onChange={(e) =>
                setFilterBy(
                  e.target.value as
                    | "bukti_transaksi"
                    | "waktu"
                    | "keterangan"
                    | "user_id"
                    | "updated_at"
                )
              }
              className="border rounded px-2 py-1"
            >
              <option value="bukti_transaksi">No Bukti</option>
              <option value="waktu">Waktu</option>
              <option value="keterangan">Keterangan</option>
              <option value="user_id">User Id</option>
              <option value="updated_at">Tanggal Update</option>
            </select>
            <input
              type="text"
              placeholder="Kata kunci..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border rounded px-2 py-1"
            />
            <button
              onClick={() => {
                // already reactive; but keep for explicit action
                setCurrentPage(1);
              }}
              className="bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-2"
            >
              Cari
            </button>
          </div>

          <div className="ml-auto flex gap-2">
            <button
                onClick={() => openForm("add_debet")}
                className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded"
                >
                <FiPlus /> Kas Masuk
            </button>

            <button
                onClick={() => openForm("add_kredit")}
                className="flex items-center gap-2 bg-red-400 text-white px-3 py-1 rounded"
                >
                <FiPlus /> Kas Keluar
            </button>

            <button
                onClick={handleDeleteSelected}
                className="bg-red-600 text-white px-3 py-1 rounded"
            >
                Hapus Terpilih
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded"
            >
              <FiDownload /> Export Excel
            </button>

            <button
            onClick={() => {
              setPendingPrintRange({
                start: range[0].startDate!,
                end: range[0].endDate!,
              });
              setShowCashOpname(true); // buka popup cash opname
            }}
            className="flex items-center gap-2 bg-orange-500 text-white px-3 py-1 rounded"
          >
            <FiPrinter /> Cetak
          </button>
          </div>
        </div>

      {/* Tabel */}
      <div className="w-full pr-8">
        <table className="w-full table-auto border border-gray-300 text-sm">
          <thead className="bg-gray-400 text-white">
            <tr>
              <th className="p-2 border text-center w-[40px]">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={
                    selected.length === paginatedData.length && paginatedData.length > 0
                  }
                  onChange={handleSelectAll}
                />
              </th>
              <th className="border p-2 text-center w-[60px]">Aksi</th>
              <th className="border p-2 text-center w-[80px]">Tanggal</th>
              <th className="border p-2 text-center w-[70px]">Waktu</th>
              <th className="border p-2 text-center w-[120px]">No Bukti</th>
              <th className="border p-2 text-center">Keterangan</th>
              <th className="border p-2 text-center w-[60px]">Jenis</th>
              <th className="border p-2 text-center w-[90px]">Debet</th>
              <th className="border p-2 text-center w-[90px]">Kredit</th>
              <th className="border p-2 text-center w-[120px]">Saldo</th>
              <th className="border p-2 text-center w-[40px]">User Id</th>
              <th className="border p-2 text-center w-[130px]">Updated At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="text-center py-3">
                  Memuat data...
                </td>
              </tr>
            ) : (
              <>
                {/* Baris Saldo Awal */}
                <tr className="bg-gray-100 text-center border font-semibold">
                  <td className="p-2 border"></td>
                  <td className="p-2 border"></td>
                  <td className="p-2 border"></td>
                  <td className="p-2 border"></td>
                  <td className="p-2 border"></td>
                  <td className="p-2 border text-center">Saldo Awal</td>
                  <td className="p-2 border"></td>
                  <td className="p-2 border"></td>
                  <td className="p-2 border"></td>
                  <td className="p-2 border">{fmt(saldoAwalHistori)}</td>
                  <td className="p-2 border"></td>
                  <td className="p-2 border"></td>
                </tr>

                {/* Jika tidak ada data */}
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-3">
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Baris Transaksi */}
                    {paginatedData.map((row) => (
                      <tr key={row.id} className="hover:bg-yellow-300 transition-all duration-150 text-center border">
                        <td className="p-2 border">
                          <input
                            type="checkbox"
                            checked={selected.includes(String(row.id))}
                            onChange={() => handleSelect(String(row.id))}
                          />
                        </td>
                        <td className="text-center py-0 px-0">
                          <div className="flex justify-center gap-[0.5px]">
                            <button
                              onClick={() => handleEditKas(row)}
                              className="text-blue-600 hover:text-blue-800 px-[5px]"
                              title="Edit"
                            >
                              <FiEdit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteKas(row)}
                              className="text-red-600 hover:text-red-800 px-[5px]"
                              title="Hapus"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="tengah p-2 border">
                          {row.tanggal ? toWIBDateString(new Date(row.tanggal), "display") : ""}
                        </td>
                        <td className="tengah p-2 border">{row.waktu ? toWIBTimeString(row.waktu) : ""}</td>
                        <td className="tengah p-2 border">{row.bukti_transaksi}</td>
                        <td className="p-2 border text-left">{row.keterangan}</td>
                        <td className="p-2 border">{row.jenis_transaksi}</td>
                        <td className="kanan p-2 border">{row.jenis_transaksi === "debet" ? fmt(row.nominal) : ""}</td>
                        <td className="kanan p-2 border">{row.jenis_transaksi === "kredit" ? fmt(row.nominal) : ""}</td>
                        <td className="kanan p-2 border">{fmt(row.saldo_akhir)}</td>
                        <td className="tengah p-2 border">{row.user_id}</td>
                        <td className="tengah p-2 border">
                          {row.updated_at ? getWIBTimestampFromUTC(row.updated_at) : ""}
                        </td>
                      </tr>
                    ))}

                    {/* Baris Saldo Akhir */}
                    <tr className="bg-gray-100 text-center border font-semibold">
                      <td className="p-2 border"></td>
                      <td className="p-2 border"></td>
                      <td className="p-2 border"></td>
                      <td className="p-2 border"></td>
                      <td className="p-2 border"></td>
                      <td className="p-2 border text-center">Saldo Akhir</td>
                      <td className="p-2 border"></td>
                      <td className="p-2 border"></td>
                      <td className="p-2 border"></td>
                      <td className="p-2 border">{fmt(dataWithSaldo.at(-1)?.saldo_akhir)}</td>
                      <td className="p-2 border"></td>
                      <td className="p-2 border"></td>
                    </tr>
                  </>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
      <div className="flex justify-center items-center mt-4 gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          ‹ Prev
        </button>
        <span>
          Halaman {currentPage} dari {totalPages || 1}
        </span>
      </div>
      )}

      {/* POPUP FORM */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start pt-24 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-lg shadow-2xl p-6 relative mb-10">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              onClick={() => {
                setShowForm(false);
                setFormData(defaultForm);
                setFormSource("kas_harian"); // reset sumber
              }}
            >
              <FiX size={22} />
            </button>

            <h2 className="text-2xl font-semibold mb-4 text-center">
              {formSource === "uang_saku_driver"
                ? "Form Uang Saku Driver"
                : formMode === "add_debet"
                ? "Kas Masuk"
                : formMode === "add_kredit"
                ? "Kas Keluar"
                : "Edit Transaksi"}
            </h2>

            {formSource === "uang_saku_driver" ? (
              <PopupUangSakuDriver
                formData={formUangSaku}
                setFormData={setFormUangSaku}
                setShowForm={setShowForm}
                defaultForm={defaultUangSakuForm}
                setFormSource={setFormSource}
                fetchData={fetchData} // ✅ kirim fungsi refresh
                sjSearch={sjSearch}
                setSjSearch={setSjSearch}
                sjList={sjList}
                showDropdown={showDropdown}
                setShowDropdown={setShowDropdown}
                highlightedIndex={highlightedIndex}
                setHighlightedIndex={setHighlightedIndex}
                handleSelectSj={handleSelectSj}
              />
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleSave();
                }}
                className="grid grid-cols-2 gap-4 pb-6"
              >
                <div>
                  <label className="block mb-1 font-semibold">Tanggal</label>
                  <input
                    type="date"
                    name="tanggal"
                    value={formData.tanggal || ""}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    onFocus={(e) => (e.target.showPicker ? e.target.showPicker() : null)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-semibold">Waktu</label>
                  <input
                    type="time"
                    name="waktu"
                    value={formData.waktu || ""}
                    readOnly
                    className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block mb-1 font-semibold">No Bukti</label>
                  <input
                    type="text"
                    name="bukti_transaksi"
                    value={formData.bukti_transaksi || ""}
                    onChange={(e) => setFormData({ ...formData, bukti_transaksi: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block mb-1 font-semibold">Keterangan</label>
                  <input
                    type="text"
                    name="keterangan"
                    value={formData.keterangan || ""}
                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-semibold">Nominal</label>
                  <input
                    type="text"
                    name="nominal"
                    value={
                      formData.nominal !== undefined && formData.nominal !== null
                        ? String(Number(formData.nominal).toLocaleString("id-ID"))
                        : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      setFormData({ ...formData, nominal: raw ? Number(raw) : 0 });
                    }}
                    className="w-full border rounded px-3 py-2 text-right"
                  />
                </div>

                <div className="col-span-2 flex justify-end gap-4 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setFormData(defaultForm);
                      setFormSource("kas_harian");
                    }}
                    className="bg-red-400 text-white px-4 py-2 rounded hover:bg-red-500"
                  >
                    Batal
                  </button>
                  <button
                  type="submit"
                  disabled={isSaving}
                  className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
                    isSaving ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Simpan
                </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showCashOpname && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded shadow-lg w-[460px] max-h-[90vh] overflow-auto">

          <h2 className="text-xl font-bold mb-4">Input Cash Opname</h2>

          <table className="w-full mb-4 border">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-1 border">Nominal</th>
                <th className="p-1 border">Qty</th>
                <th className="p-1 border w-[100px]">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {cashOpnameRows.map((row, idx) => {
                const qtyNum = Number(row.qty) || 0;
                const jumlah = row.nominal * qtyNum;

                return (
                  <tr key={idx}>
                    <td className="border p-1 text-right">
                      {row.nominal.toLocaleString("id-ID")}
                    </td>

                    <td className="border p-1">
                      <input
                        type="number"
                        className="w-full border p-1 bg-green-100 text-right"
                        value={row.qty}
                        placeholder="0"
                        onChange={(e) => {
                          const val = e.target.value;
                          setCashOpnameRows(prev => {
                            const copy = [...prev];
                            copy[idx].qty = val;
                            return copy;
                          });
                        }}
                      />
                    </td>

                    <td className="border p-1 text-right">
                      {jumlah > 0 ? jumlah.toLocaleString("id-ID") : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mb-3">
            <label className="block font-semibold">Brankas:</label>
            <input
              type="text"
              className="border p-1 w-full bg-green-100 text-right"
              value={brankas}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                setBrankas(raw === "" ? "" : Number(raw).toLocaleString("id-ID"));
              }}
            />
          </div>

          <div className="mb-3">
            <label className="block font-semibold">Diperiksa oleh:</label>
            <input
              type="text"
              className="border p-1 w-full"
              value={checkerName}
              onChange={(e) => setCheckerName(e.target.value)}
              placeholder="Nama pemeriksa"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="px-3 py-1 bg-gray-300"
              onClick={() => {
                resetCashOpname();
                setShowCashOpname(false);
              }}
            >
              Batal
            </button>

            <button
              className="px-3 py-1 bg-blue-600 text-white"
              onClick={() => {
                setShowCashOpname(false);
                handlePrintWithCashOpname();
              }}
            >
              Simpan & Cetak
            </button>
          </div>
        </div>
      </div>
    )}
      

      {createPortal(
      <style>
        {`
        @media print {
          /* Pakai selector lebih spesifik untuk menimpa Tailwind */
          td.tengah, th.tengah {
            text-align: center !important;
          }
          td.kanan, th.kanan {
            text-align: right !important;
          }
          td.text-left, th.text-left {
            text-align: left !important;
          }

          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }

          table th, table td {
            font-size: 12px !important;
            padding: 2px 4px !important;
            vertical-align: middle !important;
            border: 1px solid black !important;
            line-height: 1 !important;
          }

          /* Header tabel */
          table thead th {
            background: white !important;
            color: black !important;
            font-weight: bold !important;
            text-align: center !important;
          }

          /* Hapus kolom checkbox & aksi saat print */
          th:nth-child(1),
          td:nth-child(1),
          th:has(input[type="checkbox"]),
          td:has(input[type="checkbox"]),
          th:contains("Aksi"),
          td:contains("Aksi"),
          th:contains("Waktu"),
          td:contains("Waktu"),
          th:contains("User Id"),
          td:contains("User Id"),
          th:contains("Updated At"),
          td:contains("Updated At"),
          th:contains("Jenis"),
          td:contains("Jenis") {
            display: none !important;
          }
        }
        `}
      </style>,
      document.head
    )}
    </div>
  );
}