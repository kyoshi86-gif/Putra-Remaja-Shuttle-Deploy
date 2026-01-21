import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Dashboard() {
  // ===============================
  // 🧩 DEFINISI TYPE
  // ===============================
  interface SuratJalan {
    no_surat_jalan: string;
    tanggal_berangkat?: string | null;
    tanggal_kembali?: string | null;
    tanggal?: string | null; // dari tabel uang_saku atau premi
    driver: string;
    kode_rute: string;
    status: string;
  }

  interface TabelProps {
    title: string;
    data: SuratJalan[];
  }

  interface CardProps {
    title: string;
    value: number;
    icon: string;
    color: string;
  }

  // ===============================
  // 🧩 STATE
  // ===============================
  const [loading, setLoading] = useState<boolean>(true);
  const [sjAktif, setSjAktif] = useState<SuratJalan[]>([]);
  const [sjBelumSaku, setSjBelumSaku] = useState<SuratJalan[]>([]);
  const [sjBelumPremi, setSjBelumPremi] = useState<SuratJalan[]>([]);

  // ===============================
  // 🔥 LOAD DATA DASHBOARD
  // ===============================
  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);

    try {
      // 🚐 SURAT JALAN AKTIF (tanpa kolom status)
      const { data: aktif, error: errorAktif } = await supabase
        .from("surat_jalan")
        .select("no_surat_jalan, tanggal_berangkat, driver, kode_rute")
        .order("tanggal_berangkat", { ascending: false });

      if (errorAktif) {
        console.error("Error fetch Surat Jalan Aktif:", errorAktif);
      }

      // 💸 BELUM UANG SAKU
      const { data: belumSaku, error: errorSaku } = await supabase.rpc("get_sj_belum_saku");
      if (errorSaku) console.error("Error fetch SJ Belum Saku:", errorSaku);

      // 🏆 BELUM PREMI
      const { data: belumPremi, error: errorPremi } = await supabase.rpc("get_sj_belum_premi");
      if (errorPremi) console.error("Error fetch SJ Belum Premi:", errorPremi);

      setSjAktif((aktif as SuratJalan[]) ?? []);
      setSjBelumSaku((belumSaku as SuratJalan[]) ?? []);
      setSjBelumPremi((belumPremi as SuratJalan[]) ?? []);
    } catch (err) {
      console.error("Error loadDashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // 🔖 BADGE STATUS
  // ===============================
  const BadgeStatus = ({ status }: { status: string | null }) => {
    const color =
      status === "berangkat"
        ? "bg-blue-100 text-blue-700"
        : status === "ongoing"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-gray-200 text-gray-700";

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
        {status ?? "-"}
      </span>
    );
  };

  // ===============================
  // 📊 CARD SUMMARY
  // ===============================
  const CardStat = ({ title, value, icon, color }: CardProps) => (
    <div className="p-4 rounded-xl shadow bg-white border flex items-center gap-4 hover:shadow-lg transition">
      <div className={`p-3 rounded-lg text-white text-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );

  // ===============================
  // 📋 TABEL MODERN
  // ===============================
  const TabelModern = ({ title, data }: TabelProps) => (
    <div className="bg-white p-5 rounded-xl border shadow-md">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 text-sm top-0">
            <tr>
              <th className="border p-2">No SJ</th>
              <th className="border p-2">Tanggal</th>
              <th className="border p-2">Driver</th>
              <th className="border p-2">Rute</th>
              <th className="border p-2">Status</th>
            </tr>
          </thead>

          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-3 text-gray-500">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.no_surat_jalan ?? Math.random()}
                  className="text-sm hover:bg-gray-50"
                >
                  <td className="border p-2">{row.no_surat_jalan ?? "-"}</td>
                  <td className="border p-2">
                    {(() => {
                      const t =
                        row.tanggal_berangkat ||
                        row.tanggal ||
                        row.tanggal_kembali ||
                        null;

                      return t ? new Date(t).toLocaleDateString("id-ID") : "-";
                    })()}
                  </td>
                  <td className="border p-2">{row.driver ?? "-"}</td>
                  <td className="border p-2">{row.kode_rute ?? "-"}</td>
                  <td className="border p-2">
                    <BadgeStatus status={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ===============================
  // 🚀 FINAL RENDER
  // ===============================
  if (loading) return <div className="p-4">Loading dashboard...</div>;

  return (
  <div className="p-4 bg-white rounded shadow">
    <div className="pr-8 space-y-6">
      {/* CARD STAT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <CardStat
          title="Surat Jalan Terbit"
          value={sjAktif.length}
          icon="🚐"
          color="bg-blue-500"
        />

        <CardStat
          title="Belum Diproses Uang Saku"
          value={sjBelumSaku.length}
          icon="💸"
          color="bg-emerald-500"
        />

        <CardStat
          title="Belum Diproses Premi"
          value={sjBelumPremi.length}
          icon="🏆"
          color="bg-orange-500"
        />
      </div>

      {/* TABEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TabelModern
          title="💸 Surat Jalan Belum Diproses Uang Saku"
          data={sjBelumSaku}
        />
        <TabelModern
          title="🏆 Surat Jalan Belum Diproses Premi Driver"
          data={sjBelumPremi}
        />
      </div>
    </div>
  </div>
  );
}
