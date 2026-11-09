import React, { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/format";
import { invoiceRetention, retentionPatch } from "@/lib/retention";

export default function RetentionCell({ invoice, onSave }) {
  const r = invoiceRetention(invoice);
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(r.rate == null ? "" : String(r.rate));

  useEffect(() => {
    setRate(r.rate == null ? "" : String(r.rate));
  }, [r.rate, invoice.id]);

  const apply = (value) => {
    const num = Number(value);
    onSave({ ...retentionPatch(r.gross, isFinite(num) ? num : 0), paid_outside_draw: false });
    setOpen(false);
  };

  const clear = () => {
    onSave({
      retention_rate: null,
      retention_amount: null,
      net_paid_amount: null,
      paid_outside_draw: false,
    });
    setOpen(false);
  };

  const togglePaidOutside = (checked) => {
    if (checked) {
      onSave({ ...retentionPatch(r.gross, 0), paid_outside_draw: true });
    } else {
      onSave({ ...retentionPatch(r.gross, invoice.retention_rate ?? 10), paid_outside_draw: false });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`mt-1 ml-auto block w-fit rounded px-1 text-xs transition hover:bg-slate-100 ${
            r.tracked ? "text-slate-500" : "text-blue-600"
          }`}
        >
          {r.tracked
            ? r.retained > 0
              ? `−${formatCurrency(r.retained)} held · Net ${formatCurrency(r.net)}`
              : `No retention · ${formatCurrency(r.net)}`
            : "Add retention"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retention</div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice total</span>
              <span className="tabular-nums text-slate-900">{formatCurrency(r.gross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Retention withheld</span>
              <span className="tabular-nums text-slate-900">−{formatCurrency(r.retained)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium">
              <span className="text-slate-600">Net paid</span>
              <span className="tabular-nums text-slate-900">{formatCurrency(r.net)}</span>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Rate %</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    apply(rate);
                  }
                }}
                className="h-8 text-right"
              />
            </div>
            <Button size="sm" className="h-8" onClick={() => apply(rate)}>Apply</Button>
          </div>

          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => apply(10)}>10%</Button>
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => apply(5)}>5%</Button>
            <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={clear}>None</Button>
          </div>

          <label className="flex items-center justify-between gap-2 border-t pt-2 cursor-pointer">
            <span className="text-xs text-slate-700">Paid outside the draw — no retention</span>
            <Switch checked={!!invoice.paid_outside_draw} onCheckedChange={togglePaidOutside} />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}