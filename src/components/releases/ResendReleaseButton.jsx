import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ResendReleaseButton({ log }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke("sendReleaseEmail", {
        document_id: log.document_id,
        mode: "send",
        resend: true,
        resend_of: log.id,
      });
      const data = res.data || {};
      if (data.ok) {
        toast({
          title: "Release re-sent",
          description: (data.recipients || []).join(", ") || "Email delivered to Outlook.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Could not resend",
          description: data.error || data.reason || "Try again.",
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Could not resend", description: e.message });
    } finally {
      setSending(false);
      queryClient.invalidateQueries({ queryKey: ["releaseEmailLogs"] });
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={resend} disabled={sending} className="mt-1 h-7 px-2 text-xs">
      {sending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
      {sending ? "Sending..." : "Resend"}
    </Button>
  );
}