export const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "co_owner", label: "Co-owner" },
  { value: "owner_attorney", label: "Owner attorney" },
  { value: "lender", label: "Lender" },
  { value: "architect", label: "Architect" },
  { value: "other", label: "Other" },
];

export function roleLabel(value) {
  return ROLE_OPTIONS.find((r) => r.value === value)?.label || "Other";
}