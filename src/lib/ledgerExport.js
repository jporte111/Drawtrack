// Flattens the draw ledger into a spreadsheet-friendly CSV (opens directly in Excel).
function cell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportLedgerCsv({ groupList, draw, client, clientName }) {
  const header = [
    "Budget Category",
    "Vendor",
    "Description",
    "Invoice #",
    "Invoice Date",
    "Amount",
    "Supporting Document",
    "Missing Invoice",
    "Payment To",
  ];

  const rows = [];
  groupList.forEach((group) => {
    group.lines.forEach((line) => {
      const missing = !line.invoice?.file_url;
      rows.push([
        group.name,
        line.vendorName || "",
        line.invoice?.notes || line.scopeOfWork || line.notes || "",
        line.invoiceNumber || "",
        line.invoiceDate || "",
        line.validAmount != null ? line.validAmount.toFixed(2) : "",
        line.invoice?.file_url || "",
        missing ? "MISSING" : "",
        line.recipient || "",
      ]);
    });
  });

  const total = groupList.reduce(
    (sum, group) => sum + group.lines.reduce((s, l) => s + (l.validAmount || 0), 0),
    0,
  );
  rows.push(["Grand Total", "", "", "", "", total.toFixed(2), "", "", ""]);

  const meta = [
    ["Project", draw?.project_name || client?.project_name || ""],
    ["Property Address", client?.address || ""],
    ["Client", clientName || client?.name || ""],
    ["Draw", draw?.name || ""],
    ["Exported", new Date().toLocaleString("en-US")],
    [],
  ];

  const csv = [...meta, header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeDraw = String(draw?.name || "draw").replace(/[^A-Za-z0-9_-]+/g, "-");
  link.href = url;
  link.download = `Draw-Ledger-${safeDraw}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}