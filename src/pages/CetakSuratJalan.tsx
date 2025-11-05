import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function CetakSuratJalan() {
  const [searchParams] = useSearchParams();
  const noSurat = searchParams.get("no");
  const autoPrint = searchParams.get("autoPrint") === "true";

  interface SuratJalanRow {
    km_kembali: number;
    km_berangkat: number;
    snack_kembali: string;
    id: number;
    no_surat_jalan: string;
    tanggal_berangkat: string;
    tanggal_kembali: string;
    driver: string;
    crew?: string;
    no_polisi?: string;
    kode_unit?: string;
    kode_rute?: string;
    keterangan?: string;
    user_id?: string;
    snack_berangkat?: string;
  }
  const [data, setData] = useState<SuratJalanRow | null>(null);

  interface CustomUser {
    id: string;
    name?: string;
    email?: string;
  }

  const [customUser, setCustomUser] = useState<CustomUser | null>(null);

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

    const printTimer = setTimeout(() => {
      window.print();
    }, 800);

    return () => {
      clearTimeout(printTimer);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [data, autoPrint]);

  useEffect(() => {
  const fetchData = async () => {
    if (!noSurat) return;

    try {
      const { data, error } = await supabase
        .from("surat_jalan")
        .select("*")
        .eq("no_surat_jalan", noSurat); // ⚠️ TANPA .single() atau .maybeSingle()

      if (error) {
        console.error("Gagal ambil data:", error.message);
        return;
      }

      if (!data || data.length === 0) {
        console.warn("Tidak ditemukan data surat jalan:", noSurat);
        setData(null);
        return;
      }

      if (data.length > 1) {
        console.warn(`Peringatan: ada ${data.length} baris untuk no_surat_jalan = ${noSurat}`);
      }

      // Ambil baris pertama saja untuk ditampilkan
      setData(data[0]);
        } catch (err) {
          console.error("Kesalahan tak terduga saat ambil data:", err);
        }
      };

      fetchData();
    }, [noSurat]);

  if (!data) return <p className="text-center mt-10">Memuat data...</p>;

  const checklistPerlengkapan = [
    "Manifest",
    "Etoll",
    "Handphone",
    "Charger Hp",
    "Nota - nota",
    "Kartu Ucapan Salam",
  ];

  const checklistKebersihan = [
    "Lantai",
    "Jok Pnp & Driver",
    "Laci",
    "Pewangi dan Tissue",
    "Kaca Bagian Dalam",
    "Debu dan Remahan",
  ];

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
        </div>
      </div>

      <h2 className="text-center font-bold underline mb-1 text-[13px]">
        SURAT JALAN DRIVER
      </h2>
      <p className="text-center font-semibold mb-2">
        NO. &nbsp;&nbsp;{data.no_surat_jalan}
      </p>

      {/* INFO UTAMA */}
      <div className="grid grid-cols-3 gap-2 mb-2 text-[11px]">
        {/* KOLOM 1: Kode Unit, No Polisi, Tanggal */}
        <div className="grid grid-cols-[100px_1fr] gap-y-[2px]">
          <div className="contents">
            <span className="text-left">Kode Unit</span>
            <b>: {data.kode_unit}</b>
          </div>
          <div className="contents">
            <span className="text-left">No. Polisi</span>
            <b>: {data.no_polisi}</b>
          </div>
          <div className="contents">
            <span className="text-left">Tanggal</span>
            <b>
              : {new Date(data.tanggal_berangkat).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "2-digit",
              })}{" "}
              s/d{" "}
              {data.tanggal_kembali
                ? new Date(data.tanggal_kembali).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  })
                : "-"}
            </b>
          </div>
        </div>

        {/* KOLOM 2: Rute, Driver, Crew */}
        <div className="grid grid-cols-[100px_1fr] gap-y-[2px]">
          <div className="contents">
            <span className="text-left">Rute</span>
            <b>: {data.kode_rute}</b>
          </div>
          <div className="contents">
            <span className="text-left">Driver</span>
            <b>: {data.driver}</b>
          </div>
          <div className="contents">
            <span className="text-left">Crew</span>
            <b>: {data.crew}</b>
          </div>
        </div>

        {/* KOLOM 3: Catatan Penting */}
        <div className="border border-black p-1 text-[9px] leading-tight h-fit">
          <b className="block mb-1">Penting:</b>
          <ol className="list-decimal pl-4 space-y-[1px]">
            <li>Nota Solar wajib ada Nopol dan Kilometer saat pengisian BBM</li>
            <li>Nota Solar wajib dikumpulkan dan dibelikan sesuai nominal</li>
            <li>Parkir (jika perlu), sisa uang ditaruh dompet</li>
            <li>Surat Jalan ini berlaku sebagai tanda terima</li>
          </ol>
        </div>
      </div>

      {/* Snack & KM */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-[11px]">
        <table className="w-full border text-[11px]">
          <tbody>
            <tr>
              <td className="border border-black">Snack Berangkat</td>
              <td className="border border-black text-left px-4">{data.snack_berangkat || ""}</td>
            </tr>
            <tr>
              <td className="border border-black">Snack Kembali</td>
              <td className="border border-black text-left px-4">{data.snack_kembali || ""}</td>
            </tr>
            <tr>
              <td className="border border-black">KM Berangkat</td>
              <td className="border border-black text-left px-4">{data.km_berangkat ? Number(data.km_berangkat).toLocaleString("id-ID") : ""}</td>
            </tr>
            <tr>
              <td className="border border-black">KM Kembali</td>
              <td className="border border-black text-left px-4">{data.km_kembali ? Number(data.km_kembali).toLocaleString("id-ID") : ""}</td>
            </tr>
          </tbody>
        </table>

        {/* Checklist */}
        <div className="grid grid-cols-2 gap-2">
          <table className="w-full border text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-center px-2 py-1">PERLENGKAPAN MAP</th>
              </tr>
            </thead>
            <tbody>
              {checklistPerlengkapan.map((item) => (
                <tr key={item}>
                  <td className="text-left px-2 py-1">
                    <label className="flex items-start gap-x-2">
                      <input type="checkbox" className="mt-[2px]" />
                      <span>{item}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="w-full border text-[11px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-center px-2 py-1">KEBERSIHAN</th>
              </tr>
            </thead>
            <tbody>
              {checklistKebersihan.map((item) => (
                <tr key={item}>
                  <td className="text-left px-2 py-1">
                    <label className="flex items-start gap-x-2">
                      <input type="checkbox" className="mt-[2px]" /> 
                      <span>{item}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catatan / Penting */}
      <div className="border-t border-b py-1 text-[10px] mb-2">
        <b>NOTED : JIKA ADA KENDALA SELAMA PERJALANAN, MOHON HUBUNGI NOMOR 0811-2974-579</b>
      </div>
      <div className="border-t border-b py-1 text-center text-[10px] mb-2">
        <b>"Keselamatan adalah Utama, Kejujuran adalah Prioritas"</b>
      </div>

      <table className="w-full border text-[10px] mt-4">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-center" colSpan={2}>DIPERIKSA OLEH</th>
            <th className="border px-2 py-1 text-center">KEBERANGKATAN</th>
            <th className="border px-2 py-1 text-center">KEDATANGAN</th>
          </tr>
          <tr>
            <th className="border px-2 py-1 text-center">Driver</th>
            <th className="border px-2 py-1 text-center">Staf Operasional</th>
            <th className="border px-2 py-1 text-center">Diserahkan Oleh,</th>
            <th className="border px-2 py-1 text-center">Diterima Oleh,</th>
          </tr>
        </thead>
        <tbody>
          <tr className="h-[90px] align-bottom">
            <td className="border px-8 py-1 text-center align-bottom">
              <span>{data.driver}</span>
            </td>
            <td className="border px-2 py-1 text-center">
            </td>
            <td className="border px-2 py-1 text-center align-bottom">
              <span>{customUser?.name || ""}</span>
            </td>
            <td className="border px-2 py-1 text-center">
            </td>
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
            margin: 4mm 6mm 2mm 4mm;
          }

          html, body {
            width: 210mm;
            height: 148mm;
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8pt;
            line-height: 1.15;
            overflow: hidden !important;
          }

          * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-container {
            font-size: 9pt !important;
            line-height: 1.2 !important;
            max-height: 136mm !important;
            overflow: hidden !important;
          }

          .print-container p.text-center.font-semibold {
            margin-bottom: 6px !important;
          }

          .h-[40px] {
            height: 60px !important;
          }

          h1, h2, h3, h4, h5, h6,
          .text-[13px], .text-[12px], .text-[11px], .text-[10px], .text-[9px] {
            font-size: 9pt !important;
            line-height: 1.2 !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse;
            font-size: 9pt;
          }

          td, th {
            border: 1px solid black;
            padding: 1px 2px;
            font-size: 9pt;
          }

          .mb-1, .mb-2, .mt-1, .mt-2 {
            margin-top: 2px !important;
            margin-bottom: 2px !important;
          }

          .gap-2 {
            gap: 4px !important;
          }

          .gap-1 {
            gap: 2px !important;
          }

          .leading-tight {
            line-height: 1.2 !important;
          }

          .text-[10px], .text-[11px], .text-[12px], .text-[13px] {
            font-size: 9pt !important;
          }

          .text-[9px] {
            font-size: 8pt !important;
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
