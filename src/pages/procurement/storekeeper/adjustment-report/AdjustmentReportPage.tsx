import { useState } from "react";

import {
  number as formatNumber,
  money,
} from "@/pages/procurement/utils/format";

import { getCustomUser } from "@/lib/authUser";

import {
  exportReport,
  formatReportDateRange,
  formatReportDisplayDate,
} from "@/utils/exportReport";

import { printReport } from "@/utils/printReport";

import type { AdjustmentDocument } from "./types";

import AdjustmentFilter from "./components/AdjustmentFilter";
import AdjustmentTable from "./components/AdjustmentTable";
import AdjustmentDetailModal from "./components/AdjustmentDetailModal";

import { useAdjustmentList } from "./hooks/useAdjustmentList";

import Pagination from "@/components/common/Pagination";

export default function AdjustmentReportPage() {
  const {
    loading,
    documents,
    stores,
    filter,
    setFilter,

    paginationMeta,
    goToPage,
    changePageSize,

    fetchAllFilteredDocuments,
  } = useAdjustmentList();

  const [detail, setDetail] = useState<AdjustmentDocument | null>(null);

  // =========================================================
  // EXPORT
  // =========================================================

  const handleExport = async () => {
    try {
      const rows = await fetchAllFilteredDocuments();

      exportReport({
        filename: `Adjustment_${formatReportDateRange(
          filter.dateFrom ? new Date(`${filter.dateFrom}T00:00:00`) : null,
          filter.dateTo ? new Date(`${filter.dateTo}T00:00:00`) : null,
        )}.xlsx`,

        sheetName: "Adjustment",

        columns: [
          {
            label: "Tanggal",
            key: "tanggal",
          },
          {
            label: "No Adjustment",
            key: "reference",
          },
          {
            label: "Gudang",
            key: "gudang",
          },
          {
            label: "Artikel",
            key: "artikel",
          },
          {
            label: "Qty Sebelum",
            key: "qtyBefore",
          },
          {
            label: "Qty Adjustment",
            key: "qtyAdjustment",
          },
          {
            label: "Qty Sesudah",
            key: "qtyAfter",
          },
          {
            label: "Nilai",
            key: "nilai",
            format: (value) => formatNumber(Number(value ?? 0)),
          },
          {
            label: "User",
            key: "user",
          },
          {
            label: "Posting",
            key: "posting",
          },
        ],

        rows: rows.map((doc) => ({
          tanggal: doc.movement_date,

          reference: doc.reference,

          gudang: doc.store ? `${doc.store.code} - ${doc.store.name}` : "",

          artikel: doc.items
            .map((item) => `${item.code} - ${item.name}`)
            .join(", "),

          qtyBefore: doc.items.reduce((sum, item) => sum + item.qtyBefore, 0),

          qtyAdjustment: doc.items.reduce(
            (sum, item) => sum + item.qtyAdjustment,
            0,
          ),

          qtyAfter: doc.items.reduce((sum, item) => sum + item.qtyAfter, 0),

          nilai: doc.totalValue,

          user: doc.created_by ?? "",

          posting: doc.created_at,
        })),
      });
    } catch (error) {
      console.error("Export Adjustment gagal:", error);

      alert("Gagal melakukan export Adjustment.");
    }
  };

  // =========================================================
  // PRINT
  // =========================================================

  const handlePrint = async () => {
    try {
      const rows = await fetchAllFilteredDocuments();

      const currentUser = getCustomUser();

      const printedBy = currentUser?.name || "-";

      printReport({
        title: "LAPORAN ADJUSTMENT BARANG",

        period:
          filter.dateFrom || filter.dateTo
            ? `${
                filter.dateFrom
                  ? formatReportDisplayDate(
                      new Date(`${filter.dateFrom}T00:00:00`),
                    )
                  : "-"
              } s/d ${
                filter.dateTo
                  ? formatReportDisplayDate(
                      new Date(`${filter.dateTo}T00:00:00`),
                    )
                  : "-"
              }`
            : "Semua Periode",

        printedBy,

        columns: [
          {
            label: "Tanggal",
            key: "tanggal",
          },
          {
            label: "No Adjustment",
            key: "reference",
          },
          {
            label: "Gudang",
            key: "store",
          },
          {
            label: "Artikel",
            key: "artikel",
          },
          {
            label: "Qty Sebelum",
            key: "qtyBefore",
            align: "right",
          },
          {
            label: "Qty Adjustment",
            key: "qtyAdjustment",
            align: "right",
          },
          {
            label: "Qty Sesudah",
            key: "qtyAfter",
            align: "right",
          },
          {
            label: "Nilai",
            key: "value",
            align: "right",
            format: (value) => formatNumber(Number(value ?? 0)),
          },
          {
            label: "User",
            key: "user",
          },
        ],

        rows: rows.map((doc) => ({
          tanggal: doc.movement_date,

          reference: doc.reference,

          store: doc.store ? `${doc.store.code} - ${doc.store.name}` : "",

          artikel: doc.items
            .map((item) => `${item.code} - ${item.name}`)
            .join(", "),

          qtyBefore: doc.items.reduce((sum, item) => sum + item.qtyBefore, 0),

          qtyAdjustment: doc.items.reduce(
            (sum, item) => sum + item.qtyAdjustment,
            0,
          ),

          qtyAfter: doc.items.reduce((sum, item) => sum + item.qtyAfter, 0),

          value: doc.totalValue,

          user: doc.created_by ?? "",
        })),

        footer: [
          {
            label: "Jumlah Dokumen",

            value: rows.length,
          },

          {
            label: "Total Qty Adjustment",

            value: formatNumber(
              rows.reduce((sum, doc) => sum + doc.totalQty, 0),
            ),
          },

          {
            label: "Total Nilai",

            value: money(rows.reduce((sum, doc) => sum + doc.totalValue, 0)),
          },
        ],
      });
    } catch (error) {
      console.error("Print Adjustment gagal:", error);

      alert("Gagal mencetak Adjustment.");
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Adjustment Barang</h1>

        <p className="text-sm text-gray-500">
          Daftar seluruh dokumen adjustment persediaan.
        </p>
      </div>

      {/* FILTER + BUTTON */}
      <div className="mb-4 pr-8 flex flex-col gap-3">
        <AdjustmentFilter
          filter={filter}
          stores={stores}
          onChange={setFilter}
        />

        <div className="flex flex-wrap items-center gap-2 pr-8">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Print
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto pr-8">
        <AdjustmentTable
          loading={loading}
          documents={documents}
          onDetail={setDetail}
        />
      </div>

      {/* PAGINATION */}
      <div className="pr-8">
        <Pagination
          meta={paginationMeta}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      </div>

      {/* DETAIL */}
      <AdjustmentDetailModal
        open={detail !== null}
        row={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
