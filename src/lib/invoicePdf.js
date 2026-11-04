import { jsPDF } from "jspdf";

const COMPANY = "JLM Development Inc.";
const MARGIN = 48;
const PAGE_W = 612;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 700;

function money(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function dateLabel(value) {
  if (!value) return "—";
  const raw = String(value);
  const d = new Date(raw.length <= 10 ? `${raw}T12:00:00` : raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function downloadInvoicePdf(invoice) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const total = invoice.total != null ? invoice.total : items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PAGE_W, 104, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(COMPANY, MARGIN, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(`Invoice ${invoice.invoice_number || ""}`, MARGIN, 70);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", PAGE_W - MARGIN, 52, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(dateLabel(invoice.invoice_date), PAGE_W - MARGIN, 72, { align: "right" });

  // Bill to
  let y = 150;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("BILL TO", MARGIN, y);
  doc.text("DETAILS", PAGE_W - MARGIN, y, { align: "right" });

  y += 17;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(invoice.bill_to_name || "—", MARGIN, y);
  let leftY = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (invoice.bill_to_address) {
    doc.splitTextToSize(invoice.bill_to_address, 280).forEach((line) => {
      leftY += 14;
      doc.text(line, MARGIN, leftY);
    });
  }
  if (invoice.bill_to_email) {
    leftY += 14;
    doc.text(invoice.bill_to_email, MARGIN, leftY);
  }

  const details = [
    ["Invoice #", invoice.invoice_number || "—"],
    ["Invoice Date", dateLabel(invoice.invoice_date)],
    ...(invoice.project_name ? [["Project", invoice.project_name]] : []),
    ...(invoice.draw_name ? [["Draw", invoice.draw_name]] : []),
  ];
  let rightY = y;
  doc.setTextColor(71, 85, 105);
  details.forEach(([label, value]) => {
    doc.text(`${label}:`, PAGE_W - MARGIN - 110, rightY, { align: "right" });
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), PAGE_W - MARGIN, rightY, { align: "right" });
    doc.setTextColor(71, 85, 105);
    rightY += 14;
  });

  y = Math.max(leftY, rightY) + 30;

  // Items table header
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y, CONTENT_W, 26, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("DESCRIPTION", MARGIN + 10, y + 17);
  doc.text("AMOUNT", PAGE_W - MARGIN - 10, y + 17, { align: "right" });
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  items.forEach((item) => {
    const lines = doc.splitTextToSize(String(item.description || ""), CONTENT_W - 130);
    const rowH = Math.max(26, lines.length * 13 + 13);
    if (y + rowH > BOTTOM) {
      doc.addPage();
      y = 60;
    }
    lines.forEach((line, i) => doc.text(line, MARGIN + 10, y + 17 + i * 13));
    doc.text(money(item.amount), PAGE_W - MARGIN - 10, y + 17, { align: "right" });
    doc.setDrawColor(229, 231, 235);
    doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);
    y += rowH;
  });

  if (y + 60 > BOTTOM) {
    doc.addPage();
    y = 60;
  }

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total Due", MARGIN + 10, y + 26);
  doc.setFontSize(14);
  doc.text(money(total), PAGE_W - MARGIN - 10, y + 26, { align: "right" });
  y += 46;

  // Notes
  if (invoice.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("NOTES", MARGIN, y);
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.splitTextToSize(invoice.notes, CONTENT_W).forEach((line) => {
      doc.text(line, MARGIN, y);
      y += 13;
    });
    y += 12;
  }

  // Payment
  if (invoice.payment_instructions || invoice.pay_url) {
    if (y + 90 > BOTTOM) {
      doc.addPage();
      y = 60;
    }
    doc.setDrawColor(229, 231, 235);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("PAYMENT", MARGIN, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    if (invoice.payment_instructions) {
      doc.splitTextToSize(invoice.payment_instructions, CONTENT_W).forEach((line) => {
        doc.text(line, MARGIN, y);
        y += 13;
      });
      y += 6;
    }
    if (invoice.pay_url) {
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text("Pay online:", MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(37, 99, 235);
      doc.textWithLink(invoice.pay_url, MARGIN + 62, y, { url: invoice.pay_url });
      y += 13;
    }
  }

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Thank you,  ${COMPANY}`, MARGIN, 740);

  doc.save(`Invoice-${invoice.invoice_number || "draft"}.pdf`);
}