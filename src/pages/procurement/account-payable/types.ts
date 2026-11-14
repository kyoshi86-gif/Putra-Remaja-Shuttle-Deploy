export type ApInvoiceStatus =
  "DRAFT" | "OPEN" | "PARTIAL" | "PAID" | "CANCELLED";

export type ReceivingOption = {
  id: string;
  receiving_number: string;
  purchase_order_number_snapshot: string;
  supplier_id: string;
  supplier_code_snapshot: string;
  supplier_name_snapshot: string;
  receiving_date: string;
  grand_total: number;
  status: string;
};

export type SupplierOption = {
  id: string;
  code: string;
  name: string;
  default_payment_term_days: number;
  is_active: boolean;
};

export type AccountOption = {
  id: string;
  code: string;
  name: string;
};

export type ApInvoice = {
  id: string;
  entity_id: string;
  receiving_record_id: string | null;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;

  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;

  paid_amount: number;
  remaining_amount: number;
  status: ApInvoiceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  receiving_number?: string | null;
  receiving_date?: string | null;
  purchase_order_number?: string | null;

  supplier_code?: string | null;
  supplier_name?: string | null;

  supplier_invoice_number?: string | null;
  supplier_invoice_date?: string | null;
  supplier_due_date?: string | null;

  payment_request_id?: string | null;
  payment_request_number?: string | null;
  payment_request_status?: ApPaymentRequestStatus | null;
};

export type ApInvoiceListItem = ApInvoice & {
  receiving_number: string;
  purchase_order_number: string | null;

  supplier_code: string | null;
  supplier_name: string | null;

  supplier_invoice_number: string | null;
  supplier_invoice_date: string | null;
  supplier_due_date: string | null;

  payment_request_id: string | null;
  payment_request_number: string | null;
  payment_request_status: string | null;
};

export type ApPaymentRequestStatus =
  "DRAFT" | "APPROVED" | "PAID" | "CANCELLED";

export type ApPaymentRequest = {
  id: string;
  entity_id: string;
  payment_request_number: string;
  request_date: string;
  supplier_id: string | null;
  total_amount: number;
  status: ApPaymentRequestStatus;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ApPaymentRequestItem = {
  id: string;
  payment_request_id: string;
  ap_invoice_id: string | null;
  receiving_record_id: string | null;
  requested_amount: number;
  notes: string | null;
};

export type ApPaymentRequestItemDetail = ApPaymentRequestItem & {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  remaining_amount: number | null;

  receiving_number: string | null;
  receiving_date: string | null;

  purchase_order_number: string | null;
};

export type ApPaymentRequestListItem = ApPaymentRequest & {
  supplier_code: string | null;
  supplier_name: string | null;
  items: ApPaymentRequestItemDetail[];
};

export type CreatePaymentRequestResult = {
  success: boolean;
  payment_request_id: string;
  payment_request_number: string;
  status: ApPaymentRequestStatus;
  total_amount: number;
};

export type ApprovePaymentRequestResult = {
  success: boolean;
  payment_request_id: string;
  payment_request_number: string;
  status: "APPROVED";
  total_amount: number;
  approved_at: string;
};

export type ApPaymentRequestFormData = {
  request_date: string;
  supplier_id: string | null;
  items: {
    ap_invoice_id: string;
    receiving_record_id: string | null;
    requested_amount: number;
    notes?: string;
  }[];
  notes: string;
};

export type ApInvoiceFormData = {
  entity_id?: string | null;
  receiving_record_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  notes: string;
};

export type ApPayment = {
  id: string;
  entity_id: string;
  supplier_id: string | null;
  payment_number: string | null;
  payment_date: string;
  payment_method_id: string | null;
  amount: number;
  reference_number: string | null;
  notes: string | null;
  journal_id: string | null;
  created_by: string | null;
  created_at: string;
  payment_request_id: string | null;
};

export type ApprovedPaymentRequestItem = {
  id: string;
  payment_request_id: string;
  ap_invoice_id: string | null;
  receiving_record_id: string | null;
  requested_amount: number;
  ap_invoice?: {
    id: string;
    invoice_number: string | null;
    invoice_date: string | null;
    due_date: string | null;

    supplier?: {
      id: string;
      code: string | null;
      name: string | null;
    } | null;

    receiving_record?: {
      id: string;
      receiving_number: string | null;
    } | null;
  } | null;
};

export type ApprovedPaymentRequest = {
  id: string;
  entity_id: string;
  payment_request_number: string;
  request_date: string;
  status: "APPROVED";
  total_amount: number;
  notes: string | null;
  created_at: string;
  items: ApprovedPaymentRequestItem[];
};

export type PaymentMethodOption = {
  id: string;
  code: string;
  name: string;
  settlement_type: string;
  account_id: string | null;
  is_active: boolean;
};

export type PaymentFromRequestFormData = {
  payment_request_id: string;
  payment_date: string;
  payment_method_id: string;
  reference_number: string;
  notes: string;
};

export type CreatePaymentFromRequestResult = {
  success: boolean;
  payment_id: string;
  payment_number: string | null;
  payment_request_id: string;
  payment_request_number: string;
  entity_id: string;
  supplier_id: string | null;
  payment_date: string;
  payment_method_id: string;
  amount: number;
  reference_number: string | null;
  allocation_count: number;
  payment_request_status: "PAID";
};

export type ApPaymentAllocation = {
  invoice_id: string;
  amount: number;
  deposit_id?: string | null;
};

export type ApPaymentFormData = {
  entity_id?: string | null;
  supplier_id: string | null;
  payment_request_id: string | null;
  payment_date: string;
  payment_method_id: string;
  reference_number: string;
  notes: string;
  allocations: ApPaymentAllocation[];
};

export type ApPaymentSettlementMethod = {
  id: string;
  entity_id: string;
  code: string;
  name: string;
  settlement_type: string;
  account_id: string | null;
  requires_amount: boolean;
  is_system: boolean;
  is_active: boolean;
  available_for: string;
};

export type ApOutstandingInvoice = {
  id: string;
  entity_id: string;
  receiving_record_id: string | null;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  remaining_amount: number;
  status: ApInvoiceStatus;
  notes: string | null;
};

export type SupplierDepositOption = {
  id: string;
  supplier_id: string;
  reference: string | null;
  description: string | null;
  original_amount: number;
  allocated_amount: number;
  status: string;
};
