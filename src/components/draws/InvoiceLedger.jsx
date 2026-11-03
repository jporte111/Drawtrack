import React, { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, ExternalLink, Sparkles } from "lucide-react";
import DocStatusButton from "./DocStatusButton";
import AddVendorDialog from "./AddVendorDialog";
import AddInvoiceDialog from "./AddInvoiceDialog";
import EditableAmount from "./EditableAmount";
import EditableCategory from "./EditableCategory";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";

const RECIPIENTS = [
  { value: "vendor", label: "Vendor" },
  { value: "jlm", label: "JLM" },
  { value: "mike", label: "Mike" },
  { value: "jose", label: "Jose" },
];

export default function InvoiceLedger({ drawId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false);
  const [addInvoiceDVId, setAddInvoiceDVId] = useState(null);
  const [categorizing, setCategorizing] = useState(false);
  const [catProgress, setCatProgress] = useState("");

  const { data: drawCycle } = useQuery({
    queryKey: ["drawCycle", drawId],
    queryFn: () => base44.entities.DrawCycle.get(drawId),
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });
  const { data: allDocs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list(),
  });
  const { data: budgetCategories = [] } = useQuery({
    queryKey: ["budgetCategories", drawCycle?.client_id],
    queryFn: () => base44.entities.BudgetCategory.filter({ client_id: drawCycle.client_id }),
    enabled: !!drawCycle?.client_id,
  });
  const { data: clientVendors = [] } = useQuery({
    queryKey: ["clientVendors", drawCycle?.client_id],
    queryFn: () => base44.entities.ClientVendor.filter({ client_id: drawCycle.client_id }),
    enabled: !!drawCycle?.client_id,
  });

  const derived = useMemo(() => {
    const vendorMap = new Map(vendors.map((v) => [v.id, v]));
    const catMap = new Map(budgetCategories.map((c) => [c.id, c]));
    const cvByVendor = new Map(clientVendors.map((cv) => [cv.vendor_id, cv.id]));
    const dvIds = new Set(drawVendors.map((dv) => dv.id));

    const drawDocs = allDocs.filter((d) => dvIds.has(d.draw_vendor_id));
    const invoicesByDV = {};
    const condByInvoice = {};
    const condByDV = {};
    const uncondByCV = {};
    for (const d of drawDocs) {
      if (d.document_type === "invoice" || d.document_type === "receipt") {
        (invoicesByDV[d.draw_vendor_id] ||= []).push(d);
      } else if (d.document_type === "conditional_lien_release") {
        if (d.related_invoice_document_id) condByInvoice[d.related_invoice_document_id] = d;
        else condByDV[d.draw_vendor_id] = d;
      } else if (d.document_type === "unconditional_lien_release" && d.client_vendor_id) {
        uncondByCV[d.client_vendor_id] = d;
      }
    }

    const groups = {};
    const uncategorized = { name: "Uncategorized", sortOrder: 9999, lines: [] };
    const recipientTotals = { vendor: 0, jlm: 0, mike: 0, jose: 0 };
    let grandTotal = 0;

    const addLine = (catId, line) => {
      const amt = typeof line.amount === "number" && isFinite(line.amount) ? line.amount : null;
      line.validAmount = amt;
      line.categoryId = catId && catMap.has(catId) ? catId : null;
      line.categoryName = (catId && catMap.get(catId)?.name) || "Uncategorized";
      if (amt != null) {
        grandTotal += amt;
        const r = line.recipient || "vendor";
        recipientTotals[r] = (recipientTotals[r] || 0) + amt;
      }
      if (catId && catMap.has(catId)) {
        if (!groups[catId]) {
          const c = catMap.get(catId);
          groups[catId] = { name: c.name, sortOrder: c.sort_order || 0, lines: [] };
        }
        groups[catId].lines.push(line);
      } else {
        uncategorized.lines.push(line);
      }
    };

    drawVendors.forEach((dv) => {
      const vendor = vendorMap.get(dv.vendor_id);
      const recipient = dv.payment_recipient || "vendor";
      const cvId = cvByVendor.get(dv.vendor_id);
      const invoices = (invoicesByDV[dv.id] || [])
        .slice()
        .sort((a, b) => (a.invoice_date || "").localeCompare(b.invoice_date || ""));
      const vendorTotal = invoices.reduce((s, inv) => s + (inv.amount || 0), 0);
      const base = {
        drawVendorId: dv.id,
        vendorName: vendor?.name || "Unknown",
        recipient,
        clientVendorId: cvId,
        vendorTotal,
        scopeOfWork: dv.scope_of_work || "",
        notes: dv.notes || "",
      };
      if (invoices.length > 0) {
        invoices.forEach((inv, i) => {
          addLine(inv.budget_category_id || dv.budget_category_id, {
            ...base,
            id: inv.id,
            hasInvoice: true,
            invoice: inv,
            invoiceNumber: inv.invoice_number || "",
            invoiceDate: inv.invoice_date || "",
            amount: inv.amount,
            cond: condByInvoice[inv.id] || condByDV[dv.id],
            uncond: cvId ? uncondByCV[cvId] : undefined,
            docKind: inv.document_type === "receipt" ? "Receipt" : "Invoice",
            index: i,
          });
        });
      } else {
        addLine(dv.budget_category_id, {
          ...base,
          id: `noinv-${dv.id}`,
          hasInvoice: false,
          invoice: null,
          invoiceNumber: "",
          invoiceDate: "",
          amount: dv.amount,
          cond: null,
          uncond: cvId ? uncondByCV[cvId] : undefined,
        });
      }
    });

    const groupList = Object.values(groups).sort((a, b) => a.sortOrder - b.sortOrder);
    if (uncategorized.lines.length > 0) groupList.push(uncategorized);

    return { groupList, grandTotal, recipientTotals };
  }, [drawVendors, vendors, allDocs, budgetCategories, clientVendors]);

  const { groupList, grandTotal, recipientTotals } = derived;

  const categoryOptions = budgetCategories
    .filter((c) => c.status !== "archived")
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.name || "").localeCompare(b.name || ""));

  const updateRecipient = async (dvId, recipient) => {
    await base44.entities.DrawVendor.update(dvId, { payment_recipient: recipient });
    queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
  };

  const updateDVAmount = async (dvId, amount) => {
    await base44.entities.DrawVendor.update(dvId, { amount });
    queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
  };

  const updateLineCategory = async (line, categoryId) => {
    if (line.hasInvoice) {
      await base44.entities.Document.update(line.invoice.id, { budget_category_id: categoryId || "" });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } else {
      await base44.entities.DrawVendor.update(line.drawVendorId, { budget_category_id: categoryId || "" });
      queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
    }
  };

  const updateInvoiceAmount = async (docId, amount) => {
    await base44.entities.Document.update(docId, { amount });
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const budgetRef = useRef(null);
  const ensureBudget = async () => {
    if (budgetRef.current) return budgetRef.current;
    const budgets = await base44.entities.Budget.filter({ client_id: drawCycle.client_id });
    if (budgets.length > 0) { budgetRef.current = budgets[0].id; return budgets[0].id; }
    const b = await base44.entities.Budget.create({ client_id: drawCycle.client_id, name: "Draw Budget", budget_type: "internal", status: "active" });
    budgetRef.current = b.id;
    return b.id;
  };

  const resolveCategory = async (result, cache) => {
    if (!result) return null;
    if (result.id) return result.id;
    if (!result.name) return null;
    const key = result.name.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const existing = budgetCategories.find((c) => c.name && c.name.toLowerCase() === key);
    if (existing) { cache.set(key, existing.id); return existing.id; }
    const budgetId = await ensureBudget();
    const created = await base44.entities.BudgetCategory.create({
      budget_id: budgetId,
      client_id: drawCycle.client_id,
      name: result.name,
      sort_order: 0,
      status: "active",
    });
    cache.set(key, created.id);
    return created.id;
  };

  const resolveCategoryByName = async (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    const existing = budgetCategories.find((c) => c.name && c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;
    return resolveCategory({ name: trimmed }, new Map());
  };

  const updateLineCategoryByName = async (line, name) => {
    const catId = await resolveCategoryByName(name);
    await updateLineCategory(line, catId);
    queryClient.invalidateQueries({ queryKey: ["budgetCategories", drawCycle?.client_id] });
  };

  const categorizeInvoice = async (inv) => {
    if (!inv.file_url) return null;
    const cats = budgetCategories.filter((c) => c.status !== "archived");
    const list = cats.map((c) => `${c.id}: ${c.name}`).join("\n") || "(none yet)";
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are categorizing a construction loan draw invoice into a budget category. Read the attached invoice and determine the single best category.\n\nExisting categories (id: name):\n${list}\n\nReturn JSON: "category_id" = the id of the best existing match (or null if none fit), and "category_name" = a short 1-3 word category label (e.g. "Waterproofing", "Electrical", "Plumbing"). If an existing category fits, prefer its id.`,
      file_urls: [inv.file_url],
      response_json_schema: { type: "object", properties: { category_id: { type: ["string", "null"] }, category_name: { type: ["string", "null"] } } },
    });
    return { id: res?.category_id || null, name: (res?.category_name || "").trim() || null };
  };

  const suggestCategory = async (line) => {
    if (!line.invoice?.file_url) return;
    const cache = new Map();
    try {
      const result = await categorizeInvoice(line.invoice);
      const catId = await resolveCategory(result, cache);
      if (catId) {
        await base44.entities.Document.update(line.invoice.id, { budget_category_id: catId });
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        queryClient.invalidateQueries({ queryKey: ["budgetCategories", drawCycle?.client_id] });
        toast({ title: "Category assigned" });
      } else {
        toast({ variant: "destructive", title: "Could not determine category" });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Categorization failed", description: e.message });
    }
  };

  const autoCategorizeAll = async () => {
    const targets = [];
    groupList.forEach((g) => g.lines.forEach((line) => {
      if (line.hasInvoice && line.invoice.file_url && !line.invoice.budget_category_id) targets.push(line);
    }));
    if (targets.length === 0) {
      toast({ title: "Nothing to categorize", description: "All invoices already have a category." });
      return;
    }
    setCategorizing(true);
    const cache = new Map();
    let assigned = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const line = targets[i];
        setCatProgress(`${i + 1}/${targets.length}: ${line.vendorName}`);
        try {
          const result = await categorizeInvoice(line.invoice);
          const catId = await resolveCategory(result, cache);
          if (catId) {
            await base44.entities.Document.update(line.invoice.id, { budget_category_id: catId });
            assigned++;
          }
        } catch (e) { /* skip individual */ }
      }
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["budgetCategories", drawCycle?.client_id] });
      queryClient.invalidateQueries({ queryKey: ["budgets", drawCycle?.client_id] });
      toast({ title: "Categorization complete", description: `${assigned} of ${targets.length} invoice(s) categorized.` });
    } finally {
      setCategorizing(false);
      setCatProgress("");
    }
  };

  const openAddInvoice = (dvId) => {
    setAddInvoiceDVId(dvId);
    setAddInvoiceOpen(true);
  };

  const lineCount = groupList.reduce((s, g) => s + g.lines.length, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Draw Ledger</h2>
          <p className="text-sm text-slate-500">Invoices and amounts grouped by budget category</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={autoCategorizeAll} disabled={categorizing}>
            <Sparkles className="w-4 h-4 mr-1" />{categorizing ? (catProgress || "Categorizing...") : "Auto-Categorize"}
          </Button>
          <Button size="sm" onClick={() => setAddVendorOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />Add Vendor
          </Button>
        </div>
      </div>

      {lineCount === 0 ? (
        <div className="text-center py-10 text-slate-400 border border-dashed rounded-lg">
          <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          No line items for this draw yet.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-3 py-2.5 font-semibold">Vendor</th>
                  <th className="px-3 py-2.5 font-semibold">Category</th>
                  <th className="px-3 py-2.5 font-semibold">Invoice #</th>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Amount</th>
                  <th className="px-3 py-2.5 font-semibold">Payment To</th>
                  <th className="px-3 py-2.5 font-semibold">Documents / Status</th>
                </tr>
              </thead>
              <tbody>
                {groupList.map((group) => {
                  const subtotal = group.lines.reduce((s, l) => s + (l.validAmount || 0), 0);
                  const needsReview = group.lines.some((l) => l.validAmount == null);
                  return (
                    <React.Fragment key={group.name}>
                      <tr className="bg-slate-100/70 border-b">
                        <td colSpan={7} className="px-3 py-2">
                          <div className="flex items-center justify-end">
                            {needsReview && <span className="mr-3 text-xs text-amber-600 font-medium">Amount needs review</span>}
                            <span className="text-xs text-slate-500">
                              Category Total: <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                            </span>
                          </div>
                        </td>
                      </tr>
                      {group.lines.map((line) => (
                        <tr key={line.id} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-medium text-slate-900 align-top">
                            <div>{line.vendorName}</div>
                            {(!line.hasInvoice || line.index === 0) && (
                              <>
                                {line.scopeOfWork && (
                                  <div className="mt-1 max-w-[240px] text-xs font-normal whitespace-pre-line text-slate-500">
                                    {line.scopeOfWork}
                                  </div>
                                )}
                                {line.notes && (
                                  <div className="mt-1 max-w-[240px] text-xs font-normal italic whitespace-pre-line text-slate-400">
                                    {line.notes}
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 align-top">
                            <EditableCategory
                              categoryId={line.categoryId}
                              categoryName={line.categoryName}
                              categories={categoryOptions}
                              onSave={(name) => updateLineCategoryByName(line, name)}
                            />
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            {line.hasInvoice ? (
                              <a
                                href={line.invoice.file_url || "#"}
                                target={line.invoice.file_url ? "_blank" : undefined}
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 ${line.invoice.file_url ? "text-blue-600 hover:underline" : "text-slate-400"}`}
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                {line.invoiceNumber ? `${line.docKind} ${line.invoiceNumber}` : `${line.docKind} ${line.index + 1}`}
                              </a>
                            ) : (
                              <span className="text-slate-400">No Invoice</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 align-top">{line.invoiceDate ? formatDate(line.invoiceDate) : "—"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900 align-top">
                            {line.validAmount == null && line.hasInvoice ? (
                              <EditableAmount
                                amount={line.invoice.amount || 0}
                                onSave={(v) => updateInvoiceAmount(line.invoice.id, v)}
                                className="justify-end"
                              />
                            ) : line.validAmount == null ? (
                              <span className="text-amber-600 text-xs font-medium">Amount Needs Review</span>
                            ) : line.hasInvoice ? (
                              <EditableAmount
                                amount={line.validAmount}
                                onSave={(v) => updateInvoiceAmount(line.invoice.id, v)}
                                className="justify-end"
                              />
                            ) : (
                              <EditableAmount
                                amount={line.validAmount || 0}
                                onSave={(v) => updateDVAmount(line.drawVendorId, v)}
                                className="justify-end"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <Select value={line.recipient} onValueChange={(v) => updateRecipient(line.drawVendorId, v)}>
                              <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {RECIPIENTS.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <DocStatusButton line={line} projectName={drawCycle?.project_name} onAddInvoice={openAddInvoice} onSuggestCategory={suggestCategory} />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-slate-100 font-semibold">
                  <td className="px-3 py-3 text-slate-900" colSpan={4}>Grand Total</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-900">{formatCurrency(grandTotal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryCard label="Vendor Payments" value={recipientTotals.vendor} />
            <SummaryCard label="Mike Reimbursements" value={recipientTotals.mike} />
            <SummaryCard label="Jose Reimbursements" value={recipientTotals.jose} />
            <SummaryCard label="JLM" value={recipientTotals.jlm} />
            <SummaryCard label="Grand Total" value={grandTotal} strong />
          </div>
        </>
      )}

      <AddVendorDialog open={addVendorOpen} onOpenChange={setAddVendorOpen} drawId={drawId} clientId={drawCycle?.client_id} />
      <AddInvoiceDialog open={addInvoiceOpen} onOpenChange={setAddInvoiceOpen} drawVendorId={addInvoiceDVId} drawId={drawId} />
    </div>
  );
}

function SummaryCard({ label, value, strong }) {
  return (
    <div className={`border rounded-lg p-3 ${strong ? "bg-slate-900 border-slate-900" : "bg-white"}`}>
      <div className={`text-xs ${strong ? "text-slate-300" : "text-slate-500"}`}>{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${strong ? "text-white" : "text-slate-900"}`}>
        {formatCurrency(value || 0)}
      </div>
    </div>
  );
}