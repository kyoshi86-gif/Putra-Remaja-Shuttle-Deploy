import { createMappedJournal } from "./createJournal";

type CreateKasHarianJournalParams = {
  tanggal: string;
  reference: string;
  description?: string;
  entityId?: string | null;
  sourceId: string;
  userId?: string | null;
  isDebet: boolean;
  nominal: number;
};

export async function createKasHarianJournal(
  params: CreateKasHarianJournalParams,
) {
  const {
    tanggal,
    reference,
    description = "Kas Harian",
    entityId = null,
    sourceId,
    userId = null,
    isDebet,
    nominal,
  } = params;

  return createMappedJournal({
    tanggal,
    reference,
    description,
    entityId,
    sourceTable: "kas_harian",
    sourceId,
    userId,

    moduleCode: "CASH_DAILY",
    transactionCode: isDebet ? "CASH_RECEIPT" : "CASH_EXPENSE",

    rows: isDebet
      ? [
          {
            mappingKey: "CASH_ACCOUNT",
            side: "DEBIT",
            amount: nominal,
            description,
          },
          {
            mappingKey: "REVENUE_ACCOUNT",
            side: "CREDIT",
            amount: nominal,
            description,
          },
        ]
      : [
          {
            mappingKey: "EXPENSE_ACCOUNT",
            side: "DEBIT",
            amount: nominal,
            description,
          },
          {
            mappingKey: "CASH_ACCOUNT",
            side: "CREDIT",
            amount: nominal,
            description,
          },
        ],
  });
}
