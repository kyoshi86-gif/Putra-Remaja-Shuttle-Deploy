import { getWIBTimestampFromUTC } from "@/utils/time";
import { money, quantity } from "../../../utils/format";
import type { TransferDocument } from "../types";

interface Props {
  loading: boolean;
  documents: TransferDocument[];
  onDetail: (row: TransferDocument) => void;
}

export default function TransferTable({ loading, documents, onDetail }: Props) {
  if (loading) {
    return (
      <div className="rounded border bg-white p-6 text-center">
        Memuat data...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded border bg-white p-6 text-center text-gray-500">
        Belum ada data transfer.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border bg-white">
      {/* Header */}
      <div className="grid min-w-[1500px] grid-cols-[60px_120px_200px_220px_220px_260px_100px_140px_100px_180px_100px] bg-slate-100 text-sm font-semibold">
        <div className="border-r border-b p-3 text-center">No</div>
        <div className="border-r border-b p-3">Tanggal</div>
        <div className="border-r border-b p-3">No Transfer</div>
        <div className="border-r border-b p-3">Gudang Asal</div>
        <div className="border-r border-b p-3">Gudang Tujuan</div>
        <div className="border-r border-b p-3">Artikel</div>
        <div className="border-r border-b p-3 text-right">Qty</div>
        <div className="border-r border-b p-3 text-right">Nilai</div>
        <div className="border-r border-b p-3 text-center">User</div>
        <div className="border-r border-b p-3">Posting</div>
        <div className="border-b p-3 text-center">Aksi</div>
      </div>

      {documents.map((doc, index) => {
        const first = doc.items[0];

        return (
          <div
            key={doc.reference}
            className="grid min-w-[1500px] grid-cols-[60px_120px_200px_220px_220px_260px_100px_140px_100px_180px_100px] text-sm hover:bg-slate-50"
          >
            <div className="border-r border-b p-3 text-center">{index + 1}</div>

            <div className="border-r border-b p-3">{doc.movement_date}</div>

            <div className="border-r border-b p-3 font-medium">
              {doc.reference}
            </div>

            <div className="border-r border-b p-3">
              {doc.fromStore
                ? `${doc.fromStore.code} - ${doc.fromStore.name}`
                : "-"}
            </div>

            <div className="border-r border-b p-3">
              {doc.toStore ? `${doc.toStore.code} - ${doc.toStore.name}` : "-"}
            </div>

            <div className="border-r border-b p-3">
              {first ? `${first.code} - ${first.name}` : "-"}
            </div>

            <div className="border-r border-b p-3 text-right">
              {quantity(doc.totalQty)}
            </div>

            <div className="border-r border-b p-3 text-right">
              {money(doc.totalValue)}
            </div>

            <div className="border-r border-b p-3 text-center">
              {doc.created_by ?? "-"}
            </div>

            <div className="border-r border-b p-3 whitespace-nowrap">
              {getWIBTimestampFromUTC(doc.created_at)}
            </div>

            <div className="border-b p-3 text-center">
              <button
                type="button"
                onClick={() => onDetail(doc)}
                className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
              >
                Detail
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
