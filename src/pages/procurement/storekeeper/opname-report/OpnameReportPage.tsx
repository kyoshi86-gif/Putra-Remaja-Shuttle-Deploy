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

import type { OpnameDocument } from "./types";

import OpnameFilter from "./components/OpnameFilter";
import OpnameTable from "./components/OpnameTable";
import OpnameDetailModal from "./components/OpnameDetailModal";

import { useOpnameList } from "./hooks/useOpnameList";

import Pagination from "@/components/common/Pagination";

export default function OpnameReportPage() {
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
  } = useOpnameList();

  const [detail, setDetail] = useState<OpnameDocument | null>(null);

  // =========================================================
  // EXPORT EXCEL
  // SEMUA HASIL FILTER
  // =========================================================

  const handleExport = async () => {
    try {
      const rows = await fetchAllFilteredDocuments();

      exportReport({
        filename: `Stock_Opname_${formatReportDateRange(
          filter.dateFrom ? new Date(`${filter.dateFrom}T00:00:00`) : null,
          filter.dateTo ? new Date(`${filter.dateTo}T00:00:00`) : null,
        )}.xlsx`,

        sheetName: "Stock Opname",

        columns: [
          {
            label: "Tanggal",
            key: "tanggal",
          },
          {
            label: "No Opname",
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
            label: "Qty Sistem",
            key: "qtySystem",
          },
          {
            label: "Qty Opname",
            key: "qtyOpname",
          },
          {
            label: "Selisih",
            key: "selisih",
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

          qtySystem: doc.items.reduce((sum, item) => sum + item.qtySystem, 0),

          qtyOpname: doc.items.reduce((sum, item) => sum + item.qtyOpname, 0),

          selisih: doc.totalDifference,

          nilai: doc.totalValue,

          user: doc.created_by ?? "",

          posting: doc.created_at,
        })),
      });
    } catch (error) {
      console.error("Export Stock Opname gagal:", error);

      alert("Gagal melakukan export Stock Opname.");
    }
  };

  // =========================================================
  // PRINT
  // SEMUA HASIL FILTER
  // =========================================================

  const handlePrint = async () => {
    try {
      const rows = await fetchAllFilteredDocuments();

      const currentUser = getCustomUser();

      const printedBy = currentUser?.name || "-";

      printReport({
        title: "LAPORAN STOCK OPNAME",

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
            label: "No Opname",
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
            label: "Qty Sistem",
            key: "qtySystem",
            align: "right",
          },
          {
            label: "Qty Opname",
            key: "qtyOpname",
            align: "right",
          },
          {
            label: "Selisih",
            key: "difference",
            align: "right",
            format: (value) => formatNumber(Number(value ?? 0)),
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

          qtySystem: doc.items.reduce((sum, item) => sum + item.qtySystem, 0),

          qtyOpname: doc.items.reduce((sum, item) => sum + item.qtyOpname, 0),

          difference: doc.totalDifference,

          value: doc.totalValue,

          user: doc.created_by ?? "",
        })),

        footer: [
          {
            label: "Jumlah Dokumen",

            value: rows.length,
          },

          {
            label: "Total Selisih",

            value: formatNumber(
              rows.reduce((sum, doc) => sum + doc.totalDifference, 0),
            ),
          },

          {
            label: "Total Nilai",

            value: money(rows.reduce((sum, doc) => sum + doc.totalValue, 0)),
          },
        ],
      });
    } catch (error) {
      console.error("Print Stock Opname gagal:", error);

      alert("Gagal mencetak Stock Opname.");
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Stock Opname</h1>

        <p className="text-sm text-gray-500">
          Daftar seluruh dokumen stock opname.
        </p>
      </div>

      {/* FILTER + ACTION */}
      <div className="mb-4 pr-8 flex flex-col gap-3">
        <OpnameFilter filter={filter} stores={stores} onChange={setFilter} />

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
        <OpnameTable
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
      <OpnameDetailModal
        open={detail !== null}
        row={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
