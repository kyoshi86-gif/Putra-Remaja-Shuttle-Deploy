// ============================================================================
// PROCUREMENT FORMATTER
// ============================================================================

export function money(value: number | null | undefined): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function quantity(value: number | null | undefined, digit = 4): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digit,
  }).format(Number(value ?? 0));
}

export function percent(value: number | null | undefined, digit = 2): string {
  return `${Number(value ?? 0).toFixed(digit)}%`;
}

export function number(value: number | null | undefined): string {
  const numericValue = Number(value ?? 0);

  if (numericValue === 0) {
    return "";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

export function formatNumberInput(
  value: number | string | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

export function parseNumberInput(
  value: string
): number {
  if (!value) {
    return 0;
  }

  return Number(
    value
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  ) || 0;
}