import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function CetakUangSaku() {
  const [searchParams] = useSearchParams();
  const noUangSaku = searchParams.get("no");
  const autoPrint = searchParams.get("autoPrint") === "true";

  interface UangSakuRow {
    id: number;
    no_uang_saku: string;
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
    user_id: string;
    keterangan: string;
    tanggal: string;
    waktu: string;
  }

  const [data, setData] = useState<UangSakuRow | null>(null);

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

  // === FETCH DATA DARI SUPABASE ===
  useEffect(() => {
    const fetchData = async () => {
      if (!noUangSaku) return;

      try {
        const { data, error } = await supabase
          .from("uang_saku_driver")
          .select("*")
          .eq("no_uang_saku", noUangSaku);

        if (error) {
          console.error("Gagal ambil data:", error.message);
          return;
        }

        if (!data || data.length === 0) {
          console.warn("Tidak ditemukan data uang saku:", noUangSaku);
          setData(null);
          return;
        }

        if (data.length > 1) {
          console.warn(`Peringatan: ada ${data.length} baris untuk no_uang_saku = ${noUangSaku}`);
        }

        setData(data[0]);
      } catch (err) {
        console.error("Kesalahan saat ambil data:", err);
      }
    };

    fetchData();
  }, [noUangSaku]);

  // === AUTOPRINT ===
  useEffect(() => {
    if (!data || !autoPrint) return;

    let printed = false;

    const handleBeforePrint = () => {
      printed = true;
    };

    const handleAfterPrint = () => {
      setTimeout(() => {
        if (printed) window.close();
      }, 300);
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    const timer = setTimeout(() => {
      window.print();
    }, 800);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [data, autoPrint]);

  // === FORMAT ===
  const formatRupiah = (value: number | string | null) => {
  if (!value || isNaN(Number(value))) return "";
  return Number(value).toLocaleString("id-ID");
  };

  if (!data) return <p className="text-center mt-10">Memuat data...</p>;

  return (
    <div className="a5-sheet print-sheet print-container font-sans p-4 bg-white text-[12px]">
      {/* HEADER */}
      <div className="flex justify-between items-start border-b border-black mb-1">
        <div>
          <img src="/logo.png" alt="Logo" className="h-12" />
          <p className="font-semibold mt-1 text-[11px]">
            Hotline : 081 1250 8818
          </p>
        </div>
        <div className="text-right text-[11px]">
          <p>Jl. Ringroad Barat No. 15 Demakijo</p>
          <p>Yogyakarta 55292</p>
          <p>Email : shuttle@putraremaja.co.id</p>
        </div>
      </div>

      {/* JUDUL */}
      <h2 className="text-center font-bold underline mb-1 text-[16px]">
        UANG SAKU DRIVER
      </h2>
      <p className="text-center font-semibold mb-2">
        NO. &nbsp;&nbsp;{data.no_uang_saku}
      </p>

      {/* INFO UTAMA */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-[11px] leading-[18px]">
        <div className="grid grid-cols-[100px_1fr] gap-y-[2px]">
          <div className="contents">
            <span>Kode Unit</span>
            <b>: {data.kode_unit}</b>
          </div>
          <div className="contents">
            <span>No. Polisi</span>
            <b>: {data.no_polisi}</b>
          </div>
          <div className="contents">
            <span>Tanggal</span>
            <b>
               :{" "}
                {data.tanggal_berangkat && data.tanggal_kembali
                ? `${new Date(data.tanggal_berangkat).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                })} s/d ${new Date(data.tanggal_kembali).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                })}`
                : new Date(
                    data.tanggal_berangkat || data.tanggal_kembali
                ).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                })}
            </b>
          </div>
        </div>

        <div className="grid grid-cols-[100px_1fr] gap-y-[2px]">
          <div className="contents">
            <span>Rute</span>
            <b>: {data.kode_rute}</b>
          </div>
          <div className="contents">
            <span>Driver</span>
            <b>: {data.driver}</b>
          </div>
          <div className="contents">
            <span>Crew</span>
            <b>: {data.crew}</b>
          </div>
        </div>
      </div>

      {/* TABEL BIAYA */}
      <p className="border-t border-b text-[12px] mb-3 leading-[30px]">
        <b>No. Surat Jalan :</b> {data.no_surat_jalan}
      </p>
      <table className="w-full border text-[14px] mt-2">
        <thead className="bg-gray-100">
            <tr>
            <th className="border px-2 py-1 text-center">BBM</th>
            <th className="border px-2 py-1 text-center">Uang Makan</th>
            <th className="border px-2 py-1 text-center">Parkir</th>
            <th className="border px-2 py-1 text-center">Jumlah</th>
            </tr>
        </thead>
        <tbody>
            <tr>
            <td className="border px-2 py-1">
                <div className="flex justify-between">
                <span>Rp.</span>
                <span>{formatRupiah(data.bbm)}</span>
                </div>
            </td>
            <td className="border px-2 py-1">
                <div className="flex justify-between">
                <span>Rp.</span>
                <span>{formatRupiah(data.uang_makan)}</span>
                </div>
            </td>
            <td className="border px-2 py-1">
                <div className="flex justify-between">
                <span>Rp.</span>
                <span>{formatRupiah(data.parkir)}</span>
                </div>
            </td>
            <td className="border px-2 py-1 font-semibold">
                <div className="flex justify-between">
                <span>Rp.</span>
                <span>{formatRupiah(data.jumlah ?? 0)}</span>
                </div>
            </td>
            </tr>
        </tbody>
    </table>


      {/* INFORMASI TAMBAHAN */}
      <div className="text-[11px] mb-3 ">
        <p className="leading-[50px]">
          <b>Kartu Etol :</b> {data.kartu_etoll || "-"}
        </p>
      </div>

      {/* TANDA TANGAN */}
      <p className="leading-[10px]">
          <b>Yogyakarta, {new Date(data.tanggal).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "2-digit",
              })} </b>
        </p>
      <table className="w-full border text-[11px] mt-4">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-center">Diterima,</th>
            <th className="border px-2 py-1 text-center">Dikeluarkan,</th>
            <th className="border px-2 py-1 text-center">Verified,</th>
          </tr>
          <tr>
            <th className="border px-2 py-1 text-center">Driver</th>
            <th className="border px-2 py-1 text-center">Kasir</th>
            <th className="border px-2 py-1 text-center">Finance</th>
          </tr>

        </thead>
        <tbody>
          <tr className="h-[80px] align-bottom">
            <td className="border px-2 py-1 text-center">
              {data.driver}
            </td>
            <td className="border px-2 py-1 text-center">
              {customUser?.name || ""}
            </td>
            <td className="border px-2 py-1 text-center"></td>
          </tr>
        </tbody>
      </table>

      <p className="text-right text-[10px] mt-2 italic">
        Dicetak: {new Date().toLocaleString("id-ID")}
      </p>

      <style>{`
        @media print {
          @page {
            size: A5 landscape;
            margin: 4mm 8mm 0mm 4mm;
          }

          html, body {
            width: 210mm;
            height: 148mm;
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9pt;
            line-height: 1.2;
            overflow: hidden !important;
          }

          * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-container {
            font-size: 9pt !important;
            line-height: 1.2 !important;
            max-height: 138mm !important;
            overflow: hidden !important;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }

          td, th {
            border: 1px solid black;
            padding: 1px 3px;
          }

          .text-right {
            text-align: right !important;
          }

          .italic {
            font-style: italic !important;
          }
        }
      `}</style>
    </div>
  );
}
