import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Pagination from "@/components/common/Pagination";
import {
  exportReport,
  formatReportDateRange,
  formatReportDisplayDate,
} from "@/utils/exportReport";
import { printReport } from "@/utils/printReport";
import { getCustomUser } from "@/lib/authUser";

type Account = {
  id: string;
  code: string;
  name: string;
  normal_balance: "D" | "C" | null;
};

type Entity = {
  id: string;
  kode: string;
  nama: string;
};

type JournalDetail = {
  id: string;
  debit: number | null;
  credit: number | null;
  description: string | null;
};

type Journal = {
  id: string;
  tanggal: string;
  waktu: string | null;
  reference: string | null;
  description: string | null;
  entity_id: string | null;
  journal_details: JournalDetail[];
};

type LedgerEntry = {
  id: string;
  tanggal: string;
  waktu: string | null;
  reference: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const today = new Date().toISOString().slice(0, 10);
const firstDayOfMonth = `${today.slice(0, 8)}01`;

const OPENING_FETCH_SIZE = 1000;

export default function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  const [loading, setLoading] = useState(false);
  const [masterLoading, setMasterLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openingBalance, setOpeningBalance] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    const loadMasterData = async () => {
      setMasterLoading(true);

      const [accountsResult, entitiesResult] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, code, name, normal_balance")
          .eq("is_active", true)
          .eq("is_posting", true)
          .order("code"),

        supabase.from("entities").select("id, kode, nama").order("nama"),
      ]);

      if (accountsResult.error) {
        setError(`Gagal memuat COA: ${accountsResult.error.message}`);
      } else {
        const accountRows = (accountsResult.data ?? []) as Account[];

        setAccounts(accountRows);

        if (accountRows.length > 0) {
          setSelectedAccountId(accountRows[0].id);
        }
      }

      if (entitiesResult.error) {
        setError(`Gagal memuat cabang: ${entitiesResult.error.message}`);
      } else {
        setEntities((entitiesResult.data ?? []) as Entity[]);
      }

      setMasterLoading(false);
    };

    loadMasterData();
  }, []);

  /*
   * Ambil saldo sebelum tanggal awal.
   *
   * Tidak menggunakan satu query besar karena Supabase
   * dapat membatasi hasil pada 1000 baris.
   *
   * Data diambil bertahap 1000 baris sampai selesai.
   */
  useEffect(() => {
    let cancelled = false;

    const loadOpeningBalance = async () => {
      if (!selectedAccountId || !startDate || startDate > endDate) {
        setOpeningBalance(0);
        return;
      }

      let offset = 0;
      let balance = 0;

      try {
        while (true) {
          let query = supabase
            .from("journal_details")
            .select(
              `
              debit,
              credit,
              journals!inner (
                entity_id,
                tanggal
              )
            `,
            )
            .eq("account_id", selectedAccountId)
            .lt("journals.tanggal", startDate)
            .range(offset, offset + OPENING_FETCH_SIZE - 1);

          if (selectedEntityId) {
            query = query.eq("journals.entity_id", selectedEntityId);
          }

          const { data, error: openingError } = await query;

          if (openingError) {
            throw openingError;
          }

          const rows = (data ?? []) as Array<{
            debit: number | null;
            credit: number | null;
          }>;

          for (const detail of rows) {
            balance += getBalanceChangeForAccount(
              detail.debit,
              detail.credit,
              selectedAccountId,
              accounts,
            );
          }

          if (rows.length < OPENING_FETCH_SIZE) {
            break;
          }

          offset += OPENING_FETCH_SIZE;
        }

        if (!cancelled) {
          setOpeningBalance(balance);
        }
      } catch (openingError) {
        console.error("Gagal menghitung saldo awal:", openingError);

        if (!cancelled) {
          setOpeningBalance(0);
          setError(
            openingError instanceof Error
              ? `Gagal menghitung saldo awal: ${openingError.message}`
              : "Gagal menghitung saldo awal.",
          );
        }
      }
    };

    void loadOpeningBalance();

    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, selectedEntityId, startDate, endDate, accounts]);

  /*
   * Ambil data Buku Besar yang sedang ditampilkan.
   *
   * Berbeda dengan kode lama:
   * - tanggal difilter langsung di database
   * - hanya halaman aktif yang diambil
   * - count exact digunakan untuk pagination
   */
  useEffect(() => {
    const loadLedgerData = async () => {
      if (
        masterLoading ||
        !selectedAccountId ||
        !startDate ||
        !endDate ||
        startDate > endDate
      ) {
        setJournals([]);
        setTotal(0);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from("journals")
          .select(
            `
              id,
              tanggal,
              waktu,
              reference,
              description,
              entity_id,
              journal_details!inner (
                id,
                debit,
                credit,
                description
              )
            `,
            {
              count: "exact",
            },
          )
          .eq("journal_details.account_id", selectedAccountId)
          .gte("tanggal", startDate)
          .lte("tanggal", endDate)
          .order("tanggal", {
            ascending: true,
          })
          .order("waktu", {
            ascending: true,
          });

        if (selectedEntityId) {
          query = query.eq("entity_id", selectedEntityId);
        }

        const from = (page - 1) * pageSize;

        const to = from + pageSize - 1;

        query = query.range(from, to);

        const { data, error: journalError, count } = await query;

        if (journalError) {
          throw journalError;
        }

        setJournals((data ?? []) as Journal[]);

        setTotal(count ?? 0);
      } catch (journalError) {
        console.error("Gagal memuat Buku Besar:", journalError);

        setError(
          journalError instanceof Error
            ? `Gagal memuat Buku Besar: ${journalError.message}`
            : "Gagal memuat Buku Besar.",
        );

        setJournals([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadLedgerData();
  }, [
    selectedAccountId,
    selectedEntityId,
    startDate,
    endDate,
    page,
    pageSize,
    masterLoading,
  ]);

  /*
   * Jika filter berubah, kembali ke halaman pertama.
   */
  useEffect(() => {
    setPage(1);
  }, [selectedAccountId, selectedEntityId, startDate, endDate]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / pageSize));

    if (page > maxPage) {
      setPage(maxPage);
    }

    if (total === 0 && page !== 1) {
      setPage(1);
    }
  }, [total, page, pageSize]);

  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );

  const normalBalance = selectedAccount?.normal_balance ?? "D";

  const getBalanceChange = (debit: number, credit: number) => {
    return normalBalance === "D" ? debit - credit : credit - debit;
  };

  const ledger = useMemo(() => {
    if (!selectedAccountId || startDate > endDate) {
      return {
        openingBalance: 0,
        entries: [] as LedgerEntry[],
        totalDebit: 0,
        totalCredit: 0,
      };
    }

    let runningBalance = openingBalance;

    const allEntries = journals
      .flatMap((journal) =>
        (journal.journal_details ?? []).map((detail) => ({
          id: detail.id,
          tanggal: journal.tanggal,
          waktu: journal.waktu,
          reference: journal.reference,
          description: detail.description || journal.description || "-",
          debit: Number(detail.debit ?? 0),
          credit: Number(detail.credit ?? 0),
        })),
      )
      .sort((a, b) => {
        const first = `${a.tanggal} ${a.waktu ?? "00:00:00"}`;

        const second = `${b.tanggal} ${b.waktu ?? "00:00:00"}`;

        return first.localeCompare(second);
      });

    const entries = allEntries.map((entry) => {
      runningBalance += getBalanceChange(entry.debit, entry.credit);

      return {
        ...entry,
        balance: runningBalance,
      };
    });

    return {
      openingBalance,
      entries,
      totalDebit: entries.reduce(
        (totalValue, entry) => totalValue + entry.debit,
        0,
      ),
      totalCredit: entries.reduce(
        (totalValue, entry) => totalValue + entry.credit,
        0,
      ),
    };
  }, [
    journals,
    normalBalance,
    selectedAccountId,
    startDate,
    endDate,
    openingBalance,
  ]);

  const formatBalance = (value: number) => {
    if (value === 0) {
      return "";
    }

    return formatCurrency(value);
  };

  const endingBalance =
    ledger.openingBalance +
    ledger.totalDebit * (normalBalance === "D" ? 1 : -1) +
    ledger.totalCredit * (normalBalance === "D" ? -1 : 1);

  const fetchAllFilteredLedgerEntries = async (): Promise<LedgerEntry[]> => {
    if (!selectedAccountId || !startDate || !endDate || startDate > endDate) {
      return [];
    }

    const PAGE_SIZE = 1000;
    let offset = 0;
    const allEntries: LedgerEntry[] = [];

    while (true) {
      let query = supabase
        .from("journals")
        .select(
          `
            id,
            tanggal,
            waktu,
            reference,
            description,
            entity_id,
            journal_details!inner (
              id,
              debit,
              credit,
              description
            )
          `,
        )
        .eq("journal_details.account_id", selectedAccountId)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .order("tanggal", {
          ascending: true,
        })
        .order("waktu", {
          ascending: true,
        })
        .order("id", {
          ascending: true,
        })
        .range(offset, offset + PAGE_SIZE - 1);

      if (selectedEntityId) {
        query = query.eq("entity_id", selectedEntityId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const rows = (data ?? []) as Journal[];

      for (const journal of rows) {
        for (const detail of journal.journal_details ?? []) {
          allEntries.push({
            id: detail.id,
            tanggal: journal.tanggal,
            waktu: journal.waktu,
            reference: journal.reference,
            description: detail.description || journal.description || "-",
            debit: Number(detail.debit ?? 0),
            credit: Number(detail.credit ?? 0),
            balance: 0,
          });
        }
      }

      if (rows.length < PAGE_SIZE) {
        break;
      }

      offset += PAGE_SIZE;
    }

    allEntries.sort((a, b) => {
      const first = `${a.tanggal} ${a.waktu ?? "00:00:00"}`;

      const second = `${b.tanggal} ${b.waktu ?? "00:00:00"}`;

      return first.localeCompare(second);
    });

    let runningBalance = openingBalance;

    return allEntries.map((entry) => {
      runningBalance += getBalanceChange(entry.debit, entry.credit);

      return {
        ...entry,
        balance: runningBalance,
      };
    });
  };

  const handleExportExcel = async () => {
    try {
      const rows = await fetchAllFilteredLedgerEntries();

      const accountName = selectedAccount
        ? `${selectedAccount.code} - ${selectedAccount.name}`
        : "Buku Besar";

      const exportRows = [
        {
          tanggal: "",
          reference: "",
          description: `Saldo Awal - ${accountName}`,
          debit: 0,
          credit: 0,
          balance: openingBalance,
        },
        ...rows,
        {
          tanggal: "",
          reference: "",
          description: "Saldo Akhir",
          debit: ledger.totalDebit,
          credit: ledger.totalCredit,
          balance: endingBalance,
        },
      ];

      exportReport({
        filename: `General_Ledger_${formatReportDateRange(
          new Date(`${startDate}T00:00:00`),
          new Date(`${endDate}T00:00:00`),
        )}.xlsx`,

        sheetName: "General Ledger",

        columns: [
          {
            label: "Tanggal",
            key: "tanggal",
          },
          {
            label: "Referensi",
            key: "reference",
          },
          {
            label: "Keterangan",
            key: "description",
          },
          {
            label: "Debit",
            key: "debit",
            format: (value) =>
              Number(value ?? 0) ? formatCurrency(Number(value)) : "",
          },
          {
            label: "Kredit",
            key: "credit",
            format: (value) =>
              Number(value ?? 0) ? formatCurrency(Number(value)) : "",
          },
          {
            label: "Saldo",
            key: "balance",
            format: (value) => formatBalance(Number(value ?? 0)),
          },
        ],

        rows: exportRows,
      });
    } catch (error) {
      console.error("Export General Ledger gagal:", error);

      alert("Gagal melakukan export General Ledger.");
    }
  };

  const handlePrint = async () => {
    try {
      const rows = await fetchAllFilteredLedgerEntries();

      const accountName = selectedAccount
        ? `${selectedAccount.code} - ${selectedAccount.name}`
        : "Buku Besar";

      const printRows = [
        {
          tanggal: "",
          reference: "",
          description: `Saldo Awal - ${accountName}`,
          debit: 0,
          credit: 0,
          balance: openingBalance,
        },
        ...rows,
        {
          tanggal: "",
          reference: "",
          description: "Saldo Akhir",
          debit: ledger.totalDebit,
          credit: ledger.totalCredit,
          balance: endingBalance,
        },
      ];

      const currentUser = getCustomUser();

      const printedBy = currentUser?.name || "-";

      printReport({
        title: "GENERAL LEDGER",

        period: `${formatReportDisplayDate(
          new Date(`${startDate}T00:00:00`),
        )} s/d ${formatReportDisplayDate(new Date(`${endDate}T00:00:00`))}`,

        orientation: "landscape",

        printedBy,

        columns: [
          {
            label: "Tanggal",
            key: "tanggal",
          },
          {
            label: "Referensi",
            key: "reference",
          },
          {
            label: "Keterangan",
            key: "description",
          },
          {
            label: "Debit",
            key: "debit",
            align: "right",
            format: (value) =>
              Number(value ?? 0) ? formatCurrency(Number(value)) : "",
          },
          {
            label: "Kredit",
            key: "credit",
            align: "right",
            format: (value) =>
              Number(value ?? 0) ? formatCurrency(Number(value)) : "",
          },
          {
            label: "Saldo",
            key: "balance",
            align: "right",
            format: (value) => formatBalance(Number(value ?? 0)),
          },
        ],

        rows: printRows,
      });
    } catch (error) {
      console.error("Print General Ledger gagal:", error);

      alert("Gagal mencetak General Ledger.");
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow space-y-4">
      <div className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Akun COA
          </label>

          <select
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            disabled={masterLoading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Pilih akun</option>

            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Cabang
          </label>

          <select
            value={selectedEntityId}
            onChange={(event) => setSelectedEntityId(event.target.value)}
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
            onChange={(e) => {
              setStartDate(e.target.value);
            }}
            onClick={(e) => {
              const input = e.currentTarget as HTMLInputElement & {
                showPicker?: () => void;
              };
              input.showPicker?.();
            }}
            className="cursor-pointer w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Sampai Tanggal
          </label>

          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
            }}
            onClick={(e) => {
              const input = e.currentTarget as HTMLInputElement & {
                showPicker?: () => void;
              };
              input.showPicker?.();
            }}
            className="cursor-pointer w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mb-4 py-4">
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={loading || !selectedAccountId || startDate > endDate}
          className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-2"
        >
          Export Excel
        </button>

        <button
          type="button"
          onClick={handlePrint}
          disabled={loading || !selectedAccountId || startDate > endDate}
          className="bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-2"
        >
          Cetak
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {startDate > endDate && (
        <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          Tanggal awal tidak boleh melebihi tanggal akhir.
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">Tanggal</th>

              <th className="px-4 py-3 text-left">Referensi</th>

              <th className="px-4 py-3 text-left">Keterangan</th>

              <th className="px-4 py-3 text-right">Debit</th>

              <th className="px-4 py-3 text-right">Kredit</th>

              <th className="px-4 py-3 text-right">Saldo</th>
            </tr>
          </thead>

          <tbody>
            {!loading && selectedAccount && (
              <tr className="border-t bg-blue-50 font-medium text-gray-800">
                <td className="px-4 py-3" colSpan={5}>
                  Saldo Awal — {selectedAccount.code} - {selectedAccount.name}
                </td>

                <td className="px-4 py-3 text-right">
                  {formatBalance(ledger.openingBalance)}
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Memuat Buku Besar...
                </td>
              </tr>
            )}

            {!loading && ledger.entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada mutasi pada periode ini.
                </td>
              </tr>
            )}

            {!loading &&
              ledger.entries.map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="px-4 py-3">{entry.tanggal}</td>

                  <td className="px-4 py-3">{entry.reference || "-"}</td>

                  <td className="px-4 py-3">{entry.description}</td>

                  <td className="px-4 py-3 text-right">
                    {entry.debit ? formatCurrency(entry.debit) : ""}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {entry.credit ? formatCurrency(entry.credit) : ""}
                  </td>

                  <td className="px-4 py-3 text-right font-medium">
                    {formatBalance(entry.balance)}
                  </td>
                </tr>
              ))}

            {!loading && selectedAccount && (
              <tr className="border-t bg-gray-100 font-semibold">
                <td className="px-4 py-3" colSpan={3}>
                  Saldo Akhir
                </td>

                <td className="px-4 py-3 text-right">
                  {ledger.totalDebit ? formatCurrency(ledger.totalDebit) : ""}
                </td>

                <td className="px-4 py-3 text-right">
                  {ledger.totalCredit ? formatCurrency(ledger.totalCredit) : ""}
                </td>

                <td className="px-4 py-3 text-right">
                  {formatBalance(endingBalance)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        meta={{
          page,
          pageSize,
          total,
          totalPages,
          from: total === 0 ? 0 : (page - 1) * pageSize,
          to: total === 0 ? 0 : Math.min(page * pageSize - 1, total - 1),
          hasPreviousPage: page > 1,
          hasNextPage: page < totalPages,
        }}
        onPageChange={setPage}
        onPageSizeChange={(newPageSize) => {
          setPageSize(newPageSize);
          setPage(1);
        }}
      />
    </div>
  );
}

/*
 * Helper untuk menghitung perubahan saldo
 * berdasarkan normal balance akun.
 */
function getBalanceChangeForAccount(
  debit: number | null,
  credit: number | null,
  accountId: string,
  accounts: Account[],
): number {
  const account = accounts.find((item) => item.id === accountId);

  const normalBalance = account?.normal_balance ?? "D";

  const debitValue = Number(debit ?? 0);

  const creditValue = Number(credit ?? 0);

  return normalBalance === "D"
    ? debitValue - creditValue
    : creditValue - debitValue;
}
