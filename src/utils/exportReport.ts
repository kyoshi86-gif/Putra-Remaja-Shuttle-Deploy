import * as XLSX from "xlsx";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agst",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export function formatReportDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_NAMES[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);

  return `${day}${month}${year}`;
}

export function formatReportDisplayDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_NAMES[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);

  return `${day} ${month} ${year}`;
}

export function formatReportDateRange(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
): string {
  if (!startDate && !endDate) {
    return "SemuaTanggal";
  }

  if (startDate && !endDate) {
    return formatReportDate(startDate);
  }

  if (!startDate && endDate) {
    return formatReportDate(endDate);
  }

  const start = startDate as Date;
  const end = endDate as Date;

  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    const startDay = String(start.getDate()).padStart(2, "0");

    return `${startDay}-${formatReportDate(end)}`;
  }

  return `${formatReportDate(start)}-${formatReportDate(end)}`;
}

export interface ExportColumn {
  label: string;
  key: string;
  format?: (
    value: unknown,
    row: Record<string, unknown>,
  ) => string | number | boolean | null;
}

export interface ExportReportOptions {
  filename: string;
  sheetName: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
}

export function exportReport({
  filename,
  sheetName,
  columns,
  rows,
}: ExportReportOptions) {
  const data = rows.map((row) => {
    const result: Record<string, unknown> = {};

    columns.forEach((column) => {
      let value = row[column.key];

      if (column.format) {
        value = column.format(value, row);
      }

      result[column.label] = value;
    });

    return result;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  const columnWidths = columns.map((column) => {
    const maxLength = Math.max(
      column.label.length,
      ...data.map((row) => String(row[column.label] ?? "").length),
    );

    return {
      wch: Math.min(Math.max(maxLength + 2, 10), 40),
    };
  });

  worksheet["!cols"] = columnWidths;

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

  XLSX.writeFile(workbook, filename);
}
