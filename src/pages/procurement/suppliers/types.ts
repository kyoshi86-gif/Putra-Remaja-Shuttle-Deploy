export type Supplier = {
  id: string;
  entity_id: string | null;
  code: string;
  name: string;

  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;

  default_payment_term_days: number;
  is_active: boolean;

  created_at: string;
  updated_at: string;
};

export type SupplierFormData = {
  entity_id?: string | null;
  code: string;
  name: string;

  contact_person: string;
  phone: string;
  email: string;
  address: string;

  default_payment_term_days: number;
  is_active: boolean;
};
