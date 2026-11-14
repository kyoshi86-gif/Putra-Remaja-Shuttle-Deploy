import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getWIBTimestampFromUTC } from "@/utils/time";
import { useStorekeeper } from "./hooks/useStorekeeper";
import { useInventoryTransaction } from "./hooks/useInventoryTransaction";
import { getMovementLabel } from "../utils/movement";
import { money, quantity } from "../utils/format";
import { inputDate } from "../utils/date";
import InventoryTransactionModal from "./components/InventoryTransactionModal";
import MovementDetailModal from "./components/MovementDetailModal";
import { createPaginationMeta } from "@/lib/pagination/types";
import Pagination from "@/components/common/Pagination";

export default function StorekeeperPage(): JSX.Element {
  const [tab, setTab] = useState<"SUMMARY" | "CARD">("SUMMARY");

  const [summaryPage, setSummaryPage] = useState(1);

  const [cardPage, setCardPage] = useState(1);

  const [pageSize, setPageSize] = useState(25);

  const [detailRow, setDetailRow] = useState<
    ReturnType<typeof useStorekeeper>["groupedMovements"][number] | null
  >(null);

  const {
    stocks,
    stores,
    filteredStocks,
    filteredMovements,
    loading,
    error,
    access,
    storeId,
    setStoreId,
    itemId,
    setItemId,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    totalValue,
    loadData,
    setError,
    accounts,
  } = useStorekeeper();

  const currentUser = JSON.parse(
    localStorage.getItem("custom_user") || "{}",
  ) as {
    entity_id?: string;
  };

  const entityId = currentUser.entity_id ?? null;

  const summaryFrom = (summaryPage - 1) * pageSize;

  const summaryTo = summaryFrom + pageSize;

  const paginatedStocks = filteredStocks.slice(summaryFrom, summaryTo);

  const cardFrom = (cardPage - 1) * pageSize;

  const cardTo = cardFrom + pageSize;

  const paginatedMovements = filteredMovements.slice(cardFrom, cardTo);

  const summaryMeta = createPaginationMeta(
    summaryPage,
    pageSize,
    filteredStocks.length,
  );

  const cardMeta = createPaginationMeta(
    cardPage,
    pageSize,
    filteredMovements.length,
  );

  useEffect(() => {
    setSummaryPage(1);
    setCardPage(1);
  }, [storeId, itemId, search, dateFrom, dateTo]);

  const transaction = useInventoryTransaction({
    stocks,
    loadData,
    setError,
    entityId,
  });

  const exportExcel = useCallback(() => {
    const rows =
      tab === "SUMMARY"
        ? filteredStocks.map((row) => ({
            Store: `${row.store_code} - ${row.store_name}`,
            Kategori: row.category_name ?? "-",
            Subkategori: row.subcategory_name ?? "-",
            Kode: row.item_code,
            Artikel: row.item_name,
            Satuan: row.unit_code,
            Qty: Number(row.quantity_on_hand),
            "Harga Average": Number(row.average_cost),
            "Nilai Persediaan": Number(row.stock_value),
          }))
        : filteredMovements.map((row) => ({
            Tanggal: row.movement_date,
            Store: row.store ? `${row.store.code} - ${row.store.name}` : "-",
            Kode: row.items[0]?.code ?? "-",
            Artikel:
              row.items.length > 1
                ? `${row.items[0]?.name} (+${row.items.length - 1} artikel)`
                : (row.items[0]?.name ?? "-"),
            Tipe: getMovementLabel(row.movement_type),
            Masuk: Number(row.quantity_in),
            Keluar: Number(row.quantity_out),
            "Saldo Setelah": Number(row.quantity_after),
            Satuan: row.items[0]?.unit_code ?? "-",
            "Harga Average Setelah": Number(row.average_cost_after),
            Referensi: row.reference ?? "-",
            Keterangan: row.description ?? "-",
          }));

    const workbook = XLSX.utils.book_new();
    const sheetName = tab === "SUMMARY" ? "Stok" : "Riwayat Stok";

    const worksheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const data = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `Storekeeper-${inputDate(new Date())}.xlsx`);
  }, [tab, filteredStocks, filteredMovements]);

  /**
   * Export form Stock Opname.
   *
   * Wajib memilih satu store terlebih dahulu.
   * Export sengaja mengambil seluruh stok store tersebut,
   * bukan hanya halaman pagination yang sedang tampil.
   *
   * Kolom Qty Fisik dan Selisih dibiarkan kosong agar
   * file dapat langsung dipakai saat opname fisik.
   */
  const exportStockOpname = useCallback(() => {
    if (!storeId) {
      window.alert(
        "Pilih Store terlebih dahulu untuk membuat Form Stock Opname.",
      );
      return;
    }

    const selectedStore = stores.find((store) => store.id === storeId);

    if (!selectedStore) {
      window.alert("Store yang dipilih tidak ditemukan.");
      return;
    }

    const opnameRows = stocks
      .filter((row) => row.store_id === storeId)
      .sort((a, b) =>
        String(a.item_code).localeCompare(String(b.item_code), undefined, {
          numeric: true,
        }),
      )
      .map((row, index) => ({
        No: index + 1,
        Store: `${selectedStore.code} - ${selectedStore.name}`,
        Kode: row.item_code,
        Artikel: row.item_name,
        Kategori: row.category_name ?? "-",
        "Sub Kategori": row.subcategory_name ?? "-",
        Satuan: row.unit_code ?? "-",
        "Qty Sistem": Number(row.quantity_on_hand ?? 0),
        "Harga Average": Number(row.average_cost ?? 0),
        "Nilai Sistem": Number(row.stock_value ?? 0),
        "Qty Fisik": "",
        Selisih: "",
        "Nilai Selisih": "",
        Keterangan: "",
      }));

    if (opnameRows.length === 0) {
      window.alert("Tidak ada data stok untuk Store yang dipilih.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    const worksheet = XLSX.utils.json_to_sheet(opnameRows);

    const widths = [6, 22, 14, 30, 18, 20, 10, 14, 16, 16, 14, 12, 16, 30];

    worksheet["!cols"] = widths.map((wch) => ({
      wch,
    }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Opname");

    const data = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(
      blob,
      `Stock-Opname-${selectedStore.code}-${inputDate(new Date())}.xlsx`,
    );
  }, [storeId, stores, stocks]);

  const printSummary = useCallback(() => {
    const rows = filteredStocks
      .map(
        (row, index) =>
          `<tr>
            <td>${index + 1}</td>
            <td>${row.store_code} - ${row.store_name}</td>
            <td>${row.item_code}</td>
            <td>${row.item_name}</td>
            <td>${row.unit_code}</td>
            <td class="right">${quantity(row.quantity_on_hand)}</td>
            <td class="right">${money(row.average_cost)}</td>
            <td class="right">${money(row.stock_value)}</td>
          </tr>`,
      )
      .join("");

    const html = `<!doctype html>
      <html>
        <head>
          <title>Laporan Stok</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: Arial, sans-serif; font-size: 10px; color: #111827; }
            h1 { margin: 0; font-size: 20px; }
            .muted { color: #4b5563; margin: 5px 0 14px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #374151; padding: 6px; }
            th { background: #e5e7eb; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>LAPORAN PERSEDIAAN</h1>
          <div class="muted">Per ${dateFrom} s.d. ${dateTo} | Nilai persediaan: ${money(
            totalValue,
          )}</div>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Store</th>
                <th>Kode</th>
                <th>Artikel</th>
                <th>Satuan</th>
                <th>Qty</th>
                <th>Harga Average</th>
                <th>Nilai</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="8">Tidak ada data.</td></tr>'}
            </tbody>
          </table>
          <script>
            window.onload = () => window.print();
            window.onafterprint = () => window.close();
          </script>
        </body>
      </html>`;

    const popup = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=1000,height=800",
    );
    if (!popup) {
      window.alert("Popup print diblokir browser.");
      return;
    }

    popup.document.write(html);
    popup.document.close();
  }, [filteredStocks, dateFrom, dateTo, totalValue]);

  const handleTransfer = () => transaction.openTransaction("TRANSFER");
  const handleOpname = () => transaction.openTransaction("OPNAME");
  const handleAdjustment = () => transaction.openTransaction("ADJUSTMENT");

  return (
    <div className="w-full pr-2 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Storekeeper</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitoring stok fisik dan kartu mutasi. Saldo hanya berubah melalui
            transaksi yang diposting.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTransfer}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white"
          >
            Transfer Stok
          </button>

          <button
            type="button"
            onClick={handleOpname}
            className="rounded-md border border-amber-500 px-3 py-2 text-sm font-medium text-amber-700"
          >
            Stock Opname
          </button>

          <button
            type="button"
            onClick={handleAdjustment}
            className="rounded-md border border-indigo-500 px-3 py-2 text-sm font-medium text-indigo-700"
          >
            Adjustment
          </button>

          <button
            type="button"
            onClick={exportExcel}
            disabled={!storeId}
            className="rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={exportStockOpname}
            disabled={!storeId}
            className="rounded-md border border-amber-600 px-3 py-2 text-sm font-medium text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export Form Opname
          </button>

          {access?.print && (
            <button
              type="button"
              onClick={printSummary}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
            >
              Cetak Stok A4
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Semua Store / Gudang</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.code} - {store.name}
              </option>
            ))}
          </select>

          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Semua Artikel</option>

            {stocks.map((row) => (
              <option
                key={`${row.store_id}-${row.item_id}`}
                value={row.item_id}
              >
                {row.item_code} - {row.item_name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            onClick={(e) => {
              const input = e.currentTarget as HTMLInputElement & {
                showPicker?: () => void;
              };

              input.showPicker?.();
            }}
            className="cursor-pointer rounded-md border px-3 py-2"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            onClick={(e) => {
              const input = e.currentTarget as HTMLInputElement & {
                showPicker?: () => void;
              };

              input.showPicker?.();
            }}
            className="cursor-pointer rounded-md border px-3 py-2"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari artikel, store, referensi..."
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => {
            setTab("SUMMARY");
            setSummaryPage(1);
          }}
          className={
            tab === "SUMMARY"
              ? "border-b-2 border-blue-600 px-4 py-2 text-sm font-medium text-blue-700"
              : "px-4 py-2 text-sm text-gray-600"
          }
        >
          Ringkasan Stok
        </button>

        <button
          type="button"
          onClick={() => {
            setTab("CARD");
            setCardPage(1);
          }}
          className={
            tab === "CARD"
              ? "border-b-2 border-blue-600 px-4 py-2 text-sm font-medium text-blue-700"
              : "px-4 py-2 text-sm text-gray-600"
          }
        >
          Riwayat Stok
        </button>
      </div>

      {/* Content */}
      {tab === "SUMMARY" ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Persediaan per Store</h2>
            <span className="text-sm font-medium text-gray-700">
              Total: {money(totalValue)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left">Store</th>
                  <th className="px-3 py-3">Kategori / Sub Kategori</th>
                  <th className="px-3 py-3 text-left">Artikel</th>
                  <th className="px-3 py-3">Satuan</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Harga Average</th>
                  <th className="px-3 py-3 text-right">Nilai</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Memuat stok...
                    </td>
                  </tr>
                ) : filteredStocks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Belum ada saldo stok.
                    </td>
                  </tr>
                ) : (
                  paginatedStocks.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3 text-left font-medium">
                        {row.store_name}
                      </td>

                      <td className="px-3 py-3">
                        {row.category_name}
                        {row.subcategory_name
                          ? ` / ${row.subcategory_name}`
                          : ""}
                      </td>

                      <td className="px-3 py-3 text-left">
                        <div>
                          {row.item_code} - {row.item_name}
                        </div>
                      </td>

                      <td className="px-3 py-3">{row.unit_code}</td>

                      <td className="px-3 py-3 text-right">
                        {quantity(row.quantity_on_hand)}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {money(row.average_cost)}
                      </td>

                      <td className="px-3 py-3 text-right font-medium">
                        {money(row.stock_value)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-white px-4 py-3">
            <Pagination
              meta={summaryMeta}
              onPageChange={setSummaryPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setSummaryPage(1);
                setCardPage(1);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Kartu Mutasi Stok</h2>
            <p className="mt-1 text-sm text-gray-500">
              Periode default bulan berjalan. Pilih artikel untuk kartu per
              item.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left">Tanggal</th>
                  <th className="px-3 py-3">Mutasi</th>
                  <th className="px-3 py-3">Artikel</th>
                  <th className="px-3 py-3 text-right">Masuk</th>
                  <th className="px-3 py-3 text-right">Keluar</th>
                  <th className="px-3 py-3 text-right">Saldo</th>
                  <th className="px-3 py-3">Satuan</th>
                  <th className="px-3 py-3 text-right">Avg Cost</th>
                  <th className="px-3 py-3">Referensi</th>
                  <th className="px-3 py-3 text-center">Detail</th>
                  <th className="px-3 py-3 text-center">User ID</th>
                  <th className="px-3 py-3 text-center">Posting</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Memuat mutasi...
                    </td>
                  </tr>
                ) : filteredMovements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Tidak ada mutasi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3">{row.movement_date}</td>

                      <td className="px-3 py-3">
                        {getMovementLabel(row.movement_type)}
                      </td>

                      <td className="px-3 py-2">
                        <div>
                          <div className="font-medium">
                            {row.items[0]?.code}
                            {" - "}
                            {row.items[0]?.name}
                          </div>

                          {row.items.length > 1 && (
                            <div className="text-xs text-gray-500">
                              (+{row.items.length - 1}
                              artikel lainnya)
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right text-green-700">
                        {quantity(row.quantity_in)}
                      </td>

                      <td className="px-3 py-3 text-right text-red-700">
                        {quantity(row.quantity_out)}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {quantity(row.quantity_after)}
                      </td>

                      <td className="px-3 py-2 text-center">
                        {row.items[0]?.unit_code ?? "-"}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {money(row.average_cost_after)}
                      </td>

                      <td className="px-3 py-3">
                        {row.reference ?? "-"}
                        <div className="text-gray-500">
                          {row.description ?? ""}
                        </div>
                      </td>

                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="rounded border border-blue-500 px-2 py-1 text-blue-600 hover:bg-blue-50"
                        >
                          👁 Detail
                        </button>
                      </td>

                      <td className="px-3 py-2 text-center">
                        {row.created_by ?? "-"}
                      </td>

                      <td className="px-3 py-2 text-center">
                        {getWIBTimestampFromUTC(row.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-white px-4 py-3">
            <Pagination
              meta={cardMeta}
              onPageChange={setCardPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setSummaryPage(1);
                setCardPage(1);
              }}
            />
          </div>
        </div>
      )}

      <MovementDetailModal
        open={detailRow !== null}
        row={detailRow}
        onClose={() => setDetailRow(null)}
      />

      <InventoryTransactionModal
        open={transaction.isOpen}
        stores={stores}
        accounts={accounts}
        stocks={stocks}
        transaction={transaction}
        onClose={transaction.resetForm}
      />
    </div>
  );
}
