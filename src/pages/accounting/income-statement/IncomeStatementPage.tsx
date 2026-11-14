import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCustomUser } from "@/lib/authUser";
import {
  exportReport,
  formatReportDisplayDate,
  formatReportDateRange,
} from "@/utils/exportReport";
import { printReport } from "@/utils/printReport";

type AccountCategory =
  "REVENUE" | "OTHER_INCOME" | "COGS" | "EXPENSE" | "OTHER_EXPENSE";

type Account = {
  id: string;
  code: string;
  name: string;
  category_code: AccountCategory | null;
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

type ReportRow = {
  id: string;
  code: string;
  name: string;
  amount: number;
};

const today = new Date().toISOString().slice(0, 10);
const firstDayOfMonth = `${today.slice(0, 8)}01`;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

function getNormalBalance(account: Account): "D" | "C" {
  if (account.normal_balance) {
    return account.normal_balance;
  }

  return ["COGS", "EXPENSE", "OTHER_EXPENSE"].includes(
    account.category_code ?? "",
  )
    ? "D"
    : "C";
}

export default function IncomeStatementPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [journalDetails, setJournalDetails] = useState<JournalDetail[]>([]);

  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

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
          .in("category_code", [
            "REVENUE",
            "OTHER_INCOME",
            "COGS",
            "EXPENSE",
            "OTHER_EXPENSE",
          ])
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

    const loadJournalDetails = async () => {
      if (masterLoading || !startDate || !endDate || startDate > endDate) {
        setJournalDetails([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const FETCH_SIZE = 1000;
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
            .gte("journals.tanggal", startDate)
            .lte("journals.tanggal", endDate)
            .order("id", {
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

          allDetails.push(
            ...rows.map((row) => ({
              account_id: row.account_id,
              debit: row.debit,
              credit: row.credit,
            })),
          );

          if (rows.length < FETCH_SIZE) {
            break;
          }

          offset += FETCH_SIZE;
        }

        if (!cancelled) {
          setJournalDetails(allDetails);
        }
      } catch (journalError) {
        console.error("Gagal memuat jurnal Income Statement:", journalError);

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

    void loadJournalDetails();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, selectedEntityId, masterLoading]);

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

    const grouped: Record<AccountCategory, ReportRow[]> = {
      REVENUE: [],
      OTHER_INCOME: [],
      COGS: [],
      EXPENSE: [],
      OTHER_EXPENSE: [],
    };

    accounts.forEach((account) => {
      const category = account.category_code;

      if (!category) return;

      const mutation = mutations.get(account.id) ?? {
        debit: 0,
        credit: 0,
      };

      const normalBalance = getNormalBalance(account);

      const amount =
        normalBalance === "D"
          ? mutation.debit - mutation.credit
          : mutation.credit - mutation.debit;

      if (Math.abs(amount) <= 0.01) return;

      grouped[category].push({
        id: account.id,
        code: account.code,
        name: account.name,
        amount,
      });
    });

    const total = (category: AccountCategory) =>
      grouped[category].reduce((sum, row) => sum + row.amount, 0);

    const revenue = total("REVENUE");
    const cogs = total("COGS");
    const grossProfit = revenue - cogs;

    const operatingExpense = total("EXPENSE");
    const operatingProfit = grossProfit - operatingExpense;

    const otherIncome = total("OTHER_INCOME");
    const otherExpense = total("OTHER_EXPENSE");
    const netProfit = operatingProfit + otherIncome - otherExpense;

    return {
      grouped,
      revenue,
      cogs,
      grossProfit,
      operatingExpense,
      operatingProfit,
      otherIncome,
      otherExpense,
      netProfit,
    };
  }, [accounts, journalDetails]);

  const buildReportRows = () => {
    const rows: Array<Record<string, unknown>> = [];

    const addSection = (
      title: string,
      sectionRows: ReportRow[],
      totalLabel: string,
      totalAmount: number,
    ) => {
      rows.push({
        keterangan: title,
        jumlah: "",
      });

      sectionRows.forEach((row) => {
        rows.push({
          keterangan: `${row.code} - ${row.name}`,
          jumlah: row.amount,
        });
      });

      rows.push({
        keterangan: totalLabel,
        jumlah: totalAmount,
      });
    };

    addSection(
      "PENDAPATAN",
      report.grouped.REVENUE,
      "Total Pendapatan",
      report.revenue,
    );

    addSection(
      "HARGA POKOK PENJUALAN",
      report.grouped.COGS,
      "Total Harga Pokok Penjualan",
      report.cogs,
    );

    rows.push({
      keterangan: "LABA KOTOR",
      jumlah: report.grossProfit,
    });

    addSection(
      "BEBAN OPERASIONAL",
      report.grouped.EXPENSE,
      "Total Beban Operasional",
      report.operatingExpense,
    );

    rows.push({
      keterangan: "LABA USAHA",
      jumlah: report.operatingProfit,
    });

    addSection(
      "PENDAPATAN LAIN-LAIN",
      report.grouped.OTHER_INCOME,
      "Total Pendapatan Lain-lain",
      report.otherIncome,
    );

    addSection(
      "BEBAN LAIN-LAIN",
      report.grouped.OTHER_EXPENSE,
      "Total Beban Lain-lain",
      report.otherExpense,
    );

    rows.push({
      keterangan: "LABA BERSIH PERIODE BERJALAN",
      jumlah: report.netProfit,
    });

    return rows;
  };

  const handleExportExcel = () => {
    try {
      const rows = buildReportRows();

      exportReport({
        filename: `Income_Statement_${formatReportDateRange(
          new Date(`${startDate}T00:00:00`),
          new Date(`${endDate}T00:00:00`),
        )}.xlsx`,

        sheetName: "Income Statement",

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
      console.error("Export Income Statement gagal:", error);

      alert("Gagal melakukan export Income Statement.");
    }
  };

  const handlePrint = () => {
    try {
      const rows = buildReportRows();

      const currentUser = getCustomUser();

      const printedBy = currentUser?.name || "-";

      printReport({
        title: "INCOME STATEMENT",

        period: `${formatReportDisplayDate(
          new Date(`${startDate}T00:00:00`),
        )} s/d ${formatReportDisplayDate(new Date(`${endDate}T00:00:00`))}`,

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
      console.error("Print Income Statement gagal:", error);

      alert("Gagal mencetak Income Statement.");
    }
  };

  const renderRows = (rows: ReportRow[]) =>
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
        <div className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-3">
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
              Dari Tanggal
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Sampai Tanggal
            </label>

            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mb-4 py-4">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || startDate > endDate}
            className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || startDate > endDate}
            className="bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cetak
          </button>
        </div>

        {startDate > endDate && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
            Tanggal awal tidak boleh melebihi tanggal akhir.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Keterangan</th>
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
                    Memuat Laba Rugi...
                  </td>
                </tr>
              )}

              {!loading && (
                <>
                  <tr className="border-t bg-blue-50 font-semibold">
                    <td className="px-4 py-3">Pendapatan</td>
                    <td className="px-4 py-3 text-right" />
                  </tr>
                  {renderRows(report.grouped.REVENUE)}
                  <tr className="border-t font-semibold">
                    <td className="px-4 py-3">Total Pendapatan</td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(report.revenue)}
                    </td>
                  </tr>

                  <tr className="border-t bg-blue-50 font-semibold">
                    <td className="px-4 py-3">Harga Pokok Penjualan</td>
                    <td className="px-4 py-3 text-right" />
                  </tr>
                  {renderRows(report.grouped.COGS)}
                  <tr className="border-t font-semibold">
                    <td className="px-4 py-3">Total Harga Pokok Penjualan</td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(report.cogs)}
                    </td>
                  </tr>

                  <tr className="border-t bg-gray-100 font-bold">
                    <td className="px-4 py-3">Laba Kotor</td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(report.grossProfit)}
                    </td>
                  </tr>

                  <tr className="border-t bg-blue-50 font-semibold">
                    <td className="px-4 py-3">Beban Operasional</td>
                    <td className="px-4 py-3 text-right" />
                  </tr>
                  {renderRows(report.grouped.EXPENSE)}
                  <tr className="border-t font-semibold">
                    <td className="px-4 py-3">Total Beban Operasional</td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(report.operatingExpense)}
                    </td>
                  </tr>

                  <tr className="border-t bg-gray-100 font-bold">
                    <td className="px-4 py-3">Laba Usaha</td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(report.operatingProfit)}
                    </td>
                  </tr>

                  <tr className="border-t bg-blue-50 font-semibold">
                    <td className="px-4 py-3">Pendapatan Lain-lain</td>
                    <td className="px-4 py-3 text-right" />
                  </tr>
                  {renderRows(report.grouped.OTHER_INCOME)}

                  <tr className="border-t bg-blue-50 font-semibold">
                    <td className="px-4 py-3">Beban Lain-lain</td>
                    <td className="px-4 py-3 text-right" />
                  </tr>
                  {renderRows(report.grouped.OTHER_EXPENSE)}

                  <tr className="border-t bg-green-100 text-base font-bold">
                    <td className="px-4 py-4">Laba Bersih Periode Berjalan</td>
                    <td className="px-4 py-4 text-right">
                      {formatCurrency(report.netProfit)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
