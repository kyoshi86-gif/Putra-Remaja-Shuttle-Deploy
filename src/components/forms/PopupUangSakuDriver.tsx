import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { FiX } from "react-icons/fi";


export interface UangSakuFormData {
  id: number;
  sumber_id: number;
  tanggal: string;
  waktu?: string;
  no_uang_saku: string;
  no_surat_jalan: string;
  tanggal_berangkat?: string;
  tanggal_kembali?: string;
  driver: string;
  crew?: string;
  no_polisi: string;
  kode_unit: string;
  kode_rute: string;
  bbm: number;
  uang_makan: number;
  parkir: number;
  jumlah: number;
  kartu_etoll?: string;
  jenis_transaksi?: string;
  user_id?: string;
  keterangan?: string;
}

interface PopupUangSakuDriverProps {
  formData: UangSakuFormData;
  setFormData: React.Dispatch<React.SetStateAction<UangSakuFormData>>;
  setShowForm: (v: boolean) => void;
  defaultForm: UangSakuFormData;
  setFormSource: React.Dispatch<React.SetStateAction<"kas_harian" | "uang_saku_driver">>; // ✅
  fetchData?: () => Promise<void>;
  sjSearch: string;
  setSjSearch: (v: string) => void;
  sjList: { id?: number; no_surat_jalan: string }[];
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  highlightedIndex: number;
  setHighlightedIndex: (v: number) => void;
  handleSelectSj: (sj: { no_surat_jalan: string }) => void;
}

const PopupUangSakuDriver = ({
  formData,
  setFormData,
  setShowForm,
  defaultForm,
  setFormSource,
  fetchData,
  sjSearch,
  setSjSearch,
  sjList,
  showDropdown,
  setShowDropdown,
  highlightedIndex,
  setHighlightedIndex,
  handleSelectSj,
}: PopupUangSakuDriverProps) => {

  // Format angka ke Rupiah
  const formatRupiah = (num: number) =>
    "Rp " + (num ? num.toLocaleString("id-ID") : "0");

  // Auto hitung jumlah setiap kali bbm, uang_makan, atau parkir berubah
  useEffect(() => {
  setFormData((prev: UangSakuFormData) => ({
    ...prev,
    jumlah: (prev.bbm || 0) + (prev.uang_makan || 0) + (prev.parkir || 0),
  }));
}, [formData.bbm, formData.uang_makan, formData.parkir]);

  // Handle input perubahan
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericFields = ["bbm", "uang_makan", "parkir"];
    if (numericFields.includes(name)) {
      const raw = value.replace(/[^\d]/g, "");
      setFormData((prev: UangSakuFormData) => ({
        ...prev,
        [name]: raw ? Number(raw) : 0,
      }));
    } else {
      setFormData((prev: UangSakuFormData) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Tutup form
  const handleCloseForm = () => {
    setShowForm(false);
  };

  // Simpan data
  const handleSubmit = async () => {
    const tanggalValid = typeof formData.tanggal === "string" && formData.tanggal.trim() !== "";
    const nominalValid = typeof formData.jumlah === "number" && !isNaN(formData.jumlah);

    if (!tanggalValid || !nominalValid) {
      alert("Tanggal dan Jumlah wajib diisi.");
      return false;
    }

    if (!formData.sumber_id || !formData.id) {
      alert("❌ sumber_id atau id kas_harian kosong.");
      return false;
    }

    try {
      const { error } = await supabase
        .from("uang_saku_driver")
        .update({
          tanggal: formData.tanggal,
          no_uang_saku: formData.no_uang_saku,
          bbm: formData.bbm,
          uang_makan: formData.uang_makan,
          parkir: formData.parkir,
          jumlah: formData.jumlah,
          kartu_etoll: formData.kartu_etoll,
          no_surat_jalan: formData.no_surat_jalan,
        })
        .eq("id", formData.sumber_id);

      if (error) {
        alert("❌ Gagal update Uang Saku Driver: " + error.message);
        return false;
      }

      alert("✅ Uang Saku Driver berhasil disimpan.");

      const { error: kasError } = await supabase
        .from("kas_harian")
        .update({
          nominal: formData.jumlah,
          tanggal: formData.tanggal,
          waktu: formData.waktu,
          bukti_transaksi: formData.no_uang_saku,
          jenis_transaksi: formData.jenis_transaksi,
          sumber_id: formData.sumber_id,
          sumber_tabel: "uang_saku_driver",
          user_id: formData.user_id,
          keterangan: formData.keterangan,
        })
        .eq("id", formData.id);

      if (kasError) {
        alert("❌ Gagal update kas_harian: " + kasError.message);
        return false;
      }

      await fetchData?.(); // ✅ refresh data kas_harian setelah simpan
      return true;
    } catch (err) {
      const error = err as Error;
      alert("❌ Gagal simpan: " + error.message);
      return false;
    }
  };

  return (
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
          onSubmit={async (e) => {
            e.preventDefault();
            const success = await handleSubmit();
            if (!success) return;

            const confirmPrint = window.confirm("Cetak Bukti Uang Saku?");
            if (confirmPrint) {
              window.open(
                `/cetak-uang-saku?no=${formData.no_uang_saku}&autoPrint=true`,
                "_blank"
              );
            }

            setShowForm(false);
            setFormData(defaultForm);
            setFormSource("kas_harian");
          }}
          className="grid grid-cols-2 gap-4 pb-6"
        >
          {/* No Uang Saku Driver */}
          <div className="col-span-2">
            <label className="block mb-1 font-semibold">No Uang Saku Driver</label>
            <input
              type="text"
              name="no_uang_saku"
              required
              value={formData.no_uang_saku || ""}
              readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
            />
          </div>

          {/* Tanggal Uang Saku */}
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

          {/* No Surat Jalan */}
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
                setFormData((prev: UangSakuFormData) => ({
                  ...prev,
                  no_surat_jalan: value,
                }));
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onKeyDown={(e) => {
                const filtered: { id?: number; no_surat_jalan: string }[] = sjList.filter(
                  (sj) => sj.no_surat_jalan?.toLowerCase().includes(sjSearch.toLowerCase())
                );

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const nextIndex = highlightedIndex < filtered.length - 1 ? highlightedIndex + 1 : 0;
                    document.getElementById(`sj-item-${nextIndex}`)?.scrollIntoView({ block: "nearest" });
                    setHighlightedIndex(nextIndex);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const nextIndex = highlightedIndex > 0 ? highlightedIndex - 1 : filtered.length - 1;
                    document.getElementById(`sj-item-${nextIndex}`)?.scrollIntoView({ block: "nearest" });
                    setHighlightedIndex(nextIndex);
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
              <ul className="absolute z-50 w-full max-h-60 overflow-auto bg-white border rounded mt-1 shadow-lg">
                {sjList
                  .filter((sj) =>
                    sj.no_surat_jalan?.toLowerCase().includes(sjSearch.toLowerCase())
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
                  sj.no_surat_jalan?.toLowerCase().includes(sjSearch.toLowerCase())
                ).length === 0 && (
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
                  ? `${new Date(formData.tanggal_berangkat).toLocaleDateString("id-ID").replaceAll("/", "-")} s/d ${new Date(formData.tanggal_kembali).toLocaleDateString("id-ID").replaceAll("/", "-")}`
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

          {/* BBM */}
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

          {/* Uang Makan */}
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

          {/* Parkir */}
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

          {/* Jumlah */}
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

          {/* Tombol Simpan */}
          <button
            type="submit"
            className="col-span-2 mt-3 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Simpan
          </button>
        </form>
      </div>
    </div>
  );
};

export default PopupUangSakuDriver;