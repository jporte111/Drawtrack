import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ExternalLink, Pencil, ArrowLeft, Plus } from "lucide-react";
import BudgetMatrix from "@/components/budget/BudgetMatrix";
import BudgetFormDialog from "@/components/budget/BudgetFormDialog";

export default function Budget() {
  const { clientId } = useParams();
  const queryClient = useQueryClient();
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [linkEditing, setLinkEditing] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => base44.entities.Client.get(clientId),
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", clientId],
    queryFn: () => base44.entities.Budget.filter({ client_id: clientId }),
  });

  // Auto-select first budget once loaded
  React.useEffect(() => {
    if (!selectedBudgetId && budgets.length > 0) setSelectedBudgetId(budgets[0].id);
  }, [budgets, selectedBudgetId]);

  const rawBudgetUrl = client?.budget_url;
  const budgetUrl = rawBudgetUrl && /^https?:\/\//i.test(rawBudgetUrl) ? rawBudgetUrl : null;
  const selectedBudget = budgets.find((b) => b.id === selectedBudgetId);

  const startLinkEdit = () => { setUrlInput(budgetUrl || ""); setLinkEditing(true); };

  const handleSaveLink = async (e) => {
    e.preventDefault();
    setSavingLink(true);
    try {
      await base44.entities.Client.update(clientId, { budget_url: urlInput.trim() });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setLinkEditing(false);
    } finally {
      setSavingLink(false);
    }
  };

  const openEditBudget = () => { setEditingBudget(selectedBudget || null); setBudgetDialogOpen(true); };
  const openNewBudget = () => { setEditingBudget(null); setBudgetDialogOpen(true); };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link to={`/clients/${clientId}/draws`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-4 h-4" />Back to Draws
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Budget
          </h1>
          <p className="text-sm text-slate-500">{client?.name || "Loading..."} — operational budget</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {budgets.length > 0 && (
            <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Select budget" /></SelectTrigger>
              <SelectContent>
                {budgets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name} <span className="text-xs text-slate-400 capitalize">({b.budget_type})</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={openNewBudget}><Plus className="w-3.5 h-3.5 mr-1" />New Budget</Button>
          {selectedBudget && (
            <Button variant="outline" size="sm" onClick={openEditBudget}><Pencil className="w-3.5 h-3.5 mr-1" />Edit Budget</Button>
          )}
        </div>
      </div>

      {/* Reference link to original Dropbox budget */}
      <div className="flex items-center justify-between gap-3 bg-slate-50 border rounded-xl px-4 py-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 shrink-0">Reference:</span>
          {budgetUrl ? (
            <a href={budgetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline truncate">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />Open Original (Dropbox)
            </a>
          ) : (
            <span className="text-slate-400">No external budget link set</span>
          )}
          {selectedBudget?.source_url && (
            <a href={selectedBudget.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline truncate ml-2">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />{selectedBudget.budget_type} source
            </a>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={startLinkEdit}><Pencil className="w-3.5 h-3.5 mr-1" />{budgetUrl ? "Update Link" : "Set Link"}</Button>
      </div>

      {linkEditing && (
        <form onSubmit={handleSaveLink} className="mb-4 bg-white border rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>External Budget URL (Dropbox share link, kept as reference only)</Label>
            <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://www.dropbox.com/..." />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={savingLink}>{savingLink ? "Saving..." : "Save"}</Button>
            <Button type="button" variant="outline" onClick={() => setLinkEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border border-dashed rounded-xl">
          <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="mb-1">No budgets yet.</p>
          <p className="text-sm mb-4">Create a budget to start tracking categories and draws.</p>
          <Button onClick={openNewBudget} size="sm"><Plus className="w-4 h-4 mr-1" />New Budget</Button>
        </div>
      ) : (
        <BudgetMatrix clientId={clientId} budgetId={selectedBudgetId} budgetSourceUrl={selectedBudget?.source_url} />
      )}

      <BudgetFormDialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen} clientId={clientId} budget={editingBudget} />
    </div>
  );
}