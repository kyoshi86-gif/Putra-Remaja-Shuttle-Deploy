import { useEffect, useMemo, useState } from "react";
import { getCustomUser } from "@/lib/authUser";
import SearchableSelect, {
  type SearchableSelectOption,
} from "@/components/common/SearchableSelect";
import MoneyInput from "@/components/common/MoneyInput";
import {
  useBiayaLangsung,
  type BiayaLine,
} from "./hooks/useBiayaLangsung";

interface Props {
  entityId?: string | null;
}

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function fmtMoney(n: number): string {
  return Number(n || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function resetLine(itemId: string): BiayaLine {
  return { item_id: itemId, qty: 1, price: 0, account_id: "" };
}

export default function BiayaLangsungPage({ entityId: propEntityId = null }: Props) {
  const currentUser = getCustomUser();
  const entityId = propEntityId ?? currentUser?.entity_id ?? null;

  const { items, accounts, settlements, loading, submitting, submit } =
    useBiayaLangsung();

  const [tanggal, setTanggal] = useState(today());
  const [description, setDescription] = useState("");
  const [settlementId, setSettlementId] = useState<string | null>(null);
  const [lines, setLines] = useState<BiayaLine[]>([
    resetLine(""),
  ]);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [lastNomor, setLastNomor] = useState<string | null>(null);

  const itemOptions: SearchableSelectOption[] = useMemo(
    () =>
      items.map((it) => ({
        value: it.id,
        label: `${it.code} — ${it.nama}`,
        searchText: `${it.code} ${it.nama}`,
      })),
    [items]
  );

  const accountOptions: SearchableSelectOption[] = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.code} — ${a.name}`,
        searchText: `${a.code} ${a.name}`,
      })),
    [accounts]
  );

  const settlementOptions: SearchableSelectOption[] = useMemo(
    () =>
      settlements.map((s) => ({
        value: s.id,
        label: s.name,
        searchText: `${s.name} ${s.code || ""} ${s.kode || ""}`,
      })),
    [settlements]
  );

  useEffect(() => {
    if (!settlementId && settlements.length > 0) {
      const cash = settlements.find(
        (s) => String(s.code || s.kode || "").toLowerCase() === "cash"
      );
      setSettlementId(cash ? cash.id : settlements[0].id);
    }
  }, [settlements, settlementId]);

  const itemMap = useMemo(() => {
    const m = new Map<string, (typeof items)[number]>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const updateLine = (idx: number, patch: Partial<BiayaLine>) => {
    if (patch.item_id) {
      const item = itemMap.get(patch.item_id);
      const acc = patch.account_id ?? item?.expense_account_id ?? "";
      setLines((prev) =>
        prev.map((l, i) => (i === idx ? { ...l, ...patch, account_id: acc } : l))
      );
      return;
    }
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );
  };

  const addLine = () => setLines((prev) => [...prev, resetLine("")]);

  const removeLine = (idx: number) => {
    if (lines.length === 1) {
      setLines([resetLine("")]);
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const total = useMemo(
    () => lines.reduce((s, l) => s + (l.qty || 0) * (l.price || 0), 0),
    [lines]
  );

  const canSubmit =
    lines.length > 0 &&
    lines.every((l) => l.item_id && l.qty > 0 && l.price > 0 && l.account_id) &&
    !!settlementId;

  const isCash = useMemo(() => {
    const s = settlements.find((x) => x.id === settlementId);
    return String(s?.code || s?.kode || "").toLowerCase() === "cash";
  }, [settlements, settlementId]);

  const handleSave = async () => {
    setMessage(null);
    if (!canSubmit) {
      setMessage({
        type: "error",
        text: "Lengkapi semua baris (barang, jumlah, harga, akun biaya) dan Metode Pembayaran.",
      });
      return;
    }
    try {
      const result = await submit(entityId, tanggal, lines, description, settlementId);
      setLastNomor(result.nomor);
      setMessage({
        type: "success",
        text: `Berhasil disimpan. Dokumen ${result.nomor} masuk ke Jurnal (total ${fmtMoney(
          result.total
        )})${isCash ? " dan Kas Harian." : "."}`,
      });
      setDescription("");
      setLines([resetLine("")]);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="p-4 max-w-2xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">Buku Biaya</h1>
        <p className="text-sm text-gray-500">
          Pilih barang &amp; harga, lalu akun biaya. Simpan → otomatis masuk
          Jurnal tanpa proses PO. Bila Cash, juga tercatat di Kas Harian.
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 px-3 py-2 rounded text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tanggal
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="h-[44px] border border-gray-300 rounded px-2 w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Keterangan (opsional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="mis. Pembelian snack"
              className="h-[44px] border border-gray-300 rounded px-2 w-full text-sm"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Metode Pembayaran
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
            <SearchableSelect
              value={settlementId}
              options={settlementOptions}
              placeholder="Pilih metode..."
              emptyMessage="Tidak ada metode aktif."
              disabled={loading}
              onChange={(v) => setSettlementId(v)}
            />
            <p className="text-xs text-gray-400 sm:pt-0">
              {isCash
                ? "Cash → tercatat di Jurnal & Kas Harian."
                : "Transfer Bank → tercatat di Jurnal."}
            </p>
          </div>
        </div>

        {/* Header kolom */}
        <div className="hidden md:grid grid-cols-[1.4fr_70px_70px_100px_1.1fr_28px] gap-2 mb-1 px-1">
          <span className="text-xs font-semibold text-gray-500">Barang</span>
          <span className="text-xs font-semibold text-gray-500">Qty</span>
          <span className="text-xs font-semibold text-gray-500">Satuan</span>
          <span className="text-xs font-semibold text-gray-500 text-right">
            Harga
          </span>
          <span className="text-xs font-semibold text-gray-500">
            Akun Biaya
          </span>
          <span />
        </div>

        {lines.map((line, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 sm:grid-cols-[1.4fr_70px_70px_100px_1.1fr_28px] gap-2 items-center mb-2"
          >
            <SearchableSelect
              value={line.item_id}
              options={itemOptions}
              placeholder="Pilih barang..."
              emptyMessage="Tidak ada barang aktif."
              disabled={loading}
              onChange={(v) => updateLine(idx, { item_id: v })}
            />
            <input
              type="number"
              min={1}
              value={line.qty || ""}
              placeholder="0"
              onChange={(e) =>
                updateLine(idx, { qty: Number(e.target.value) })
              }
              className="h-[44px] border border-gray-300 rounded px-2 text-right text-sm w-full"
            />
            <div className="text-sm text-gray-600 truncate px-1">
              {line.item_id ? itemMap.get(line.item_id)?.unit_name || "-" : ""}
            </div>
            <MoneyInput
              value={line.price}
              onCommit={(v) => updateLine(idx, { price: v })}
              placeholder="0"
              className="h-[44px] border border-gray-300 rounded px-2 w-full text-right text-sm"
            />
            <SearchableSelect
              value={line.account_id}
              options={accountOptions}
              placeholder="Pilih akun..."
              emptyMessage="Tidak ada akun biaya."
              disabled={loading}
              onChange={(v) => updateLine(idx, { account_id: v })}
            />
            <button
              type="button"
              title="Hapus baris"
              onClick={() => removeLine(idx)}
              className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded text-base font-bold"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={addLine}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Tambah Baris
          </button>
          <div className="text-right">
            <span className="text-sm text-gray-500">Total </span>
            <span className="text-lg font-bold text-gray-800">
              {fmtMoney(total)}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={submitting || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? "Menyimpan..." : "Simpan & Masuk Jurnal"}
          </button>
        </div>
      </div>

      {lastNomor && (
        <p className="mt-3 text-xs text-gray-400">
          Dokumen terakhir: {lastNomor} (sudah tercatat di Jurnal).
        </p>
      )}
    </div>
  );
}
