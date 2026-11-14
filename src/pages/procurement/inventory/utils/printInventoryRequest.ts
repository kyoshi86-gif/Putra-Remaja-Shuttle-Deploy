import type { InventoryRequest, InventoryRequestLineForm } from "../types";

function fmtDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID");
}

function fmtQty(value: number) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function printInventoryRequest(
  header: InventoryRequest,
  details: InventoryRequestLineForm[],
) {
  const html = `

<html>

<head>

<title>${header.request_no}</title>

<style>

@page{
size:A4 portrait;
margin:12mm;
}

body{
font-family:Arial,Helvetica,sans-serif;
font-size:12px;
color:#000;
}

table{
width:100%;
border-collapse:collapse;
}

th,td{
border:1px solid #000;
padding:5px;
}

th{
background:#eee;
}

.header{
margin-bottom:20px;
}

.title{
font-size:22px;
font-weight:bold;
text-align:center;
margin-bottom:10px;
}

.info td{
border:none;
padding:3px 4px;
vertical-align:top;
text-align:left;
}

.info td:nth-child(3){
text-align:right;
padding-right:8px;
font-weight:bold;
white-space:nowrap;
}

.info td:nth-child(4){
white-space:nowrap;
}

.sign{
margin-top:50px;
width:100%;
}

.sign td{
border:none;
text-align:center;
padding-top:60px;
}

.right{
text-align:right;
}

.center{
text-align:center;
}

</style>

</head>

<body>

<div class="title">

STORE REQUEST

</div>

<div class="header" style="overflow:hidden; margin-bottom:20px;">

<div style="float:left; width:58%;">

<table class="info">

<tr>
<td width="38%">Nomor</td>
<td>: ${header.request_no}</td>
</tr>

<tr>
<td>Gudang Asal</td>
<td>: ${header.source_store_name}</td>
</tr>

<tr>
<td>Gudang Tujuan</td>
<td>: ${header.destination_store_name}</td>
</tr>

<tr>
<td>Catatan</td>
<td>: ${header.remarks ?? "-"}</td>
</tr>

</table>

</div>

<div style="float:right; width:32%;">

<table class="info">

<tr>
<td width="40%">Tanggal</td>
<td>: ${fmtDate(header.request_date)}</td>
</tr>

<tr>
<td>Status</td>
<td>: ${header.status}</td>
</tr>

</table>

</div>

</div>

<table>

<thead>

<tr>

<th width="5%">No</th>

<th>Item</th>

<th width="12%">Qty Request</th>

<th width="12%">Qty Approve</th>

<th width="12%">Qty Transfer</th>

<th width="20%">Catatan</th>

</tr>

</thead>

<tbody>

${details
  .map(
    (x, i) => `

<tr>

<td class="center">

${i + 1}

</td>

<td>

${x.item_code ?? ""} - ${x.item_name ?? ""}

</td>

<td class="right">

${fmtQty(x.qty_request)}

</td>

<td class="right">

${fmtQty(x.qty_approved)}

</td>

<td class="right">

${fmtQty(x.qty_transfer)}

</td>

<td>

${x.remarks ?? ""}

</td>

</tr>

`,
  )
  .join("")}

</tbody>

</table>

<table class="sign">

<tr>

<td>

Dibuat oleh,

</td>

<td>

Disiapkan oleh,

</td>

<td>

Diterima oleh,

</td>

</tr>

<tr>

<td>

____________________

</td>

<td>

____________________

</td>

<td>

____________________

</td>

</tr>

</table>

<script>

window.onload=function(){

window.print();

window.close();

}

</script>

</body>

</html>

`;

  const win = window.open("", "_blank", "width=900,height=900");

  if (!win) return;

  win.document.open();

  win.document.write(html);

  win.document.close();
}
