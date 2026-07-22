export const statusConfig = {
  // Draw Cycle
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  submitted: { label: "Submitted", className: "bg-indigo-100 text-indigo-700" },
  under_review: { label: "Under Review", className: "bg-amber-100 text-amber-700" },
  funded: { label: "Funded", className: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Closed", className: "bg-slate-200 text-slate-500" },
  // Vendor
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  inactive: { label: "Inactive", className: "bg-slate-100 text-slate-500" },
  // Draw Vendor
  pending: { label: "Pending", className: "bg-slate-100 text-slate-600" },
  documents_requested: { label: "Docs Requested", className: "bg-blue-100 text-blue-700" },
  documents_received: { label: "Docs Received", className: "bg-amber-100 text-amber-700" },
  complete: { label: "Complete", className: "bg-emerald-100 text-emerald-700" },
  // Document
  missing: { label: "Missing", className: "bg-red-100 text-red-700" },
  pending_signature: { label: "Pending Signature", className: "bg-amber-100 text-amber-700" },
  needs_correction: { label: "Needs Correction", className: "bg-orange-100 text-orange-700" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  na: { label: "N/A", className: "bg-slate-200 text-slate-500" },
  // Open Item
  open: { label: "Open", className: "bg-red-100 text-red-700" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-700" },
  // Voucher
  approved_voucher: { label: "Approved", className: "bg-indigo-100 text-indigo-700" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700" },
  void: { label: "Void", className: "bg-slate-200 text-slate-500" },
};

export const priorityConfig = {
  low: { label: "Low", className: "bg-slate-100 text-slate-600" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-700" },
  high: { label: "High", className: "bg-amber-100 text-amber-700" },
  critical: { label: "Critical", className: "bg-red-100 text-red-700" },
};

export const openItemDocTypeConfig = {
  invoice: { label: "Invoice", className: "bg-red-100 text-red-700", borderClass: "border-l-red-500" },
  conditional_lien_release: { label: "Cond. Release", className: "bg-amber-100 text-amber-700", borderClass: "border-l-amber-500" },
  unconditional_lien_release: { label: "Uncond. Release", className: "bg-purple-100 text-purple-700", borderClass: "border-l-purple-500" },
};

export const vendorTypeConfig = {
  general_contractor: "General Contractor",
  subcontractor: "Subcontractor",
  supplier: "Supplier",
  consultant: "Consultant",
  other: "Other",
};