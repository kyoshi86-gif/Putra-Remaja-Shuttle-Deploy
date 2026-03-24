import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiDownload } from "react-icons/fi";
import { exportTableToExcel } from "../utils/exportTableToExcel";
import { toDate } from "./SuratJalan";
import { getEntityContext, type EntityContext } from "../lib/entityContext";

interface JaminanRow {
  no: number;
  no_premi_driver: string;
  tanggal: string;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  no_polisi: string;
  kode_rute: string;
  jaminan: number;

  [key: string]: unknown; // 🔥 WAJIB TAMBAH INI
}

export default function LaporanDriver() {
  const [entityId, setEntityId] = useState<string | null>(null);

  const [drivers, setDrivers] = useState<string[]>([]);
  const [driverSearch, setDriverSearch] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [data, setData] = useState<JaminanRow[]>([]);

  const [filtered, setFiltered] = useState<JaminanRow[]>([]);

  useEffect(() => {
    loadEntity();
  }, []);

  useEffect(() => {
    if (entityId) loadDrivers();
  }, [entityId]);

  useEffect(() => {
    if (selectedDriver) loadData();
  }, [selectedDriver]);

  function handleSelectDriver(driver: string) {
    setSelectedDriver(driver);
    setDriverSearch(driver);
    setShowDropdown(false);
  }

  useEffect(() => {
    setFiltered(data);
  }, [data]);

  const totalFiltered = filtered.reduce((sum, r) => sum + r.jaminan, 0);

  const handleExportExcel = () => {
    exportTableToExcel(filtered, {
      filename: "JaminanDriver.xlsx",
      sheetName: "Jaminan Driver",
      columns: [
        { label: "Tanggal", key: "tanggal", type: "date", format: toDate },
        { label: "No Premi Driver", key: "no_premi_driver" },
        { label: "Tanggal Berangkat", key: "tanggal_berangkat", type: "date", format: toDate },
        { label: "Tanggal Kembali", key: "tanggal_kembali", type: "date", format: toDate },
        { label: "No Polisi", key: "no_polisi" },
        { label: "Kode Rute", key: "kode_rute" },
        { label: "Jaminan", key: "jaminan", type: "currency" },
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

  async function loadDrivers() {

    if (!entityId) return;

    const { data, error } = await supabase
      .from("premi_driver")
      .select("driver")
      .eq("entity_id", entityId)
      .not("driver", "is", null)
      .order("driver", { ascending: true });

    if (error) {
      console.error("Error load driver:", error);
      return;
    }

    if (!data) return;

    const uniqueDrivers = Array.from(
      new Set(data.map((d) => d.driver?.trim()))
    ).filter(Boolean);

    setDrivers(uniqueDrivers);
  }

  async function loadData() {
    const { data: premi, error } = await supabase
      .from("premi_driver")
      .select("id, no_premi_driver, no_polisi, kode_rute, potongan_jaminan, tanggal, tanggal_berangkat, tanggal_kembali")
      .eq("driver", selectedDriver)
      .eq("entity_id", entityId)
      .gt("potongan_jaminan", 0) // 🔥 FILTER DI SINI
      .order("tanggal", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    // 🔵 DATA DARI PREMI DRIVER
    const premiRows = (premi || []).map((p) => ({
      no: 0,
      no_premi_driver: p.no_premi_driver,
      tanggal: p.tanggal,
      no_polisi: p.no_polisi,
      kode_rute: p.kode_rute,
      tanggal_berangkat: p.tanggal_berangkat,
      tanggal_kembali: p.tanggal_kembali,
      jaminan: Number(p.potongan_jaminan || 0),
    }));

    // 🔴 DATA DARI KAS HARIAN (jaminan driver)
    const { data: kas } = await supabase
      .from("kas_harian")
      .select("tanggal, nominal, bukti_transaksi, jenis_transaksi, driver, keterangan, kategori")
      .eq("driver", selectedDriver)
      .eq("entity_id", entityId)
      .eq("kategori", "Jaminan Driver"); // 🔥 harus sama dengan nama di DB

    const kasRows = (kas || []).map((k) => ({
      no: 0,
      no_premi_driver: k.bukti_transaksi || "Kas Jaminan",
      tanggal: k.tanggal,
      no_polisi: "-",
      kode_rute: k.keterangan || "Kas Jaminan",
      tanggal_berangkat: "",
      tanggal_kembali: "",
      jaminan:
        k.jenis_transaksi === "debet"
          ? Number(k.nominal)
          : -Number(k.nominal),
    }));

    // 🔥 GABUNG + URUTKAN
    const combined = [...premiRows, ...kasRows]
      .sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || ""))
      .map((row, i) => ({
        ...row,
        no: i + 1,
      }));

    setData(combined);
  }

  const filteredDrivers = drivers.filter((d) =>
    d.toLowerCase().includes(driverSearch.toLowerCase())
  );

  const formatTanggal = (tgl: string | null | undefined): string => {
    if (!tgl) return "";

    const [year, month, day] = (tgl || "").split("-");

    return `${day}-${month}-${year}`;
  };

  return (
    <div className="p-4 bg-white rounded shadow max-w-[1600px] mx-auto">

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
              <th className="border px-2 py-1 text-right">Jaminan</th>
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
                  {row.jaminan.toLocaleString()}
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