import { useRef, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {FiEdit, FiTrash2, FiPlus, FiX, FiDownload, FiPrinter} from "react-icons/fi";
import { exportTableToExcel } from "../utils/exportTableToExcel";
import { insertWithAutoNomor } from "../lib/dbUtils";
import { getCustomUserId } from "../lib/authUser";
import { toDate } from "./SuratJalan";
import { getEntityContext, type EntityContext } from "../lib/entityContext";
import { toWIBDateString } from "@/utils/time";

export interface UangSakuData {
  id: number;
  tanggal: string;
  no_surat_jalan: string;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  driver: string;
  crew: string;
  no_polisi: string;
  kode_unit: string;
  kode_rute: string;
  bbm: number;
  uang_makan: number;
  parkir: number;
  jumlah: number;
  kartu_etoll: string;
  no_uang_saku: string;
  id_kas_harian?: number | null;

  [key: string]: unknown; // ✅ tambahkan ini
}

interface CustomUser {
  id: string;
  name?: string;
  role: string;
  access?: string[];
  entity_id: string;
}

export default function UangSakuDriver() {
  const [data, setData] = useState<UangSakuData[]>([]);
  const [filtered, setFiltered] = useState<UangSakuData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kasHilangMap, setKasHilangMap] = useState<Record<number, boolean>>({}); // cegah dikasharian terhapus
  const [formData, setFormData] = useState<UangSakuData>({
    id: 0,
    tanggal: "",
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
    no_uang_saku: "",
    id_kas_harian: null,
  });

  const defaultFormData: UangSakuData= {
    id: 0,
    tanggal: "",
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
    no_uang_saku: "",
    id_kas_harian: null,
  };  

  // Context Entity
  const [entityCtx, setEntityCtx] = useState<EntityContext | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [entities, setEntities] = useState<{id:string; kode:string; nama:string; tipe:string}[]>([]);
  const [customUser, setCustomUser] = useState<CustomUser | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(true);
  
  // --- FETCH DAFTAR ENTITIES JIKA USER PUSAT ---
  const fetchEntities = async () => {
    if (!entityCtx?.entity_id) return; // ⛔ jangan query kalau belum siap
    const { data, error } = await supabase
      .from("entities")
      .select("id, kode, nama, tipe")
      .order("nama", { ascending: true });

    if (error) {
      console.error("❌ Gagal ambil daftar entities:", error.message);
    } else {
      setEntities(data as {id:string; kode:string; nama:string; tipe:string}[]);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("custom_user");
    if (!storedUser) {
      setLoadingCtx(false);
      return;
    }
    try {
      const parsed: CustomUser = JSON.parse(storedUser);
      setCustomUser(parsed);
      getEntityContext(parsed.entity_id)
        .then((ctx) => {
          setEntityCtx(ctx);
          setLoadingCtx(false);
        })
        .catch(() => setLoadingCtx(false));
    } catch {
      setLoadingCtx(false);
    }
  }, []);

  // Auto fetch data saat filter outlet berubah
  useEffect(() => {
    if (!entityCtx) return;
    if (entityCtx.tipe === "pusat") {
      fetchData(); // langsung ambil data sesuai outlet terpilih
      fetchEntities(); // ambil daftar outlet
    }
  }, [selectedEntityId, entityCtx]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);

    if (!entityCtx?.entity_id) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from("uang_saku_driver")
      .select("*")
      .order("id", { ascending: false });

    if (entityCtx.tipe === "pusat") {
      // ✅ kalau user pusat, pakai filter outlet jika dipilih
      if (selectedEntityId) {
        query = query.eq("entity_id", selectedEntityId);
      } else {
        query = query.eq("entity_id", entityCtx.entity_id);
      }
    } else {
      // ✅ kalau user outlet, pakai entity outlet langsung
      query = query.eq("entity_id", entityCtx.entity_id);
    }

    const { data, error } = await query;
    if (error) {
      console.error("❌ Gagal ambil data:", error.message);
    } else {
      setData(data as UangSakuData[]);
      setFiltered(data as UangSakuData[]);
    }
    setLoading(false);
  };

  // ✅ panggil ulang setiap kali filter outlet atau context berubah
  useEffect(() => {
    fetchData();
  }, [selectedEntityId, entityCtx]);

  // --- CEGAH EDIT TERHAPUS ---
  const cekKasStatus = async (data: UangSakuData[]) => {
    const ids = data.map((row) => row.id);
    const { data: kasList } = await supabase
      .from("kas_harian")
      .select("sumber_id, sumber_tabel")
      .eq("sumber_tabel", "uang_saku_driver")
      .in("sumber_id", ids);

    const existingIds = new Set(kasList?.map((k) => k.sumber_id));
    const map: Record<number, boolean> = {};

    for (const row of data) {
      map[row.id] = !existingIds.has(row.id);
    }

    setKasHilangMap(map);
  };

  useEffect(() => {
    if (data.length > 0) {
      cekKasStatus(data);
    }
  }, [data]);

  useEffect(() => {
    let lastRefresh = 0;

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now - lastRefresh > 3000) {
        lastRefresh = now;
        fetchData();
        cekKasStatus(data);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [data]);

  // --- SEARCH ---
  useEffect(() => {
    let filteredData = [...data];
    if (search.trim() !== "") {
      const keyword = search.toLowerCase();
      filteredData = filteredData.filter(
        (d) =>
          d.no_uang_saku?.toLowerCase().includes(keyword) ||
          d.no_surat_jalan?.toLowerCase().includes(keyword) ||
          d.driver?.toLowerCase().includes(keyword) ||
          d.no_polisi?.toLowerCase().includes(keyword)
      );
    }
    setFiltered(filteredData);
    setCurrentPage(1);
  }, [search, data]);

  // --- PAGINATION ---
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  // --- Reset checkbox saat pindah halaman ---
  useEffect(() => {
    setSelected([]); // kosongkan semua checkbox setiap kali pindah halaman
  }, [currentPage]);

  // --- SELECT ALL CHECKBOX ---
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const handleSelectAll = () => {
    if (selected.length === paginatedData.length) setSelected([]);
    else setSelected(paginatedData.map((item) => item.id));
  };

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selected.length > 0 && selected.length < paginatedData.length;
    }
  }, [selected, paginatedData]);

  const handleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

 // --- DELETE SELECTED ---
  const handleDeleteSelected = async () => {
    if (selected.length === 0) return alert("Pilih data terlebih dahulu!");
    if (!confirm("Yakin ingin hapus data terpilih?")) return;

    // 1. Hapus dulu semua baris kas_harian yang terkait
    const { error: kasError } = await supabase
      .from("kas_harian")
      .delete()
      .eq("sumber_tabel", "uang_saku_driver")
      .in("sumber_id", selected)
      .eq("entity_id", selectedEntityId ?? entityCtx?.entity_id); // ✅ filter entity

    if (kasError) {
      alert("❌ Gagal hapus data Kas Harian: " + kasError.message);
      return;
    }

    // 2. Hapus data utama dari uang_saku_driver
    const { error: usError } = await supabase
      .from("uang_saku_driver")
      .delete()
      .in("id", selected)
      .eq("entity_id", selectedEntityId ?? entityCtx?.entity_id); // ✅ filter entity

    if (usError) {
      alert("❌ Gagal hapus Uang Saku: " + usError.message);
      return;
    }

    alert("✅ Data terpilih berhasil dihapus lengkap.");

    setSelected([]);
    fetchData();
    await fetchSjList();
  };

  // --- EXPORT EXCEL ---
  const handleExportExcel = () => {
    exportTableToExcel(filtered, {
      filename: "UangSakuDriver.xlsx",
      sheetName: "Uang Saku Driver",
      columns: [
        { label: "Tanggal", key: "tanggal", type: "date", format: toDate },
        { label: "No Uang Saku", key: "no_uang_saku" },
        { label: "No Surat Jalan", key: "no_surat_jalan" },
        { label: "Tanggal Berangkat", key: "tanggal_berangkat", type: "date", format: toDate },
        { label: "Tanggal Kembali", key: "tanggal_kembali", type: "date", format: toDate },
        { label: "Driver", key: "driver" },
        { label: "Crew", key: "crew" },
        { label: "No Polisi", key: "no_polisi" },
        { label: "Kode Unit", key: "kode_unit" },
        { label: "Kode Rute", key: "kode_rute" },
        { label: "BBM", key: "bbm", type: "currency" },
        { label: "Uang Makan", key: "uang_makan", type: "currency" },
        { label: "Parkir", key: "parkir", type: "currency" },
        { label: "Jumlah", key: "jumlah", type: "currency" },
        { label: "Kartu E-Toll", key: "kartu_etoll" },
        { label: "Created At", key: "created_at", type: "date", format: toDate },
      ]
    });
  };

  // --- Cetak Uang Saku ---
  const handlePrintSelected = () => {
    if (selected.length === 0) {
      alert("Pilih data Uang Saku yang ingin dicetak!");
      return;
  }

  // Ambil hanya ID pertama (atau bisa ubah jadi multiple print)
    const idCetak = selected[0];
    const dataCetak = data.find((d) => d.id === idCetak);

    if (!dataCetak) {
      alert("Data tidak ditemukan!");
      return;
    }

    // Buka halaman print-ready
    const printWindow = window.open(
      `/cetak-uang-saku?no=${dataCetak.no_uang_saku}&autoPrint=true`,
      "_blank"
    );

    if (!printWindow) {
      alert("Gagal membuka jendela cetak. Periksa popup blocker browser kamu.");
    }
  };

  // --- EDIT ---
  const handleEdit = (item: UangSakuData) => {
    if (kasHilangMap[item.id]) {
    alert("❌ Transaksi kas sudah dihapus. Tidak bisa diedit.");
    return;
  }

  setFormData({
    ...item,
    id_kas_harian: item.id_kas_harian ?? undefined, // ✅ pastikan properti ikut masuk
  });
  setShowForm(true);
};

  // --- DELETE ROW ---
  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin hapus data ini?")) return;

    // 1. Hapus dulu di kas_harian
    const { error: kasError } = await supabase
      .from("kas_harian")
      .delete()
      .eq("sumber_tabel", "uang_saku_driver")
      .eq("sumber_id", id)
      .eq("entity_id", selectedEntityId ?? entityCtx?.entity_id); // ✅ filter entity

    if (kasError) {
      alert("❌ Gagal menghapus data di Kas Harian: " + kasError.message);
      return;
    }

    // 2. Hapus data utama di uang_saku_driver
    const { error: usError } = await supabase
      .from("uang_saku_driver")
      .delete()
      .eq("id", id)
      .eq("entity_id", selectedEntityId ?? entityCtx?.entity_id); // ✅ filter entity

    if (usError) {
      alert("❌ Gagal menghapus Uang Saku: " + usError.message);
      return;
    }

    alert("✅ Data Uang Saku & Kas Harian berhasil dihapus.");

    fetchData();       // refresh tabel utama
    await fetchSjList();
  };

  // --- SUBMIT ---
  const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
  if (e) e.preventDefault();
  if (isSubmitting) return false;
  setIsSubmitting(true);

  // ✅ Tentukan entity target sekali di awal
  const targetEntity =
    entityCtx?.tipe === "pusat" && selectedEntityId
      ? selectedEntityId
      : entityCtx?.entity_id;

  try {
    // --- Validasi wajib ---
    const wajibIsi = [
      { field: "no_surat_jalan", label: "No Surat Jalan" },
      { field: "driver", label: "Driver" },
      { field: "no_polisi", label: "Nomor Polisi" },
      { field: "kode_rute", label: "Kode Rute" },
      { field: "tanggal_berangkat", label: "Tanggal Berangkat" },
      { field: "tanggal_kembali", label: "Tanggal Kembali" },
    ];
    for (const { field, label } of wajibIsi) {
      const value = formData[field as keyof UangSakuData];
      if (!value || value.toString().trim() === "") {
        alert(`❌ ${label} wajib diisi.`);
        return false;
      }
    }

    // --- Bersihkan numeric & hitung jumlah ---
    const numericFields = ["bbm", "uang_makan", "parkir"];
    const cleanedData = { ...formData } as Partial<Record<keyof UangSakuData, string | number | null>>;
    numericFields.forEach((f) => {
      const key = f as keyof UangSakuData;
      const val = cleanedData[key];
      const parsed =
        val === "" || val === undefined || val === null
          ? 0
          : Number(String(val).replace(/[^\d.-]/g, ""));
      cleanedData[key] = Number.isNaN(parsed) ? 0 : parsed;
    });
    cleanedData.jumlah =
      Number(cleanedData.bbm ?? 0) +
      Number(cleanedData.uang_makan ?? 0) +
      Number(cleanedData.parkir ?? 0);

    const isEdit = formData.id && Number(formData.id) !== 0;
    let finalNomor = formData.no_uang_saku?.trim();
    let dbError = null;
    const waktu = new Date().toTimeString().slice(0, 8);

    if (isEdit) {
        // --- UPDATE Uang Saku Driver ---
        const { error } = await supabase
          .from("uang_saku_driver")
          .update({
            ...cleanedData,
            no_uang_saku: finalNomor,
            entity_id: targetEntity,
          })
          .eq("id", formData.id);
        dbError = error;

        // --- UPDATE Kas Harian ---
        if (formData.id_kas_harian) {
          // pastikan jumlah dihitung ulang
          const nominalBaru = 
            Number(cleanedData.bbm ?? 0) + 
            Number(cleanedData.uang_makan ?? 0) + 
            Number(cleanedData.parkir ?? 0);

          // ambil baris kas_harian yang terkait
          const { data: kasLama } = await supabase
            .from("kas_harian")
            .select("saldo_awal")
            .eq("id", formData.id_kas_harian)
            .single();

          const saldoAwalLama = Number(kasLama?.saldo_awal ?? 0);
          const saldoAkhirBaru = saldoAwalLama - nominalBaru;
          const currentUserId = getCustomUserId() ?? "";
          const keberangkatan = toWIBDateString(new Date(formData.tanggal_berangkat), "display");
          const rute = formData.kode_rute ?? "";

          const kasPayload = {
            tanggal: cleanedData.tanggal,
            waktu,
            bukti_transaksi: finalNomor,
            keterangan: `Uang Saku Driver ${formData.driver}; ${cleanedData.no_polisi}; ${cleanedData.no_surat_jalan}; ${keberangkatan}; ${rute}`,
            jenis_transaksi: "kredit",
            nominal: nominalBaru,              // ✅ overwrite nominal baru
            saldo_awal: saldoAwalLama,
            saldo_akhir: saldoAkhirBaru,
            user_id: currentUserId,
            sumber_id: formData.id,
            sumber_tabel: "uang_saku_driver",
            updated_at: new Date().toISOString(),
            entity_id: targetEntity,
          };

          await supabase
            .from("kas_harian")
            .update(kasPayload)
            .eq("id", formData.id_kas_harian)
            .eq("entity_id", targetEntity);   // ✅ update langsung by id
        }
      } else {
        // --- INSERT BARU ---
        delete cleanedData.id;

        if (!entityCtx) {
          alert("Entity context belum siap");
          return false;
        }

        // ✅ Tentukan prefix nomor
        let outletPrefix = "US";
        if (entityCtx.tipe === "outlet") {
          outletPrefix = `${entityCtx.kode}-US`;
        } else if (selectedEntityId && selectedEntityId !== entityCtx.entity_id) {
          const ent = entities.find((e) => e.id === selectedEntityId);
          outletPrefix = ent?.kode ? `${ent.kode}-US` : "US";
        }

        // --- Generate nomor uang saku dulu ---
        const result = await insertWithAutoNomor({
          table: "uang_saku_driver",
          prefix: outletPrefix,
          nomorField: "no_uang_saku",
          data: { ...cleanedData, entity_id: targetEntity },
          previewOnly: true, // ✅ hanya generate nomor
          entityId: targetEntity,
        });

        if (!result.success || !result.nomor) {
          alert("❌ Gagal generate nomor: " + result.error);
          return false;
        }
        finalNomor = result.nomor;
        cleanedData.no_uang_saku = finalNomor;

        // --- Insert ke uang_saku_driver sekali saja ---
        const { data: insertedRow, error: insertError } = await supabase
          .from("uang_saku_driver")
          .insert({ ...cleanedData, entity_id: targetEntity })
          .select("id")
          .single();
        if (insertError || !insertedRow?.id) {
          alert("❌ Gagal insert Uang Saku Driver: " + insertError?.message);
          return false;
        }

        // --- Insert ke kas_harian dengan sumber_id & bukti_transaksi yang jelas ---
        const { data: lastRow } = await supabase
          .from("kas_harian")
          .select("*")
          .order("tanggal", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .single();

        const saldoAwal = Number(lastRow?.saldo_akhir ?? 0);
        const nominal = Number(cleanedData.jumlah ?? 0);
        const saldoAkhir = saldoAwal - nominal;
        const currentUserId = getCustomUserId();

        // ✅ rakit keterangan dengan format sama seperti update
        const keberangkatan = toWIBDateString(new Date(formData.tanggal_berangkat), "display"); 
        const rute = formData.kode_rute ?? "";

        const kasPayload = {
          tanggal: cleanedData.tanggal,
          waktu,
          bukti_transaksi: finalNomor,
          keterangan: `Uang Saku Driver ${formData.driver}; ${formData.no_polisi}; ${formData.no_surat_jalan}; ${keberangkatan}; ${rute}`,
          jenis_transaksi: "kredit",
          nominal,
          saldo_awal: saldoAwal,
          saldo_akhir: saldoAkhir,
          user_id: currentUserId,
          sumber_id: insertedRow.id,
          sumber_tabel: "uang_saku_driver",
          updated_at: new Date().toISOString(),
          entity_id: targetEntity,
        };

        // --- Insert kas_harian dan ambil id ---
        const { data: insertedKas, error: kasError } = await supabase
          .from("kas_harian")
          .insert(kasPayload)
          .select("id")
          .single();

        if (kasError || !insertedKas?.id) {
          alert("❌ Gagal insert Kas Harian: " + kasError?.message);
          return false;
        }

        // --- Update uang_saku_driver dengan id_kas_harian ---
        await supabase
          .from("uang_saku_driver")
          .update({ id_kas_harian: insertedKas.id })
          .eq("id", insertedRow.id);
      }

      if (dbError) {
        alert("❌ Gagal menyimpan: " + dbError.message);
        return false;
      }

      alert(`✅ Saku Driver ${finalNomor} berhasil disimpan.`);
      fetchData();
      await fetchSjList();
      return finalNomor;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Terjadi kesalahan: " + message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- CHANGE HANDLER ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let numericFields = ["bbm", "uang_makan", "parkir"];
    if (numericFields.includes(name)) {
      const raw = value.replace(/[^\d]/g, "");
      setFormData((prev) => ({
        ...prev,
        [name]: raw === "" ? 0 : parseInt(raw),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // --- AUTO HITUNG JUMLAH ---
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      jumlah: (prev.bbm || 0) + (prev.uang_makan || 0) + (prev.parkir || 0),
    }));
  }, [formData.bbm, formData.uang_makan, formData.parkir]);

  const formatRupiah = (num: number) =>
    "Rp " + (num ? num.toLocaleString("id-ID") : "0");

  // --- Tambahkan / ganti state & fetch di atas komponen ---
  const [sjList, setSjList] = useState<SuratJalanRow[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [sjSearch, setSjSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchSjList = async () => {
    try {
      if (!entityCtx?.entity_id) return;

      let query = supabase
        .from("surat_jalan")
        .select("*")
        .order("no_surat_jalan", { ascending: true });

      if (entityCtx.tipe === "pusat") {
        const targetEntity = selectedEntityId ?? entityCtx.entity_id;
        query = query.eq("entity_id", targetEntity); // ✅ filter outlet
      } else {
        query = query.eq("entity_id", entityCtx.entity_id);
      }

      const { data: semuaSj, error: sjError } = await query;
      if (sjError) throw sjError;

      // Ambil semua no_surat_jalan yang sudah dipakai
      const { data: dipakai, error: usdError } = await supabase
        .from("uang_saku_driver")
        .select("no_surat_jalan, entity_id");
      if (usdError) throw usdError;

      const dipakaiSet = new Set(
        dipakai?.filter((d) => d.entity_id === (selectedEntityId ?? entityCtx.entity_id))
              .map((d) => d.no_surat_jalan)
      );

      const belumDipakai = semuaSj?.filter(
        (sj) => !dipakaiSet.has(sj.no_surat_jalan)
      );

      setSjList(belumDipakai ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("❌ Gagal ambil SJ:", message);
      setSjList([]);
    }
  };

  useEffect(() => {
    fetchSjList();
  }, [selectedEntityId, entityCtx]);

// --- Fungsi pilih SJ (ditrigger sebelum blur karena onMouseDown di item) ---
interface SuratJalanRow {
  id?: number;
  no_surat_jalan: string;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  driver: string;
  crew: string;
  no_polisi: string;
  kode_unit: string;
  kode_rute: string;
}

const handleSelectSj = (sj: SuratJalanRow) => {

  // Pastikan field ada; gunakan empty string jika tidak
  const noSj = sj?.no_surat_jalan ?? "";
  const tBerangkat = sj?.tanggal_berangkat ?? "";
  const tKembali = sj?.tanggal_kembali ?? "";
  const driver = sj?.driver ?? "";
  const crew = sj?.crew ?? "";
  const noPol = sj?.no_polisi ?? "";
  const kodeUnit = sj?.kode_unit ?? "";
  const kodeRute = sj?.kode_rute ?? "";

  // AUTO SEARCH DI SURAT JALAN
  setFormData((prev) => ({
    ...prev,
    no_surat_jalan: noSj,
    tanggal_berangkat: tBerangkat,
    tanggal_kembali: tKembali,
    driver,
    crew,
    no_polisi: noPol,
    kode_unit: kodeUnit,
    kode_rute: kodeRute,
  }));

  setSjSearch(noSj);
  setShowDropdown(false);

  // opsional: fokus kembali ke input jika butuh
  // inputRef?.current?.focus();
};

  // --- Escape key untuk tutup form ---
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && setShowForm(false);
    setFormData(defaultFormData); // <-- reset
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // --- Auto isi NO USD saat klik Tambah (preview saja) ---
  const handleTambah = async (): Promise<void> => {
    try {
      setFormData({ ...defaultFormData });
      setSjSearch("");
      setShowDropdown(false);
      setHighlightedIndex(-1);

      // ✅ Tentukan entity target sekali di awal (di handleSubmit & handleTambah)
      const targetEntity =
        entityCtx?.tipe === "pusat" && selectedEntityId
          ? selectedEntityId
          : entityCtx?.entity_id;

      // Validasi entity
      if (!targetEntity) {
        alert("❌ Entity target belum siap. Pilih outlet atau tunggu context ter-load.");
        setIsSubmitting(false);
        return;
      }

      // Prefix konsisten
      let outletPrefix = "US";
      if (entityCtx?.tipe === "outlet") {
        outletPrefix = `${entityCtx.kode}-US`; // ✅ tambahkan strip
      } else if (selectedEntityId && selectedEntityId !== entityCtx?.entity_id) {
        const ent = entities.find((e) => e.id === selectedEntityId);
        outletPrefix = ent?.kode ? `${ent.kode}-US` : "US";
      }

      // Generate nomor preview
      const { success, nomor, error } = await insertWithAutoNomor({
        table: "uang_saku_driver",
        prefix: outletPrefix,
        data: { entity_id: targetEntity },
        entityId: targetEntity, // ✅ filter per entitas
        nomorField: "no_uang_saku",
        previewOnly: true,
      });

      if (!success || !nomor) throw new Error(error || "Gagal buat nomor baru");

      setFormData((prev) => ({ ...prev, no_uang_saku: nomor }));
      setShowForm(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("❌ Terjadi kesalahan saat membuat nomor uang saku: " + message);
    }
  };

  const handleCloseForm = () => {
  setFormData(defaultFormData); // reset semua isi form
  setShowForm(false);            // sembunyikan pop-up
  };

  if (loadingCtx) {
    return <div className="p-4 text-gray-600">Memuat Data Cabang...</div>;
  }

  if (!customUser || !entityCtx) {
    return <div className="p-4 text-red-600">Entity atau user tidak valid</div>;
  }

  return (
    <div className="p-4 bg-white rounded shadow">
    {/* POP UP FORM */}
    {showForm && (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start pt-24 overflow-y-auto">
        <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl p-6 relative mb-10">
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            onClick={handleCloseForm}
          >
            <FiX size={22} />
          </button>

          <h2 className="text-2xl font-semibold mb-4 text-center">
            Form Uang Saku Driver
          </h2>

          <form
            onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                e.preventDefault();

                const nomorFinal = await handleSubmit();
                  if (!nomorFinal) return;

                  const confirmPrint = window.confirm("Cetak Bukti Uang Saku?");
                  if (confirmPrint) {
                    window.open(
                      `/cetak-uang-saku?no=${nomorFinal}&autoPrint=true`,
                      "_blank"
                    );
                  }

                  // Baru reset form (setelah cetak)
                  setShowForm(false);
                  setFormData(defaultFormData);
              }}
            className="grid grid-cols-2 gap-4 pb-6"
          >
          
          {/* No Saku Driver */}
          <div className="col-span-2">
            <label className="block mb-1 font-semibold">No Uang Saku Driver</label>
            <input
              type="text"
              name="no_uang_saku"
              value={formData.no_uang_saku || ""}
              readOnly={formData.id === 0} // tambah baru readonly
              onChange={(e) =>
                setFormData({ ...formData, no_uang_saku: e.target.value })
              }
              className={`w-full border rounded px-3 py-2 ${formData.id === 0 ? "bg-gray-100 cursor-not-allowed" : ""}`}
            />
          </div>

          {/* Tanggal Keluar */}
          <div>
            <label className="block mb-1 font-semibold">Tanggal Uang Saku</label>
            <input
              type="date"
              name="tanggal"
              value={formData.tanggal || ""}
              onChange={handleChange}
              onFocus={(e) => (e.target.showPicker ? e.target.showPicker() : null)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* No Surat Jalan (autocomplete) */}
          <div className="relative">
            <label className="block mb-1 font-semibold">No Surat Jalan</label>
            <input
              type="text"
              name="no_surat_jalan"
              value={sjSearch || formData.no_surat_jalan || ""}
              onChange={(e) => {
                const value = e.target.value;
                setSjSearch(value);
                setShowDropdown(true);
                setHighlightedIndex(-1);
                setFormData((prev) => ({ ...prev, no_surat_jalan: value }));
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => {
                setTimeout(() => setShowDropdown(false), 150);
              }}
              onKeyDown={(e) => {
                const filtered = sjList.filter((sj) =>
                  sj.no_surat_jalan
                    ?.toLowerCase()
                    .includes(sjSearch.toLowerCase())
                );

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIndex((prev) => {
                    const next = prev < filtered.length - 1 ? prev + 1 : 0;
                    const el = document.getElementById(`sj-item-${next}`);
                    if (el) el.scrollIntoView({ block: "nearest" });
                    return next;
                  });
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIndex((prev) => {
                    const next = prev > 0 ? prev - 1 : filtered.length - 1;
                    const el = document.getElementById(`sj-item-${next}`);
                    if (el) el.scrollIntoView({ block: "nearest" });
                    return next;
                  });
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
                    handleSelectSj(filtered[highlightedIndex]);
                  }
                } else if (e.key === "Escape") {
                  setShowDropdown(false);
                }
              }}
              placeholder="Cari No Surat Jalan..."
              className="w-full border rounded px-3 py-2"
              autoComplete="off"
            />

            {showDropdown && (
              <ul
                id="sj-list"
                className="absolute z-50 w-full max-h-60 overflow-auto bg-white border rounded mt-1 shadow-lg"
              >
                {sjList
                  .filter((sj) =>
                    sj.no_surat_jalan
                      ?.toLowerCase()
                      .includes(sjSearch.toLowerCase())
                  )
                  .map((sj, idx) => (
                    <li
                      key={sj.id ?? `${sj.no_surat_jalan}-${idx}`}
                      id={`sj-item-${idx}`}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        handleSelectSj(sj);
                      }}
                      className={`px-3 py-2 cursor-pointer ${
                        highlightedIndex === idx ? "bg-blue-100" : "hover:bg-gray-200"
                      }`}
                    >
                      {sj.no_surat_jalan}
                    </li>
                  ))}

                {sjList.filter((sj) =>
                  sj.no_surat_jalan
                    ?.toLowerCase()
                    .includes(sjSearch.toLowerCase())
                ).length === 0 && (
                  <li className="px-3 py-2 text-gray-400">Tidak ditemukan</li>
                )}
              </ul>
            )}
          </div>

          {/* Tanggal Berangkat */}
          <div>
            <label className="block mb-1 font-semibold">Tanggal Berangkat & Kembali</label>
            <input
              type="text"
              readOnly
              value={
                formData.tanggal_berangkat && formData.tanggal_kembali
                  ? `${new Date(formData.tanggal_berangkat)
                      .toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                      .replaceAll("/", "-")} s/d ${new Date(formData.tanggal_kembali)
                      .toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                      .replaceAll("/", "-")}`
                  : ""
              }
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Driver / Crew */}
          <div>
            <label className="block mb-1 font-semibold">Driver / Crew</label>
            <input
              type="text"
              readOnly
              name="driver"
              value={formData.driver || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-gray-100"
              placeholder="Nama Driver / Crew"
            />
          </div>

          {/* No Polisi */}
          <div>
            <label className="block mb-1 font-semibold">No Polisi</label>
            <input
              type="text"
              readOnly
              name="no_polisi"
              value={formData.no_polisi || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Kode Unit */}
          <div>
            <label className="block mb-1 font-semibold">Kode Unit</label>
            <input
              type="text"
              readOnly
              name="kode_unit"
              value={formData.kode_unit || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Kode Rute */}
          <div>
            <label className="block mb-1 font-semibold">Kode Rute</label>
            <input
              type="text"
              readOnly
              name="kode_rute"
              value={formData.kode_rute || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Uang Input */}
          <div>
            <label className="block mb-1 font-semibold">BBM</label>
            <input
              type="text"
              name="bbm"
              value={formatRupiah(formData.bbm)}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-left"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Uang Makan</label>
            <input
              type="text"
              name="uang_makan"
              value={formatRupiah(formData.uang_makan) || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-left"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Parkir</label>
            <input
              type="text"
              name="parkir"
              value={formatRupiah(formData.parkir)}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-left"
            />
          </div>

          <div className="col-span-2 my-2 font-bold text-center">
            <label className="block mb-1 font-semibold">Jumlah</label>
            <input
              type="text"
              name="jumlah"
              value={formatRupiah(formData.jumlah)}
              readOnly
              className="w-full border rounded px-3 py-2 bg-green-400 text-center font-bold text-xl"
            />
          </div>

          {/* Kartu Etoll */}
          <div className="col-span-2">
            <label className="block mb-1 font-semibold">Kartu Etoll</label>
            <input
              type="text"
              name="kartu_etoll"
              value={formData.kartu_etoll || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Submit */}
          <div className="col-span-2 flex justify-end gap-4 mt-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="bg-red-400 text-white px-4 py-2 rounded hover:bg-red-500"
                >
                  Batal
                </button>
                <button
                type="submit"
                disabled={isSubmitting}
                className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
                  isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Simpan
              </button>
              </div>
        </form>
      </div>
    </div>
  )}

      {/* BUTTONS */}
      <div className="w-full pr-8 flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleTambah}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            <FiPlus /> Tambah
          </button>

          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            <FiTrash2 /> Hapus
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            <FiDownload /> Export Excel
          </button>

          <button
            onClick={handlePrintSelected}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            <FiPrinter /> Cetak
          </button>
        </div>

        {/* -- TAMPILKAN -- */}
        {entityCtx?.tipe === "pusat" && (
          <div className="gap-3 flex items-center border p-2 rounded bg-gray-100">
            <label className="mr-2 font-semibold">Filter Outlet:</label>
            <select
              value={selectedEntityId ?? entityCtx.entity_id}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="border rounded px-2"
            >
              <option value={entityCtx.entity_id}>
                {entityCtx.kode} - Kantor Pusat
              </option>
              {entities
                .filter((ent) => ent.id !== entityCtx.entity_id)
                .map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.kode} - {ent.nama}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="relative w-[320px]">
          <input
            type="text"
            placeholder="Cari Tanggal / No SJ / Driver / Nopol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 w-full pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="w-full pr-8">
      <table className="min-w-[1800px] table-auto border border-gray-300">
        <thead className="bg-gray-400 text-white">
          <tr> 
            <th className="p-2 border text-center w-[40px]">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={
                selected.length === paginatedData.length &&
                paginatedData.length > 0
                }
                onChange={handleSelectAll}
              />
            </th>
            <th className="border p-2 text-center w-[50px]">Aksi</th>
            <th className="border p-2 text-center w-[150px]">Tanggal</th>
            <th className="border p-2 text-center w-[230px]">No Kas / USD</th>
            <th className="border p-2 text-center w-[230px]">No Surat Jalan</th>
            <th className="border p-2 text-center w-[300px]">Tgl Berangkat & Kembali</th>
            <th className="border p-2 text-center w-[150px]">Driver</th>
            <th className="border p-2 text-center w-[150px]">Crew</th>
            <th className="border p-2 text-center w-[150px]">No Polisi</th>
            <th className="border p-2 text-center w-[120px]">Kode Unit</th>
            <th className="border p-2 text-center w-[220px]">Kode Rute</th>
            <th className="border p-2 text-center w-[150px]">BBM</th>
            <th className="border p-2 text-center w-[150px]">Uang Makan</th>
            <th className="border p-2 text-center w-[150px]">Parkir</th>
            <th className="border p-2 text-center w-[150px]">Jumlah</th>
            <th className="border p-2 text-center w-[200px]">Kartu Etoll</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={16} className="text-center p-3">Memuat data...</td>
            </tr>
          ) : paginatedData.length === 0 ? (
            <tr>
              <td colSpan={16} className="text-center p-3 text-gray-500">Data kosong</td>
            </tr>
          ) : (
            paginatedData.map((item) => {
              // Format tanggal ke dd-mm-yyyy
              const formatTanggal = (tgl: string | Date): string =>
                tgl
                  ? new Date(tgl)
                      .toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                      .replaceAll("/", "-")
                  : "";
                
              const isKasHilang = kasHilangMap[item.id] ?? false;

              return (
                <tr
                  key={item.id}
                  className="hover:bg-yellow-300 transition-all duration-150"
                >
                  <td className="border p-0 text-center">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => handleSelect(item.id)}
                    />
                  </td>
                  <td className="border p-0 text-center">
                    <div className="flex justify-center gap-[0.5px]">
                    <button
                      onClick={() => {
                        console.log("Edit klik:", item.id, "Kas hilang:", kasHilangMap[item.id]);
                        if (isKasHilang) {
                          alert("❌ Transaksi kas sudah dihapus. Data ini tidak bisa diedit.");
                          return;
                        }
                        handleEdit(item);
                        console.log("kasHilangMap", kasHilangMap);
                      }}
                      className="text-blue-600 hover:text-blue-800 px-[5px]"
                      title="Edit"
                    >
                      <FiEdit size={16} />
                    </button>
                    <button
                       onClick={() => {
                        if (isKasHilang) {
                          alert("❌ Transaksi kas sudah dihapus. Data ini tidak bisa dihapus.");
                          return;
                        }
                        handleDelete(item.id);
                        console.log("kasHilangMap", kasHilangMap);
                      }}
                      className="text-red-600 hover:text-red-800 px-[5px]"
                      title="Hapus"
                    >
                      <FiTrash2 size={16} />
                    </button>
                    </div>
                  </td>
                  <td className="border p-0 text-center">
                    {formatTanggal(item.tanggal)}
                  </td>
                   <td className="border p-0 text-center">
                    {item.no_uang_saku}
                  </td>
                  <td className="border p-0 text-center">
                    {item.no_surat_jalan}
                  </td>

                  {/* ✅ Gabungan tanggal berangkat & kembali */}
                  <td className="border p-2 text-center">
                    {item.tanggal_berangkat && item.tanggal_kembali
                      ? `${formatTanggal(item.tanggal_berangkat)} s/d ${formatTanggal(item.tanggal_kembali)}`
                      : formatTanggal(item.tanggal_berangkat || item.tanggal_kembali)}
                  </td>

                  <td className="border p-0 text-center px-2">
                    {item.driver}
                  </td>
                  <td className="border p-0 text-center px-2">
                    {item.crew}
                  </td>
                  <td className="border p-0 text-center">
                    {item.no_polisi}
                  </td>
                  <td className="border p-0 text-center">
                    {item.kode_unit}
                  </td>
                  <td className="border p-0 text-center">
                    {item.kode_rute}
                  </td>
                  <td className="border p-0 text-right pr-2">
                    {formatRupiah(item.bbm)}
                  </td>
                  <td className="border p-00 text-right pr-2">
                    {formatRupiah(item.uang_makan)}
                  </td>
                  <td className="border p-0 text-right pr-2">
                    {formatRupiah(item.parkir)}
                  </td>
                  <td className="border p-0 text-right font-semibold pr-2">
                    {formatRupiah(item.jumlah)}
                  </td>
                  <td className="border p-0 text-center">
                    {item.kartu_etoll}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>

      {/* PAGINATION */}
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
    </div>
  );
}