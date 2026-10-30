import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LienFormFields({ values, onChange, showCheckDetails }) {
  const set = (key) => (e) => onChange({ ...values, [key]: e.target.value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Customer">
        <Input value={values.customer} onChange={set("customer")} placeholder="Party who contracted the work" />
      </Field>
      <Field label="Owner">
        <Input value={values.owner} onChange={set("owner")} />
      </Field>
      <Field label="Job Location" className="sm:col-span-2">
        <Input value={values.location} onChange={set("location")} placeholder="Project address" />
      </Field>
      <Field label="Through Date">
        <Input type="date" value={values.throughDate} onChange={set("throughDate")} />
      </Field>
      <Field label="Amount of Check">
        <Input type="number" step="0.01" value={values.amount} onChange={set("amount")} />
      </Field>
      {showCheckDetails && (
        <>
          <Field label="Maker of Check">
            <Input value={values.maker} onChange={set("maker")} placeholder="Lender / bank" />
          </Field>
          <Field label="Check Payable To">
            <Input value={values.payable} onChange={set("payable")} />
          </Field>
        </>
      )}
    </div>
  );
}

function Field({ label, className = "", children }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}