export type Unit = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UnitFormData = {
  code: string;
  name: string;
  is_active: boolean;
};
