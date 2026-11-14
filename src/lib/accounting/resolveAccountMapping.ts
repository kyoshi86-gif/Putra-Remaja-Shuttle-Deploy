import { supabase } from "@/lib/supabaseClient";

export type ResolveAccountMappingParams = {
  moduleCode: string;
  transactionCode: string;
  mappingKey: string;
  entityId?: string | null;
};

export type ResolvedAccountMapping = {
  mappingId: string;
  accountId: string;
  moduleCode: string;
  transactionCode: string;
  mappingKey: string;
  mappingName: string;
  source: "ENTITY" | "GLOBAL";
};

type AccountMappingRow = {
  id: string;
  module_code: string;
  transaction_code: string;
  mapping_key: string | null;
  account_id: string | null;
  name: string | null;
  entity_id: string | null;
  is_active: boolean | null;
};

async function findMapping(
  moduleCode: string,
  transactionCode: string,
  mappingKey: string,
  entityId: string | null,
): Promise<AccountMappingRow | null> {
  let query = supabase
    .from("account_mappings")
    .select(
      `
      id,
      module_code,
      transaction_code,
      mapping_key,
      account_id,
      name,
      entity_id,
      is_active
    `,
    )
    .eq("module_code", moduleCode)
    .eq("transaction_code", transactionCode)
    .eq("mapping_key", mappingKey)
    .eq("is_active", true);

  query = entityId
    ? query.eq("entity_id", entityId)
    : query.is("entity_id", null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(
      `Gagal membaca Account Mapping ${moduleCode} / ${transactionCode} / ${mappingKey}: ${error.message}`,
    );
  }

  return data as AccountMappingRow | null;
}

export async function resolveAccountMapping(
  params: ResolveAccountMappingParams,
): Promise<ResolvedAccountMapping> {
  const { moduleCode, transactionCode, mappingKey, entityId = null } = params;

  // Prioritas 1: mapping khusus cabang.
  let mapping: AccountMappingRow | null = null;
  let source: "ENTITY" | "GLOBAL" = "GLOBAL";

  if (entityId) {
    mapping = await findMapping(
      moduleCode,
      transactionCode,
      mappingKey,
      entityId,
    );

    if (mapping) {
      source = "ENTITY";
    }
  }

  // Prioritas 2: fallback ke mapping global.
  if (!mapping) {
    mapping = await findMapping(moduleCode, transactionCode, mappingKey, null);

    source = "GLOBAL";
  }

  if (!mapping) {
    throw new Error(
      `Account Mapping belum tersedia: ${moduleCode} / ${transactionCode} / ${mappingKey}.`,
    );
  }

  if (!mapping.account_id) {
    throw new Error(
      `Account Mapping "${mapping.name ?? mapping.id}" belum memiliki akun COA.`,
    );
  }

  return {
    mappingId: mapping.id,
    accountId: mapping.account_id,
    moduleCode: mapping.module_code,
    transactionCode: mapping.transaction_code,
    mappingKey: mapping.mapping_key ?? mappingKey,
    mappingName: mapping.name ?? `${moduleCode} - ${mappingKey}`,
    source,
  };
}
