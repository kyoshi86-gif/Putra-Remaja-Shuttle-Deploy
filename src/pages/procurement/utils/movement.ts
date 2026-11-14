// ============================================================================
// INVENTORY MOVEMENT LABEL
// ============================================================================

export const MOVEMENT_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Saldo Awal",

  RECEIPT: "Receiving",

  ISSUE: "Pemakaian",

  TRANSFER_IN: "Transfer Masuk",

  TRANSFER_OUT: "Transfer Keluar",

  ADJUSTMENT_IN: "Penyesuaian Masuk",

  ADJUSTMENT_OUT: "Penyesuaian Keluar",

  STOCK_OPNAME: "Stock Opname",
};

export function getMovementLabel(type: string): string {
  return MOVEMENT_LABELS[type] ?? type;
}
