import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiDownload } from "react-icons/fi";
import { exportTableToExcel } from "../utils/exportTableToExcel";
import { toDate } from "./SuratJalan";
import { getEntityContext, type EntityContext } from "../lib/entityContext";

interface LedgerRow {
  no: number;
  no_premi_driver: string;
  tanggal: string;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  no_polisi: string;
  kode_rute: string;
  jumlah: number;

  [key: string]: unknown;
}

interface JenisPotongan {
  id: string;
  nama: string;
  kategori: string | null;
}

interface DriverRow {
  premi_driver: {
    driver: string;
    entity_id: string;
  };
}

interface DetailRow {
  nominal: number | null;
  jenis_potongan_id: string | null;
  premi_driver?: {
    no_premi_driver: string;
    no_polisi: string;
    kode_rute: string;
    tanggal: string;
    tanggal_berangkat: string;
    tanggal_kembali: string;
  };
}

interface KasRow {
  bukti_transaksi: string;
  tanggal: string;
  keterangan: string;
  nominal: number | null;
  jenis_transaksi: "debet" | "kredit";
}

export default function LaporanDriver() {
  const [entityId, setEntityId] = useState<string | null>(null);

  const [drivers, setDrivers] = useState<string[]>([]);
  const [driverSearch, setDriverSearch] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [data, setData] = useState<LedgerRow[]>([]);
  const [jenisList, setJenisList] = useState<JenisPotongan[]>([]);
  const [selectedJenisId, setSelectedJenisId] = useState("");

  const [filtered, setFiltered] = useState<LedgerRow[]>([]);

  const selectedJenis = jenisList.find((j) => j.id === selectedJenisId);

  useEffect(() => {
    loadEntity();
  }, []);

  // Muat daftar jenis potongan (dinamis dari tabel jenis_potongan)
  useEffect(() => {
    if (entityId) loadJenisList();
  }, [entityId]);

  useEffect(() => {
    if (entityId && selectedJenisId) {
      setSelectedDriver("");
      setDriverSearch("");
      setData([]);
      loadDrivers();
    }
  }, [entityId, selectedJenisId]);

  useEffect(() => {
    if (selectedDriver && selectedJenisId) loadData();
  }, [selectedDriver, selectedJenisId]);

  function handleSelectDriver(driver: string) {
    setSelectedDriver(driver);
    setDriverSearch(driver);
    setShowDropdown(false);
  }

  useEffect(() => {
    setFiltered(data);
  }, [data]);

  const totalFiltered = filtered.reduce((sum, r) => sum + r.jumlah, 0);

  const handleExportExcel = () => {
    const namaJenis = selectedJenis?.nama || "Potongan";
    exportTableToExcel(filtered, {
      filename: `DriverLedger_${namaJenis.replace(/\s+/g, "_")}.xlsx`,
      sheetName: `${namaJenis} Driver`,
      columns: [
        { label: "Tanggal", key: "tanggal", type: "date", format: toDate },
        { label: "No Bukti Transaksi", key: "no_premi_driver" },
        { label: "Tanggal Berangkat", key: "tanggal_berangkat", type: "date", format: toDate },
        { label: "Tanggal Kembali", key: "tanggal_kembali", type: "date", format: toDate },
        { label: "No Polisi", key: "no_polisi" },
        { label: "Kode Rute", key: "kode_rute" },
        { label: namaJenis, key: "jumlah", type: "currency" },
      ],
    });
  };

  async function loadEntity() {
    const storedUser = localStorage.getItem("custom_user");

    if (!storedUser) {
      console.error("User tidak ditemukan di localStorage");
      return;
    }

    try {
      const parsed = JSON.parse(storedUser);

      if (!parsed?.entity_id) {
        console.error("Entity ID tidak ada pada custom_user");
        return;
      }

      const ctx: EntityContext = await getEntityContext(parsed.entity_id);

      setEntityId(ctx.entity_id);
    } catch (err) {
      console.error("Gagal membaca custom_user:", err);
    }
  }

  async function loadJenisList() {
    if (!entityId) return;

    const { data, error } = await supabase
      .from("jenis_potongan")
      .select("id, nama, kategori")
      .order("nama");

    if (error) {
      console.error(error);
      return;
    }

    const list = (data || []) as JenisPotongan[];
    setJenisList(list);

    if (list.length > 0 && !selectedJenisId) {
      setSelectedJenisId(list[0].id);
    }
  }

  // Daftar driver yang pernah tercatat utk jenis terpilih (tetap muncul
  // meski sudah lunas/nol, supaya history tidak hilang & mudah tracking).
  async function loadDrivers() {
    if (!entityId || !selectedJenisId) return;

    const { data, error } = await supabase
      .from("premi_driver_potongan")
      .select("premi_driver:premi_driver_id!inner(driver, entity_id)")
      .eq("premi_driver.entity_id", entityId)
      .eq("jenis_potongan_id", selectedJenisId);

    if (error) {
      console.error(error);
      return;
    }

    const uniqueDrivers = Array.from(
      new Set(
        ((data || []) as DriverRow[])
          .map(
            (r: DriverRow) =>
              ((r.premi_driver.driver as string) || "").trim()
          )
          .filter(Boolean)
      )
    ).sort();

    setDrivers(uniqueDrivers);
  }

  const filteredDrivers = drivers.filter((d) =>
    d.toLowerCase().includes(driverSearch.trim().toLowerCase())
  );

  const formatTanggal = (tgl: string | null | undefined): string => {
    if (!tgl) return "";

    const [year, month, day] = (tgl || "").split("-");

    return `${day}-${month}-${year}`;
  };

  async function loadData() {
    if (!selectedDriver || !selectedJenisId || !entityId) return;
    if (!selectedJenis) return;

    // 1) Potongan dari premi (detail per-jenis)
    const { data: detail, error: detailError } = await supabase
      .from("premi_driver_potongan")
      .select(
        `nominal,
         jenis_potongan_id,
         premi_driver:premi_driver_id!inner(
           no_premi_driver, no_polisi, kode_rute,
           tanggal, tanggal_berangkat, tanggal_kembali
         )`
      )
      .eq("jenis_potongan_id", selectedJenisId)
      .eq("premi_driver.driver", selectedDriver)
      .eq("premi_driver.entity_id", entityId);

    if (detailError) {
      console.error(detailError);
      return;
    }

    const premiRows: LedgerRow[] = ((detail as DetailRow[]) || []).map((d) => {
      const p = d.premi_driver;

      return {
        no: 0,
        no_premi_driver: p?.no_premi_driver || "",
        tanggal: p?.tanggal || "",
        tanggal_berangkat: p?.tanggal_berangkat || "",
        tanggal_kembali: p?.tanggal_kembali || "",
        no_polisi: p?.no_polisi || "",
        kode_rute: p?.kode_rute || "",
        jumlah: Number(d.nominal || 0),
      };
    });

    // 2) Transaksi kas (pelunasan / pemakaian) utk jenis ini
    const { data: kas, error: kasError } = await supabase
      .from("kas_harian")
      .select("bukti_transaksi, tanggal, keterangan, nominal, jenis_transaksi")
      .eq("entity_id", entityId)
      .eq("driver", selectedDriver)
      .eq("kategori", selectedJenis.nama)
      .order("tanggal");

    if (kasError) {
      console.error(kasError);
      return;
    }

    const kasRows: LedgerRow[] = ((kas as KasRow[]) || []).map((k) => ({
      no: 0,
      no_premi_driver: k.bukti_transaksi || "",
      tanggal: k.tanggal || "",
      tanggal_berangkat: "",
      tanggal_kembali: "",
      no_polisi: "",
      kode_rute: k.keterangan || "",
      jumlah:
        k.jenis_transaksi === "debet"
          ? Number(k.nominal || 0)
          : -Number(k.nominal || 0),
    }));

    const gabungan = [...premiRows, ...kasRows];

    gabungan.sort(
      (a, b) =>
        new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );

    gabungan.forEach((r, i) => {
      r.no = i + 1;
    });

    setData(gabungan);
  }

  return (
    <div className="p-4 bg-white rounded shadow max-w-[1600px] mx-auto">
      <div className="mb-3 w-80">
        <label className="block mb-1 font-semibold">
          Jenis Ledger
        </label>

        <select
          value={selectedJenisId}
          onChange={(e) => setSelectedJenisId(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          {jenisList.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nama}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 w-80">
        <div className="mb-4 w-80 relative">
          <input
            type="text"
            value={driverSearch}
            onChange={(e) => {
              const value = e.target.value;
              setDriverSearch(value);
              setShowDropdown(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => {
              setTimeout(() => setShowDropdown(false), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex((prev) => {
                  const next = prev < filteredDrivers.length - 1 ? prev + 1 : 0;
                  const el = document.getElementById(`driver-item-${next}`);
                  if (el) el.scrollIntoView({ block: "nearest" });
                  return next;
                });
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex((prev) => {
                  const next = prev > 0 ? prev - 1 : filteredDrivers.length - 1;
                  const el = document.getElementById(`driver-item-${next}`);
                  if (el) el.scrollIntoView({ block: "nearest" });
                  return next;
                });
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < filteredDrivers.length) {
                  handleSelectDriver(filteredDrivers[highlightedIndex]);
                }
              } else if (e.key === "Escape") {
                setShowDropdown(false);
              }
            }}
            placeholder="Cari Driver..."
            className="w-full border rounded px-3 py-2"
            autoComplete="off"
          />

          {showDropdown && (
            <ul className="absolute z-50 w-full max-h-60 overflow-auto bg-white border rounded mt-1 shadow-lg">
              {filteredDrivers.map((driver, idx) => (
                <li
                  key={driver}
                  id={`driver-item-${idx}`}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    handleSelectDriver(driver);
                  }}
                  className={`px-3 py-2 cursor-pointer ${
                    highlightedIndex === idx ? "bg-blue-100" : "hover:bg-gray-200"
                  }`}
                >
                  {driver}
                </li>
              ))}

              {filteredDrivers.length === 0 && (
                <li className="px-3 py-2 text-gray-400">Tidak ditemukan</li>
              )}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            <FiDownload /> Export Excel
          </button>
        </div>
      </div>

      <div className="w-full pr-8">
        <table className="table-auto border w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">No</th>
              <th className="border px-2 py-1">Tanggal</th>
              <th className="border px-2 py-1">No Bukti Transaksi</th>
              <th className="border px-2 py-1">Tgl Brkt & Kembali</th>
              <th className="border px-2 py-1">Nopol</th>
              <th className="border px-2 py-1">Keterangan</th>
              <th className="border px-2 py-1 text-right">
                {selectedJenis?.nama || "Jumlah"}
              </th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((row) => (
              <tr key={row.no}>
                <td className="border px-2 py-1 text-center">{row.no}</td>
                <td className="border px-2 py-1 text-center">
                  {formatTanggal(row.tanggal)}
                </td>
                <td className="border px-2 py-1">{row.no_premi_driver}</td>
                <td className="border px-2 py-1">
                  {formatTanggal(row.tanggal_berangkat)} - {formatTanggal(row.tanggal_kembali)}
                </td>
                <td className="border px-2 py-1">{row.no_polisi}</td>
                <td className="border px-2 py-1">{row.kode_rute}</td>
                <td className="border px-2 py-1 text-right">
                  {row.jumlah.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={6} className="border px-2 py-1 text-right">
                TOTAL
              </td>
              <td className="border font-bold px-2 py-1 text-right">
                {totalFiltered.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
