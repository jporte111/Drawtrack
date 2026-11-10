import { base44 } from "@/api/base44Client";

// Two category names count as the same category when they differ only by
// capitalization, spacing or punctuation ("Hardscape " vs "hardscape").
export const normCategoryName = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

// One row per category name: duplicate category records collapse onto the first kept one.
// `idToKept` maps every duplicate id to the record kept on screen, so amounts land in one row.
export function dedupeCategories(categories = []) {
  const seen = new Map();
  const idToKept = new Map();
  const kept = [];
  for (const c of categories) {
    const key = normCategoryName(c.name) || c.id;
    const dup = seen.get(key);
    if (dup) {
      idToKept.set(c.id, dup);
      continue;
    }
    seen.set(key, c);
    idToKept.set(c.id, c);
    kept.push(c);
  }
  return { categories: kept, idToKept };
}

// A project's authoritative budget is its most recently modified active budget.
export async function getAuthoritativeBudget(clientId) {
  if (!clientId) return null;
  const budgets = await base44.entities.Budget.filter({ client_id: clientId });
  const active = budgets.filter((b) => b.status !== "archived");
  const pool = active.length > 0 ? active : budgets;
  if (pool.length === 0) return null;
  return pool
    .slice()
    .sort((a, b) =>
      String(b.updated_date || b.created_date || "").localeCompare(
        String(a.updated_date || a.created_date || ""),
      ),
    )[0];
}

// The single list of budget categories every screen in a project must use.
export async function loadProjectCategories(clientId) {
  const budget = await getAuthoritativeBudget(clientId);
  if (!budget) return { budget: null, categories: [] };
  const categories = await base44.entities.BudgetCategory.filter({ budget_id: budget.id });
  return { budget, categories: categories.filter((c) => c.status !== "archived") };
}

// Reuse the project's existing category instead of creating a duplicate.
// The check runs against the server as well, so two quick saves cannot both create one.
export async function findOrCreateCategory({ clientId, projectName, name, budget, categories = [] }) {
  const key = normCategoryName(name);
  if (!key) return null;

  const local = categories.find((c) => normCategoryName(c.name) === key);
  if (local) return local;

  const server = await base44.entities.BudgetCategory.filter({ client_id: clientId });
  const existing = server.find((c) => normCategoryName(c.name) === key && c.status !== "archived");
  if (existing) return existing;

  let budgetId = budget?.id;
  if (!budgetId) {
    const budgets = await base44.entities.Budget.filter({ client_id: clientId });
    const active = budgets.find((b) => b.status !== "archived");
    budgetId = active
      ? active.id
      : (await base44.entities.Budget.create({
          client_id: clientId,
          name: `${projectName || "Project"} Budget`,
          budget_type: "internal",
        })).id;
  }

  return await base44.entities.BudgetCategory.create({
    budget_id: budgetId,
    client_id: clientId,
    name: String(name).trim(),
    sort_order: categories.length,
  });
}