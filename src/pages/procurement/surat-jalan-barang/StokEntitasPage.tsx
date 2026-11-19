import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCustomUser } from "@/lib/authUser";

interface Props {
  entityId?: string | null;
}

interface StockRow {
  entity_id: string;
  entity_kode: string;
  entity_nama: string;
  item_id: string;
  item_code: string;
  item_name: string;
  unit_code: string;
  qty_on_hand: number;
  avg_cost: number;
}

function fmtQty(n: number): string {
  return Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function fmtMoney(n: number): string {
  return "Rp " + Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export default function StokEntitasPage({ entityId: propEntityId = null }: Props) {
  const currentUser = getCustomUser();
  const entityId = propEntityId ?? currentUser?.entity_id ?? null;

  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Array<{ id: string; kode: string; nama: string }>>([]);
  const [filterEntity, setFilterEntity] = useState(entityId ?? "");

  const fetchMasters = useCallback(async () => {
    const { data } = await supabase.from("entities").select("id,kode,nama").order("kode");
    setEntities((data ?? []) as Array<{ id: string; kode: string; nama: string }>);
  }, []);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("item_entity_stocks")
      .select(
        `
        entity_id,
        qty_on_hand,
        avg_cost,
        entity:entities(kode,nama),
        item:items(code,name,unit:units(code))
        `,
      )
      .order("entity_id");

    if (filterEntity) {
      query = query.eq("entity_id", filterEntity);
    }

    const { data, error } = await query;
    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const out: StockRow[] = ((data ?? []) as unknown as Array<{
      entity_id: string;
      qty_on_hand: number;
      avg_cost: number;
      entity: { kode: string; nama: string } | Array<{ kode: string; nama: string }> | null;
      item: {
        code: string;
        name: string;
        unit: { code: string } | Array<{ code: string }> | null;
      } | null;
    }>).map((r) => {
      const ent = Array.isArray(r.entity) ? r.entity[0] : r.entity;
      const itm = r.item;
      const unit = itm?.unit ? (Array.isArray(itm.unit) ? itm.unit[0] : itm.unit) : null;
      return {
        entity_id: r.entity_id,
        entity_kode: ent?.kode ?? "?",
        entity_nama: ent?.nama ?? "",
        item_id: "",
        item_code: itm?.code ?? "",
        item_name: itm?.name ?? "",
        unit_code: unit?.code ?? "",
        qty_on_hand: Number(r.qty_on_hand ?? 0),
        avg_cost: Number(r.avg_cost ?? 0),
      };
    });

    setRows(out);
    setLoading(false);
  }, [filterEntity]);

  useEffect(() => {
    fetchMasters();
  }, [fetchMasters]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Stok per Entitas</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm">Entitas:</label>
          <select
            className="border rounded px-2 py-1"
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
          >
            <option value="">Semua</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.kode} — {ent.nama}
              </option>
            ))}
          </select>
          <button
            className="border rounded px-3 py-1 text-sm"
            onClick={fetchStocks}
            disabled={loading}
          >
            {loading ? "Loading..." : "Muat Ulang"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded mb-3">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table-auto w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 text-left">Entitas</th>
              <th className="border px-2 py-1 text-left">Kode Item</th>
              <th className="border px-2 py-1 text-left">Nama Item</th>
              <th className="border px-2 py-1 text-left">Satuan</th>
              <th className="border px-2 py-1 text-right">Qty</th>
              <th className="border px-2 py-1 text-right">Avg Cost</th>
              <th className="border px-2 py-1 text-right">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="border px-2 py-3 text-center">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="border px-2 py-3 text-center">
                  Belum ada stok terdata.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.entity_id}-${r.item_code}-${i}`}>
                  <td className="border px-2 py-1 font-medium">
                    {r.entity_kode} — {r.entity_nama}
                  </td>
                  <td className="border px-2 py-1 font-mono">{r.item_code}</td>
                  <td className="border px-2 py-1">{r.item_name}</td>
                  <td className="border px-2 py-1">{r.unit_code}</td>
                  <td className="border px-2 py-1 text-right font-semibold">
                    {fmtQty(r.qty_on_hand)}
                  </td>
                  <td className="border px-2 py-1 text-right">{fmtMoney(r.avg_cost)}</td>
                  <td className="border px-2 py-1 text-right">
                    {fmtMoney(r.qty_on_hand * r.avg_cost)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
