// ============================================================================
// PROCUREMENT DATE
// ============================================================================

export function inputDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function currentMonthStart(): string {
  const now = new Date();

  return inputDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function today(): string {
  return inputDate(new Date());
}
