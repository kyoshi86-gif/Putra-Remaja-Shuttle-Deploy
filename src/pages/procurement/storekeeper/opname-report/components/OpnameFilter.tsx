import type { Dispatch, SetStateAction } from "react";

import type { OpnameFilter } from "../types";

import type { StoreOption } from "../../types";

interface Props {
  filter: OpnameFilter;
  stores: StoreOption[];
  onChange: Dispatch<SetStateAction<OpnameFilter>>;
}

export default function OpnameFilter({ filter, stores, onChange }: Props) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Tanggal Awal</label>

          <input
            type="date"
            value={filter.dateFrom}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                dateFrom: e.target.value,
              }))
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Tanggal Akhir
          </label>

          <input
            type="date"
            value={filter.dateTo}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                dateTo: e.target.value,
              }))
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Gudang</label>

          <select
            value={filter.storeId}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                storeId: e.target.value,
              }))
            }
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Semua Gudang</option>

            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.code} - {store.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Pencarian</label>

          <input
            type="text"
            placeholder="No Opname / Artikel..."
            value={filter.keyword}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                keyword: e.target.value,
              }))
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>
      </div>
    </div>
  );
}
