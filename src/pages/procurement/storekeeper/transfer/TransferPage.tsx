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

import type { TransferDocument } from "./types";

import TransferFilter from "./components/TransferFilter";
import TransferTable from "./components/TransferTable";
import TransferDetailModal from "./components/TransferDetailModal";

import { useTransferList } from "./hooks/useTransferList";

import Pagination from "@/components/common/Pagination";

export default function TransferPage() {
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
  } = useTransferList();

  const [detail, setDetail] = useState<TransferDocument | null>(null);

  const handleExport = async () => {
    try {
      const rows = await fetchAllFilteredDocuments();

      exportReport({
        filename: `Transfer_${formatReportDateRange(
          filter.dateFrom ? new Date(`${filter.dateFrom}T00:00:00`) : null,
          filter.dateTo ? new Date(`${filter.dateTo}T00:00:00`) : null,
        )}.xlsx`,

        sheetName: "Transfer",

        columns: [
          {
            label: "Tanggal",
            key: "movement_date",
          },

          {
            label: "No Transfer",
            key: "reference",
          },

          {
            label: "Gudang Asal",
            key: "from_store",
          },

          {
            label: "Gudang Tujuan",
            key: "to_store",
          },

          {
            label: "Artikel",
            key: "items",
          },

          {
            label: "Qty",
            key: "totalQty",
            format: (value) => Number(value ?? 0),
          },

          {
            label: "Nilai",
            key: "totalValue",
            format: (value) => formatNumber(Number(value ?? 0)),
          },

          {
            label: "User ID",
            key: "created_by",
          },

          {
            label: "Created At",
            key: "created_at",
          },
        ],

        rows: rows.map((doc) => ({
          movement_date: doc.movement_date,

          reference: doc.reference,

          from_store: doc.fromStore
            ? `${doc.fromStore.code} - ${doc.fromStore.name}`
            : "",

          to_store: doc.toStore
            ? `${doc.toStore.code} - ${doc.toStore.name}`
            : "",

          items: doc.items
            .map((item) => `${item.code} - ${item.name}`)
            .join(", "),

          totalQty: doc.totalQty,

          totalValue: doc.totalValue,

          created_by: doc.created_by ?? "",

          created_at: doc.created_at,
        })),
      });
    } catch (error) {
      console.error("Export Transfer gagal:", error);

      alert("Gagal melakukan export Transfer.");
    }
  };

  const handlePrint = async () => {
    try {
      const rows = await fetchAllFilteredDocuments();

      const currentUser = getCustomUser();

      const printedBy = currentUser?.name || "-";

      printReport({
        title: "TRANSFER BARANG",

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
            key: "movement_date",
          },

          {
            label: "No Transfer",
            key: "reference",
          },

          {
            label: "Gudang Asal",
            key: "from_store",
          },

          {
            label: "Gudang Tujuan",
            key: "to_store",
          },

          {
            label: "Artikel",
            key: "items",
          },

          {
            label: "Qty",
            key: "totalQty",
            align: "right",
          },

          {
            label: "Nilai",
            key: "totalValue",
            align: "right",

            format: (value) => formatNumber(Number(value ?? 0)),
          },
        ],

        rows: rows.map((doc) => ({
          movement_date: doc.movement_date,

          reference: doc.reference,

          from_store: doc.fromStore
            ? `${doc.fromStore.code} - ${doc.fromStore.name}`
            : "",

          to_store: doc.toStore
            ? `${doc.toStore.code} - ${doc.toStore.name}`
            : "",

          items: doc.items
            .map((item) => `${item.code} - ${item.name}`)
            .join(", "),

          totalQty: doc.totalQty,

          totalValue: doc.totalValue,
        })),

        footer: [
          {
            label: "Jumlah Dokumen",

            value: rows.length,
          },

          {
            label: "Total Selisih",

            value: rows.reduce((sum, doc) => sum + doc.totalQty, 0),
          },

          {
            label: "Total Nilai",

            value: money(rows.reduce((sum, doc) => sum + doc.totalValue, 0)),
          },
        ],
      });
    } catch (error) {
      console.error("Print Transfer gagal:", error);

      alert("Gagal mencetak Transfer.");
    }
  };

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Transfer Barang</h1>

        <p className="text-sm text-gray-500">
          Daftar seluruh dokumen transfer.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 pr-8">
        <TransferFilter filter={filter} stores={stores} onChange={setFilter} />

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

      <div className="overflow-x-auto pr-8">
        <TransferTable
          loading={loading}
          documents={documents}
          onDetail={setDetail}
        />
      </div>

      <div className="pr-8">
        <Pagination
          meta={paginationMeta}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      </div>

      <TransferDetailModal
        open={detail !== null}
        row={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
