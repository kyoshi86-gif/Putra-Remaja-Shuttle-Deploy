import { useEffect, useMemo, useState } from "react";
import { createPaginationMeta } from "@/lib/pagination/types";
import { usePagination } from "@/lib/pagination/usePagination";
import Pagination from "@/components/common/Pagination";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { hasAccess } from "@/lib/hasAccess";
import { useInventoryRequests } from "./hooks/useInventoryRequest";
import TransferDialog from "./components/TransferDialog";
import ApprovalDialog from "./components/ApprovalDialog";
import { printInventoryRequest } from "./utils/printInventoryRequest";
import type {
  InventoryRequest,
  InventoryRequestFormData,
  InventoryRequestLineForm,
  InventoryRequestStatus,
} from "./types";

import {
  Pencil,
  Eye,
  Check,
  Trash2,
  ArrowRightLeft,
  Printer,
} from "lucide-react";
import SearchableSelect, {
  type SearchableSelectOption,
} from "@/components/common/SearchableSelect";

interface Props {
  entityId?: string | null;
}

const statusLabels: Record<InventoryRequestStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  IN_PREPARATION: "Preparation",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const statusClass: Record<InventoryRequestStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",

  APPROVED: "bg-green-100 text-green-700",

  IN_PREPARATION: "bg-yellow-100 text-yellow-700",

  COMPLETED: "bg-emerald-100 text-emerald-700",

  REJECTED: "bg-red-100 text-red-700",

  CANCELLED: "bg-gray-900 text-white",
};

function today() {
  const now = new Date();

  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function createLine(): InventoryRequestLineForm {
  return {
    item_id: "",
    unit_id: "",
    qty_request: 1,
    qty_approved: 0,
    qty_transfer: 0,
    remarks: "",
  };
}

function createForm(entityId?: string | null): InventoryRequestFormData {
  return {
    entity_id: entityId,
    request_date: today(),
    source_store_id: "",
    destination_store_id: "",
    remarks: "",
    details: [createLine()],
  };
}

export default function InventoryRequestPage({ entityId = null }: Props) {
  const {
    requests,
    totalCount,

    stores,
    items,

    loading,
    loadingMasters,
    saving,
    error,

    fetchRequests,
    fetchAllRequestsForExport,
    fetchDetails,

    create,
    update,
    deleteRequest,

    addItem,
    updateItem,
    deleteItem,

    approve,
    completeRequest,

    storeItems,
    fetchStoreItems,
  } = useInventoryRequests(entityId);

  const [showForm, setShowForm] = useState(false);

  const [editing, setEditing] = useState<InventoryRequest | null>(null);

  const [search, setSearch] = useState("");

  const [access, setAccess] = useState({
    create: false,
     edit: false,
    delete: false,
    submit: false,
    approve: false,
    transfer: false,
    print: false,
    export: false,
  });

  const [form, setForm] = useState<InventoryRequestFormData>(() =>
    createForm(entityId),
  );

  const [showApprove, setShowApprove] = useState(false);

  const [approveHeader, setApproveHeader] = useState<InventoryRequest | null>(
    null,
  );

  const [approveDetails, setApproveDetails] = useState<
    InventoryRequestLineForm[]
  >([]);

  const [approveNote, setApproveNote] = useState("");

  const [showTransfer, setShowTransfer] = useState(false);

  const [transferHeader, setTransferHeader] = useState<InventoryRequest | null>(
    null,
  );

  const [transferDetails, setTransferDetails] = useState<
    InventoryRequestLineForm[]
  >([]);

  const [viewOnly, setViewOnly] = useState(false);

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");

  const {
    page,
    pageSize,

    setPage,
    setPageSize,
    resetPage,
  } = usePagination();

  /*
   * ACCESS
   */
  useEffect(() => {
    async function loadAccess() {
      const [
        createAccess,
        editAccess,
        deleteAccess,
        submitAccess,
        approveAccess,
        transferAccess,
        printAccess,
        exportAccess,
      ] = await Promise.all([
        hasAccess("inventory_request.create"),
        hasAccess("inventory_request.edit"),
        hasAccess("inventory_request.delete"),
        hasAccess("inventory_request.submit"),
        hasAccess("inventory_request.approve"),
        hasAccess("inventory_request.transfer"),
        hasAccess("inventory_request.print"),
        hasAccess("inventory_request.export"),
      ]);

      setAccess({
        create: createAccess,
        edit: editAccess,
        delete: deleteAccess,
        submit: submitAccess,
        approve: approveAccess,
        transfer: transferAccess,
        print: printAccess,
        export: exportAccess,
      });
    }

    loadAccess();
  }, []);

  /*
   * SERVER-SIDE FETCH
   *
   * Tidak ada filtering / slice data di browser.
   */
  useEffect(() => {
    fetchRequests({
      page,
      pageSize,
      search,
      startDate,
      endDate,
    });
  }, [fetchRequests, page, pageSize, search, startDate, endDate]);

  const destinationStores = useMemo(() => {
    return stores.filter((store) => store.id !== form.source_store_id);
  }, [stores, form.source_store_id]);

  const openCreate = () => {
    setViewOnly(false);
    setEditing(null);

    const genstore = stores.find((x) => x.code === "GENSTORE");

    if (genstore) {
      fetchStoreItems(genstore.id);
    }

    setForm({
      ...createForm(entityId),

      source_store_id: genstore?.id ?? "",

      entity_id: genstore?.entity_id ?? entityId,
    });

    setShowForm(true);
  };

  const closeForm = () => {
    setViewOnly(false);
    setEditing(null);

    setForm(createForm(entityId));

    setShowForm(false);
  };

  const addLine = () => {
    setForm((prev) => ({
      ...prev,

      details: [...prev.details, createLine()],
    }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => ({
      ...prev,

      details: prev.details.filter((_, i) => i !== index),
    }));
  };

  const updateLine = <K extends keyof InventoryRequestLineForm>(
    index: number,
    field: K,
    value: InventoryRequestLineForm[K],
  ) => {
    setForm((prev) => ({
      ...prev,

      details: prev.details.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    }));
  };

  const updateApproveQty = (index: number, qty: number) => {
    setApproveDetails((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              qty_approved: qty,
            }
          : row,
      ),
    );
  };

  const updateTransferQty = (index: number, qty: number) => {
    setTransferDetails((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              qty_transfer: qty,
            }
          : row,
      ),
    );
  };

  const availableItems = storeItems;

  const itemOptions = useMemo<SearchableSelectOption[]>(
    () =>
      availableItems.map((item) => ({
        value: item.id,
        label: item.code ? `${item.code} - ${item.name}` : item.name,
        searchText: `${item.code ?? ""} ${item.name ?? ""}`,
      })),
    [availableItems],
  );

  const handleItemChange = (index: number, itemId: string) => {
    const item = items.find((x) => x.id === itemId);

    updateLine(index, "item_id", itemId);

    updateLine(index, "unit_id", item?.unit?.id ?? "");
  };

  /*
   * SAVE
   */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.source_store_id) {
      if (!form.entity_id) {
        alert("Entity Gudang Asal tidak ditemukan.");

        return;
      }

      alert("Gudang asal wajib dipilih.");

      return;
    }

    if (!form.destination_store_id) {
      alert("Gudang tujuan wajib dipilih.");

      return;
    }

    for (const row of form.details) {
      if (!row.item_id) {
        alert("Item belum dipilih.");

        return;
      }

      if (Number(row.qty_request) <= 0) {
        alert("Qty harus lebih dari 0.");

        return;
      }
    }

    let requestId = "";
    let requestNo = "";

    if (editing) {
      const result = await update(editing.id, form);

      if (!result?.success) {
        return;
      }

      requestId = editing.id;

      requestNo = editing.request_no;

      for (const row of form.details) {
        if (row.id) {
          await updateItem(row.id, row);
        } else {
          await addItem(requestId, row);
        }
      }
    } else {
      const result = await create({
        entity_id: form.entity_id,

        request_date: today(),

        source_store_id: form.source_store_id,

        destination_store_id: form.destination_store_id,

        remarks: form.remarks,

        details: [],
      });

      if (!result?.success) {
        return;
      }

      requestId = result.request_id!;

      requestNo = result.request_no!;

      for (const row of form.details) {
        await addItem(requestId, row);
      }
    }

    alert(`Inventory Request ${requestNo} berhasil disimpan.`);

    await fetchRequests({
      page,
      pageSize,
      search,
      startDate,
      endDate,
    });

    closeForm();
  };

  /*
   * EXPORT
   *
   * Tidak memakai requests karena requests
   * hanya berisi halaman aktif.
   */
  const exportExcel = async () => {
    try {
      const rows = await fetchAllRequestsForExport({
        search,
        startDate,
        endDate,
      });

      const exportRows = rows.map((x) => ({
        Nomor: x.request_no,

        Tanggal: x.request_date,

        "Gudang Asal": x.source_store_name,

        "Gudang Tujuan": x.destination_store_name,

        Status: statusLabels[x.status],

        Catatan: x.remarks ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);

      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "Inventory Request");

      const file = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      });

      saveAs(new Blob([file]), `InventoryRequest-${today()}.xlsx`);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Gagal export Inventory Request.",
      );
    }
  };

  /*
   * APPROVAL
   */
  const handleApprove = async () => {
    for (const row of approveDetails) {
      if (row.qty_approved <= 0) {
        alert(
          `Qty Approved untuk ${row.item_name ?? "item"} harus lebih dari 0.`,
        );

        return;
      }

      if (row.qty_approved > row.qty_request) {
        alert(
          `Qty Approved untuk ${row.item_name ?? "item"} melebihi Qty Request.`,
        );

        return;
      }
    }

    if (!approveHeader) return;

    const currentUser = JSON.parse(localStorage.getItem("custom_user") || "{}");

    const userId = currentUser.id;

    if (!userId) {
      alert("User login tidak ditemukan.");

      return;
    }

    const { error } = await approve(
      approveHeader.id,
      userId,
      approveNote,

      approveDetails.map((row) => ({
        id: row.id!,
        qty_approved: Number(row.qty_approved),
      })),
    );

    if (error) {
      alert(error.message);

      return;
    }

    alert("Approval berhasil.");

    setShowApprove(false);

    await fetchRequests({
      page,
      pageSize,
      search,
      startDate,
      endDate,
    });
  };

  /*
   * TRANSFER
   */
  const handleTransfer = async () => {
    for (const row of transferDetails) {
      if (row.qty_transfer <= 0) {
        alert(
          `Qty Transfer untuk ${row.item_name ?? "item"} harus lebih dari 0.`,
        );

        return;
      }

      if (row.qty_transfer > row.qty_approved) {
        alert(
          `Qty Transfer untuk ${
            row.item_name ?? "item"
          } melebihi Qty Approved.`,
        );

        return;
      }
    }

    if (!transferHeader) return;

    const currentUser = JSON.parse(localStorage.getItem("custom_user") || "{}");

    const userId = currentUser.id;

    if (!userId) {
      alert("User login tidak ditemukan.");

      return;
    }

    try {
      await completeRequest(
        transferHeader.id,
        userId,

        transferDetails.map((row) => ({
          id: row.id!,
          qty_transfer: Number(row.qty_transfer),
        })),
      );

      alert("Transfer berhasil.");

      setShowTransfer(false);

      setTransferHeader(null);

      setTransferDetails([]);

      await fetchRequests({
        page,
        pageSize,
        search,
        startDate,
        endDate,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  };

  return (
    <div className="w-full pr-2 space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold">Inventory Request</h1>

          <p className="text-sm text-gray-500">
            Permintaan perpindahan stok antar gudang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);

              resetPage();
            }}
            onClick={(e) => {
              const input = e.currentTarget as HTMLInputElement & {
                showPicker?: () => void;
              };

              input.showPicker?.();
            }}
            className="cursor-pointer rounded border px-3 py-2"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);

              resetPage();
            }}
            onClick={(e) => {
              const input = e.currentTarget as HTMLInputElement & {
                showPicker?: () => void;
              };

              input.showPicker?.();
            }}
            className="cursor-pointer rounded border px-3 py-2"
          />

          <input
            className="w-72 rounded-md border px-3 py-2"
            placeholder="Cari Request..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);

              resetPage();
            }}
          />

          <button
            type="button"
            onClick={() =>
              fetchRequests({
                page,
                pageSize,
                search,
                startDate,
                endDate,
              })
            }
            className="rounded border px-4 py-2"
          >
            Refresh
          </button>

          {access.export && (
            <button
              type="button"
              onClick={exportExcel}
              className="rounded-md border border-green-300 bg-green-50 px-4 py-2"
            >
              Export
            </button>
          )}

          {access.create && (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-blue-600 px-4 py-2 text-white"
            >
              + Store Request
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3">
          {error}
        </div>
      )}

      {loadingMasters && (
        <div className="rounded border border-blue-300 bg-blue-50 p-3">
          Loading Master...
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSave}
          className="space-y-5 rounded-lg border bg-white p-5 shadow"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block">Tanggal</label>

              <input
                type="date"
                value={form.request_date}
                readOnly
                className="w-full rounded border bg-gray-100 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block">Gudang Asal</label>

              <select
                disabled
                value={form.source_store_id}
                onChange={(e) => {
                  const selectedStore = stores.find(
                    (x) => x.id === e.target.value,
                  );

                  setForm({
                    ...form,

                    source_store_id: e.target.value,

                    entity_id: selectedStore?.entity_id ?? null,

                    destination_store_id: "",
                  });
                }}
                className="w-full rounded border px-3 py-2"
              >
                <option value="">Pilih Gudang</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} - {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block">Gudang Tujuan</label>

              <select
                disabled={viewOnly}
                value={form.destination_store_id}
                onChange={(e) =>
                  setForm({
                    ...form,

                    destination_store_id: e.target.value,
                  })
                }
                className="w-full rounded border px-3 py-2"
              >
                <option value="">Pilih Gudang</option>

                {destinationStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} - {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="mb-1 block">Catatan</label>

              <textarea
                disabled={viewOnly}
                rows={2}
                value={form.remarks}
                onChange={(e) =>
                  setForm({
                    ...form,

                    remarks: e.target.value,
                  })
                }
                className="w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left">Item</th>

                  <th className="px-3 py-3 text-center">Satuan</th>

                  <th className="px-3 py-3 text-right">Qty Request</th>

                  <th className="px-3 py-3 text-right">Qty Approved</th>

                  <th className="px-3 py-3 text-right">Qty Transfer</th>

                  <th className="px-3 py-3 text-left">Catatan</th>

                  <th className="px-3 py-3 text-center">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {form.details.map((row, index) => {
                  const item = items.find((x) => x.id === row.item_id);

                  const unitCode = row.unit_code ?? item?.unit?.code ?? "-";

                  const itemLabel =
                    row.item_code && row.item_name
                      ? `${row.item_code} - ${row.item_name}`
                      : item
                        ? `${item.code} - ${item.name}`
                        : "(Item tidak ditemukan)";

                  return (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        {viewOnly ? (
                          <div className="rounded border bg-gray-100 px-3 py-2">
                            {itemLabel}
                          </div>
                        ) : (
                          <SearchableSelect
                            value={row.item_id}

                            options={itemOptions}

                            placeholder="
                                                                Cari atau pilih artikel...
                                                            "

                            disabled={viewOnly || !form.source_store_id}

                            emptyMessage="
                                                                Artikel tidak ditemukan.
                                                            "

                            onChange={(itemId) =>
                              handleItemChange(index, itemId)
                            }
                          />
                        )}
                      </td>

                      <td className="px-3 py-2">{unitCode}</td>

                      <td className="px-3 py-2">
                        <input
                          disabled={viewOnly}
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={row.qty_request}
                          onChange={(e) =>
                            updateLine(
                              index,
                              "qty_request",
                              Number(e.target.value),
                            )
                          }
                          className="w-28 rounded border px-2 py-2 text-right"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          disabled={viewOnly}
                          type="number"
                          value={row.qty_approved}
                          readOnly
                          className="w-28 rounded border bg-gray-100 px-2 py-2 text-right"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          disabled={viewOnly}
                          type="number"
                          value={row.qty_transfer ?? row.qty_approved}
                          readOnly
                          className="w-28 rounded border bg-gray-100 px-2 py-2 text-right"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          disabled={viewOnly}
                          type="text"
                          value={row.remarks}
                          onChange={(e) =>
                            updateLine(index, "remarks", e.target.value)
                          }
                          className="w-64 rounded border px-2 py-2"
                        />
                      </td>

                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          disabled={viewOnly || form.details.length === 1}
                          onClick={async () => {
                            if (row.id) {
                              await deleteItem(row.id);
                            }

                            removeLine(index);
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={addLine}
              disabled={viewOnly}
              className={`rounded border border-blue-300 px-4 py-2 ${
                viewOnly
                  ? "cursor-not-allowed bg-gray-100 text-gray-400"
                  : "bg-blue-50"
              }`}
            >
              + Tambah Item
            </button>

            <div className="space-x-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded border px-4 py-2"
              >
                Batal
              </button>

              {!viewOnly && (
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-blue-600 px-5 py-2 text-white"
                >
                  {saving
                    ? "Menyimpan..."
                    : editing
                      ? "Update Draft"
                      : "Simpan Draft"}
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold">Daftar Inventory Request</h2>
        </div>

        <div className="overflow-x-auto px-2">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3">Nomor</th>

                <th className="px-4 py-3">Tanggal</th>

                <th className="px-4 py-3">Gudang Asal</th>

                <th className="px-4 py-3">Gudang Tujuan</th>

                <th className="px-4 py-3">Status</th>

                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    Memuat...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {request.request_no}
                    </td>

                    <td className="px-4 py-3">{request.request_date}</td>

                    <td className="px-4 py-3">
                      <div>{request.source_store_name}</div>

                      <div className="text-xs text-gray-500">
                        {request.source_store_code}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div>{request.destination_store_name}</div>

                      <div className="text-xs text-gray-500">
                        {request.destination_store_code}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          statusClass[request.status]
                        }`}
                      >
                        {statusLabels[request.status]}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        title={request.status === "DRAFT" ? "Edit" : "Detail"}
                        className="mr-3 text-blue-600 hover:underline"
                        onClick={async () => {
                          const detail = await fetchDetails(request.id);

                          if (!detail) return;

                          setViewOnly(request.status !== "DRAFT");

                          setEditing(request);

                          setForm((prev) => ({
                            ...prev,

                            entity_id: request.entity_id,

                            request_date: request.request_date,

                            source_store_id: request.source_store_id,

                            destination_store_id: request.destination_store_id,

                            remarks: request.remarks ?? "",

                            details: detail,
                          }));

                          if (
                            request.source_store_id &&
                            request.status === "DRAFT"
                          ) {
                            await fetchStoreItems(request.source_store_id);
                          }

                          setShowForm(true);

                          window.scrollTo({
                            top: 0,
                            behavior: "smooth",
                          });
                        }}
                      >
                        {access.edit && request.status === "DRAFT" ? (
                          <Pencil size={17} strokeWidth={2} />
                        ) : (
                          <Eye size={17} strokeWidth={2} />
                        )}
                      </button>

                      {access.delete && request.status === "DRAFT" && access.approve && (
                        <>
                          <button
                            type="button"
                            title="Approve"
                            className="mr-3 text-blue-600"
                            disabled={saving}
                            onClick={async () => {
                              const detail = await fetchDetails(request.id);

                              if (!detail) return;

                              setApproveHeader(request);

                              setApproveDetails(
                                detail.map((x) => ({
                                  ...x,

                                  qty_approved:
                                    x.qty_approved > 0
                                      ? x.qty_approved
                                      : x.qty_request,
                                })),
                              );

                              setApproveNote("");

                              setShowApprove(true);
                            }}
                          >
                            <Check size={16} />
                          </button>

                          <button
                            type="button"
                            title="Hapus Draft"
                            className="mr-3 text-red-600"
                            disabled={saving}
                            onClick={async () => {
                              if (!window.confirm("Hapus Draft ?")) return;

                              const { error } = await deleteRequest(request.id);

                              if (error) {
                                window.alert(error.message);

                                return;
                              }

                              window.alert("Draft berhasil dihapus.");

                              await fetchRequests({
                                page,
                                pageSize,
                                search,
                                startDate,
                                endDate,
                              });
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}

                      {request.status === "APPROVED" && access.transfer && (
                        <button
                          type="button"
                          title="Transfer"
                          disabled={saving}
                          className="mr-3 text-orange-600"
                          onClick={async () => {
                            const detail = await fetchDetails(request.id);

                            if (!detail) return;

                            setTransferHeader(request);

                            setTransferDetails(
                              detail.map((x) => ({
                                ...x,

                                qty_transfer:
                                  x.qty_transfer > 0
                                    ? x.qty_transfer
                                    : x.qty_approved,
                              })),
                            );

                            setShowTransfer(true);
                          }}
                        >
                          <ArrowRightLeft size={16} />
                        </button>
                      )}

                      {access.print && (
                        <button
                          type="button"
                          title="Print"
                          className="text-gray-700"
                          onClick={async () => {
                            const detail = await fetchDetails(request.id);

                            if (!detail) return;

                            printInventoryRequest(request, detail);
                          }}
                        >
                          <Printer size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pr-8">
        <Pagination
          meta={createPaginationMeta(page, pageSize, totalCount)}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <ApprovalDialog
        open={showApprove}
        request={approveHeader}
        details={approveDetails}
        items={items}
        note={approveNote}
        onNoteChange={setApproveNote}
        onQtyChange={updateApproveQty}
        onClose={() => setShowApprove(false)}
        onApprove={handleApprove}
        saving={saving}
      />

      <TransferDialog
        open={showTransfer}
        request={transferHeader}
        details={transferDetails}
        items={items}
        onQtyChange={updateTransferQty}
        onClose={() => setShowTransfer(false)}
        onTransfer={handleTransfer}
        saving={saving}
      />
    </div>
  );
}
