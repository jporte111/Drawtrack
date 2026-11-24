import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { dedupeCategories, loadProjectCategories } from "@/lib/budgetCategories";
import { JLM_LOGO_URL } from "@/lib/invoiceEmail";

const COMPANY = "JLM Development Inc.";
const MARGIN = 40;
const PAGE_W = 612;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 726;

const money = (value) =>
  (Number(value) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

async function loadLogo() {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = JLM_LOGO_URL;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

// Budget vs. approved invoices to date, per category, across the client's draws.
async function collectRows(clientId) {
  const { budget, categories: rawCategories } = await loadProjectCategories(clientId);
  const { categories, idToKept } = dedupeCategories((rawCategories || []).filter((c) => c.status !== "archived"));

  const draws = await base44.entities.DrawCycle.filter({ client_id: clientId });
  const drawIds = draws.map((d) => d.id);
  const drawVendors = drawIds.length
    ? await base44.entities.DrawVendor.filter({ draw_cycle_id: { $in: drawIds } })
    : [];
  const dvById = new Map(drawVendors.map((dv) => [dv.id, dv]));
  const dvIds = drawVendors.map((dv) => dv.id);
  const docs = dvIds.length
    ? await base44.entities.Document.filter({
        draw_vendor_id: { $in: dvIds },
        document_type: { $in: ["invoice", "receipt"] },
      })
    : [];

  const spentByCat = new Map();
  let uncategorized = 0;
  for (const doc of docs) {
    if (doc.review_status === "needs_review") continue;
    const dv = dvById.get(doc.draw_vendor_id);
    const rawId = doc.budget_category_id || dv?.budget_category_id;
    const kept = rawId ? idToKept.get(rawId) : null;
    const amount = Number(doc.amount) || 0;
    if (kept) spentByCat.set(kept.id, (spentByCat.get(kept.id) || 0) + amount);
    else uncategorized += amount;
  }

  const rows = [...categories]
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((cat) => {
      const budgetAmount = cat.revised_budget != null ? cat.revised_budget : cat.original_budget || 0;
      const spent = spentByCat.get(cat.id) || 0;
      return { name: cat.name || "Category", budget: budgetAmount, spent, remaining: budgetAmount - spent };
    });
  if (uncategorized > 0) {
    rows.push({ name: "Uncategorized", budget: 0, spent: uncategorized, remaining: -uncategorized });
  }
  return { budgetName: budget?.name || "", rows };
}

export async function buildBudgetProgressPdf({ clientId, clientName, projectName }) {
  const logo = await loadLogo();
  const { rows, budgetName } = await collectRows(clientId);
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  // Header: logo on the left, company on the right.
  let y = MARGIN;
  if (logo) {
    const h = 30;
    const w = Math.min((logo.width / logo.height) * h, 150);
    doc.addImage(logo.dataUrl, "PNG", MARGIN, y, w, h);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(COMPANY, PAGE_W - MARGIN, y + 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("BUDGET PROGRESS REPORT", PAGE_W - MARGIN, y + 26, { align: "right" });

  y += 52;
  doc.setDrawColor(229, 231, 235);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(projectName || clientName || "Project", MARGIN, y);

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const subtitle = [
    clientName && clientName !== projectName ? clientName : "",
    budgetName,
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(subtitle, MARGIN, y);
  y += 26;

  const cols = { budget: 320, spent: 430, remaining: 540 };

  const drawHead = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(MARGIN, y, CONTENT_W, 26, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("BUDGET CATEGORY", MARGIN + 10, y + 17);
    doc.text("BUDGET", cols.budget, y + 17, { align: "right" });
    doc.text("INVOICED TO DATE", cols.spent, y + 17, { align: "right" });
    doc.text("REMAINING", cols.remaining, y + 17, { align: "right" });
    y += 26;
  };

  drawHead();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  rows.forEach((row) => {
    const lines = doc.splitTextToSize(row.name, 240);
    const rowH = Math.max(24, lines.length * 12 + 12);
    if (y + rowH > BOTTOM) {
      doc.addPage();
      y = MARGIN;
      drawHead();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
    }
    doc.setTextColor(15, 23, 42);
    lines.forEach((line, i) => doc.text(line, MARGIN + 10, y + 16 + i * 12));
    if (row.remaining < 0) doc.setTextColor(185, 28, 28);
    else doc.setTextColor(15, 23, 42);
    doc.text(money(row.budget), cols.budget, y + 16, { align: "right" });
    doc.text(money(row.spent), cols.spent, y + 16, { align: "right" });
    doc.text(money(row.remaining), cols.remaining, y + 16, { align: "right" });
    doc.setDrawColor(229, 231, 235);
    doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);
    y += rowH;
  });

  if (rows.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.text("No budget categories yet.", MARGIN + 10, y + 16);
    y += 26;
  }

  if (y + 40 > BOTTOM) {
    doc.addPage();
    y = MARGIN;
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.budget += row.budget;
      acc.spent += row.spent;
      return acc;
    },
    { budget: 0, spent: 0 },
  );

  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y, CONTENT_W, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL", MARGIN + 10, y + 18);
  doc.text(money(totals.budget), cols.budget, y + 18, { align: "right" });
  doc.text(money(totals.spent), cols.spent, y + 18, { align: "right" });
  doc.text(money(totals.budget - totals.spent), cols.remaining, y + 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Invoiced to date reflects approved vendor invoices across all draws for this project.",
    MARGIN,
    y + 48,
  );

  const safeName = String(projectName || clientName || "Project").replace(/[^A-Za-z0-9]+/g, "-");
  return {
    blob: doc.output("blob"),
    fileName: `Budget Progress - ${safeName}.pdf`,
  };
}

// Builds the report and uploads it privately so the email function can attach it.
export async function uploadBudgetProgressReport({ clientId, clientName, projectName }) {
  const { blob, fileName } = await buildBudgetProgressPdf({ clientId, clientName, projectName });
  const file = new File([blob], fileName, { type: "application/pdf" });
  const res = await base44.integrations.Core.UploadPrivateFile({ file });
  const data = res?.data || res;
  return { uri: data.file_uri, fileName };
}