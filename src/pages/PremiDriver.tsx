// src/pages/PremiDriver.tsx
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload, FiPrinter } from "react-icons/fi";
import { exportTableToExcel } from "../utils/exportTableToExcel";
import { insertWithAutoNomor } from "../lib/dbUtils";
import { getCustomUserId } from "../lib/authUser";

interface PremiData {
  id: number;
  tanggal: string;
  no_premi_driver: string;
  no_surat_jalan: string;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  driver: string;
  crew: string;
  no_polisi: string;
  kode_unit: string;
  kode_rute: string;
  premi: number | null;
  perpal: number | null;
  potongan: number | null;
  jumlah: number | null;
  keterangan: string;
  biaya_etoll?: number | null;
  kartu_etoll?: string | null;
  id_kas_harian?: number | null;
  user_id?: string;
  perpalAktif?: boolean;
  [key: string]: unknown; // ✅ tambahkan ini
}

export const toDate = (v: unknown): Date | "" => {
  if (typeof v === "string" || typeof v === "number" || v instanceof Date) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? "" : d;
  }
  return "";
};

export default function PremiDriver() {
  const [data, setData] = useState<PremiData[]>([]);
  const [filtered, setFiltered] = useState<PremiData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("tanggal"); // ✅ tambahkan state untuk kriteria pencarian
  const [showForm, setShowForm] = useState(false);
  const [sjSearch, setSjSearch] = useState<string>(""); // ✅ eksplisit string
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [, setDriverOptions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suratJalanTersedia, setSuratJalanTersedia] = useState<{ no_surat_jalan: string, nama: string }[]>([]);
  const [formData, setFormData] = useState<PremiData>({
    id: 0,
    tanggal: "",
    no_premi_driver: "",
    no_surat_jalan: "",
    tanggal_berangkat: "",
    tanggal_kembali: "",
    driver: "",
    crew: "",
    no_polisi: "",
    kode_unit: "",
    kode_rute: "",
    premi: 0,
    perpal: 0,
    potongan: 0,
    jumlah: 0,
    keterangan: "",
    biaya_etoll: 0,
    kartu_etoll: "",
    id_kas_harian: null,
  });

  const [driverDropdownOptions, setDriverDropdownOptions] = useState<string[]>([]); // ✅ untuk dropdown nama driver/crew

  interface PotonganItem {
    keterangan: string;
    nominal: number | null;
  }

  interface SuratJalanDipakai {
    driver: string;
    crew: string;
    no_surat_jalan: string;
    tanggal_berangkat: string;
    tanggal_kembali: string;
    no_polisi: string;
    kode_unit: string;
    kode_rute: string;
  }

  const [, setSuratJalanDipakai] = useState<SuratJalanDipakai[]>([]);

  interface KasHarianRow {
    id: number;
    tanggal: string;
    waktu: string;
    keterangan: string;
    nominal: number;
    jenis_transaksi: "debet" | "kredit";
    sumber_tabel: string;
    sumber_id: number;
    bukti_transaksi: string;
    urutan: number;
    user_id: string;
    updated_at: string;
  }

  const [, setKasHarian] = useState<KasHarianRow[]>([]);

  interface SuratJalanRow {
    no_surat_jalan: string;
    driver: string;
    crew: string;
    tanggal_berangkat: string;
    tanggal_kembali: string;
    no_polisi: string;
    kode_unit: string;
    kode_rute: string;
    nama?: string;
    perpal_1x_keterangan?: string | null;
    perpal_2x_keterangan?: string | null;
  }

  const [semuaSJ, setSemuaSJ] = useState<SuratJalanRow[]>([]);

  interface PotonganItem {
    keterangan: string;
    nominal: number | null;
  }

  const [potonganList, setPotonganList] = useState<PotonganItem[]>([]);

  const defaultFormData: PremiData = {
    id: 0,
    tanggal: "",
    no_premi_driver: "",
    no_surat_jalan: "",
    tanggal_berangkat: "",
    tanggal_kembali: "",
    driver: "",
    crew: "",
    no_polisi: "",
    kode_unit: "",
    kode_rute: "",
    premi: 0,
    perpal: 0,
    potongan: 0,
    jumlah: 0,
    keterangan: "",
    id_kas_harian: null,
    perpalAktif: false,
  };

  const prepareFormData = (nomor: string): PremiData => ({
    id: 0,
    tanggal: new Date().toISOString().slice(0, 10),
    no_premi_driver: nomor,
    no_surat_jalan: "",
    tanggal_berangkat: "",
    tanggal_kembali: "",
    driver: "",
    crew: "",
    no_polisi: "",
    kode_unit: "",
    kode_rute: "",
    premi: 0,
    perpal: 0,
    potongan: 0,
    jumlah: 0,
    keterangan: "",
    id_kas_harian: null,
    user_id: getCustomUserId() ?? "",
  });

  const [uangSakuDetail, setUangSakuDetail] = useState({
    uang_saku: 0,
    bbm: 0,
    makan: 0,
    parkir: 0,
    jumlah: 0,
    sisa: 0,
  });

  // === Generate keterangan otomatis berdasarkan perpal ===
  interface PerpalSource {
    perpal_1x_tanggal?: string | Date | null;
    perpal_1x_rute?: string | null;
    perpal_2x_tanggal?: string | Date | null;
    perpal_2x_rute?: string | null;
  }

  const generateKeterangan = (
    src: PerpalSource | null,
    driver?: string | null,
    noPol?: string | null,
    noSj?: string | null
  ): string => {
    if (!src) return "";

    const p1t = src.perpal_1x_tanggal ?? null;
    const p1r = src.perpal_1x_rute ?? null;
    const p2t = src.perpal_2x_tanggal ?? null;
    const p2r = src.perpal_2x_rute ?? null;

    // helper format tanggal dd-mm-yy (sesuai contoh Anda)
    const fmtDate = (d: string | Date | null | undefined) => {
      if (!d) return "";
      const date = typeof d === "string" ? new Date(d) : d;
      if (isNaN(date.getTime())) return "";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = String(date.getFullYear()).slice(-2); // yy
      return `${day}-${month}-${year}`;
    };

    // parse route string "ASAL - TUJUAN - HH:MM" => { routeNoTime: "ASAL - TUJUAN - HH:MM", routeNoJam: "ASAL - TUJUAN", jam: "HH:MM" }
    const parseRoute = (r?: string | null) => {
      if (!r) return null;
      const parts = r.split(" - ").map((s) => s.trim());
      if (parts.length === 3) {
        const [asal, tujuan, jam] = parts;
        return {
          route: `${asal} - ${tujuan}`,
          jam: jam,
        };
      }
      // fallback: treat whole string as route (no jam)
      return { route: r.trim(), jam: "" };
    };

    const p1 = parseRoute(p1r as string | undefined);
    const p2 = parseRoute(p2r as string | undefined);

    // tanggal utama: pakai p1 jika ada, kalau tidak ambil p2
    const tanggalUtama = p1t ? fmtDate(p1t) : fmtDate(p2t);

    // bangun bagian route+jam:
    let routePart = "";
    const jamParts: string[] = [];

    if (p1 && p2) {
      if (p1.route === p2.route) {
        // sama rute -> tampilkan route sekali dan gabungkan jam
        routePart = p1.route;
        if (p1.jam) jamParts.push(`(${p1.jam})`);
        if (p2.jam) jamParts.push(`(${p2.jam})`);
      } else {
        // beda rute -> tampilkan masing2 "ROUTE (jam)" dipisah spasi
        const segs: string[] = [];
        if (p1.route) segs.push(`${p1.route}${p1.jam ? ` (${p1.jam})` : ""}`);
        if (p2.route) segs.push(`${p2.route}${p2.jam ? ` (${p2.jam})` : ""}`);
        routePart = segs.join(" ");
      }
    } else if (p1) {
      routePart = p1.route ?? "";
      if (p1.jam) jamParts.push(`(${p1.jam})`);
    } else if (p2) {
      routePart = p2.route ?? "";
      if (p2.jam) jamParts.push(`(${p2.jam})`);
    }

    // Susun final: "Perpal [driver] [nopol] [tanggal] [routePart] [jamParts...] [noSj]"
    const parts: string[] = ["Perpal"];
    if (driver) parts.push(String(driver));
    if (noPol) parts.push(String(noPol));
    if (tanggalUtama) parts.push(tanggalUtama);
    if (routePart) parts.push(routePart);
    if (jamParts.length > 0 && p1 && p2 && p1.route === p2.route) {
      // jika route sama, jamParts sudah berisi jam terpisah seperti ["(04:30)","(20:00)"]
      parts.push(jamParts.join(" "));
    } else if (jamParts.length > 0 && !(p1 && p2 && p1.route === p2.route)) {
      // jika route berbeda dan kami sudah memasukkan jam di routePart, tidak tambahkan lagi
      // (jam sudah di-routePart). Jadi nothing to add here.
    }
    if (noSj) parts.push(String(noSj));

    return parts.filter(Boolean).join(" ").trim();
  };

  // -- JUMLAH PAGE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const formatRupiah = (num: number | string | null | undefined) => {
    const n =
      typeof num === "string"
        ? parseFloat(num)
        : typeof num === "number"
        ? num
        : 0;

    return "Rp " + (!isFinite(n) ? "0" : n.toLocaleString("id-ID"));
  };

  // -- Fetch Surat Jalan Di UangSakuDriver
  const fetchSuratJalanDipakai = async () => {
    const { data } = await supabase
      .from("uang_saku_driver")
      .select("driver, crew, no_surat_jalan, tanggal_berangkat, tanggal_kembali, no_polisi, kode_unit, kode_rute")
      .order("tanggal", { ascending: false });

    if (data) {
      setSuratJalanDipakai(data);

      const allNames = [
        ...data.map((d) => d.driver),
        ...data.map((d) => d.crew),
      ].filter(Boolean);

      const uniqueNames = Array.from(new Set(allNames));
      setDriverOptions(uniqueNames);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSuratJalanDipakai();
    setSemuaSJ(data);
  }, []);

  //-- auto refresh--
  useEffect(() => {
    let lastRefresh = 0;

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now - lastRefresh > 3000) {
        lastRefresh = now;
        fetchData();       // ✅ ambil ulang data premi_driver
        fetchKasHarian();  // ✅ pastikan kas_harian ikut update
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  //--- CEK FETCH SJ TERSEDIA ---
  const fetchSJ = async () => {
    const { data: semuaSJ } = await supabase
      .from("uang_saku_driver")
      .select("no_surat_jalan, driver, crew, tanggal_berangkat, tanggal_kembali, no_polisi, kode_unit, kode_rute")
      .order("tanggal", { ascending: false });

    const { data: sudahDipakai } = await supabase
      .from("premi_driver")
      .select("no_surat_jalan, driver");

    const dipakaiSet = new Set(
      sudahDipakai?.map((row) => `${row.no_surat_jalan}__${row.driver}`) || []
    );

    const hasil: { no_surat_jalan: string; nama: string }[] = [];

    semuaSJ?.forEach((row) => {
      const sj = row.no_surat_jalan;
      const driver = row.driver;
      const crew = row.crew;

      if (driver && !dipakaiSet.has(`${sj}__${driver}`)) {
        hasil.push({ no_surat_jalan: sj, nama: driver });
      }

      if (crew && !dipakaiSet.has(`${sj}__${crew}`)) {
        hasil.push({ no_surat_jalan: sj, nama: crew });
      }
    });

    setSuratJalanTersedia(
      hasil.sort((a, b) => a.no_surat_jalan.localeCompare(b.no_surat_jalan))
    );
    setSemuaSJ(semuaSJ ?? []);
  };

  useEffect(() => {
    fetchSJ(); // ✅ panggil saat mount
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      console.log("🔄 Refresh SJ karena premi_driver dihapus");
      fetchSJ(); // ✅ panggil ulang saat event
    };

    window.addEventListener("refresh-premi-driver", handleRefresh);
    return () => window.removeEventListener("refresh-premi-driver", handleRefresh);
  }, []);

  // === FETCH DATA ===
  const fetchData = async () => {
    const { data, error } = await supabase
      .from("premi_driver")
      .select("*")
      .order("id", { ascending: false });

    if (!error && data) {
      setData(data);
      setFiltered(data);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Fungsi pilih SJ (ditrigger sebelum blur karena onMouseDown di item) ---
  const handleSelectSj = async (sj: SuratJalanRow) => {
  const options = [sj.driver, sj.crew].filter(Boolean);
  setDriverDropdownOptions(options);

  // ✅ Ambil detail SJ dari tabel surat_jalan
  const { data: detailSJ } = await supabase
    .from("surat_jalan")
    .select("tanggal_berangkat, tanggal_kembali, no_polisi, kode_unit, kode_rute, perpal_1x_rute, perpal_1x_tanggal, perpal_2x_rute, perpal_2x_tanggal")
    .eq("no_surat_jalan", sj.no_surat_jalan)
    .single();

  // 🔍 Ambil kartu etoll
  const { data: etollRow } = await supabase
    .from("uang_saku_driver")
    .select("kartu_etoll")
    .eq("no_surat_jalan", sj.no_surat_jalan)
    .single();


  const nilaiPerpal =
    (detailSJ?.perpal_1x_rute ? 20000 : 0) +
    (detailSJ?.perpal_2x_rute ? 10000 : 0);

  const perpalAktif = !!(detailSJ?.perpal_1x_rute || detailSJ?.perpal_2x_rute);

  setFormData((prev) => ({
    ...prev,
    no_surat_jalan: sj.no_surat_jalan,
    driver: sj.nama ?? "",
    crew: sj.crew ?? "",
    tanggal_berangkat: detailSJ?.tanggal_berangkat ?? "",
    tanggal_kembali: detailSJ?.tanggal_kembali ?? "",
    no_polisi: detailSJ?.no_polisi ?? "",
    kode_unit: detailSJ?.kode_unit ?? "",
    kode_rute: detailSJ?.kode_rute ?? "",
    perpalAktif,
    perpal: nilaiPerpal,
    kartu_etoll: etollRow?.kartu_etoll ?? "",
    biaya_etoll: 0,
    // langsung generate keterangan dari detailSJ
    keterangan:
      prev.keterangan?.trim() !== ""
        ? prev.keterangan
        : generateKeterangan(
            {
              perpal_1x_tanggal: detailSJ?.perpal_1x_tanggal,
              perpal_1x_rute: detailSJ?.perpal_1x_rute,
              perpal_2x_tanggal: detailSJ?.perpal_2x_tanggal,
              perpal_2x_rute: detailSJ?.perpal_2x_rute,
            },
            sj.nama ?? "",
            detailSJ?.no_polisi ?? "",
            sj.no_surat_jalan
          ),
  }));

  // ✅ Realisasi hanya untuk driver
  if (sj.nama === sj.driver) {
    const { data: sakuRow } = await supabase
      .from("uang_saku_driver")
      .select("jumlah, bbm, uang_makan, parkir")
      .eq("no_surat_jalan", sj.no_surat_jalan)
      .single();

    if (sakuRow) {
      const jumlah =
        (sakuRow.bbm || 0) + (sakuRow.uang_makan || 0) + (sakuRow.parkir || 0);
      const sisa = (sakuRow.jumlah || 0) - jumlah;

      setUangSakuDetail({
        uang_saku: sakuRow.jumlah || 0,
        bbm: sakuRow.bbm || 0,
        makan: sakuRow.uang_makan || 0,
        parkir: sakuRow.parkir || 0,
        jumlah,
        sisa,
      });
    } else {
      setUangSakuDetail({
        uang_saku: 0,
        bbm: 0,
        makan: 0,
        parkir: 0,
        jumlah: 0,
        sisa: 0,
      });
    }
  } else {
    setUangSakuDetail({
      uang_saku: 0,
      bbm: 0,
      makan: 0,
      parkir: 0,
      jumlah: 0,
      sisa: 0,
    });
  }

  setSjSearch(sj.no_surat_jalan);
  setShowDropdown(false);
  setHighlightedIndex(-1);
  setShowDriverDropdown(false);
};

  // === SEARCH ===
  useEffect(() => {
    let filteredData = [...data];

    if (search.trim() !== "") {
      const keyword = search.toLowerCase();

      filteredData = filteredData.filter((d) => {
        const value = String(d[searchField] ?? "").toLowerCase();
        return value.includes(keyword);
      });
    }

    setFiltered(filteredData);
  }, [search, searchField, data]);

  // === PAGINATION ===
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  // === CHECKBOX ===
  const handleSelectAll = () => {
    if (selected.length === paginatedData.length) setSelected([]);
    else setSelected(paginatedData.map((i) => i.id));
  };
  const handleSelect = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  // --- DELETE SELECTED ---
  const handleDeleteSelected = async () => {
    if (selected.length === 0) return alert("Pilih data terlebih dahulu!");
    if (!confirm("Yakin ingin hapus data terpilih?")) return;

    // 🔍 Ambil semua no_premi_driver
    const selectedRows = data.filter((d) => selected.includes(d.id));
    const noPDs = selectedRows.map((r) => r.no_premi_driver).filter(Boolean);

    // 🔥 Hapus kas_harian yang terhubung
    const { error: kasDeleteError } = await supabase
      .from("kas_harian")
      .delete()
      .in("bukti_transaksi", noPDs)
      .in("sumber_tabel", ["premi_driver", "perpal", "potongan", "realisasi_saku_header", "realisasi_saku_sisa", "realisasi_saku_item"]);

    if (kasDeleteError) {
      alert("❌ Gagal hapus kas_harian: " + kasDeleteError.message);
      return;
    }

    // 🔥 Hapus premi_driver
    const { error } = await supabase
      .from("premi_driver")
      .delete()
      .in("id", selected);

    if (error) {
      alert("❌ Gagal hapus premi_driver: " + error.message);
    } else {
      setSelected([]);
      fetchData(); // refresh premi_driver
      await fetchKasHarian(); // refresh kas_harian
      await fetchSuratJalanDipakai();
      window.dispatchEvent(new Event("refresh-premi-driver"));
    }
  };

  // === TAMBAH ===
  const handleTambah = async () => {
    try {
      const result = await insertWithAutoNomor({
        table: "premi_driver",
        prefix: "PD-",
        nomorField: "no_premi_driver",
        previewOnly: true, // ✅ hanya ambil nomor, belum insert
        tanggal: formData.tanggal || undefined,
        data: {},
      });

      if (!result || !result.success || !result.nomor) {
        throw new Error(result?.error || "Gagal buat nomor premi");
      }

      setFormData(prepareFormData(result.nomor));
      setShowForm(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("❌ " + message);
    }
  };

  // === EXPORT ===
  const handleExportExcel = () => {
    exportTableToExcel(filtered, {
      filename: "PremiDriver.xlsx",
      sheetName: "Premi Driver",
      columns: [
        { label: "Tanggal", key: "tanggal", type: "date", format: toDate },
        { label: "No Premi Driver", key: "no_premi_driver" },
        { label: "No Surat Jalan", key: "no_surat_jalan" },
        { label: "Tanggal Berangkat", key: "tanggal_berangkat", type: "date", format: toDate },
        { label: "Tanggal Kembali", key: "tanggal_kembali", type: "date", format: toDate },
        { label: "Driver", key: "driver" },
        { label: "Crew", key: "crew" },
        { label: "No Polisi", key: "no_polisi" },
        { label: "Kode Unit", key: "kode_unit" },
        { label: "Kode Rute", key: "kode_rute" },
        { label: "Premi", key: "premi", type: "currency" },
        { label: "Perpal", key: "perpal", type: "currency" },
        { label: "Potongan", key: "potongan", type: "currency" },
        { label: "Jumlah", key: "jumlah", type: "currency" },
        { label: "Kartu EToll", key: "kartu_etoll" },
        { label: "Biaya EToll", key: "biaya_etoll", type: "currency" },
        { label: "Keterangan", key: "keterangan" },
        { label: "Created At", key: "created_at", type: "date", format: toDate },
        { label: "User ID", key: "user_id" },
      ]
    });
  };

  // === CETAK ===
  const handlePrint = () => {
    if (selected.length === 0) {
      alert("Pilih data yang ingin dicetak!");
      return;
    }
    const item = data.find((d) => d.id === selected[0]);
    if (item)
      window.open(
        `/cetak-premi-driver?no=${item.no_premi_driver}&autoPrint=true`,
        "_blank"
      );
  };

  // === SIMPAN FORM ===
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return false; // ⛔ cegah submit ganda
    setIsSubmitting(true);

    // === Validasi wajib isi ===
    const wajibIsi = [
      { field: "no_surat_jalan", label: "No Surat Jalan" },
      { field: "driver", label: "Driver" },
      { field: "no_polisi", label: "Nomor Polisi" },
      { field: "kode_rute", label: "Kode Rute" },
      { field: "tanggal_berangkat", label: "Tanggal Berangkat" },
      { field: "tanggal_kembali", label: "Tanggal Kembali" },
      { field: "biaya_etoll", label: "Biaya EToll" },
    ];

    for (const { field, label } of wajibIsi) {
      const key = field as keyof PremiData;
      const value = formData[key];
      if (!value || value.toString().trim() === "") {
        alert(`❌ ${label} wajib diisi.`);
        setIsSubmitting(false);
        return;
      }
    }

    // === Validasi khusus biaya etoll ===
    if (!formData.biaya_etoll || formData.biaya_etoll === 0) {
      alert("❌ Biaya EToll wajib diisi!");
      setIsSubmitting(false);
      return;
    }

    // ❌ Cegah simpan jika Sisa / Kembali negatif
    if ((uangSakuDetail.sisa || 0) < 0) {
      alert("❌ Sisa / Kembali tidak boleh negatif. Periksa kembali pengisian BBM, Makan, dan Parkir.");
      return;
    }

    // === Bersihkan angka ===
    const formDataCleaned = structuredClone(formData);
    delete formDataCleaned.perpalAktif;

    const cleanedData = Object.fromEntries(
      Object.entries(formData).filter(([key]) => key !== "perpalAktif")
    ) as Partial<Record<keyof PremiData, string | number | null>>;

    const numericFields: (keyof PremiData)[] = ["premi", "perpal", "biaya_etoll"];

    for (const key of numericFields) {
      const raw = formData[key];
      const parsed =
        raw === "" || raw === undefined || raw === null
          ? null
          : Number(String(raw).replace(/[^\d.-]/g, ""));
      cleanedData[key] = Number.isNaN(parsed) ? null : parsed;
    }

    // === Bersihkan UUID ===
    if (
      cleanedData.id_kas_harian === "0" ||
      cleanedData.id_kas_harian === 0 ||
      cleanedData.id_kas_harian === "" ||
      cleanedData.id_kas_harian === undefined
    ) {
      cleanedData.id_kas_harian = null;
    }

    // === Hitung jumlah akhir ===
    const totalPotongan = potonganList.reduce(
      (sum, item) => sum + (item.nominal || 0),
      0
    );

    const premi = Number(cleanedData.premi ?? 0);
    const perpal = Number(cleanedData.perpal ?? 0);

    cleanedData.jumlah = premi + perpal - totalPotongan;
    cleanedData.potongan = totalPotongan;

    cleanedData.user_id = getCustomUserId();

    // === AUTO KETERANGAN jika kosong tetapi perpal ada ===
    if (!cleanedData.keterangan || String(cleanedData.keterangan).trim() === "") {
      const gen = generateKeterangan({
        perpal_1x_tanggal: cleanedData.perpal_1x_tanggal
          ? String(cleanedData.perpal_1x_tanggal)
          : null,
        perpal_1x_rute: cleanedData.perpal_1x_rute
          ? String(cleanedData.perpal_1x_rute)
          : null,
        perpal_2x_tanggal: cleanedData.perpal_2x_tanggal
          ? String(cleanedData.perpal_2x_tanggal)
          : null,
        perpal_2x_rute: cleanedData.perpal_2x_rute
          ? String(cleanedData.perpal_2x_rute)
          : null,
      });

      if (gen.trim() !== "") cleanedData.keterangan = gen;
    }

    // === Hapus kolom auto-generated ===
    delete cleanedData.id;

    const isEdit = formData.id !== 0;
    let finalNomor = formData.no_premi_driver?.trim();
    let finalId = formData.id;

    // === Simpan ke premi_driver ===
    if (isEdit) {
      const { error } = await supabase
        .from("premi_driver")
        .update(cleanedData)
        .eq("id", formData.id);

      if (error) {
        alert("❌ Gagal update: " + error.message);
        return;
      }
    } else {
      const result = await insertWithAutoNomor({
        table: "premi_driver",
        prefix: "PD-",
        nomorField: "no_premi_driver",
        data: cleanedData,
        excludeFields: [],
        previewOnly: false,
        monthlyReset: false,  // ⛔ tidak reset tiap bulan
        resetAfterMax: true,  // ✅ reset setelah 999
        maxSeq: 999,
        digitCount: 3,
      });

      if (!result.success) {
        alert("❌ Gagal simpan: " + result.error);
        return;
      }

      finalNomor = result.nomor!;
      finalId = result.id!;
    }

    // === Siapkan transaksi kas_harian ===
    interface KasTransaksi {
      tanggal: string;
      waktu: string;
      keterangan: string;
      nominal: number;
      jenis_transaksi: "debet" | "kredit";
      sumber_tabel: string;
      sumber_id: number;
      bukti_transaksi: string;
      urutan: number;
      user_id: string | null;
      updated_at: string;
    }

    const transaksi: KasTransaksi[] = [];
    const waktuNow = new Date().toTimeString().slice(0, 8); // hasil: HH:mm:ss lokal
    const keteranganBase = `${formData.driver} ${formData.no_polisi} ${formData.no_surat_jalan}`;
    const currentUserId = getCustomUserId();
    let urutan = 1;

    if (cleanedData.premi) {
      transaksi.push({
        tanggal: formData.tanggal,
        waktu: waktuNow,
        keterangan: `Premi Driver ${keteranganBase}`,
        nominal: Number(cleanedData.premi ?? 0),
        jenis_transaksi: "kredit",
        sumber_tabel: "premi_driver",
        sumber_id: finalId,
        bukti_transaksi: finalNomor,
        urutan: urutan++,
        user_id: currentUserId,
        updated_at: new Date().toISOString(),
      });
    }

    if (cleanedData.perpal) {
      // build perpal keterangan lengkap sesuai format: Perpal [driver] [nopol] [tanggal] [ROUTE] (jam...) [no_surat_jalan]

      transaksi.push({
        tanggal: formData.tanggal,
        waktu: waktuNow,
        keterangan: formData.keterangan,
        nominal: Number(cleanedData.perpal ?? 0),
        jenis_transaksi: "kredit",
        sumber_tabel: "perpal",
        sumber_id: finalId,
        bukti_transaksi: finalNomor,
        urutan: urutan++,
        user_id: currentUserId,
        updated_at: new Date().toISOString(),
      });
    }

    for (const item of potonganList) {
      if (item.nominal && item.nominal > 0) {
        transaksi.push({
          tanggal: formData.tanggal,
          waktu: waktuNow,
          keterangan: `Potongan ${item.keterangan} ${keteranganBase}`,
          nominal: item.nominal,
          jenis_transaksi: "debet",
          sumber_tabel: "potongan",
          sumber_id: finalId,
          bukti_transaksi: finalNomor,
          urutan: urutan++,
          user_id: currentUserId,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // === Tambahkan uang saku jika belum masuk kas_harian
    const realisasiKeterangan = `Realisasi Saku ${formData.no_polisi} ${formData.no_surat_jalan}`;

    const { data: sakuRow } = await supabase
      .from("uang_saku_driver")
      .select("id, driver, jumlah")
      .eq("no_surat_jalan", formData.no_surat_jalan)
      .single();

    const bersihRealisasi = (sakuRow?.jumlah || 0) - (uangSakuDetail.sisa || 0);

    // === Realisasi Saku
    if (
      sakuRow && sakuRow.driver === formData.driver && sakuRow.jumlah > 0
    ) {

      if (bersihRealisasi > 0) {
        transaksi.push({
          tanggal: formData.tanggal,
          waktu: waktuNow,
          keterangan: realisasiKeterangan,
          nominal: bersihRealisasi,
          jenis_transaksi: "debet",
          sumber_tabel: "realisasi_saku_header",
          sumber_id: finalId,
          bukti_transaksi: finalNomor,
          urutan: urutan++,
          user_id: currentUserId,
          updated_at: new Date().toISOString(),
        });
      }

      // === Sisa / Kembali langsung di bawah Realisasi Saku
      if (uangSakuDetail.sisa > 0.001) {
        transaksi.push({
          tanggal: formData.tanggal,
          waktu: waktuNow,
          keterangan: `Sisa / Kembali ${formData.no_polisi} ${formData.no_surat_jalan}`,
          nominal: uangSakuDetail.sisa,
          jenis_transaksi: "debet",
          sumber_tabel: "realisasi_saku_sisa",
          sumber_id: finalId,
          bukti_transaksi: finalNomor,
          urutan: urutan++,
          user_id: currentUserId,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // === Biaya-biaya setelah Sisa / Kembali
    const biayaList = [
      { label: "BBM", value: uangSakuDetail.bbm },
      { label: "Makan", value: uangSakuDetail.makan },
      { label: "Parkir", value: uangSakuDetail.parkir },
    ];

    for (const biaya of biayaList) {
      if (biaya.value > 0) {
        transaksi.push({
          tanggal: formData.tanggal,
          waktu: waktuNow,
          keterangan: `Biaya ${biaya.label} ${keteranganBase}`,
          nominal: biaya.value,
          jenis_transaksi: "kredit",
          sumber_tabel: "realisasi_saku_item",
          sumber_id: finalId,
          bukti_transaksi: finalNomor,
          urutan: urutan++,
          user_id: currentUserId,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (!isEdit) {
      const { error: insertKasError } = await supabase
        .from("kas_harian")
        .insert(transaksi);

      if (insertKasError) {
        alert("❌ Gagal simpan kas_harian: " + insertKasError.message);
        return;
      }
    }

    // === Simpan ke kas_harian ===
    if (isEdit) {
      // Ambil baris kas_harian lama terkait bukti ini
      const { data: oldKas, error: fetchOldError } = await supabase
        .from("kas_harian")
        .select("id, keterangan, waktu, urutan, sumber_tabel")
        .eq("bukti_transaksi", finalNomor)
        .in("sumber_tabel", [
          "premi_driver",
          "perpal",
          "potongan",
          "realisasi_saku_header",
          "realisasi_saku_sisa",
          "realisasi_saku_item"
        ]);

      if (fetchOldError) {
        alert("❌ Gagal ambil transaksi kas lama: " + fetchOldError.message);
        return;
      }

      const currentUserId = getCustomUserId();

      // 1) Perbarui/hapus baris lama yang cocok — JAGA waktu/urutan (jangan overwrite waktu)
      for (const old of oldKas ?? []) {
        const isOldSisaKembali = old.keterangan?.startsWith("Sisa / Kembali");

        // Hapus baris Sisa/Kembali jika sekarang nol atau negatif
        if (isOldSisaKembali && (uangSakuDetail.sisa || 0) <= 0) {
          const { error: deleteError } = await supabase.from("kas_harian").delete().eq("id", old.id);
          if (deleteError) {
            alert("❌ Gagal hapus baris Sisa/Kembali: " + deleteError.message);
            return;
          }
          continue;
        }

        // carikan transaksi baru yang cocok berdasarkan keterangan (case-insensitive)
        const trx = transaksi.find((t) =>
          String(t.keterangan || "").trim().toLowerCase() === String(old.keterangan || "").trim().toLowerCase()
        );

        if (!trx) {
          // jika tidak ditemukan, kita biarkan nanti (akan dihapus di langkah delete diff)
          continue;
        }

        const isSisaKembali = trx.keterangan?.startsWith("Sisa / Kembali");

        // jika sisa sekarang 0 dan ini baris sisa/kembali -> hapus
        if (isSisaKembali && Math.abs(uangSakuDetail.sisa || 0) < 0.001) {
          const { error: deleteError } = await supabase.from("kas_harian").delete().eq("id", old.id);
          if (deleteError) {
            alert("❌ Gagal hapus baris Sisa/Kembali: " + deleteError.message);
            return;
          }
          continue;
        }

        // hitung nominal & jenis transaksi
        const nominal = trx.nominal;
        const jenis_transaksi = isSisaKembali ? (uangSakuDetail.sisa >= 0 ? "debet" : "kredit") : trx.jenis_transaksi;

        // update hanya fields selain waktu/urutan (keterangan/nominal/jenis/etc)
        const { error: updateError } = await supabase
          .from("kas_harian")
          .update({
            tanggal: formData.tanggal,
            // jangan ubah old.waktu (biar urutan tampilan stabil)
            keterangan: trx.keterangan,
            nominal,
            jenis_transaksi,
            updated_at: new Date().toISOString(),
            user_id: currentUserId,
          })
          .eq("id", old.id);

        if (updateError) {
          alert("❌ Gagal update transaksi kas: " + updateError.message);
          return;
        }
      }

      // ===== REPLACEMENT: diff-based update kas_harian (preserve existing waktu/urutan) =====

      // Ambil baris kas_harian existing untuk bukti_transaksi ini (lengkap)
      const { data: existingRowsRes, error: errExisting } = await supabase
        .from("kas_harian")
        .select("*")
        .eq("bukti_transaksi", formData.no_premi_driver);

      if (errExisting) {
        console.error("Gagal ambil existing kas_harian:", errExisting);
        throw errExisting;
      }

      // gunakan tipe KasHarianRow yang sudah ada di file
      const existingRows = (existingRowsRes || []) as KasHarianRow[];

      // Normalisasi key untuk compare (gunakan keterangan + jenis + nominal sebagai identitas sederhana)
      const normalizeKey = (r: { keterangan?: string; jenis_transaksi?: string; nominal?: number | string }) =>
        `${String(r.keterangan || "").trim().toLowerCase()}|${String(r.jenis_transaksi || "").trim().toLowerCase()}|${Number(r.nominal || 0)}`;

      // Map existing by normalized key (pakai tipe eksplisit)
      const existingMap = new Map<string, KasHarianRow>();
      existingRows.forEach((r) => existingMap.set(normalizeKey(r), r));

      // Tipe internal untuk transaksi yang akan dimasukkan/ dibandingkan
      type KasTransaksi = {
        tanggal?: string;
        waktu?: string;
        keterangan?: string;
        nominal?: number;
        jenis_transaksi?: string;
        sumber_tabel?: string;
        sumber_id?: number | null;
        bukti_transaksi?: string;
        urutan?: number;
        user_id?: string | null;
        updated_at?: string;
        created_at?: string;
      };

      // Map transaksi target by normalized key (pakai KasTransaksi)
      const transaksiMap = new Map<string, KasTransaksi>();
      transaksi.forEach((t) => transaksiMap.set(normalizeKey(t as KasTransaksi), t as KasTransaksi));

      // 1) DELETE: hapus existing yang tidak ada di transaksi lagi
      const toDeleteIds: number[] = existingRows
        .filter((r) => !transaksiMap.has(normalizeKey(r)))
        .map((r) => r.id)
        .filter(Boolean);

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase.from("kas_harian").delete().in("id", toDeleteIds);
        if (delErr) {
          console.error("Gagal menghapus baris kas_harian:", delErr);
          throw delErr;
        }
      }

      // 2) UPDATE: sudah dilakukan di loop atas (untuk menjaga waktu/urutan)

      // --- Siapkan helper waktu / urutan (dipakai saat insert) ---
      const existingTimes = existingRows.map((r) => r.waktu).filter(Boolean) as string[];
      const existingUrutans = existingRows.map((r) => Number(r.urutan || 0));

      let maxTime = existingTimes.length > 0 ? existingTimes.sort()[existingTimes.length - 1] : "06:00:00";
      let maxUrutan = existingUrutans.length > 0 ? Math.max(...existingUrutans) : 0;

      // 3) INSERT (baru): cari transaksi yang belum ada di existing -> INSERT pada posisi yang benar
      const realisasiSources = new Set([
        "realisasi_saku_header",
        "realisasi_saku_item",
        "realisasi_saku_sisa",
        "realisasi",
      ]);

      // urutkan existingRows berdasarkan urutan numerik (kecil -> besar)
      const existingByUrutan = existingRows
        .map(r => ({ ...r, urutan: Number(r.urutan || 0) }))
        .sort((a, b) => a.urutan - b.urutan);

      // cari firstRealRow (baris realisasi pertama)
      const firstRealRow = existingByUrutan.find(r => realisasiSources.has(String(r.sumber_tabel)));
      const firstRealUrutan = firstRealRow ? Number(firstRealRow.urutan || 0) : null;

      // list transaksi baru yg belum ada
      const toInsert: KasTransaksi[] = transaksi.filter(
        (t: KasTransaksi) => !existingMap.has(normalizeKey(t))
      );

      if (toInsert.length === 0) {
        // nothing to insert
      } else if (firstRealUrutan === null) {
        // tidak ada realisasi: APPEND (perilaku lama tetapi tanpa membuat waktu berbeda signifikan)
        let curUrutan = maxUrutan;
        const toInsertRows: KasTransaksi[] = [];

        for (const t of toInsert) {
          curUrutan += 1;
          // gunakan waktu = maxTime agar tampil berdekatan; created_at diberi suffix unik untuk stabilitas
          const waktuForRow = maxTime;
          const msSuffix = String(curUrutan).padStart(3, "0");
          const createdAtForRow = `${formData.tanggal}T${waktuForRow}.${msSuffix}Z`;

          toInsertRows.push({
            tanggal: formData.tanggal,
            waktu: waktuForRow,
            keterangan: t.keterangan,
            nominal: t.nominal,
            jenis_transaksi: t.jenis_transaksi,
            sumber_tabel: t.sumber_tabel,
            sumber_id: finalId,
            bukti_transaksi: formData.no_premi_driver,
            urutan: curUrutan,
            user_id: await getCustomUserId(),
            updated_at: createdAtForRow,
            created_at: createdAtForRow,
          });
        }

        if (toInsertRows.length > 0) {
          const { error: insErr } = await supabase.from("kas_harian").insert(toInsertRows);
          if (insErr) {
            console.error("Gagal insert kas_harian baru:", insErr);
            throw insErr;
          }
        }
      } else {
        // ADA realisasi -> sisipkan before firstRealUrutan
        const nInsert = toInsert.length;

        // SHIFT urutan per-row: tambah nInsert ke semua urutan >= firstRealUrutan
        const affected = existingByUrutan.filter(r => r.urutan >= firstRealUrutan).reverse();
        for (const row of affected) {
          const newUrutan = Number(row.urutan) + nInsert;
          const { error: uErr } = await supabase
            .from("kas_harian")
            .update({ urutan: newUrutan, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          if (uErr) {
            console.error("Gagal shift urutan per-row id", row.id, uErr);
            throw uErr;
          }
        }

        // Tentukan waktu sisipan: gunakan waktu dari nextRow (firstRealRow) agar konsisten.
        const nextWaktu = firstRealRow?.waktu ?? maxTime;
        const baseInsertTimes: string[] = new Array(nInsert).fill(nextWaktu);

        // Build toInsertRows with urutan starting at firstRealUrutan
        const toInsertRows: KasTransaksi[] = [];
        let urutanPointer = firstRealUrutan;
        for (let i = 0; i < toInsert.length; i++) {
          const t = toInsert[i];
          const waktuForRow = baseInsertTimes[i];
          const msSuffix = String(urutanPointer).padStart(3, "0");
          const createdAtForRow = `${formData.tanggal}T${waktuForRow}.${msSuffix}Z`;

          toInsertRows.push({
            tanggal: formData.tanggal,
            waktu: waktuForRow,
            keterangan: t.keterangan,
            nominal: t.nominal,
            jenis_transaksi: t.jenis_transaksi,
            sumber_tabel: t.sumber_tabel,
            sumber_id: finalId,
            bukti_transaksi: formData.no_premi_driver,
            urutan: urutanPointer++,
            user_id: await getCustomUserId(),
            updated_at: createdAtForRow,
            created_at: createdAtForRow,
          });
        }

        if (toInsertRows.length > 0) {
          const { error: insErr } = await supabase.from("kas_harian").insert(toInsertRows);
          if (insErr) {
            console.error("Gagal insert kas_harian baru (sisip):", insErr);
            throw insErr;
          }
        }
      }

      // ===== Tambahan safety: RE-SEQ urutan untuk mencegah duplikat urutan =====
      // Ambil ulang rows dan pastikan urutan bersih (1..N) untuk bukti_transaksi ini
      const { data: afterRows } = await supabase
        .from("kas_harian")
        .select("id, urutan")
        .eq("bukti_transaksi", formData.no_premi_driver)
        .order("urutan", { ascending: true });

      if (afterRows && afterRows.length > 0) {
        let seq = 1;
        for (const r of afterRows) {
          const currentUrut = Number(r.urutan || 0);
          if (currentUrut !== seq) {
            const { error: updSeqErr } = await supabase
              .from("kas_harian")
              .update({ urutan: seq, updated_at: new Date().toISOString() })
              .eq("id", r.id);
            if (updSeqErr) {
              console.error("Gagal re-seq urutan id", r.id, updSeqErr);
              // bukan fatal — lanjutkan
            }
          }
          seq++;
        }
      }

      // ===== END REPLACEMENT =====
    }

    // ✅ Reset form
    alert(`✅ Premi Driver ${finalNomor} berhasil disimpan.`);
    setSjSearch("");
    setShowForm(false);
    setFormData(defaultFormData);
    setPotonganList([]);
    fetchData();

    if (typeof fetchKasHarian === "function") {
      await fetchKasHarian();
      await fetchSuratJalanDipakai();
      await fetchData();
    }
    // ✅ Beri sinyal ke halaman Kas Harian agar refresh otomatis
    window.dispatchEvent(new Event("refresh-kas-harian"));
    setIsSubmitting(false); // ✅ buka kunci submit
    return true;
  };

  //--- AUTO REFRESH TAPI GAGAL ---
  const fetchKasHarian = async () => {
    const { data, error } = await supabase
      .from("kas_harian")
      .select("*")
      .order("tanggal", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error("❌ Gagal ambil kas_harian:", error.message);
      return;
    }

    setKasHarian(data); // ✅ update state
  };

  // === DELETE ===
  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin hapus data ini?")) return;

    const row = data.find((d) => d.id === id);
    if (!row || !row.no_premi_driver) {
      alert("❌ Data tidak ditemukan.");
      return;
    }

    const noPD = row.no_premi_driver;

    const { error: kasDeleteError } = await supabase
      .from("kas_harian")
      .delete()
      .eq("bukti_transaksi", noPD)
      .in("sumber_tabel", ["premi_driver", "perpal", "potongan", "realisasi_saku_header", "realisasi_saku_sisa", "realisasi_saku_item"]);

    if (kasDeleteError) {
      alert("❌ Gagal hapus kas_harian: " + kasDeleteError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("premi_driver")
      .delete()
      .eq("id", id);

    if (deleteError) {
      alert("❌ Gagal hapus premi_driver: " + deleteError.message);
    } else {
      await fetchData(); // refresh premi_driver
      await fetchKasHarian(); // refresh kas_harian
      await fetchSuratJalanDipakai(); // refresh SJ lokal
      window.dispatchEvent(new Event("refresh-premi-driver")); // ✅ trigger SJ global
    }
  };

  // === FORM HANDLER ===
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const numFields = ["premi", "perpal", "potongan"];
    if (numFields.includes(name)) {
      const val = value.replace(/[^\d]/g, "");
      setFormData((prev) => ({
        ...prev,
        [name as keyof PremiData]: val === "" ? 0 : parseInt(val),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name as keyof PremiData]: value,
      }));
    }
  };

  // === HANDLER REALISASI SAKU ===
  const handleUangSakuChange = (field: "bbm" | "makan" | "parkir", value: string) => {
    const clean = Number(value.replace(/[^\d]/g, "")) || 0;
    const updated = {
      ...uangSakuDetail,
      [field]: clean,
    };
    updated.jumlah = updated.bbm + updated.makan + updated.parkir;
    updated.sisa = updated.uang_saku - updated.jumlah;
    setUangSakuDetail(updated);
  };

  // --- Escape key untuk tutup form ---
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseForm();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // === HITUNG JUMLAH ===
  useEffect(() => {
    const totalPotongan = potonganList.reduce(
      (sum, item) => sum + (item.nominal || 0),
      0
    );
    setFormData((prev) => ({
      ...prev,
      jumlah: (prev.premi || 0) + (prev.perpal || 0) - totalPotongan,
    }));
  }, [formData.premi, formData.perpal, potonganList]);

  // -- CLOSE FORM ---
  const handleCloseForm = () => {
    setFormData(defaultFormData);
    setSjSearch("");
    setPotonganList([]);
    setUangSakuDetail({
      uang_saku: 0,
      bbm: 0,
      makan: 0,
      parkir: 0,
      jumlah: 0,
      sisa: 0,
    });
    setShowForm(false);
  };

// Format tanggal ke dd-mm-yyyy
  const formatTanggal = (tgl: string | Date | null | undefined): string => {
    if (!tgl) return "";
    const date = typeof tgl === "string" ? new Date(tgl) : tgl;
    if (isNaN(date.getTime())) return "";
    return date
      .toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replaceAll("/", "-");
  };

  //-- otomatis isi tab +potongan ---
  const lastPotonganRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (lastPotonganRef.current) {
      lastPotonganRef.current.focus();
    }
  }, [potonganList.length]);

  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="w-full pr-8 flex flex-wrap justify-between items-center mb-4 gap-3">
      {/* Tombol Aksi */}
        <div className="flex flex-wrap gap-3">
          <button onClick={handleTambah} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            <FiPlus /> Tambah
          </button>
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            <FiTrash2 /> Hapus
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            <FiDownload /> Export Excel
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">
            <FiPrinter /> Cetak
          </button>
        </div>

        {/* Dropdown + Searchbox */}
        <div className="flex items-center gap-2">
          {/* Dropdown kriteria pencarian */}
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="tanggal">Tanggal</option>
            <option value="no_premi_driver">No Bukti (PD-)</option>
            <option value="no_surat_jalan">No Surat Jalan</option>
            <option value="driver">Driver</option>
            <option value="no_polisi">No Polisi</option>
            <option value="kode_unit">Kode Unit</option>
            <option value="kode_rute">Kode Rute</option>
            <option value="kartu_etoll">Kartu Etoll</option>
          </select>

          {/* Textbox pencarian */}
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Cari data..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded px-3 py-2 pr-8"
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
      </div>

      {/* Tabel Data */}
      <div className="max-w-screen overflow-x-auto pr-8">
      <table className="min-w-[1860px] table-auto border border-gray-300">
        <thead className="bg-gray-400 text-white">
          <tr>
            <th className="p-2 border text-center w-[40px]">
              <input
                type="checkbox"
                ref={selectAllRef}
                checked={selected.length === paginatedData.length && paginatedData.length > 0}
                onChange={handleSelectAll}
              />
            </th>
            <th className="p-2 border text-center w-[50px]">Aksi</th>
            <th className="p-2 border text-center w-[150px]">Tanggal</th>
            <th className="p-2 border text-center w-[200px]">No Kas / PD</th>
            <th className="p-2 border text-center w-[200px]">No Surat Jalan</th>
            <th className="p-2 border text-center w-[300px]">Tgl Brkt & Kembali</th>
            <th className="p-2 border text-center w-[200px]">Driver / Crew</th>
            <th className="p-2 border text-center w-[150px]">No Polisi</th>
            <th className="p-2 border text-center w-[120px]">Kode Unit</th>
            <th className="p-2 border text-center w-[220px]">Kode Rute</th>
            <th className="p-2 border text-center w-[150px]">Premi</th>
            <th className="p-2 border text-center w-[150px]">Perpal</th>
            <th className="p-2 border text-center w-[150px]">Potongan</th>
            <th className="p-2 border text-center w-[150px]">Jumlah</th>
            <th className="p-2 border text-center w-[150px]">Kartu EToll</th>
            <th className="p-2 border text-center w-[150px]">Biaya EToll</th>
            <th className="p-2 border text-center w-[300px]">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row) => (
            <tr key={row.id} className="hover:bg-yellow-300 transition-all duration-150">
              <td className="p-2 border text-center">
                <input
                  type="checkbox"
                  checked={selected.includes(row.id)}
                  onChange={() => handleSelect(row.id)}
                />
              </td>
              <td className="border p-2 text-center">
                <div className="flex justify-center gap-[0.5px]">
                  <button
                    onClick={async () => {
                      setFormData({ 
                        ...row,
                        kartu_etoll: row.kartu_etoll ?? "",
                        biaya_etoll: row.biaya_etoll ?? 0,
                        user_id: row.user_id ?? getCustomUserId() ?? "",
                        perpalAktif: !!row.perpal,
                      });

                      setSjSearch(row.no_surat_jalan || "");
                      setShowForm(true);
                      setPotonganList([]);

                      // ✅ Ambil semua baris kas_harian terkait
                      const { data: kasRows } = await supabase
                        .from("kas_harian")
                        .select("keterangan, nominal, jenis_transaksi")
                        .eq("bukti_transaksi", row.no_premi_driver)
                        .in("sumber_tabel", [
                            "premi_driver",
                            "perpal",
                            "potongan",              // ← WAJIB agar potongan ikut kebaca
                            "realisasi_saku_header",
                            "realisasi_saku_sisa",
                            "realisasi_saku_item"
                        ]);

                      let uang_saku = 0;
                      let sisa = 0;
                      let bbm = 0;
                      let makan = 0;
                      let parkir = 0;
                      const potonganList: { keterangan: string; nominal: number }[] = [];

                      for (const kas of kasRows ?? []) {
                        const ket = kas.keterangan || "";
                        const nominal = kas.nominal || 0;
                        const jenis = kas.jenis_transaksi;

                        if (ket.startsWith("Realisasi Saku")) {
                          uang_saku += nominal;
                        }

                        if (ket.startsWith("Sisa / Kembali")) {
                          if (jenis === "debet") {
                            sisa = nominal;
                            uang_saku += nominal; // ✅ tambahkan ke uang_saku
                          } else {
                            sisa = -nominal;
                          }
                        }

                        if (ket.startsWith("Biaya BBM")) bbm = nominal;
                        if (ket.startsWith("Biaya Makan")) makan = nominal;
                        if (ket.startsWith("Biaya Parkir")) parkir = nominal;

                        if (ket.startsWith("Potongan ")) {
                          const raw = ket.replace("Potongan ", "").trim();
                          const potonganOnly =
                            raw.split(row.driver)[0]?.trim() ||
                            raw.split(row.no_polisi)[0]?.trim() ||
                            raw.split(row.no_surat_jalan)[0]?.trim() ||
                            raw;

                          potonganList.push({
                            keterangan: potonganOnly,
                            nominal,
                          });
                        }
                      }

                      const jumlah = bbm + makan + parkir;

                      setUangSakuDetail({
                        uang_saku,
                        bbm,
                        makan,
                        parkir,
                        jumlah,
                        sisa,
                      });

                      setPotonganList(potonganList);

                      // === AUTO KETERANGAN pada saat EDIT jika kosong ===
                      if ((!row.keterangan || row.keterangan.trim() === "") && row.no_surat_jalan) {
                        const { data: sj } = await supabase
                          .from("surat_jalan")
                          .select("perpal_1x_tanggal, perpal_1x_rute, perpal_2x_tanggal, perpal_2x_rute")
                          .eq("no_surat_jalan", row.no_surat_jalan)
                          .single();

                        if (sj) {
                          const gen = generateKeterangan(
                            {
                              perpal_1x_tanggal: sj.perpal_1x_tanggal,
                              perpal_1x_rute: sj.perpal_1x_rute,
                              perpal_2x_tanggal: sj.perpal_2x_tanggal,
                              perpal_2x_rute: sj.perpal_2x_rute,
                            },
                            row.driver ?? row.crew ?? "",
                            row.no_polisi ?? "",
                            row.no_surat_jalan ?? ""
                          );

                          if (gen && gen.trim() !== "") {
                            setFormData(prev => ({
                              ...prev,
                              keterangan: gen,
                              perpal_1x_tanggal: sj.perpal_1x_tanggal ?? prev.perpal_1x_tanggal,
                              perpal_1x_rute: sj.perpal_1x_rute ?? prev.perpal_1x_rute,
                              perpal_2x_tanggal: sj.perpal_2x_tanggal ?? prev.perpal_2x_tanggal,
                              perpal_2x_rute: sj.perpal_2x_rute ?? prev.perpal_2x_rute,
                            }));
                          }
                        }
                      }

                    }}
                    className="text-blue-600 hover:text-blue-800 px-[5px]"
                    title="Edit"
                  >
                    <FiEdit size={16} />
                  </button>
                  <button onClick={() => handleDelete(row.id)} 
                    className="text-red-600 hover:text-red-800 px-[5px]"
                    title="Hapus"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </td>
              <td className="p-2 border text-center">{formatTanggal(row.tanggal)}</td>
              <td className="p-2 border text-center">{row.no_premi_driver}</td>
              <td className="p-2 border text-center">{row.no_surat_jalan}</td>
              <td className="p-2 border text-center">
                {formatTanggal(row.tanggal_berangkat)} - {formatTanggal(row.tanggal_kembali)}
              </td>
              <td className="p-2 border text-center">
                {row.driver ? row.driver : row.crew ? row.crew : "-"}
              </td>
              <td className="p-2 border text-center">{row.no_polisi}</td>
              <td className="p-2 border text-center">{row.kode_unit}</td>
              <td className="p-2 border text-center">{row.kode_rute}</td>
              <td className="p-2 border text-right">{formatRupiah(row.premi)}</td>
              <td className="p-2 border text-right">{formatRupiah(row.perpal)}</td>
              <td className="p-2 border text-right">{formatRupiah(row.potongan)}</td>
              <td className="p-2 border text-right">{formatRupiah(row.jumlah)}</td>
              <td className="p-2 border text-center">{row.kartu_etoll ?? ""}</td>
              <td className="p-2 border text-right">{formatRupiah(row.biaya_etoll)}</td>
              <td className="p-2 border">{row.keterangan}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

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
            <h2 className="text-2xl font-semibold mb-4 text-center">Form Premi Driver</h2>
            
            <form
              onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                e.preventDefault();  // cegah submit default

                const success = await handleSubmit(e);
                if (!success) return;

                const confirmPrint = window.confirm("Cetak Bukti Premi Driver?");
                if (confirmPrint) {
                  window.open(
                    `/cetak-premi-driver?no=${formData.no_premi_driver}&autoPrint=true`,
                    "_blank"
                  );
                }

                setShowForm(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();   // cegah submit
                  e.stopPropagation();  // cegah trigger tombol hapus potongan
                }
              }}
              className="grid grid-cols-2 gap-4 pb-6"
            >
              <div className="col-span-2">
                <label>No Premi Driver</label>
                <input
                  type="text"
                  name="no_premi_driver"
                  readOnly
                  value={formData.no_premi_driver}
                  className="w-full border px-3 py-2 bg-gray-100"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Tanggal</label>
                <input
                  type="date"
                  name="tanggal"
                  value={formData.tanggal}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              
              <div className="relative">
                <label className="block mb-1 font-semibold">No Surat Jalan</label>
                <input
                  type="text"
                  name="no_surat_jalan"
                  value={sjSearch ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSjSearch(value);
                    setShowDropdown(true);
                    setHighlightedIndex(-1);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  onKeyDown={(e) => {
                    const keyword = (sjSearch ?? "").toLowerCase();

                    const filtered = suratJalanTersedia.filter((item) =>
                      (typeof item.no_surat_jalan === "string" &&
                        item.no_surat_jalan.toLowerCase().includes(keyword)) ||
                      (typeof item.nama === "string" &&
                        item.nama.toLowerCase().includes(keyword))
                    );

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedIndex((prev) => {
                        const next = prev < filtered.length - 1 ? prev + 1 : 0;
                        setTimeout(() => {
                          document.getElementById(`sj-item-${next}`)?.scrollIntoView({ block: "nearest" });
                        }, 0);
                        return next;
                      });
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedIndex((prev) => {
                        const next = prev > 0 ? prev - 1 : filtered.length - 1;
                        setTimeout(() => {
                          document.getElementById(`sj-item-${next}`)?.scrollIntoView({ block: "nearest" });
                        }, 0);
                        return next;
                      });
                    } else if (e.key === "Enter" && highlightedIndex >= 0) {
                      e.preventDefault();
                      const selected = filtered[highlightedIndex];
                      const detail = semuaSJ.find(
                        (sj) =>
                          sj.no_surat_jalan === selected.no_surat_jalan &&
                          (sj.driver === selected.nama || sj.crew === selected.nama)
                      );
                      if (detail) {
                        handleSelectSj({ ...detail, nama: selected.nama });
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
                  <ul className="absolute z-50 w-full max-h-60 overflow-auto bg-white border rounded mt-1 shadow-lg text-sm">
                    {suratJalanTersedia
                      .filter((item) =>
                        (typeof item.no_surat_jalan === "string" &&
                          item.no_surat_jalan.toLowerCase().includes((sjSearch ?? "").toLowerCase())) ||
                        (typeof item.nama === "string" &&
                          item.nama.toLowerCase().includes((sjSearch ?? "").toLowerCase()))
                      )
                      .map((item, idx) => {
                        const detail = semuaSJ.find(
                          (sj) =>
                            sj.no_surat_jalan === item.no_surat_jalan &&
                            (sj.driver === item.nama || sj.crew === item.nama)
                        );
                        if (!detail) return null;

                        return (
                          <li
                            key={`${item.no_surat_jalan}-${item.nama}`}
                            id={`sj-item-${idx}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectSj({ ...detail, nama: item.nama });
                            }}
                            className={`px-3 py-2 cursor-pointer ${
                              highlightedIndex === idx ? "bg-blue-100" : "hover:bg-gray-200"
                            }`}
                          >
                            {item.no_surat_jalan} - {item.nama}
                          </li>
                        );
                      })}

                    {suratJalanTersedia.length === 0 && (
                      <li className="px-3 py-2 text-gray-400">Tidak ditemukan</li>
                    )}
                  </ul>
                )}
              </div>
              
              {/* Tanggal Berangkat & Kembali */}
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

              {/* DRIVER */}
              <div className="relative">
                <label className="block mb-1 font-semibold">Driver</label>
                <input
                  type="text"
                  name="driver"
                  value={formData.driver ?? ""}
                  readOnly
                  className="w-full border rounded px-3 py-2 bg-gray-100 cursor-pointer"
                  placeholder="Pilih driver dari SJ"
                />

                {showDriverDropdown && (
                  <ul className="absolute z-50 w-full max-h-60 overflow-auto bg-white border rounded mt-1 shadow-lg text-sm">
                    {driverDropdownOptions.map((name, idx) => (
                      <li
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormData((prev) => ({ ...prev, driver: name }));
                          setShowDriverDropdown(false);
                        }}
                        className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div>
                <label>No Polisi</label>
                <input
                  name="no_polisi"
                  value={formData.no_polisi ?? ""}
                  readOnly
                  onChange={handleChange}
                  className="w-full border px-3 py-2 bg-gray-100"
                />
              </div>
              
              {/* Kode Unit */}
              <div>
                <label className="block mb-1 font-semibold">Kode Unit</label>
                <input
                  type="text"
                  readOnly
                  name="kode_unit"
                  value={formData.kode_unit ?? ""}
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
                  value={formData.kode_rute ?? ""}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>

              <div>
                <label>Premi</label>
                <input
                  name="premi"
                  value={formatRupiah(formData.premi ?? 0)}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 text-left"
                />
              </div>
              <div>
                <label>Perpal</label>
                <input
                  type="text"
                  name="perpal"
                  value={formatRupiah(formData.perpal ?? 0)}
                  onChange={handleChange}
                  disabled={!formData.perpalAktif}
                  className={`w-full border rounded px-3 py-2 ${!formData.perpalAktif ? "bg-gray-100 text-gray-500" : ""}`}
                />
              </div>
              <div className="mb-2">
                <label className="block font-semibold mb-1">Potongan</label>
                {potonganList.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center mb-1">
                    <input
                      ref={index === potonganList.length - 1 ? lastPotonganRef : null}
                      type="text"
                      placeholder="Keterangan"
                      value={item.keterangan}
                      onChange={(e) => {
                        const updated = [...potonganList];
                        updated[index].keterangan = e.target.value;
                        setPotonganList(updated);
                      }}
                      className="border px-2 py-1 text-sm w-1/2"
                    />
                    <input
                      type="text"
                      placeholder="Nominal"
                      value={
                        item.nominal !== null && item.nominal !== undefined
                          ? formatRupiah(item.nominal)
                          : ""
                      }
                      onChange={(e) => {
                        const updated = [...potonganList];
                        updated[index].nominal = Number(
                          e.target.value.replace(/[^\d]/g, "")
                        );
                        setPotonganList(updated);
                      }}
                      className="border px-2 py-1 text-sm w-1/3 text-right"
                    />
                    <button
                      onClick={() => {
                        const updated = [...potonganList];
                        updated.splice(index, 1);
                        setPotonganList(updated);
                      }}
                      className="text-red-500 text-sm"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setPotonganList((prev) => [...prev, { keterangan: "", nominal: 0 }])
                  }
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  + Tambah Potongan
                </button>
              </div>
              
              {/* Jumlah Premi Driver */}
              <div className="col-span-2 my-2 font-bold text-center">
                <label>TOTAL</label>
                <input
                  readOnly
                  value={formatRupiah(formData.jumlah ?? 0)}
                  className="w-full border rounded px-3 py-2 bg-green-400 text-center font-bold text-xl"
                />
              </div>

              {/* Garis batas Realisasi Uang Sakau */}
              <div className="col-span-2 border-t border-gray-300 my-4"></div>

              {/* Header */}
              <div className="col-span-2 font-semibold text-xl font-semibold text-center mb-4">
                Realisasi Uang Saku Driver
              </div>

              {/* Uang Saku */}
              <div>
                <label className="block mb-1">Uang Saku</label>
                <input
                  type="text"
                  readOnly
                  value={formatRupiah(uangSakuDetail.uang_saku)}
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>

              {/* BBM */}
              <div>
                <label className="block mb-1">Biaya BBM</label>
                <input
                  type="text"
                  value={formatRupiah(uangSakuDetail.bbm)}
                  onChange={(e) => handleUangSakuChange("bbm", e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Makan */}
              <div>
                <label className="block mb-1">Biaya Makan</label>
                <input
                  type="text"
                  value={formatRupiah(uangSakuDetail.makan)}
                  onChange={(e) => handleUangSakuChange("makan", e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Parkir */}
              <div>
                <label className="block mb-1">Biaya Parkir</label>
                <input
                  type="text"
                  value={formatRupiah(uangSakuDetail.parkir)}
                  onChange={(e) => handleUangSakuChange("parkir", e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Jumlah */}
              <div>
                <label className="block mb-1">Jumlah</label>
                <input
                  type="text"
                  readOnly
                  value={formatRupiah(uangSakuDetail.jumlah)}
                  className="w-full border rounded px-3 py-2 bg-blue-600 text-white font-bold text-center"
                />
              </div>

              {/* Sisa / Kembali */}
              <div>
                <label className="block mb-1">Sisa / Kembali</label>
                <input
                  type="text"
                  readOnly
                  value={formatRupiah(uangSakuDetail.sisa)}
                  className={`w-full border rounded px-3 py-2 bg-gray-100 font-bold text-center ${
                    uangSakuDetail.sisa >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                />
              </div>

              {/* Kartu EToll */}
              <div>
                <label className="block mb-1">Kartu EToll</label>
                <input
                  type="text"
                  readOnly
                  value={formData.kartu_etoll ?? ""}
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>

              {/* Biaya EToll */}
              <div>
                <label className="block mb-1 font-semibold">Biaya EToll (Wajib Diisi)</label>
                <input
                  type="text"
                  name="biaya_etoll"
                  value={formatRupiah(formData.biaya_etoll ?? 0)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      biaya_etoll: Number(e.target.value.replace(/[^\d]/g, "")),
                    }))
                  }
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/*Keterangan Transaksi */}
              <div className="col-span-2">
                <label>Keterangan</label>
                <textarea
                  name="keterangan"
                  value= {formData.keterangan ?? ""}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
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
    </div>
  );
}
