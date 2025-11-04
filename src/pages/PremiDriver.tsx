// src/pages/PremiDriver.tsx
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload, FiPrinter } from "react-icons/fi";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
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
  id_kas_harian?: number | null;
  user_id?: string;
}

export default function PremiDriver() {
  const [data, setData] = useState<PremiData[]>([]);
  const [filtered, setFiltered] = useState<PremiData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [sjSearch, setSjSearch] = useState<string>(""); // ✅ eksplisit string
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [, setDriverOptions] = useState<string[]>([]);
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
      .select("no_surat_jalan, driver, crew, tanggal_berangkat, tanggal_kembali, no_polisi, kode_unit, kode_rute");

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

    setFormData((prev) => ({
      ...prev,
      no_surat_jalan: sj.no_surat_jalan,
      driver: sj.nama ?? "",
      crew: sj.crew ?? "",
      tanggal_berangkat: sj.tanggal_berangkat ?? "",
      tanggal_kembali: sj.tanggal_kembali ?? "",
      no_polisi: sj.no_polisi ?? "",
      kode_unit: sj.kode_unit ?? "",
      kode_rute: sj.kode_rute ?? "",
    }));

    // ✅ Hanya ambil data realisasi jika yang dipilih adalah driver
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
      // ✅ Kosongkan jika yang dipilih adalah crew
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
      filteredData = filteredData.filter((d) =>
        (typeof d.no_premi_driver === "string" &&
          d.no_premi_driver.toLowerCase().includes(keyword)) ||
        (typeof d.no_surat_jalan === "string" &&
          d.no_surat_jalan.toLowerCase().includes(keyword)) ||
        (typeof d.driver === "string" &&
          d.driver.toLowerCase().includes(keyword)) ||
        (typeof d.no_polisi === "string" &&
          d.no_polisi.toLowerCase().includes(keyword))
      );
    }
    setFiltered(filteredData);
  }, [search, data]);

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
      .eq("sumber_tabel", "premi_driver");

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
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Premi Driver");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "UangSakuDriver.xlsx");
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

    // === Validasi wajib isi ===
    const wajibIsi = [
      { field: "no_surat_jalan", label: "No Surat Jalan" },
      { field: "driver", label: "Driver" },
      { field: "no_polisi", label: "Nomor Polisi" },
      { field: "kode_rute", label: "Kode Rute" },
      { field: "tanggal_berangkat", label: "Tanggal Berangkat" },
      { field: "tanggal_kembali", label: "Tanggal Kembali" },
    ];

    for (const { field, label } of wajibIsi) {
      const key = field as keyof PremiData;
      const value = formData[key];
      if (!value || value.toString().trim() === "") {
        alert(`❌ ${label} wajib diisi.`);
        return;
      }
    }

    // ❌ Cegah simpan jika Sisa / Kembali negatif
    if ((uangSakuDetail.sisa || 0) < 0) {
      alert("❌ Sisa / Kembali tidak boleh negatif. Periksa kembali pengisian BBM, Makan, dan Parkir.");
      return;
    }

    // === Bersihkan angka ===
    const numericFields = ["premi", "perpal"];
    const cleanedData: Partial<Record<keyof PremiData, string | number | null>> = { ...formData };

    numericFields.forEach((f) => {
      const key = f as keyof PremiData;
      const raw = cleanedData[key];

      const parsed =
        raw === "" || raw === undefined || raw === null
          ? null
          : Number(String(raw).replace(/[^\d.-]/g, ""));

      if (parsed === null || Number.isNaN(parsed)) {
        cleanedData[key] = null as PremiData[typeof key];
      } else {
        cleanedData[key] = parsed as PremiData[typeof key];
      }
    });

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
      transaksi.push({
        tanggal: formData.tanggal,
        waktu: waktuNow,
        keterangan: `Perpal ${keteranganBase}`,
        nominal: Number(cleanedData.perpal ?? 0),
        jenis_transaksi: "kredit",
        sumber_tabel: "premi_driver",
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
          sumber_tabel: "premi_driver",
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
          sumber_tabel: "premi_driver",
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
          sumber_tabel: "premi_driver",
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
          sumber_tabel: "premi_driver",
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
      const { data: oldKas, error: fetchOldError } = await supabase
        .from("kas_harian")
        .select("id, keterangan, waktu")
        .eq("bukti_transaksi", finalNomor)
        .eq("sumber_tabel", "premi_driver");

      if (fetchOldError) {
        alert("❌ Gagal ambil transaksi kas lama: " + fetchOldError.message);
        return;
      }

      const currentUserId = getCustomUserId();

      for (const old of oldKas ?? []) {
        const isOldSisaKembali = old.keterangan?.startsWith("Sisa / Kembali");

      // ✅ Hapus baris lama jika sisa sekarang nol atau negatif
      if (isOldSisaKembali && (uangSakuDetail.sisa || 0) <= 0) {
        const { error: deleteError } = await supabase
          .from("kas_harian")
          .delete()
          .eq("id", old.id);

        if (deleteError) {
          alert("❌ Gagal hapus baris Sisa/Kembali: " + deleteError.message);
          return;
        }

        continue;
      }

        const trx = transaksi.find((t) =>
          t.keterangan?.trim().toLowerCase() === old.keterangan?.trim().toLowerCase()
        );
        if (!trx) {
          console.warn("❌ Baris tidak ditemukan di transaksi:", old.keterangan);
          continue;
        }

        const isSisaKembali = trx.keterangan?.startsWith("Sisa / Kembali");

        // ✅ Jika sisa = 0 dan ini baris sisa/kembali → hapus
        if (isSisaKembali && Math.abs(uangSakuDetail.sisa || 0) < 0.001) {
          const { error: deleteError } = await supabase
            .from("kas_harian")
            .delete()
            .eq("id", old.id);

          if (deleteError) {
            alert("❌ Gagal hapus baris Sisa/Kembali: " + deleteError.message);
            return;
          }

          continue; // ⛔ jangan lanjut update baris ini
        }

        // ✅ Hitung nominal realisasi saku utuh
        const nominal = trx.nominal;

        const jenis_transaksi = isSisaKembali
          ? uangSakuDetail.sisa >= 0 ? "debet" : "kredit"
          : trx.jenis_transaksi;

        const { error: updateError } = await supabase
          .from("kas_harian")
          .update({
            tanggal: formData.tanggal,
            waktu: old.waktu, // ✅ jaga urutan
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

      // ✅ Tambahkan baris baru jika ada
      const existingKeterangan = new Set((oldKas ?? []).map((k) => k.keterangan?.trim().toLowerCase()));
      const tambahan = transaksi.filter((t) => !existingKeterangan.has(t.keterangan?.trim().toLowerCase()));
console.log("🚀 transaksi:", transaksi);
      if (tambahan.length > 0) {
        const { error: insertError } = await supabase
          .from("kas_harian")
          .insert(tambahan);
console.log("✅ Menyimpan tambahan:", tambahan);
        if (insertError) {
          alert("❌ Gagal simpan transaksi tambahan: " + insertError.message);
          return;
        }
      }
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
      .eq("sumber_tabel", "premi_driver");

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
        setFormData(defaultFormData); // ✅ reset semua field
        setSjSearch("");              // ✅ kosongkan input SJ
        setPotonganList([]);          // ✅ bersihkan potongan
        setShowForm(false);           // ✅ tutup popup
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
    setFormData(defaultFormData); // reset semua isi form
    setSjSearch("");
    setPotonganList([]);          // ✅ bersihkan potongan
    setShowForm(false);            // sembunyikan pop-up
    };
// Format tanggal ke dd-mm-yyyy
  const formatTanggal = (tgl: string | null | undefined) => {
    if (!tgl) return "";
    const date = new Date(tgl);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).replaceAll("/", "-");
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
      {/* Tombol Aksi */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
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
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Cari data..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded px-3 py-2 pr-8"
          />
          {search && (
            <FiX
              className="absolute right-2 top-3 cursor-pointer text-gray-500"
              onClick={() => setSearch("")}
            />
          )}
        </div>
      </div>

      {/* Tabel Data */}
      <table className="min-w-[800px] w-full table-auto border border-gray-300 text-sm">
        <thead className="bg-gray-400 text-white">
          <tr>
            <th className="p-2 border text-center">
              <input
                type="checkbox"
                ref={selectAllRef}
                checked={selected.length === paginatedData.length && paginatedData.length > 0}
                onChange={handleSelectAll}
              />
            </th>
            <th className="p-2 border text-center w-[60px]">Aksi</th>
            <th className="p-2 border text-center w-[80px]">Tanggal</th>
            <th className="p-2 border text-center w-[100px]">No Kas / PD</th>
            <th className="p-2 border text-center w-[110px]">No Surat Jalan</th>
            <th className="p-2 border text-center w-[160px]">Tgl Brkt & Kembali</th>
            <th className="p-2 border text-center w-[90px]">Driver / Crew</th>
            <th className="p-2 border text-center">No Polisi</th>
            <th className="p-2 border text-center w-[60px]">Kode Unit</th>
            <th className="p-2 border text-center">Kode Rute</th>
            <th className="p-2 border text-center">Premi</th>
            <th className="p-2 border text-center">Perpal</th>
            <th className="p-2 border text-center">Potongan</th>
            <th className="p-2 border text-center">Jumlah</th>
            <th className="p-2 border text-center">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
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
                      setFormData({ ...row, user_id: row.user_id ?? getCustomUserId() ?? "" });
                      setSjSearch(row.no_surat_jalan || "");
                      setShowForm(true);
                      setPotonganList([]);

                      // ✅ Ambil semua baris kas_harian terkait
                      const { data: kasRows } = await supabase
                        .from("kas_harian")
                        .select("keterangan, nominal, jenis_transaksi")
                        .eq("bukti_transaksi", row.no_premi_driver)
                        .eq("sumber_tabel", "premi_driver");

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
              <td className="p-2 border">{row.keterangan}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
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
                  name="perpal"
                  value={formatRupiah(formData.perpal ?? 0)}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 text-left"
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

              {/*Keterangan Transaksi */}
              <div className="col-span-2">
                <label>Keterangan</label>
                <textarea
                  name="keterangan"
                  value={formData.keterangan ?? ""}
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
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
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
