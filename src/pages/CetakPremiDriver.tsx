import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function CetakPremiDriver() {
  const [searchParams] = useSearchParams();
  const noPD = searchParams.get("no");
  const autoPrint = searchParams.get("autoPrint") === "true";
  const [suratJalan, setSuratJalan] = useState<any>(null);

  interface CustomUser {
    id: string;
    name?: string;
    email?: string;
  }

  const [customUser, setCustomUser] = useState<CustomUser | null>(null);
  const [data, setData] = useState<any>(null);
  const [saku, setSaku] = useState({
    bbm: 0,
    makan: 0,
    parkir: 0,
  });

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

  // === FETCH DATA PREMI_DRIVER + KAS_HARIAN + REALISASI SAKU ===
  useEffect(() => {
    const fetchData = async () => {
      if (!noPD) return;

      // ambil premi_driver
      const { data: pdData, error: err1 } = await supabase
        .from("premi_driver")
        .select("*")
        .eq("no_premi_driver", noPD)
        .single();

      if (err1 || !pdData) {
        console.error("❌ Gagal ambil data premi_driver:", err1?.message);
        return;
      }

      // ambil kas_harian
      const { data: kasData, error: err2 } = await supabase
        .from("kas_harian")
        .select("keterangan, nominal, jenis_transaksi")
        .eq("bukti_transaksi", noPD)
        .eq("sumber_tabel", "premi_driver");

      if (err2) {
        console.error("❌ Gagal ambil kas_harian:", err2.message);
        return;
      }

      // ambil realisasi saku driver dari uang_saku_driver
      const { data: sakuData } = await supabase
        .from("uang_saku_driver")
        .select("bbm, uang_makan, parkir")
        .eq("no_surat_jalan", pdData.no_surat_jalan)
        .single();

      setSaku({
        bbm: sakuData?.bbm || 0,
        makan: sakuData?.uang_makan || 0,
        parkir: sakuData?.parkir || 0,
      });

      // hitung total premi, perpal, potongan
      let totalPremi = 0;
      let totalPerpal = 0;
      let potonganList: { keterangan: string; nominal: number }[] = [];

      kasData?.forEach((row) => {
        const ket = row.keterangan || "";
        if (ket.startsWith("Premi Driver")) totalPremi += row.nominal;
        if (ket.startsWith("Perpal")) totalPerpal += row.nominal;
        if (ket.startsWith("Potongan")) {
          const cleaned = ket
            .replace(/^Potongan\s*/i, "")
            .split(pdData.driver)[0]
            ?.split(pdData.no_polisi)[0]
            ?.split(pdData.no_surat_jalan)[0]
            ?.trim();
          potonganList.push({ keterangan: cleaned || "-", nominal: row.nominal });
        }
      });

      const subTotalA = totalPremi + totalPerpal;
      const subTotalB = potonganList.reduce((sum, p) => sum + (p.nominal || 0), 0);
      const takeHomePay = subTotalA - subTotalB;

      setData({
        ...pdData,
        totalPremi,
        totalPerpal,
        potonganList,
        subTotalA,
        subTotalB,
        takeHomePay,
      });
    };

    fetchData();
  }, [noPD]);

  // === Fetch data surat_jalan ===
  useEffect(() => {
    const fetchSuratJalan = async () => {
      if (!data?.no_surat_jalan) return;
      const { data: sjData } = await supabase
        .from("surat_jalan")
        .select("*")
        .eq("no_surat_jalan", data.no_surat_jalan)
        .single();
      if (sjData) setSuratJalan(sjData);
    };
    fetchSuratJalan();
  }, [data?.no_surat_jalan]);

  // === AUTO PRINT ===
  useEffect(() => {
    if (!data || !autoPrint) return;

    let printed = false;
    const handleBeforePrint = () => (printed = true);
    const handleAfterPrint = () => {
      setTimeout(() => {
        if (printed) window.close();
      }, 300);
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    const timer = setTimeout(() => window.print(), 800);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [data, autoPrint]);

  if (!data)
    return <p className="text-center mt-10 text-sm">Memuat data premi driver...</p>;

  // ✅ Format dengan prefix Rp dan default 0 bila undefined
  const formatRp = (num: number | null | undefined) =>
    `Rp ${Number(num || 0).toLocaleString("id-ID")}`;

  // ✅ Tambahkan fungsi ini di bawah formatRp
  const formatTanggal = (tgl: string | Date | null | undefined) => {
    if (!tgl) return "-";
    try {
      const dateObj = new Date(tgl);
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
      };
      return dateObj.toLocaleDateString("id-ID", options).replace(".", "");
    } catch {
      return "-";
    }
  };

  const getPerpalKeterangan = (sj: any) => {
    if (!sj) return "";
    if (sj.perpal_2x_tanggal && sj.perpal_2x_rute) {
      return `[2x] ${formatTanggal(sj.perpal_2x_tanggal)} ${sj.perpal_2x_rute}`;
    }
    if (sj.perpal_1x_tanggal && sj.perpal_1x_rute) {
      return `[1x] ${formatTanggal(sj.perpal_1x_tanggal)} ${sj.perpal_1x_rute}`;
    }
    return "";
  };


  return (
    <div className="font-sans p-4 bg-white text-[12px] print-sheet">
      {/* HEADER */}
      <div className="flex justify-between items-start border-b border-black mb-1">
        <div>
          <img src="/logo.png" alt="Logo" className="h-12" />
          <p className="font-semibold mt-1 text-[12px]">Hotline : 081 1250 8818</p>
        </div>
        <div className="text-right text-[12px]">
          <p>Jl. Ringroad Barat No. 15 Demakijo</p>
          <p>Yogyakarta 55292</p>
          <p>Email : shuttle@putraremaja.co.id</p>
        </div>
      </div>

      <h2 className="text-center font-bold underline mb-1 text-[16px]">
        FORM PREMI DRIVER
      </h2>
      <p className="text-center font-semibold mb-4 text-[14px]">
        NO. {data.no_premi_driver}
      </p>

      {/* INFO DRIVER */}
      <div className="grid grid-cols-3 gap-4 text-[12px] mb-2">
        <div className="grid grid-cols-[100px_1fr] gap-y-[2px]">
          <span>Tanggal Premi</span>
          <b>: {formatTanggal(data.tanggal)}</b>
          <span>Kode Unit</span>
          <b>: {data.kode_unit}</b>
          <span>No Polisi</span>
          <b>: {data.no_polisi}</b>
          <span>No Surat Jalan</span>
          <b>: {data.no_surat_jalan}</b>
        </div>

        <div className="grid grid-cols-[80px_1fr] gap-y-[2px]">
          <span>Rute</span>
          <b>: {data.kode_rute}</b>

          {/*
            Tampilkan Driver hanya bila:
            - data.driver ada (truthy)
            - dan setelah di-trim nilainya berbeda dari data.crew (menghindari kasus driver terisi dengan nama crew)
            Jika kondisi itu tidak terpenuhi tetapi data.crew ada → tampilkan Crew.
          */}
          {data?.driver && (String(data.driver).trim() !== String(data.crew).trim()) ? (
            <>
              <span>Driver</span>
              <b>: {data.driver}</b>
            </>
          ) : data?.crew ? (
            <>
              <span>Crew</span>
              <b>: {data.crew}</b>
            </>
          ) : (
            <>
              <span>Nama</span>
              <b>: -</b>
            </>
          )}
        </div>

        {/* REALISASI SAKU DRIVER */}
        <div>
          <b>Realisasi Saku Driver</b>
          <table className="w-full border text-[11px] mt-1">
            <thead>
              <tr>
                <th className="border px-2 w-[100px]">Keterangan</th>
                <th className="border px-2 w-[90px]">Nominal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 text-left">BBM</td>
                <td className="border px-2 text-right">{formatRp(saku.bbm)}</td>
              </tr>
              <tr>
                <td className="border px-2 text-left">Biaya Makan</td>
                <td className="border px-2 text-right">{formatRp(saku.makan)}</td>
              </tr>
              <tr>
                <td className="border px-2 text-left">Parkir</td>
                <td className="border px-2 text-right">{formatRp(saku.parkir)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PENDAPATAN */}
      <table className="w-full border table-fixed mb-3 text-[11px]">
        <thead>
          <tr>
            <th className="border px-2 w-[40px]">No</th>
            <th className="border px-2 text-left">A. Pendapatan</th>
            <th className="border px-2 w-[170px]">Nominal</th>
            <th className="border px-2 w-[152px]">Sub Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border px-2 text-center">1</td>
            <td className="border px-2 text-left">Premi Driver</td>
            <td className="border px-2 text-right">{formatRp(data.totalPremi)}</td>
            <td className="border px-2"></td>
          </tr>
          {data.totalPerpal > 0 && (
            <tr>
              <td className="border px-2 text-center">2</td>
              <td className="border px-2 text-left">Perpal {getPerpalKeterangan(suratJalan)}</td>
              <td className="border px-2 text-right">{formatRp(data.totalPerpal)}</td>
              <td className="border px-2"></td>
            </tr>
          )}
          <tr>
            <td className="border px-2 text-right font-semibold"></td>
            <td className="border px-2 text-right font-semibold"></td>
            <td className="border px-2 text-right font-semibold">Total A</td>
            <td className="border px-2 text-right font-semibold">
             {formatRp(data.subTotalA)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* POTONGAN */}
      {data.potonganList?.length > 0 && (
        <table className="w-full border table-fixed mb-4 text-[11px]">
          <thead>
            <tr>
              <th className="border px-2 w-[40px]">No</th>
              <th className="border px-2 text-left">B. Potongan</th>
              <th className="border px-2 w-[170px]">Nominal</th>
              <th className="border px-2 w-[152px]">Sub Total</th>
            </tr>
          </thead>
          <tbody>
            {data.potonganList.map((p: any, i: number) => (
              <tr key={i}>
                <td className="border px-2 text-center">{i + 1}</td>
                <td className="border px-2 text-left">{p.keterangan}</td>
                <td className="border px-2 text-right">{formatRp(p.nominal)}</td>
                <td className="border px-2"></td>
              </tr>
            ))}
            <tr>
              <td className="border px-2 text-right font-semibold"></td>
              <td className="border px-2 text-right font-semibold"></td>
              <td className="border px-2 text-right font-semibold">Total B</td>
              <td className="border px-2 text-right font-semibold">
                {formatRp(data.subTotalB)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* TAKE HOME PAY */}
      <table className="w-full border-none table-fixed mb-4 text-[11px]">
          <tbody>
              <tr>
              <td colSpan={3} className="gborder border px-2 text-right font-bold">
                TAKE HOME PAY (A - B)
              </td>
              <td className="border-2 border-black text-right font-bold text-[16px] w-[152px]">
                {formatRp(data.takeHomePay)}
              </td>
            </tr>
          </tbody>
        </table>

      {/* TANDA TANGAN */}
      <table className="w-full border text-[10px] mb-2">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-center">Diterima,</th>
            <th className="border px-2 py-1 text-center">Dikeluarkan,</th>
            <th className="border px-2 py-1 text-center w-[322px]">Diverifikasi,</th>
          </tr>
        </thead>
        <tbody>
          <tr className="h-[120px] align-bottom">
            <td className="border px-2 py-1 text-center align-bottom">
              <span>{data.driver}</span>
            </td>
            <td className="border px-2 py-1 text-center align-bottom">
              <span>{customUser?.name || ""}</span>
            </td>
            <td className="border px-2 py-1 text-center align-bottom">Finance</td>
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
            font-size: 10pt;
            line-height: 1.15;
            overflow: hidden !important;
          }

          * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-container {
            font-size: 10pt !important;
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
            font-size: 10pt !important;
            line-height: 1.2 !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse;
            font-size: 10pt;
          }

          td, th {
            border: 1px solid black;
            padding: 2px 4px;
            font-size: 10pt;
          }
          
          .gborder {
            border-left: hidden;
            border-top: hidden;
            border-bottom: hidden;
            padding: 2px 4px;
            font-size: 10pt;
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
