import type { StoreOption } from "../../types";
import type { TransferFilter } from "../types";

interface Props {
  filter: TransferFilter;
  stores: StoreOption[];
  onChange: (value: TransferFilter) => void;
}

export default function TransferFilter({ filter, stores, onChange }: Props) {
  return (
    <div className="grid grid-cols-5 gap-3 rounded border bg-white p-4">
      {/* Date From */}
      <input
        type="date"
        value={filter.dateFrom}
        onChange={(e) => onChange({ ...filter, dateFrom: e.target.value })}
        className="rounded border px-3 py-2"
      />

      {/* Date To */}
      <input
        type="date"
        value={filter.dateTo}
        onChange={(e) => onChange({ ...filter, dateTo: e.target.value })}
        className="rounded border px-3 py-2"
      />

      {/* From Store */}
      <select
        value={filter.fromStoreId}
        onChange={(e) => onChange({ ...filter, fromStoreId: e.target.value })}
        className="rounded border px-3 py-2"
      >
        <option value="">Semua Gudang Asal</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.code} - {store.name}
          </option>
        ))}
      </select>

      {/* To Store */}
      <select
        value={filter.toStoreId}
        onChange={(e) => onChange({ ...filter, toStoreId: e.target.value })}
        className="rounded border px-3 py-2"
      >
        <option value="">Semua Gudang Tujuan</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.code} - {store.name}
          </option>
        ))}
      </select>

      {/* Keyword */}
      <input
        placeholder="Cari No Transfer / Artikel..."
        value={filter.keyword}
        onChange={(e) => onChange({ ...filter, keyword: e.target.value })}
        className="rounded border px-3 py-2"
      />
    </div>
  );
}
