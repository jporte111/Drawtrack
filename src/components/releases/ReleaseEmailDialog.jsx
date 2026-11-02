import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Mail, Paperclip, Send } from "lucide-react";

const REASON_TEXT = {
  no_release_contacts: "No active release contacts for this client. Add them under Release contacts.",
  release_file_missing: "This release has no PDF yet. Generate or upload it first.",
  not_a_release: "This document is not a lien waiver or release.",
  already_sent: "This release was already emailed. Use Resend to send it again.",
  send_failed: "The email could not be sent.",
};

function formatWhen(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ReleaseEmailDialog({ open, onOpenChange, documentId, onSent }) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);

  const { data: sentLogs = [] } = useQuery({
    queryKey: ["releaseEmailLogs", "document", documentId],
    queryFn: () => base44.entities.ReleaseEmailLog.filter({ document_id: documentId, status: "sent" }, { sort: "-sent_at", limit: 5 }),
    enabled: !!documentId,
    select: (result) => (Array.isArray(result) ? result : result.items || []),
  });
  const lastSent = sentLogs[0] || null;

  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    setPreview(null);
    setSent(null);
    setError(null);
    setLoading(true);
    base44.functions.invoke("sendReleaseEmail", { document_id: documentId, mode: "preview" })
      .then((res) => {
        if (cancelled) return;
        const data = res.data || {};
        if (data.ok) setPreview(data);
        else setError(REASON_TEXT[data.reason] || data.error || "Could not load the email preview.");
      })
      .catch((e) => { if (!cancelled) setError(e.message || "Could not load the email preview."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, documentId]);

  const handleSend = async (isResend) => {
    setSending(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("sendReleaseEmail", {
        document_id: documentId,
        mode: "send",
        resend: !!isResend,
        resend_of: isResend ? lastSent?.id : undefined,
      });
      const data = res.data || {};
      queryClient.invalidateQueries({ queryKey: ["releaseEmailLogs"] });
      if (data.ok) {
        setSent(data);
        onSent?.();
      } else {
        const base = REASON_TEXT[data.reason] || "The email was not sent.";
        setError(data.error ? `${base} ${data.error}` : base);
      }
    } catch (e) {
      setError(e.message || "The email was not sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" />Email release</DialogTitle>
          <DialogDescription>
            Review the waiver and release email before sending it to this client's release contacts.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Building preview...
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="flex items-start gap-2 border border-red-200 bg-red-50 text-red-700 rounded-lg p-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {sent && (
              <div className="flex items-start gap-2 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg p-3 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Release emailed</div>
                  <div className="text-xs">Sent to {(sent.recipients || []).join(", ")} on {formatWhen(sent.sent_at)}</div>
                </div>
              </div>
            )}

            {preview && (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-12 shrink-0">To</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(preview.recipients || []).map((email) => (
                        <span key={email} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">{email}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-12 shrink-0">CC</span>
                    <span className="text-slate-700 text-xs">{(preview.cc || []).join(", ")}</span>
                  </div>
                  {preview.sender && (
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-12 shrink-0">From</span>
                      <span className="text-slate-700 text-xs">{preview.sender}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-12 shrink-0">Subject</span>
                    <span className="font-medium text-slate-900">{preview.subject}</span>
                  </div>
                </div>

                <div className="border rounded-lg bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {preview.body}
                </div>

                <div className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{preview.attachment_name}</span>
                  </div>
                  {preview.attachment_url && (
                    <a href={preview.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 shrink-0">
                      <ExternalLink className="w-3 h-3" /> View PDF
                    </a>
                  )}
                </div>

                {(sent || lastSent) && (
                  <p className="text-xs text-slate-500">
                    Last sent {formatWhen(sent?.sent_at || lastSent?.sent_at)}
                    {lastSent?.recipients ? ` to ${lastSent.recipients}` : ""}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => handleSend(!!lastSent)} disabled={sending || !preview}>
            {sending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-1" />{lastSent ? "Resend" : "Send"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}