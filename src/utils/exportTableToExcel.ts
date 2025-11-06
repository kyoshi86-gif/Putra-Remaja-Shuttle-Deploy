import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export interface ColumnConfig {
  label: string;
  key: string;
  format?: (value: any, row?: Record<string, any>) => any;
  type?: "date" | "currency";
  formatString?: string;
}

export interface ExportOptions {
  filename?: string;
  sheetName?: string;
  columns: ColumnConfig[];
  prependRows?: Record<string, any>[];
  appendRows?: Record<string, any>[];
}

export function exportTableToExcel(
  data: Record<string, any>[],
  options: ExportOptions
) {
  const {
    filename = "Export.xlsx",
    sheetName = "Sheet1",
    columns,
    prependRows = [],
    appendRows = [],
  } = options;

  const header = columns.map((col) => col.label);

  const normalizeRow = (row: Record<string, any>) =>
    columns.map((col) => {
      const raw = row[col.key];
      const val = col.format ? col.format(raw, row) : raw;

      if (col.type === "date") {
        const d = new Date(val);
        if (isNaN(d.getTime())) return "";
        if (col.label === "Tanggal") {
          return new Date(d.getFullYear(), d.getMonth(), d.getDate()); // jam 00:00:00
        }
        return d;
      }

      if (col.type === "currency") {
        return typeof val === "number" ? val : Number(val) || "";
      }

      return val ?? "";
    });

  const rows = [header, ...prependRows.map(normalizeRow), ...data.map(normalizeRow), ...appendRows.map(normalizeRow)];
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  const range = XLSX.utils.decode_range(sheet["!ref"]!);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const col = columns[C];
    const colLetter = XLSX.utils.encode_col(C);

    for (let R = 1; R <= range.e.r; ++R) {
      const cellRef = colLetter + (R + 1);
      const cell = sheet[cellRef];
      if (!cell || cell.v === "" || cell.v === null || cell.v === undefined) continue;

      if (col?.type === "date" && cell.v instanceof Date) {
        const isMidnight = cell.v.getHours() === 0 && cell.v.getMinutes() === 0 && cell.v.getSeconds() === 0;
        cell.t = "d";
        cell.z = col.label === "Tanggal" && isMidnight
          ? "dd/mm/yyyy"
          : col.formatString || "dd/mm/yyyy hh:mm:ss";
      }

      if (col?.type === "currency" && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = '"Rp"#,##0.00;[Red]"Rp"-#,##0.00';
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  saveAs(blob, filename);
}