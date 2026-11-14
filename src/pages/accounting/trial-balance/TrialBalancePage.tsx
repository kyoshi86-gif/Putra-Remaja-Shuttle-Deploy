import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Account = {
  id: string;
  code: string;
  name: string;
  category_code: string | null;
  normal_balance: "D" | "C" | null;
};

type Entity = {
  id: string;
  kode: string;
  nama: string;
};

type JournalDetail = {
  account_id: string;
  debit: number | null;
  credit: number | null;
};

type JournalDetailRow = JournalDetail & {
  journals: {
    entity_id: string | null;
    tanggal: string;
  } | null;
};

type TrialBalanceRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  debit: number;
  credit: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const today = new Date().toISOString().slice(0, 10);

function getNormalBalance(account: Account): "D" | "C" {
  if (account.normal_balance) {
    return account.normal_balance;
  }

  return ["ASSET", "COGS", "EXPENSE"].includes(account.category_code ?? "")
    ? "D"
    : "C";
}

export default function TrialBalancePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [journalDetails, setJournalDetails] = useState<JournalDetail[]>([]);

  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [asOfDate, setAsOfDate] = useState(today);

  const [loading, setLoading] = useState(false);
  const [masterLoading, setMasterLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMasterData = async () => {
      setMasterLoading(true);

      const [accountResult, entityResult] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, code, name, category_code, normal_balance")
          .eq("is_active", true)
          .eq("is_posting", true)
          .order("code"),
        supabase.from("entities").select("id, kode, nama").order("nama"),
      ]);

      if (accountResult.error) {
        setError(`Gagal memuat COA: ${accountResult.error.message}`);
      } else {
        setAccounts((accountResult.data ?? []) as Account[]);
      }

      if (entityResult.error) {
        setError(`Gagal memuat cabang: ${entityResult.error.message}`);
      } else {
        setEntities((entityResult.data ?? []) as Entity[]);
      }

      setMasterLoading(false);
    };

    loadMasterData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadJournalData = async () => {
      if (!asOfDate || masterLoading) {
        setJournalDetails([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const batchSize = 1000;
        let offset = 0;
        const allDetails: JournalDetail[] = [];

        while (true) {
          let query = supabase
            .from("journal_details")
            .select(
              `
              account_id,
              debit,
              credit,
              journals!inner (
                entity_id,
                tanggal
              )
            `,
            )
            .lte("journals.tanggal", asOfDate)
            .order("id", { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (selectedEntityId) {
            query = query.eq("journals.entity_id", selectedEntityId);
          }

          const { data, error: journalError } = await query;

          if (journalError) {
            throw journalError;
          }

          const rows = (data ?? []) as unknown as JournalDetailRow[];

          allDetails.push(
            ...rows.map((row) => ({
              account_id: row.account_id,
              debit: row.debit,
              credit: row.credit,
            })),
          );

          if (rows.length < batchSize) {
            break;
          }

          offset += batchSize;
        }

        if (!cancelled) {
          setJournalDetails(allDetails);
        }
      } catch (journalError) {
        console.error("Gagal memuat jurnal Trial Balance:", journalError);

        if (!cancelled) {
          setJournalDetails([]);
          setError(
            journalError instanceof Error
              ? `Gagal memuat jurnal: ${journalError.message}`
              : "Gagal memuat jurnal.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadJournalData();

    return () => {
      cancelled = true;
    };
  }, [asOfDate, selectedEntityId, masterLoading]);

  const report = useMemo(() => {
    const mutations = new Map<string, { debit: number; credit: number }>();

    journalDetails.forEach((detail) => {
      const current = mutations.get(detail.account_id) ?? {
        debit: 0,
        credit: 0,
      };

      current.debit += Number(detail.debit ?? 0);
      current.credit += Number(detail.credit ?? 0);

      mutations.set(detail.account_id, current);
    });

    const rows: TrialBalanceRow[] = accounts.map((account) => {
      const mutation = mutations.get(account.id) ?? { debit: 0, credit: 0 };
      const normalBalance = getNormalBalance(account);

      const netBalance =
        normalBalance === "D"
          ? mutation.debit - mutation.credit
          : mutation.credit - mutation.debit;

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        category: account.category_code ?? "-",
        debit:
          netBalance >= 0 && normalBalance === "D"
            ? netBalance
            : netBalance < 0 && normalBalance === "C"
              ? Math.abs(netBalance)
              : 0,
        credit:
          netBalance >= 0 && normalBalance === "C"
            ? netBalance
            : netBalance < 0 && normalBalance === "D"
              ? Math.abs(netBalance)
              : 0,
      };
    });

    const visibleRows = rows.filter(
      (row) => row.debit !== 0 || row.credit !== 0,
    );

    const totalDebit = visibleRows.reduce((total, row) => total + row.debit, 0);

    const totalCredit = visibleRows.reduce(
      (total, row) => total + row.credit,
      0,
    );

    return {
      rows: visibleRows,
      totalDebit,
      totalCredit,
      difference: Math.abs(totalDebit - totalCredit),
    };
  }, [accounts, journalDetails]);

  return (
    <div className="p-4 bg-white rounded shadow max-w-[1600px] mx-auto">
      <div className="w-full space-y-4">
        <div className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cabang
            </label>

            <select
              value={selectedEntityId}
              onChange={(event) => setSelectedEntityId(event.target.value)}
              disabled={masterLoading}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Semua Cabang</option>

              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.kode} - {entity.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Posisi per Tanggal
            </label>

            <input
              type="date"
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && report.difference > 0.01 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Trial Balance tidak balance. Selisih:{" "}
            <strong>{formatCurrency(report.difference)}</strong>
          </div>
        )}

        {!loading && report.difference <= 0.01 && report.rows.length > 0 && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Trial Balance balance.
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Nama Akun</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-right">Debit</th>
                <th className="px-4 py-3 text-right">Kredit</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Memuat Trial Balance...
                  </td>
                </tr>
              )}

              {!loading && report.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada saldo akun sampai tanggal laporan.
                  </td>
                </tr>
              )}

              {!loading &&
                report.rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3">{row.code}</td>
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.category}</td>
                    <td className="px-4 py-3 text-right">
                      {row.debit ? formatCurrency(row.debit) : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.credit ? formatCurrency(row.credit) : ""}
                    </td>
                  </tr>
                ))}

              {!loading && (
                <tr className="border-t bg-gray-100 font-semibold">
                  <td colSpan={3} className="px-4 py-3">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(report.totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(report.totalCredit)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
