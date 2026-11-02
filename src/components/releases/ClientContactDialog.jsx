import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ROLE_OPTIONS } from "./contactRoles";

const EMPTY = {
  name: "",
  role: "other",
  email: "",
  phone: "",
  receives_releases: true,
  active: true,
  source: "",
  notes: "",
};

export default function ClientContactDialog({ open, onOpenChange, clientId, contact }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      contact
        ? {
            name: contact.name || "",
            role: contact.role || "other",
            email: contact.email || "",
            phone: contact.phone || "",
            receives_releases: contact.receives_releases !== false,
            active: contact.active !== false,
            source: contact.source || "",
            notes: contact.notes || "",
          }
        : EMPTY
    );
  }, [open, contact?.id]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, client_id: clientId, email: form.email.trim() };
      if (contact) {
        await base44.entities.ClientContact.update(contact.id, payload);
      } else {
        await base44.entities.ClientContact.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ["clientContacts", clientId] });
      onOpenChange(false);
    } catch (e) {
      setError(e.message || "Could not save contact");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit release contact" : "Add release contact"}</DialogTitle>
          <DialogDescription>
            Contacts marked to receive releases are emailed every conditional and unconditional waiver for this client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 555-5555" />
            </div>
          </div>

          <div>
            <Label>Source</Label>
            <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Contract notices clause" />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>

          <div className="flex flex-col gap-2 border rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Receives releases</div>
                <div className="text-xs text-slate-500">Include this contact on waiver and release emails</div>
              </div>
              <Switch checked={form.receives_releases} onCheckedChange={(v) => set("receives_releases", v)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Active</div>
                <div className="text-xs text-slate-500">Inactive contacts are never emailed</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}