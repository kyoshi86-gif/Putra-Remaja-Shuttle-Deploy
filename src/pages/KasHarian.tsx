// src/pages/KasHarian.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload, FiPrinter } from "react-icons/fi";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { DateRangePicker } from "react-date-range";
import { createPortal } from "react-dom";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { getSaldoKemarin, injectSaldoKeData } from "../utils/finance";
import { insertWithAutoNomor } from "../lib/dbUtils"; // pastikan path sesuai
import { toWIBDateString, getWIBTimestampFromUTC, toWIBTimeString } from "../utils/time";
import type { KasRow } from "../utils/types";
import type { UangSakuFormData }  from "../components/forms/PopupUangSakuDriver";
import type { Range } from "react-date-range";
import PopupUangSakuDriver from "../components/forms/PopupUangSakuDriver";
import { getCustomUserId } from "../lib/authUser";

export default function KasHarian() {
  // Data
  const [data, setData] = useState<KasRow[]>([]);
  const [filtered, setFiltered] = useState<KasRow[]>([]);
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
        .order("urutan", { ascending: true }); // ⬅️ tambahkan ini

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

  // Filter + inject saldo
  useEffect(() => {
   const startStr = toWIBDateString(range[0].startDate ?? new Date());
    const endStr = toWIBDateString(range[0].endDate ?? new Date());

    // Inject saldo ke seluruh data dulu
    const injectedAll = injectSaldoKeData(data, 0); // saldo awal dummy, akan dihitung ulang

    // Ambil saldo akhir terakhir sebelum startStr
    const saldoKemarin = getSaldoKemarin(injectedAll, startStr);
    setSaldoAwalHistori(saldoKemarin);

    // Filter data sesuai range
    const filteredRange = injectedAll.filter(
      (r) => r.tanggal >= startStr && r.tanggal <= endStr
    );

    // Filter by keyword
    const keyword = q.toLowerCase().trim();
    const filteredKeyword = keyword
      ? filteredRange.filter((r) => {
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
              return false;
          }
        })
      : filteredRange;

    const injectedFinal = injectSaldoKeData(filteredKeyword, saldoKemarin);
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
  const itemsPerPage = 100;

  // Selection
  const [selected, setSelected] = useState<number[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  
  // Pagination logic
  const totalPages = Math.ceil(dataWithSaldo.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = dataWithSaldo.slice(startIndex, startIndex + itemsPerPage);


  // select all checkbox behavior
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selected.length > 0 && selected.length < paginatedData.length;
    }
  }, [selected, paginatedData]);

  const handleSelectAll = () => {
    if (selected.length === paginatedData.length) setSelected([]);
    else setSelected(paginatedData.map((p) => p.id));
  };

  const handleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(Number(id)) ? prev.filter((x) => x !== Number(id)) : [...prev, Number(id)]
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
        .eq("sumber_tabel", "premi_driver");

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

  // Export Excel (filtered set)
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kas Harian");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "KasHarian.xlsx");
  };

  // Print (open print page) - open new tab with query (caller implement print route)
  const handlePrint = () => {
    // if selected none, print all filtered; else print selected
    let ids = selected;
    if (ids.length === 0) {
      // pass date range & other params
      const from = toWIBDateString(range[0].startDate ?? new Date());
      const to = toWIBDateString(range[0].endDate ?? new Date());
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", to);
      window.open(`/cetak-kas-harian?${params.toString()}`, "_blank");
      return;
    }
    // print selected ids (first one for example)
    const q = ids.join(",");
    window.open(`/cetak-kas-harian?ids=${q}`, "_blank");
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

  // Save form (insert or update)
  const handleSave = async () => {
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
    }
  };

  // --- Handler: Edit Kas yang berasal dari uang_saku_driver ---
  const handleEditKas = async (kasRow: KasRow) => {
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
    } else {
      setFormData({
        ...kasRow,
      });
      setFormMode("edit");
      setFormSource("kas_harian");
      setShowForm(true);
    }
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
        .eq("sumber_tabel", "premi_driver");

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

  // Escape closes form & resets
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowForm(false);
        setFormData(defaultForm);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

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
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
    <div ref={triggerRef}>
      <label className="font-semibold">Date range: </label>
      <input
        type="text"
        readOnly
        value={`${format(range[0].startDate ?? new Date(), "dd-MM-yyyy", { locale: id })} - ${format(range[0].endDate ?? new Date(), "dd-MM-yyyy", { locale: id })}`}
        onClick={() => setShowPicker(!showPicker)}
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
                onChange={(ranges) => {
                  const selection = ranges.selection;
                  if (selection) {
                    setRange([selection]);
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
              onClick={handlePrint}
              className="flex items-center gap-2 bg-orange-500 text-white px-3 py-1 rounded"
            >
              <FiPrinter /> Cetak
            </button>
          </div>
        </div>

      {/* Tabel */}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border border-gray-300 text-sm">
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
              <th className="border p-2 text-center w-[100px]">No Bukti</th>
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
                      <tr key={row.id} className="hover:bg-gray-100 text-center border">
                        <td className="p-2 border">
                          <input
                            type="checkbox"
                            checked={selected.includes(row.id)}
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
                        <td className="p-2 border">
                          {row.tanggal ? toWIBDateString(new Date(row.tanggal), "display") : ""}
                        </td>
                        <td className="p-2 border">{row.waktu ? toWIBTimeString(row.waktu) : ""}</td>
                        <td className="p-2 border">{row.bukti_transaksi}</td>
                        <td className="p-2 border text-left">{row.keterangan}</td>
                        <td className="p-2 border">{row.jenis_transaksi}</td>
                        <td className="p-2 border">{row.jenis_transaksi === "debet" ? fmt(row.nominal) : ""}</td>
                        <td className="p-2 border">{row.jenis_transaksi === "kredit" ? fmt(row.nominal) : ""}</td>
                        <td className="p-2 border">{fmt(row.saldo_akhir)}</td>
                        <td className="p-2 border">{row.user_id}</td>
                        <td className="p-2 border">
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
        <button
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => setCurrentPage((p) => p + 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next ›
        </button>
      </div>

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
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Simpan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
