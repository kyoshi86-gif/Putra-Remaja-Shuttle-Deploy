import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCustomUser } from "@/lib/authUser";

import {
  exportReport,
  formatReportDate,
  formatReportDisplayDate,
} from "@/utils/exportReport";

import { printReport } from "@/utils/printReport";

type AccountCategory =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "OTHER_INCOME"
  | "COGS"
  | "EXPENSE"
  | "OTHER_EXPENSE";

type Account = {
  id: string;
  code: string;
  name: string;
  category_code: AccountCategory | null;
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

type Journal = {
  journal_details: JournalDetail[];
};

type BalanceSheetRow = {
  id: string;
  code: string;
  name: string;
  amount: number;
};

const today = new Date().toISOString().slice(0, 10);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

export default function BalanceSheetPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);

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
          .select("id, code, name, category_code")
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

    const loadJournals = async () => {
      setLoading(true);
      setError(null);

      try {
        /**
         * Balance Sheet membutuhkan seluruh mutasi akun sampai tanggal
         * laporan. Jadi pagination di sini digunakan sebagai BATCH SERVER-SIDE,
         * bukan pagination tampilan.
         *
         * Yang diambil langsung adalah journal_details + filter journals.
         * Ini lebih hemat payload dibanding mengambil journals dengan nested
         * journal_details.
         */
        const FETCH_SIZE = 1000;
        let offset = 0;

        type JournalDetailRow = JournalDetail & {
          journals:
            | {
                entity_id: string | null;
                tanggal: string;
              }
            | {
                entity_id: string | null;
                tanggal: string;
              }[]
            | null;
        };

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
            .order("journal_id", {
              ascending: true,
            })
            .range(offset, offset + FETCH_SIZE - 1);

          if (selectedEntityId) {
            query = query.eq("journals.entity_id", selectedEntityId);
          }

          const { data, error: journalError } = await query;

          if (journalError) {
            throw journalError;
          }

          const rows = (data ?? []) as unknown as JournalDetailRow[];

          const details = rows.map((row) => ({
            account_id: row.account_id,
            debit: row.debit,
            credit: row.credit,
          }));

          allDetails.push(...details);

          if (rows.length < FETCH_SIZE) {
            break;
          }

          offset += FETCH_SIZE;
        }

        if (!cancelled) {
          setJournals(
            allDetails.map((detail) => ({
              journal_details: [detail],
            })),
          );
        }
      } catch (journalError) {
        console.error("Gagal memuat jurnal Balance Sheet:", journalError);

        if (!cancelled) {
          setError(
            journalError instanceof Error
              ? `Gagal memuat jurnal: ${journalError.message}`
              : "Gagal memuat jurnal.",
          );

          setJournals([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadJournals();

    return () => {
      cancelled = true;
    };
  }, [asOfDate, selectedEntityId]);

  const report = useMemo(() => {
    const mutations = new Map<string, { debit: number; credit: number }>();

    journals.forEach((journal) => {
      journal.journal_details?.forEach((detail) => {
        const current = mutations.get(detail.account_id) ?? {
          debit: 0,
          credit: 0,
        };

        current.debit += Number(detail.debit ?? 0);
        current.credit += Number(detail.credit ?? 0);

        mutations.set(detail.account_id, current);
      });
    });

    const assets: BalanceSheetRow[] = [];
    const liabilities: BalanceSheetRow[] = [];
    const equities: BalanceSheetRow[] = [];

    let revenue = 0;
    let otherIncome = 0;
    let cogs = 0;
    let expenses = 0;
    let otherExpenses = 0;

    accounts.forEach((account) => {
      const mutation = mutations.get(account.id) ?? {
        debit: 0,
        credit: 0,
      };

      const debit = mutation.debit;
      const credit = mutation.credit;
      const category = account.category_code;

      if (category === "ASSET") {
        const amount = debit - credit;

        if (Math.abs(amount) > 0.01) {
          assets.push({
            id: account.id,
            code: account.code,
            name: account.name,
            amount,
          });
        }
      }

      if (category === "LIABILITY") {
        const amount = credit - debit;

        if (Math.abs(amount) > 0.01) {
          liabilities.push({
            id: account.id,
            code: account.code,
            name: account.name,
            amount,
          });
        }
      }

      if (category === "EQUITY") {
        const amount = credit - debit;

        if (Math.abs(amount) > 0.01) {
          equities.push({
            id: account.id,
            code: account.code,
            name: account.name,
            amount,
          });
        }
      }

      if (category === "REVENUE") {
        revenue += credit - debit;
      }

      if (category === "OTHER_INCOME") {
        otherIncome += credit - debit;
      }

      if (category === "COGS") {
        cogs += debit - credit;
      }

      if (category === "EXPENSE") {
        expenses += debit - credit;
      }

      if (category === "OTHER_EXPENSE") {
        otherExpenses += debit - credit;
      }
    });

    const currentProfit =
      revenue + otherIncome - cogs - expenses - otherExpenses;

    const totalAssets = assets.reduce((sum, row) => sum + row.amount, 0);
    const totalLiabilities = liabilities.reduce(
      (sum, row) => sum + row.amount,
      0,
    );
    const totalEquity = equities.reduce((sum, row) => sum + row.amount, 0);
    const totalEquityWithProfit = totalEquity + currentProfit;

    return {
      assets,
      liabilities,
      equities,
      currentProfit,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalEquityWithProfit,
      difference: Math.abs(
        totalAssets - totalLiabilities - totalEquityWithProfit,
      ),
    };
  }, [accounts, journals]);

  const buildReportRows = (): Array<Record<string, unknown>> => {
    const rows: Array<Record<string, unknown>> = [];

    rows.push({
      keterangan: "ASET",
      jumlah: "",
    });

    report.assets.forEach((row) => {
      rows.push({
        keterangan: `${row.code} - ${row.name}`,
        jumlah: row.amount,
      });
    });

    rows.push({
      keterangan: "TOTAL ASET",
      jumlah: report.totalAssets,
    });

    rows.push({
      keterangan: "KEWAJIBAN",
      jumlah: "",
    });

    report.liabilities.forEach((row) => {
      rows.push({
        keterangan: `${row.code} - ${row.name}`,
        jumlah: row.amount,
      });
    });

    rows.push({
      keterangan: "TOTAL KEWAJIBAN",
      jumlah: report.totalLiabilities,
    });

    rows.push({
      keterangan: "EKUITAS",
      jumlah: "",
    });

    report.equities.forEach((row) => {
      rows.push({
        keterangan: `${row.code} - ${row.name}`,
        jumlah: row.amount,
      });
    });

    rows.push({
      keterangan: "Laba (Rugi) Periode Berjalan",
      jumlah: report.currentProfit,
    });

    rows.push({
      keterangan: "TOTAL EKUITAS",
      jumlah: report.totalEquityWithProfit,
    });

    rows.push({
      keterangan: "TOTAL KEWAJIBAN DAN EKUITAS",
      jumlah: report.totalLiabilities + report.totalEquityWithProfit,
    });

    return rows;
  };

  const handleExportExcel = () => {
    try {
      const rows = buildReportRows();

      exportReport({
        filename: `Balance_Sheet_${formatReportDate(
          new Date(`${asOfDate}T00:00:00`),
        )}.xlsx`,

        sheetName: "Balance Sheet",

        columns: [
          {
            label: "Keterangan",
            key: "keterangan",
          },
          {
            label: "Jumlah",
            key: "jumlah",
            format: (value) =>
              value === "" || value === null || value === undefined
                ? ""
                : formatCurrency(Number(value)),
          },
        ],

        rows,
      });
    } catch (error) {
      console.error("Export Balance Sheet gagal:", error);

      alert("Gagal melakukan export Balance Sheet.");
    }
  };

  const handlePrint = () => {
    try {
      const rows = buildReportRows();

      const currentUser = getCustomUser();

      const printedBy = currentUser?.name || "-";

      printReport({
        title: "BALANCE SHEET",

        period: `Posisi per ${formatReportDisplayDate(
          new Date(`${asOfDate}T00:00:00`),
        )}`,

        orientation: "portrait",

        printedBy,

        columns: [
          {
            label: "Keterangan",
            key: "keterangan",
          },
          {
            label: "Jumlah",
            key: "jumlah",
            align: "right",
            format: (value) =>
              value === "" || value === null || value === undefined
                ? ""
                : formatCurrency(Number(value)),
          },
        ],

        rows,
      });
    } catch (error) {
      console.error("Print Balance Sheet gagal:", error);

      alert("Gagal mencetak Balance Sheet.");
    }
  };

  const renderRows = (rows: BalanceSheetRow[]) =>
    rows.map((row) => (
      <tr key={row.id} className="border-t">
        <td className="px-4 py-2 pl-10">
          {row.code} - {row.name}
        </td>
        <td className="px-4 py-2 text-right">{formatCurrency(row.amount)}</td>
      </tr>
    ));

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

        <div className="flex justify-end gap-2 mb-4 py-4">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cetak
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && report.difference > 0.01 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Neraca tidak balance. Selisih:{" "}
            <strong>{formatCurrency(report.difference)}</strong>
          </div>
        )}

        {!loading &&
          report.difference <= 0.01 &&
          (report.totalAssets !== 0 ||
            report.totalLiabilities !== 0 ||
            report.totalEquityWithProfit !== 0) && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Neraca balance.
            </div>
          )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">ASET</th>
                  <th className="px-4 py-3 text-right">Jumlah</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Memuat Neraca...
                    </td>
                  </tr>
                )}

                {!loading && renderRows(report.assets)}

                {!loading && (
                  <tr className="border-t bg-gray-100 font-bold">
                    <td className="px-4 py-3">TOTAL ASET</td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(report.totalAssets)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">KEWAJIBAN</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                  </tr>
                </thead>

                <tbody>
                  {!loading && renderRows(report.liabilities)}

                  {!loading && (
                    <tr className="border-t bg-gray-100 font-bold">
                      <td className="px-4 py-3">TOTAL KEWAJIBAN</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(report.totalLiabilities)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">EKUITAS</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                  </tr>
                </thead>

                <tbody>
                  {!loading && renderRows(report.equities)}

                  {!loading && (
                    <tr className="border-t">
                      <td className="px-4 py-2 pl-10">
                        Laba (Rugi) Periode Berjalan
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatCurrency(report.currentProfit)}
                      </td>
                    </tr>
                  )}

                  {!loading && (
                    <tr className="border-t bg-gray-100 font-bold">
                      <td className="px-4 py-3">TOTAL EKUITAS</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(report.totalEquityWithProfit)}
                      </td>
                    </tr>
                  )}

                  {!loading && (
                    <tr className="border-t bg-green-100 text-base font-bold">
                      <td className="px-4 py-4">TOTAL KEWAJIBAN DAN EKUITAS</td>
                      <td className="px-4 py-4 text-right">
                        {formatCurrency(
                          report.totalLiabilities +
                            report.totalEquityWithProfit,
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
