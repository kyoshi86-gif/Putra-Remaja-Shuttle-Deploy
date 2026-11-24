// ======================= JURNAL.tsx =======================
// FULL ADAPTASI DARI KAS_HARIAN (SIMPLIFIED UNTUK JURNAL)

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus } from "react-icons/fi";
import { DateRangePicker } from "react-date-range";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { createPortal } from "react-dom";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import type { Range } from "react-date-range";
import { toWIBDateString, getWIBTimestampFromUTC, toWIBTimeString } from "../utils/time";
import { FiDownload, FiPrinter } from "react-icons/fi";
import { exportTableToExcel, type ColumnConfig } from "../utils/exportTableToExcel";
import MoneyInput from "../components/common/MoneyInput";
import AccountSearchSelect from "../components/common/AccountSearchSelect";

// ================= TYPES =================
type Journal = {
  id: string;
  tanggal: string;
  waktu: string;
  reference: string;
  description: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  entity_id: string;

  journal_details?: {
    id: string;
    debit: number;
    credit: number;
    description: string;
    account: {
      id: string;
      code: string;
      name: string;
    };
  }[];
};

// ================= PAGE =================
export default function Jurnal() {
  const [data, setData] = useState<Journal[]>([]);
  const [filtered, setFiltered] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [filterBy, setFilterBy] = useState("reference");

  const [selectedEntity, setSelectedEntity] = useState("");

    type Entity = {
    id: string;
    kode: string;
    nama: string;
  };

  type Account = {
    id: string;
    code: string;
    name: string;
  };

  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [editId, setEditId] = useState<string | null>(null);

  const today = new Date();

  const [range, setRange] = useState<Range[]>([
    {
      startDate: today,
      endDate: today,
      key: "selection",
    },
  ]);

  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [pickerStyle, setPickerStyle] = useState({ top: 0, left: 0 });

  const [showForm, setShowForm] = useState(false);

  const [tanggal, setTanggal] = useState("");
  const [reference, setReference] = useState("");

  type RowType = {
    account_id: string;
    desc: string;
    debit: number;
    credit: number;
  };

  const defaultRows: RowType[] = [
    {
      account_id: "",
      desc: "",
      debit: 0,
      credit: 0,
    },
    {
      account_id: "",
      desc: "",
      debit: 0,
      credit: 0,
    },
  ];

  const [rows, setRows] = useState<RowType[]>(defaultRows);

  const loadAccounts = async () => {
    const { data } = await supabase.from("accounts").select("*");
    setAccounts(data || []);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // ================= LOAD DATA =================
  const loadData = async () => {
    setLoading(true);

    let query = supabase
      .from("journals")
      .select(`
        *,
        journal_details (
          id,
          debit,
          credit,
          description,
          account:accounts (
            id,
            code,
            name
          )
        )
      `)
      .order("created_at", { ascending: false });

    // 🔥 SAFE FILTER (hindari error 400)
    if (selectedEntity && selectedEntity !== "") {
      query = query.eq("entity_id", selectedEntity);
    }

    // Terapkan rentang tanggal DI SQL, bukan hanya client-side.
    // Ini penting karena outlet besar (mis. PUSAT) bisa punya puluhan ribu
    // jurnal; mengambil semuanya memicu "statement timeout" -> error 500
    // -> tabel tampil kosong. Dengan filter di server, hanya row dalam
    // rentang yang diambil.
    if (range[0]?.startDate && range[0]?.endDate) {
      const s = toDateKey(range[0].startDate);
      const e = toDateKey(range[0].endDate);
      if (s) query = query.gte("tanggal", s);
      if (e) query = query.lte("tanggal", e);
    }

    // Batas aman supaya query tidak pernah ekstrem.
    query = query.limit(3000);

    const { data, error } = await query;

    if (error) {
      console.error("ERROR LOAD JURNAL:", error.message);
      setData([]);
    } else {
      setData(data || []);
    }

    setLoading(false);
  };

  // ================= FETCH ENTITY =================
  const fetchEntities = async () => {
    const { data } = await supabase
      .from("entities")
      .select("id, kode, nama")
      .order("nama");

    setEntities(data || []);

    if (data?.length) {
      setSelectedEntity(data[0].id);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  useEffect(() => {
    if (selectedEntity) loadData();
     
  }, [selectedEntity, range]);

  // ================= FILTER =================
  useEffect(() => {
    const start = range[0].startDate!;
    const end = range[0].endDate!;

    let result = data.filter((r) => {
      const dt = new Date(r.tanggal);

      const s = new Date(start);
      s.setHours(0, 0, 0, 0);

      const e = new Date(end);
      e.setHours(23, 59, 59, 999);

      return dt >= s && dt <= e;
    });

    // 🔍 SEARCH
    if (q) {
      const keyword = q.toLowerCase();

      result = result.filter((r) => {
        if (filterBy === "reference") {
          return r.reference?.toLowerCase().includes(keyword);
        }
        if (filterBy === "description") {
          return r.description?.toLowerCase().includes(keyword);
        }
        if (filterBy === "user_id") {
          return r.user_id?.toLowerCase().includes(keyword);
        }
        return true;
      });
    }

    setFiltered(result);
  }, [data, q, filterBy, range]);

  // ================= DATE PICKER =================
  useEffect(() => {
    if (showPicker && pickerRef.current && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();

      setPickerStyle({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });

      function handleClickOutside(e: MouseEvent) {
        if (
          pickerRef.current &&
          !pickerRef.current.contains(e.target as Node) &&
          !triggerRef.current?.contains(e.target as Node)
        ) {
          setShowPicker(false);
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPicker]);

  // ================= EDIT =================
  const handleEdit = (row: Journal) => {
    setEditId(row.id); // 🔥 penting

    setTanggal(row.tanggal);
    setReference(row.reference);

    const newRows =
      row.journal_details?.map((d) => ({
        account_id: d.account?.id || "", // 🔥 FIX
        search: "",
        selectedLabel: `${d.account?.code} - ${d.account?.name}`,
        desc: d.description,
        debit: d.debit,
        credit: d.credit,
        open: false,
        highlightIndex: 0,
      })) || [];

    setRows(newRows);
    setShowForm(true);
  };

  // ================= DELETE =================
  const handleDelete = async (id: string) => {
    if (!confirm("Hapus data?")) return;

    await supabase.from("journal_details").delete().eq("journal_id", id);
    await supabase.from("journals").delete().eq("id", id);

    loadData();
  };

  // ================== INPUT JURNAL =============
  function updateRow(
    i: number,
    field: keyof RowType,
    val: string | number
  ) {
    const newRows = [...rows];

    if (field === "debit") {
      newRows[i].debit = Number(val) || 0;
      newRows[i].credit = 0;
    } else if (field === "credit") {
      newRows[i].credit = Number(val) || 0;
      newRows[i].debit = 0;
    } else {
      (newRows[i][field] as RowType[keyof RowType]) = val;
    }

    setRows(newRows);
  }

  function totalDebit() {
    return rows.reduce((s, r) => s + r.debit, 0);
  }

  function totalCredit() {
    return rows.reduce((s, r) => s + r.credit, 0);
  }

  function formatNumber(n: number) {
    return n.toLocaleString("id-ID");
  }

  /** Ubah Date -> "YYYY-MM-DD" (lokal) untuk filter SQL. */
  function toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  // ================== SAVE JURNAL =================
  const saveJurnal = async () => {
    // ================= VALIDASI =================

    if (!reference || reference.trim() === "") {
      alert("❌ No Referensi wajib diisi");
      return;
    }

    if (rows.length === 0) {
      alert("❌ Minimal harus ada 1 baris jurnal");
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      if (!r.account_id) {
        alert(`❌ Baris ke-${i + 1}: Akun belum dipilih`);
        return;
      }

      if (!r.desc || r.desc.trim() === "") {
        alert(`❌ Baris ke-${i + 1}: Keterangan wajib diisi`);
        return;
      }

      if (!r.debit && !r.credit) {
        alert(`❌ Baris ke-${i + 1}: Debit atau Kredit harus diisi`);
        return;
      }
    }

    if (Math.abs(totalDebit() - totalCredit()) > 0.01) {
      alert("❌ Debit dan Kredit harus sama (balance)");
      return;
    }

    try {
      let journalId = editId; // 🔥 penting

      // ================= INSERT / UPDATE =================
      const userId = localStorage.getItem("user_id") || "admin"; // 🔥 ambil sekali

      if (!editId) {
        // ➕ INSERT BARU
        const { data: journal, error: err1 } = await supabase
          .from("journals")
          .insert({
            tanggal,
            waktu: new Date().toISOString(),
            reference,
            entity_id: selectedEntity,
            user_id: userId,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (err1) throw err1;

        journalId = journal.id;
      } else {
        // ✏️ UPDATE
        const { error: err1 } = await supabase
          .from("journals")
          .update({
            tanggal,
            waktu: new Date().toISOString(), // 🔥 TAMBAH
            reference,
            user_id: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editId);

        if (err1) throw err1;

        // 🔥 HAPUS DETAIL LAMA
        await supabase
          .from("journal_details")
          .delete()
          .eq("journal_id", editId);
      }

      // ================= INSERT DETAIL =================
      const details = rows.map((r) => ({
        journal_id: journalId,
        account_id: r.account_id,
        debit: r.debit,
        credit: r.credit,
        description: r.desc,
      }));

      const { error: err2 } = await supabase
        .from("journal_details")
        .insert(details);

      if (err2) throw err2;

      // ================= SUCCESS =================
      alert("✅ Jurnal berhasil disimpan");

      setEditId(null); // 🔥 reset mode edit
      setShowForm(false);
      resetForm();
      // Arahkan rentang tanggal ke tanggal jurnal yang baru disimpan agar
      // hasil simpan langsung terlihat (kalau tidak, filter "hari ini"
      // bisa menyembunyikannya).
      const newRange: Range[] = [
        {
          startDate: new Date(tanggal),
          endDate: new Date(tanggal),
          key: "selection",
        },
      ];
      setRange(newRange);
      loadData();

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("❌ Gagal simpan: " + message);
    }
  };

  // ========== RESETFORM ======
  function resetForm() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const today = local.toISOString().split("T")[0];

    setTanggal(today);
    setReference("");
    setRows(defaultRows);
  }

  // ========== EXPORT EXCEL ======
  const handleExportExcel = () => {
    type ExcelRow = {
      tanggal: string;
      waktu: string;
      referensi: string;
      keterangan: string;
      debit: number | string;
      kredit: number | string;
      user: string;
      updated: string;
    };

    const rowsExcel: ExcelRow[] = [];

    filtered.forEach((j) => {
      rowsExcel.push({
        tanggal: new Date(j.tanggal).toLocaleDateString("id-ID"),
        waktu: toWIBTimeString(j.waktu),
        referensi: j.reference,
        keterangan: "",
        debit: "",
        kredit: "",
        user: j.user_id,
        updated: getWIBTimestampFromUTC(j.updated_at),
      });

      j.journal_details?.forEach((d) => {
        rowsExcel.push({
          tanggal: "",
          waktu: "",
          referensi: `${d.account?.code} ${d.account?.name}`,
          keterangan: d.description,
          debit: d.debit || "",
          kredit: d.credit || "",
          user: "",
          updated: "",
        });
      });
    });

    const columns: ColumnConfig[] = [
      { label: "Tanggal", key: "tanggal" },
      { label: "Waktu", key: "waktu" },
      { label: "No Referensi", key: "referensi" },
      { label: "Keterangan", key: "keterangan" },
      { label: "Debit", key: "debit" },
      { label: "Kredit", key: "kredit" },
      { label: "User", key: "user" },
      { label: "Updated", key: "updated" },
    ];

    exportTableToExcel(rowsExcel, {
      filename: "Jurnal.xlsx",
      sheetName: "Jurnal",
      columns, // 🔥 WAJIB ADA
    });
  };

  // ========== CETAK HALAMAN ======
  const handlePrint = () => {
    const now = new Date();
    const printInfo = `
      ${toWIBDateString(now, "display")} 
      ${toWIBTimeString(now.toISOString())} // 
      ${localStorage.getItem("user_id") || "admin"}
    `;

    const rowsHtml = filtered
      .map((j) => {
        // 🔥 HEADER JURNAL (TANPA USER & WAKTU)
        const header = `
          <tr style="font-weight:bold;">
            <td style="width:150px;">
              ${toWIBDateString(new Date(j.tanggal), "display")}
            </td>
            <td colspan="4">${j.reference}</td>
          </tr>
        `;

        // 🔥 DETAIL
        const details = j.journal_details
          ?.map(
            (d) => `
          <tr>
            <td></td>
            <td>${d.account?.code} ${d.account?.name}</td>
            <td>${d.description || ""}</td>
            <td style="text-align:right">${d.debit ? Number(d.debit).toLocaleString("id-ID") : ""}</td>
            <td style="text-align:right">${d.credit ? Number(d.credit).toLocaleString("id-ID") : ""}</td>
          </tr>
        `
          )
          .join("");

        const spacer = `
          <tr>
            <td colspan="5" style="height:10px; border:none;"></td>
          </tr>
        `;

        return header + details + spacer;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>Cetak Jurnal</title>
          <style>
            body {
              font-family: Arial;
              font-size: 12px;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1px solid black;
              padding: 6px;
            }
            th {
              background: #ddd;
            }
          </style>
        </head>
        <body>

          <!-- 🔥 INFO CETAK DI ATAS -->
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <div>${printInfo}</div>
            <div>Cetak Jurnal</div>
          </div>

          <h3 style="text-align:center">JURNAL</h3>

          <div style="margin-bottom:10px;">
            ${format(range[0].startDate!, "dd-MM-yyyy")} - ${format(
      range[0].endDate!,
      "dd-MM-yyyy"
    )}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:150px">Tanggal</th>
                <th>Akun</th>
                <th>Keterangan</th>
                <th style="width:120px">Debit</th>
                <th style="width:120px">Kredit</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(html);
    win.document.close();
    win.print();
  };

  // ================= UI =================
  return (
    <div className="p-4 bg-white rounded shadow max-w-[1600px] mx-auto">

      {/* ================= HEADER ================= */}
      <div className="mb-4 flex flex-col gap-3">

        {/* BARIS 1 */}
        <div className="flex flex-wrap items-center gap-3">

          {/* KIRI : DATE + SEARCH */}
          <div className="flex flex-wrap items-center gap-3">

            {/* DATE RANGE */}
            <div ref={triggerRef} className="flex items-center gap-2">
              <label className="font-semibold">Date range:</label>

              <input
                readOnly
                value={`${format(range[0].startDate!, "dd-MM-yyyy", { locale: id })} - ${format(range[0].endDate!, "dd-MM-yyyy", { locale: id })}`}
                onClick={() => setShowPicker(true)}
                className="border px-2 py-1 rounded cursor-pointer w-[210px]"
              />

              {showPicker &&
                createPortal(
                  <div
                    ref={pickerRef}
                    className="z-50 shadow border bg-white"
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
                        if (selection.startDate && selection.endDate) {
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
                      preventSnapRefocus={true}
                      calendarFocus="forwards"
                    />
                  </div>,
                  document.body
                )}
            </div>

            {/* OUTLET */}
            <div className="flex flex-wrap items-center gap-2 border p-2 rounded bg-gray-100 w-fit">
              <label>Outlet:</label>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="border px-2 py-1"
              >
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.kode} - {e.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* FILTER */}
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="border px-2 py-1"
            >
              <option value="reference">No Referensi</option>
              <option value="description">Keterangan</option>
              <option value="user_id">User</option>
            </select>

            {/* SEARCH */}
            <input
              placeholder="Kata kunci..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border px-2 py-1"
            />

            <button className="bg-blue-600 text-white px-3 py-1 rounded">
              Cari
            </button>

            <div className="flex items-center gap-3 ml-6">

              <button
                onClick={() => {
                  const now = new Date();
                  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
                  const today = local.toISOString().split("T")[0];
                  setTanggal(today);
                  resetForm();
                  setShowForm(true);
                }}
                className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-2"
              >
                <FiPlus /> Tambah Jurnal
              </button>

              <button
                onClick={handleExportExcel}
                className="bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-2"
              >
                <FiDownload /> Export
              </button>

              <button
                onClick={handlePrint}
                className="bg-orange-500 text-white px-3 py-1 rounded flex items-center gap-2"
              >
                <FiPrinter /> Cetak
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <div className="w-full pr-8">
        <table className="w-full table-auto border border-gray-300 text-sm">
          <thead className="bg-gray-500 text-white">
            <tr>
              <th className="border p-2 w-[80px]">Aksi</th>
              <th className="border p-2">Tanggal</th>
              <th className="border p-2">Waktu</th>
              <th className="border p-2">No Referensi</th>
              <th className="border p-2">Keterangan</th>
              <th className="border p-2">Debit</th>
              <th className="border p-2">Kredit</th>
              <th className="border p-2">User</th>
              <th className="border p-2">Updated</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-3">
                  Memuat...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-3">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const detailRows =
                  row.journal_details?.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-yellow-100 transition text-sm"
                    >
                      <td className="border p-2"></td>
                      <td className="border p-2"></td>
                      <td className="border p-2"></td>

                      <td className="border p-2">
                        {d.account?.code} {d.account?.name}
                      </td>

                      <td className="border p-2 text-left">
                        {d.description}
                      </td>

                      <td className="border p-2 text-right">
                        {d.debit
                          ? Number(d.debit).toLocaleString("id-ID")
                          : ""}
                      </td>

                      <td className="border p-2 text-right">
                        {d.credit
                          ? Number(d.credit).toLocaleString("id-ID")
                          : ""}
                      </td>

                      <td className="border p-2"></td>
                      <td className="border p-2"></td>
                    </tr>
                  )) || [];

                return [
                  <tr
                    key={`header-${row.id}`}
                    className="bg-gray-300 font-semibold text-center"
                  >
                    <td className="border p-2 align-top">
                      <div className="flex justify-center gap-1">
                        <FiEdit
                          className="cursor-pointer text-blue-600"
                          onClick={() => handleEdit(row)}
                        />
                        <FiTrash2
                          className="cursor-pointer text-red-500"
                          onClick={() => handleDelete(row.id)}
                        />
                      </div>
                    </td>

                    <td className="tengah p-2 border">
                      {row.tanggal
                        ? toWIBDateString(new Date(row.tanggal), "display")
                        : ""}
                    </td>

                    <td className="tengah p-2 border">
                      {row.waktu ? toWIBTimeString(row.waktu) : ""}
                    </td>

                    <td className="border p-2 align-top font-semibold">
                      {row.reference}
                    </td>

                    <td className="border p-2"></td>
                    <td className="border p-2"></td>
                    <td className="border p-2"></td>

                    <td className="border p-2 align-top">
                      {row.user_id}
                    </td>

                    <td className="tengah p-2 border">
                      {row.updated_at
                        ? getWIBTimestampFromUTC(row.updated_at)
                        : ""}
                    </td>
                  </tr>,

                  ...detailRows,
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-start pt-20 z-50 overflow-y-auto">
        <div className="bg-white w-[800px] max-h-[85vh] overflow-y-auto rounded-lg shadow-lg p-6">

          <h2 className="text-lg font-semibold mb-4 text-center">
            Input Jurnal
          </h2>

          {/* HEADER */}
          <div className="flex gap-3 mb-4">
            <input
              type="date"
              className="border px-3 py-2 rounded w-[180px]"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
            <input
              placeholder="No Referensi"
              className="border px-3 py-2 rounded w-[220px]"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          {/* ROWS */}
          <div className="space-y-2">
            {rows.map((row, i) => {
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 border rounded px-2 py-2"
                >
                  {/* DELETE */}
                  <button
                    onClick={() => {
                      if (rows.length <= 2) return;
                      setRows(rows.filter((_, idx) => idx !== i));
                    }}
                    className="text-red-500 text-lg px-2"
                  >
                    ×
                  </button>

                  {/* DESKRIPSI */}
                  <input
                    className="border px-2 py-1 rounded w-[160px]"
                    placeholder="Keterangan"
                    value={row.desc}
                    onChange={(e) =>
                      updateRow(i, "desc", e.target.value)
                    }
                  />

                  {/* AKUN */}
                  <AccountSearchSelect
                    accounts={accounts}
                    value={row.account_id}
                    onChange={(id) => updateRow(i, "account_id", id)}
                  />

                  {/* DEBIT */}
                  <MoneyInput
                    placeholder="Debit"
                    value={row.debit}
                    onCommit={(v) => updateRow(i, "debit", v)}
                  />

                  {/* CREDIT */}
                  <MoneyInput
                    placeholder="Kredit"
                    value={row.credit}
                    onCommit={(v) => updateRow(i, "credit", v)}
                  />
                </div>
              );
            })}
          </div>

          {/* TAMBAH BARIS */}
          <button
            onClick={() =>
              setRows([
                ...rows,
                {
                  account_id: "",
                  desc: "",
                  debit: 0,
                  credit: 0,
                },
              ])
            }
            className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
          >
            + Tambah Baris
          </button>

          {/* TOTAL */}
          <div className="mt-3 font-semibold text-sm">
            Total Debit: {formatNumber(totalDebit())} | Total Kredit:{" "}
            {formatNumber(totalCredit())}
          </div>

          {Math.abs(totalDebit() - totalCredit()) > 0.01 && (
            <div className="mt-2 text-red-600 font-semibold text-sm">
              ⚠️ Debit dan Kredit belum balance (selisih{" "}
              {formatNumber(Math.abs(totalDebit() - totalCredit()))})
            </div>
          )}

          {/* ACTION */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
              setShowForm(false);
              resetForm();
              }}
              className="bg-gray-400 px-3 py-1 text-white rounded"
            >
              Batal
            </button>

            <button
              onClick={saveJurnal}
              className="bg-green-600 hover:bg-green-700 px-3 py-1 text-white rounded"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}