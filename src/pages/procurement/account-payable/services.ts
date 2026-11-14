import { supabase } from "@/lib/supabaseClient";

export const apService = {
  getInvoices() {
    return supabase
      .from("ap_invoices")
      .select("*")
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });
  },

  getPayments() {
    return supabase
      .from("ap_payments")
      .select("*")
      .order("payment_date", { ascending: false });
  },

  getReceivingLookup() {
    return supabase
      .from("receiving_records")
      .select("*")
      .in("status", ["OPEN", "PARTIAL"]);
  },

  getSuppliers() {
    return supabase
      .from("suppliers")
      .select("id,code,name")
      .eq("is_active", true)
      .order("code");
  },

  getAccounts() {
    return supabase
      .from("accounts")
      .select("id,code,name")
      .eq("is_active", true)
      .order("code");
  },

  getPaymentSettlementMethods(entityId: string) {
    return supabase
      .from("purchase_settlement_methods")
      .select(
        `
        id,
        entity_id,
        code,
        name,
        settlement_type,
        account_id,
        requires_amount,
        is_system,
        is_active,
        available_for
      `,
      )
      .eq("entity_id", entityId)
      .eq("is_active", true)
      .in("available_for", ["PAYMENT", "BOTH"])
      .order("name");
  },

  getOutstandingInvoices(entityId: string, supplierId: string) {
    return supabase
      .from("ap_invoices")
      .select(
        `
        id,
        entity_id,
        receiving_record_id,
        supplier_id,
        invoice_number,
        invoice_date,
        due_date,
        subtotal,
        discount_amount,
        tax_amount,
        grand_total,
        paid_amount,
        remaining_amount,
        status,
        notes
      `,
      )
      .eq("entity_id", entityId)
      .eq("supplier_id", supplierId)
      .in("status", ["OPEN", "PARTIAL"])
      .gt("remaining_amount", 0)
      .order("due_date", {
        ascending: true,
        nullsFirst: false,
      });
  },

  getSupplierDeposits(entityId: string, supplierId: string) {
    return supabase
      .from("supplier_deposits")
      .select(
        `
        id,
        supplier_id,
        reference,
        description,
        original_amount,
        allocated_amount,
        status
      `,
      )
      .eq("entity_id", entityId)
      .eq("supplier_id", supplierId)
      .in("status", ["OPEN", "PARTIAL"])
      .order("deposit_date", {
        ascending: false,
      });
  },
};
