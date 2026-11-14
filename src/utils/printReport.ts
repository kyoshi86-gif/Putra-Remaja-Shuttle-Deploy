export interface PrintColumn {
  label: string;
  key: string;
  align?: "left" | "center" | "right";
  width?: string;
  format?: (value: unknown, row: Record<string, unknown>) => string | number;
}

export interface PrintFooter {
  label: string;
  value: string | number;
}

export interface PrintReportOptions {
  title: string;
  company?: string;
  period?: string;
  filename?: string;

  orientation?: "portrait" | "landscape";

  printedBy?: string;

  columns: PrintColumn[];
  rows: Array<Record<string, unknown>>;
  footer?: Array<{
    label: string;
    value: string | number;
  }>;
}

export function printReport({
  title,
  company = "BUTTER CLUB BAKERY",
  period = "-",
  orientation = "portrait",
  printedBy = "-",
  columns,
  rows,
  footer = [],
}: PrintReportOptions) {
  const printWindow = window.open("", "_blank", "width=1400,height=900");

  if (!printWindow) {
    alert("Popup print diblokir browser.");
    return;
  }

  const printedAt = new Date().toLocaleString("id-ID");

  const escapeHtml = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const tableHeader = columns
    .map(
      (column) => `
        <th
          style="
            width:${column.width ?? "auto"};
            text-align:${column.align ?? "left"};
          "
        >
          ${escapeHtml(column.label)}
        </th>
      `,
    )
    .join("");

  const tableBody = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          let value = row[column.key];

          if (column.format) {
            value = column.format(value, row);
          }

          return `
            <td
              style="
                text-align:${column.align ?? "left"};
              "
            >
              ${escapeHtml(value)}
            </td>
          `;
        })
        .join("");

      return `
        <tr>
          ${cells}
        </tr>
      `;
    })
    .join("");

  const footerHtml = `
    ${
      footer.length > 0
        ? `
          <div class="summary">
            ${footer
              .map(
                (item) => `
                  <div class="summary-row">
                    <span>${escapeHtml(item.label)}</span>
                    <strong>${escapeHtml(item.value)}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
        `
        : ""
    }

    <div class="print-info">
      <div>
        Dicetak : ${escapeHtml(printedAt)}
      </div>

      <div>
        Dicetak Oleh : ${escapeHtml(printedBy)}
      </div>
    </div>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />

        <title></title>

        <style>
          @page {
            size: A4 ${orientation};
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
            font-family: Arial, Helvetica, sans-serif;
          }

          body {
            margin: 0;
            padding: 0;
            color: #222;
            font-size: 12px;
          }

          .header {
            border-bottom: 2px solid #000;
            margin-bottom: 12px;
            padding-bottom: 8px;
          }

          .company {
            text-align : center;
            font-size: 22px;
            font-weight: bold;
          }

          .title {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin-top: 8px;
          }

          .period {
            margin-top: 6px;
            font-size: 12px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }

          thead {
            display: table-header-group;
            background: #f3f4f6;
          }

          tr {
            page-break-inside: avoid;
          }

          th {
            border: 1px solid #000;
            padding: 6px;
            font-size: 12px;
            font-weight: bold;
          }

          td {
            border: 1px solid #000;
            padding: 5px;
            font-size: 11px;
            vertical-align: top;
          }

          .print-info {
            margin-top: 20px;
            padding-top: 8px;
            border-top: 1px solid #000;
            display: flex;
            justify-content: space-between;
            gap: 20px;
            font-size: 11px;
          }

          .summary {
            width: 320px;
            margin-top: 18px;
            margin-left: auto;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 4px 0;
            border-bottom: 1px dashed #999;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>

      <body>

        <div class="header">

          <div class="company">
            ${escapeHtml(company)}
          </div>

          <div class="title">
            ${escapeHtml(title)}
          </div>

          <div class="period">
            Periode : ${escapeHtml(period)}
          </div>

        </div>

        <table>
          <thead>
            <tr>
              ${tableHeader}
            </tr>
          </thead>

          <tbody>
            ${tableBody}
          </tbody>
        </table>

        ${footerHtml}

      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 300);

  printWindow.onafterprint = () => {
    printWindow.close();
  };
}
