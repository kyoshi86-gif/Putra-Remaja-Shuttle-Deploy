-- ============================================================
-- FASE 6 — HRD & PAYROLL (fondasi DB)
-- ------------------------------------------------------------
-- Sifat: ADDITIVE & idempotent. Sesuai 08-hrd-payroll.md.
-- Prinsip:
--   * Data sensitif karyawan berada di tabel terpisah (akses diatur RBAC).
--   * Komponen gaji dikonfigurasi (earning/deduction, taxable).
--   * Konfigurasi pajak/BPJS bertanggal efektif (tidak dikunci di kode).
--   * Payroll posting immutable; koreksi via adjustment/reversal.
-- ============================================================

-- ------------------------------------------------------------
-- 1) KARYAWAN (data inti)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    kode text,
    nama text NOT NULL,
    nip_nik text,
    jabatan text,
    departemen text,
    cost_center text,
    status_kerja text NOT NULL DEFAULT 'AKTIF',  -- AKTIF | NONAKTIF
    tanggal_masuk date,
    tanggal_keluar date,
    atasan_id uuid REFERENCES public.employees(id),
    alamat text,
    telepon text,
    email text,
    no_rekening text,
    created_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_entity ON public.employees (entity_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees (status_kerja);
CREATE INDEX IF NOT EXISTS idx_employees_atasan ON public.employees (atasan_id);

-- Data sensitif (akses terbatas / RBAC)
CREATE TABLE IF NOT EXISTS public.employee_sensitive_data (
    employee_id uuid PRIMARY KEY REFERENCES public.employees(id),
    nik text,
    alamat_ktp text,
    no_bpjs_kesehatan text,
    no_bpjs_ketenagakerjaan text,
    npwp text,
    status_kawin text,
    jumlah_tanggungan integer DEFAULT 0,
    tanggal_lahir date,
    updated_at timestamptz DEFAULT now()
);

-- ------------------------------------------------------------
-- 2) SHIFT & JADWAL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.employees(id),
    shift_name text NOT NULL,
    hari text[],                  -- ['SENIN','SELASA',...]
    jam_mulai time,
    jam_selesai time,
    effective_date date,
    status text NOT NULL DEFAULT 'AKTIF'
);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_emp ON public.employee_shifts (employee_id);

-- ------------------------------------------------------------
-- 3) ABSENSI
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    employee_id uuid NOT NULL REFERENCES public.employees(id),
    tanggal date NOT NULL,
    check_in timestamptz,
    check_out timestamptz,
    shift_id uuid REFERENCES public.employee_shifts(id),
    status text NOT NULL DEFAULT 'PRESENT',  -- PRESENT|ABSENT|LATE|LEAVE
    notes text,
    source text NOT NULL DEFAULT 'MANUAL',
    corrected_by text,
    corrected_at timestamptz,
    alasan_koreksi text
);
CREATE INDEX IF NOT EXISTS idx_attendance_emp ON public.attendance_records (employee_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_entity ON public.attendance_records (entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_emp_date
    ON public.attendance_records (employee_id, tanggal);

-- ------------------------------------------------------------
-- 4) CUTI
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    employee_id uuid NOT NULL REFERENCES public.employees(id),
    jenis text NOT NULL,           -- CUTI_TAHUNAN | SAKIT | IZIN | DLL
    tanggal_mulai date NOT NULL,
    tanggal_selesai date NOT NULL,
    jumlah_hari numeric NOT NULL DEFAULT 0,
    alasan text,
    status text NOT NULL DEFAULT 'PENDING',  -- PENDING|APPROVED|REJECTED|CANCELLED
    approved_by text,
    approved_at timestamptz,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leave_emp ON public.leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_entity ON public.leave_requests (entity_id);

-- ------------------------------------------------------------
-- 5) KOMPONEN GAJI (konfigurasi)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kode text UNIQUE,
    nama text NOT NULL,
    type text NOT NULL,            -- EARNING | DEDUCTION
    taxable boolean NOT NULL DEFAULT true,
    basis text NOT NULL DEFAULT 'FIXED',  -- FIXED|PERCENTAGE|PER_TRIP|PER_DAY
    akun_coa_id uuid REFERENCES public.accounts(id),
    frequency text NOT NULL DEFAULT 'MONTHLY',
    is_active boolean NOT NULL DEFAULT true
);

-- Alokasi komponen per karyawan (nilai khusus)
CREATE TABLE IF NOT EXISTS public.employee_payroll_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.employees(id),
    component_id uuid NOT NULL REFERENCES public.payroll_components(id),
    amount numeric(18,2) NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    UNIQUE (employee_id, component_id)
);

-- ------------------------------------------------------------
-- 6) PERIODE PAYROLL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    nama text NOT NULL,
    tanggal_mulai date NOT NULL,
    tanggal_selesai date NOT NULL,
    status text NOT NULL DEFAULT 'OPEN',   -- OPEN | PROCESSING | CLOSED | LOCKED
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_entity ON public.payroll_periods (entity_id);

-- ------------------------------------------------------------
-- 7) RUN PAYROLL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    period_id uuid NOT NULL REFERENCES public.payroll_periods(id),
    run_no text,
    status text NOT NULL DEFAULT 'DRAFT',  -- DRAFT|UNDER_REVIEW|APPROVED|POSTED|SETTLED
    calculated_by text,
    reviewed_by text,
    approved_by text,
    approved_at timestamptz,
    posted_at timestamptz,
    total_gross numeric(18,2) NOT NULL DEFAULT 0,
    total_deduction numeric(18,2) NOT NULL DEFAULT 0,
    total_net numeric(18,2) NOT NULL DEFAULT 0,
    posting_key text UNIQUE,
    journal_id uuid REFERENCES public.journals(id),
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_entity ON public.payroll_runs (entity_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON public.payroll_runs (period_id);

CREATE TABLE IF NOT EXISTS public.payroll_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES public.employees(id),
    gross numeric(18,2) NOT NULL DEFAULT 0,
    deduction numeric(18,2) NOT NULL DEFAULT 0,
    net numeric(18,2) NOT NULL DEFAULT 0,
    UNIQUE (run_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_emp ON public.payroll_lines (employee_id);

CREATE TABLE IF NOT EXISTS public.payroll_line_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_line_id uuid NOT NULL REFERENCES public.payroll_lines(id) ON DELETE CASCADE,
    component_id uuid NOT NULL REFERENCES public.payroll_components(id),
    amount numeric(18,2) NOT NULL DEFAULT 0,
    UNIQUE (payroll_line_id, component_id)
);

-- ------------------------------------------------------------
-- 8) PEMBAYARAN GAJI
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    run_id uuid NOT NULL REFERENCES public.payroll_runs(id),
    payment_no text,
    payment_date date,
    method text,
    amount numeric(18,2) NOT NULL DEFAULT 0,
    source_account_id uuid REFERENCES public.cash_accounts(id),
    status text NOT NULL DEFAULT 'PAID',
    posting_key text UNIQUE,
    journal_id uuid REFERENCES public.journals(id),
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_run ON public.payroll_payments (run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_entity ON public.payroll_payments (entity_id);

-- ------------------------------------------------------------
-- 9) KONFIGURASI PAJAK/BPJS (bertanggal efektif)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_type text NOT NULL,   -- BPJS_KESEHATAN|BPJS_KETENAGAKERJAAN|PPH21|LAINNYA
    effective_from date NOT NULL,
    params jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    note text
);
CREATE INDEX IF NOT EXISTS idx_payroll_configs_type ON public.payroll_configs (config_type, effective_from);
