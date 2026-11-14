import { supabase } from "@/lib/supabaseClient";
import { resolveAccountMapping } from "./resolveAccountMapping";

export type JournalRow = {
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
};

export type CreateJournalPayload = {
  tanggal: string;
  reference?: string;
  description?: string;
  entity_id?: string | null;
  source_table?: string | null;
  source_id?: string | null;
  user_id?: string | null;
  rows: JournalRow[];
};

export type MappedJournalRow = {
  mappingKey: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
  description?: string;
};

export type CreateMappedJournalPayload = {
  tanggal: string;
  reference?: string;
  description?: string;
  entityId?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  userId?: string | null;

  moduleCode: string;
  transactionCode: string;
  rows: MappedJournalRow[];
};

function validateJournalRows(rows: JournalRow[]) {
  if (!rows || rows.length < 2) {
    throw new Error("Minimal harus ada 2 baris jurnal.");
  }

  for (const [index, row] of rows.entries()) {
    const debit = Number(row.debit || 0);
    const credit = Number(row.credit || 0);

    if (!row.account_id) {
      throw new Error(`Baris jurnal ke-${index + 1} belum memiliki akun COA.`);
    }

    if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
      throw new Error(`Nominal jurnal pada baris ke-${index + 1} tidak valid.`);
    }

    if (debit < 0 || credit < 0) {
      throw new Error(
        `Nominal jurnal pada baris ke-${index + 1} tidak boleh negatif.`,
      );
    }

    if ((debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
      throw new Error(
        `Baris jurnal ke-${index + 1} harus berisi debit atau kredit saja.`,
      );
    }
  }

  const totalDebit = rows.reduce(
    (total, row) => total + Number(row.debit || 0),
    0,
  );

  const totalCredit = rows.reduce(
    (total, row) => total + Number(row.credit || 0),
    0,
  );

  if (totalDebit <= 0 || totalCredit <= 0) {
    throw new Error("Total debit dan kredit harus lebih dari nol.");
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Jurnal tidak balance. Debit: ${totalDebit}, Kredit: ${totalCredit}.`,
    );
  }
}

export async function createJournal(
  payload: CreateJournalPayload,
): Promise<{ success: true; journal_id: string }> {
  const {
    tanggal,
    reference,
    description,
    entity_id,
    source_table,
    source_id,
    user_id,
    rows,
  } = payload;

  if (!tanggal?.trim()) {
    throw new Error("Tanggal jurnal wajib diisi.");
  }

  validateJournalRows(rows);

  const { data: journal, error: journalError } = await supabase
    .from("journals")
    .insert({
      tanggal,
      waktu: new Date().toISOString(),
      reference: reference?.trim() || null,
      description: description?.trim() || null,
      entity_id: entity_id ?? null,
      source_table: source_table ?? null,
      source_id: source_id ?? null,
      user_id: user_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (journalError || !journal) {
    throw new Error(journalError?.message ?? "Gagal membuat header jurnal.");
  }

  const detailRows = rows.map((row) => ({
    journal_id: journal.id,
    account_id: row.account_id,
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    description: row.description?.trim() || null,
  }));

  const { error: detailError } = await supabase
    .from("journal_details")
    .insert(detailRows);

  if (detailError) {
    await supabase.from("journals").delete().eq("id", journal.id);

    throw new Error(
      `Gagal membuat detail jurnal. Header jurnal dibatalkan: ${detailError.message}`,
    );
  }

  return {
    success: true,
    journal_id: journal.id,
  };
}

/*
  Fungsi Accounting Engine.

  Ia mencari akun COA dari Account Mapping, lalu membentuk jurnal balance.
  Prioritas mapping:
  1. Khusus cabang (entityId)
  2. Global (entity_id null)
*/
export async function createMappedJournal(
  payload: CreateMappedJournalPayload,
): Promise<{ success: true; journal_id: string }> {
  const {
    moduleCode,
    transactionCode,
    entityId = null,
    rows,
    tanggal,
    reference,
    description,
    sourceTable,
    sourceId,
    userId,
  } = payload;

  if (!rows || rows.length < 2) {
    throw new Error("Minimal harus ada 2 baris mapping jurnal.");
  }

  const journalRows = await Promise.all(
    rows.map(async (row) => {
      const amount = Number(row.amount || 0);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
          `Nominal untuk mapping ${row.mappingKey} harus lebih dari nol.`,
        );
      }

      const mapping = await resolveAccountMapping({
        moduleCode,
        transactionCode,
        mappingKey: row.mappingKey,
        entityId,
      });

      return {
        account_id: mapping.accountId,
        debit: row.side === "DEBIT" ? amount : 0,
        credit: row.side === "CREDIT" ? amount : 0,
        description: row.description ?? mapping.mappingName,
      };
    }),
  );

  return createJournal({
    tanggal,
    reference,
    description,
    entity_id: entityId,
    source_table: sourceTable,
    source_id: sourceId,
    user_id: userId,
    rows: journalRows,
  });
}
