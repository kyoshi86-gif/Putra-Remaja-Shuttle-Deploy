import { getWIBTimestampFromUTC } from "@/utils/time";
import { money, quantity } from "../../../utils/format";
import type { OpnameDocument } from "../types";

interface Props {
  loading: boolean;
  documents: OpnameDocument[];
  onDetail: (row: OpnameDocument) => void;
}

export default function OpnameTable({ loading, documents, onDetail }: Props) {
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
        Belum ada data stock opname.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border bg-white">
      {/* Header */}
      <div className="grid min-w-[1650px] grid-cols-[60px_120px_220px_220px_260px_110px_110px_110px_150px_100px_180px_100px] bg-slate-100 text-sm font-semibold">
        <div className="border-r border-b p-3 text-center">No</div>

        <div className="border-r border-b p-3">Tanggal</div>

        <div className="border-r border-b p-3">No Opname</div>

        <div className="border-r border-b p-3">Gudang</div>

        <div className="border-r border-b p-3">Artikel</div>

        <div className="border-r border-b p-3 text-right">Qty Sistem</div>

        <div className="border-r border-b p-3 text-right">Qty Opname</div>

        <div className="border-r border-b p-3 text-right">Selisih</div>

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
            className="grid min-w-[1650px] grid-cols-[60px_120px_220px_220px_260px_110px_110px_110px_150px_100px_180px_100px] text-sm hover:bg-slate-50"
          >
            <div className="border-r border-b p-3 text-center">{index + 1}</div>

            <div className="border-r border-b p-3">{doc.movement_date}</div>

            <div className="border-r border-b p-3 font-medium">
              {doc.reference}
            </div>

            <div className="border-r border-b p-3">
              {doc.store ? `${doc.store.code} - ${doc.store.name}` : "-"}
            </div>

            <div className="border-r border-b p-3">
              {first ? `${first.code} - ${first.name}` : "-"}
            </div>

            <div className="border-r border-b p-3 text-right">
              {first ? quantity(first.qtySystem) : "-"}
            </div>

            <div className="border-r border-b p-3 text-right">
              {first ? quantity(first.qtyOpname) : "-"}
            </div>

            <div
              className={`border-r border-b p-3 text-right font-semibold ${
                doc.totalDifference < 0
                  ? "text-red-600"
                  : doc.totalDifference > 0
                    ? "text-green-600"
                    : ""
              }`}
            >
              {quantity(doc.totalDifference)}
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
