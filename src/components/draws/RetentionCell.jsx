import React, { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/format";
import { DEFAULT_RETENTION_RATE, invoiceRetention, retentionPatch } from "@/lib/retention";

export default function RetentionCell({ invoice, onSave, defaultRate = DEFAULT_RETENTION_RATE }) {
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

  const toggleSubject = (checked) => {
    if (checked) apply(defaultRate);
    else clear();
  };

  const togglePaidOutside = (checked) => {
    if (checked) {
      onSave({ ...retentionPatch(r.gross, 0), paid_outside_draw: true });
    } else {
      onSave({ ...retentionPatch(r.gross, invoice.retention_rate ?? defaultRate), paid_outside_draw: false });
    }
    setOpen(false);
  };

  return (
    <div className="mt-1 flex items-center justify-end gap-1.5">
      {r.tracked ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="rounded px-1 text-xs tabular-nums text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              title="Retention — click to adjust the rate"
            >
              {r.retained > 0 ? `−${formatCurrency(r.retained)} · ${formatCurrency(r.net)}` : formatCurrency(r.net)}
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
                <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => apply(DEFAULT_RETENTION_RATE)}>
                  {DEFAULT_RETENTION_RATE}%
                </Button>
                <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => apply(10)}>10%</Button>
                <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={clear}>None</Button>
              </div>

              <label className="flex items-center justify-between gap-2 border-t pt-2 cursor-pointer">
                <span className="text-xs text-slate-700">Paid outside the draw — no retention</span>
                <Switch checked={!!invoice.paid_outside_draw} onCheckedChange={togglePaidOutside} />
              </label>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <span className="text-xs text-slate-400">Retention</span>
      )}
      <Checkbox
        checked={r.tracked}
        onCheckedChange={toggleSubject}
        aria-label="Subject to retention"
        title={`Subject to retention (${defaultRate}%)`}
        className="h-4 w-4 border-slate-300"
      />
    </div>
  );
}