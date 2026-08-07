import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VENDOR_TYPES = ["general_contractor", "subcontractor", "supplier", "consultant", "other"];
const EMPTY = { name: "", vendor_type: "other", contact_name: "", email: "", phone: "", address: "", tax_id: "", status: "active", notes: "", client_id: "" };

function VendorNameCombobox({ value, onChange, onSelectVendor }) {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const { data: allVendors = [] } = useQuery({
    queryKey: ["vendors", "all"],
    queryFn: () => base44.entities.Vendor.list("-name"),
  });

  // Dedupe vendor names
  const uniqueNames = [...new Set(allVendors.map(v => v.name))].sort();
  const filtered = search.length > 0
    ? uniqueNames.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : uniqueNames;

  useEffect(() => { setSearch(value || ""); }, [value]);

  const handleSelect = (name) => {
    const match = allVendors.find(v => v.name === name);
    setSearch(name);
    onChange(name);
    if (match) onSelectVendor(match);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    setSearch(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={search}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type or select a vendor..."
        required
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(name => (
            <button
              key={name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={() => handleSelect(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorFormDialog({ open, onOpenChange, vendor, clientId }) {
  const isEdit = !!vendor;
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date"),
    enabled: !clientId,
  });

  useEffect(() => {
    setForm(vendor ? { ...EMPTY, ...vendor } : EMPTY);
  }, [vendor, open]);

  const handleSelectVendor = (v) => {
    // Auto-fill fields from the selected master vendor
    setForm(prev => ({
      ...prev,
      name: v.name,
      vendor_type: v.vendor_type || prev.vendor_type,
      contact_name: v.contact_name || prev.contact_name,
      email: v.email || prev.email,
      phone: v.phone || prev.phone,
      address: v.address || prev.address,
      tax_id: v.tax_id || prev.tax_id,
      notes: v.notes || prev.notes,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await base44.entities.Vendor.update(vendor.id, form);
      } else {
        const effectiveClientId = clientId || form.client_id;
        const created = await base44.entities.Vendor.create({ ...form, client_id: effectiveClientId || null });
        if (effectiveClientId) {
          await base44.entities.ClientVendor.create({ client_id: effectiveClientId, vendor_id: created.id, status: "active" });
          queryClient.invalidateQueries({ queryKey: ["clientVendors", effectiveClientId] });
          queryClient.invalidateQueries({ queryKey: ["clientVendors", "all"] });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Vendor" : "New Vendor"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!clientId && (
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor Name</Label>
              <VendorNameCombobox
                value={form.name}
                onChange={(name) => setForm({ ...form, name })}
                onSelectVendor={handleSelectVendor}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.vendor_type} onValueChange={(v) => setForm({ ...form, vendor_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Contact Name</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tax ID</Label>
              <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}