import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getEntityContext, type EntityContext } from "../lib/entityContext";

interface SuratJalan {
  no_surat_jalan:string;
  tanggal_berangkat?:string|null;
  driver:string;
  kode_rute:string;

  premi:number;
}


export default function Dashboard() {

  const [loading, setLoading] = useState(true);

  const [sjBelumSaku, setSjBelumSaku] = useState<SuratJalan[]>([]);
  const [sjBelumPremi, setSjBelumPremi] = useState<SuratJalan[]>([]);

  const totalPremiBelumDiambil =
    sjBelumPremi.reduce(
      (sum,row)=>sum + Number(row.premi || 0),
      0
    );

  const [totalSuratJalan, setTotalSuratJalan] = useState(0);

  const [entityCtx, setEntityCtx] = useState<EntityContext | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [entities, setEntities] = useState<{id:string; kode:string; nama:string}[]>([]);

  // =============================
  // ENTITY CONTEXT
  // =============================

  useEffect(() => {

    const storedUser = localStorage.getItem("custom_user");
    if (!storedUser) return;

    const parsed = JSON.parse(storedUser);

    getEntityContext(parsed.entity_id).then((ctx)=>{
      setEntityCtx(ctx);
      setSelectedEntityId(ctx.entity_id);
    });

  }, []);

  // =============================
  // FETCH ENTITY LIST
  // =============================

  useEffect(()=>{

    if (entityCtx?.tipe !== "pusat") return;

    supabase
      .from("entities")
      .select("id,kode,nama")
      .order("nama")
      .then(({data})=>{
        if(data) setEntities(data);
      });

  },[entityCtx]);

  // =============================
  // LOAD DASHBOARD
  // =============================

  useEffect(()=>{

    if(!entityCtx) return;

    loadDashboard();

  },[entityCtx,selectedEntityId]);


  const loadDashboard = async ()=>{

    setLoading(true);

    const entityId = selectedEntityId ?? entityCtx?.entity_id;

    if(!entityId){
      setLoading(false);
      return;
    }

    try{

      // =============================
      // TOTAL SURAT JALAN
      // =============================

      const {count} = await supabase
        .from("surat_jalan")
        .select("*",{count:"exact",head:true})
        .eq("entity_id",entityId);

      setTotalSuratJalan(count ?? 0);

      // =============================
      // BELUM UANG SAKU
      // =============================

      const {data:belumSaku} = await supabase
        .rpc("get_sj_belum_saku",{entity_filter:entityId});

      setSjBelumSaku(belumSaku ?? []);

      // =============================
      // BELUM PREMI
      // =============================

      const { data: belumPremi } = await supabase
        .rpc("get_sj_belum_premi", { entity_filter: entityId });

      setSjBelumPremi(belumPremi ?? []);

    }
    catch(err){
      console.error(err);
    }

    setLoading(false);
  };


  // =============================
  // CARD
  // =============================

  const Card = ({title,value,color}:{title:string,value:number,color:string})=>(
    <div className={`p-4 rounded-xl shadow text-white ${color}`}>
      <div className="text-sm">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );

  // =============================
  // TABLE
  // =============================

  const Table = ({
    title,
    data,
    showPremi = false
  }:{
    title:string;
    data:SuratJalan[];
    showPremi?:boolean;
  })=>(
    <div className="bg-white p-4 rounded shadow">
      <h2 className="font-semibold mb-3">{title}</h2>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">No SJ</th>
            <th className="border p-2">Tanggal</th>
            <th className="border p-2">Driver</th>
            <th className="border p-2">Rute</th>
            {showPremi && (
              <th className="border p-2">Premi</th>
            )}
          </tr>
        </thead>

        <tbody>

        {data.length === 0 &&
          <tr>
            <td
              colSpan={showPremi ? 5 : 4}
              className="text-center p-3"
            >
              Tidak ada data
            </td>
          </tr>
        }

        {data.map(row=>(
          <tr key={row.no_surat_jalan}>
            <td className="border p-2">{row.no_surat_jalan}</td>
            <td className="border p-2">
              {row.tanggal_berangkat
                ? new Date(row.tanggal_berangkat).toLocaleDateString("id-ID")
                : "-"
              }
            </td>
            <td className="border p-2">{row.driver}</td>
            <td className="border p-2">{row.kode_rute}</td>
            {showPremi && (
              <td className="border p-2 text-right">
                {Number(row.premi || 0).toLocaleString("id-ID")}
              </td>
            )}
          </tr>
        ))}

        </tbody>

        {showPremi && (
          <tfoot>
            <tr className="bg-yellow-100 font-bold">
              <td
                colSpan={4}
                className="border p-2 text-right"
              >
                TOTAL PREMI BELUM DIAMBIL
              </td>

              <td className="border p-2 text-right">
                {totalPremiBelumDiambil.toLocaleString("id-ID")}
              </td>
            </tr>
          </tfoot>
          )}
      </table>
    </div>
  );


  if(loading) return <div className="p-6">Loading...</div>;

  return(

  <div className="p-4 space-y-6 pr-12">

    {/* CARD */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      <Card
        title="🚐 Surat Jalan Terbit"
        value={totalSuratJalan}
        color="bg-blue-500"
      />

      <Card
        title="💸 Belum Uang Saku"
        value={sjBelumSaku.length}
        color="bg-emerald-500"
      />

      <Card
        title="🏆 Belum Premi"
        value={sjBelumPremi.length}
        color="bg-orange-500"
      />

    </div>

    {/* FILTER */}
    {entityCtx?.tipe==="pusat" &&
      <div className="flex items-center gap-2 border px-3 py-2 rounded bg-gray-100">
        <label className="font-semibold text-sm whitespace-nowrap">
          Outlet:
        </label>
        <select
          value={selectedEntityId ?? ""}
          onChange={(e)=>setSelectedEntityId(e.target.value)}
          className="border p-2 rounded"
        >
          {entities.map(e=>(
            <option key={e.id} value={e.id}>
              {e.nama}
            </option>
          ))}
        </select>
      </div>
    }

    {/* TABLE */}

    <div className="grid lg:grid-cols-2 gap-6">

      <Table
        title="💸 Surat Jalan Belum Uang Saku"
        data={sjBelumSaku}
        showPremi={false}
      />

      <Table
        title="🏆 Surat Jalan Belum Premi Driver"
        data={sjBelumPremi}
        showPremi={true}
      />

    </div>
  </div>

  );

}