import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { collectEmails, formatMoney, graphRequest, toBase64 } from "../../shared/outlookMail.ts";

import { LOGO_URL } from "../../shared/emailBrand.ts";
// Always copied on every release email.
const CC_EMAILS = ["jose@jlmdevelopmentinc.com", "christina@namasteresources.com"];
// Single configurable sender. Leave blank to send from the connected Outlook mailbox.
const SENDER_OVERRIDE = "";
const RELEASE_TYPES = ["conditional_lien_release", "unconditional_lien_release"];

async function getRecord(base44, entityName, id) {
  if (!id) return null;
  try {
    return await base44.entities[entityName].get(id);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

function asList(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return result.items || [];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { document_id, mode = "preview", extra_recipients = [], resend = false, resend_of } = body;
    if (!document_id) return Response.json({ error: "document_id is required" }, { status: 400 });
    if (mode !== "preview" && mode !== "send") {
      return Response.json({ error: 'mode must be "preview" or "send"' }, { status: 400 });
    }

    const doc = await getRecord(base44, "Document", document_id);
    if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });
    if (!RELEASE_TYPES.includes(doc.document_type)) {
      return Response.json({ ok: false, reason: "not_a_release" });
    }

    // Resolve the chain: Document -> DrawVendor -> DrawCycle -> Client
    const drawVendor = await getRecord(base44, "DrawVendor", doc.draw_vendor_id);
    const clientVendor = drawVendor ? null : await getRecord(base44, "ClientVendor", doc.client_vendor_id);
    const vendorId = drawVendor?.vendor_id || clientVendor?.vendor_id;
    let drawCycle = await getRecord(base44, "DrawCycle", drawVendor?.draw_cycle_id);
    let clientId = drawCycle?.client_id || clientVendor?.client_id;

    if (!drawCycle && clientId) {
      const pages = await base44.entities.DrawCycle.filter({ client_id: clientId }, { sort: "-created_date", limit: 1 });
      drawCycle = asList(pages)[0] || null;
    }
    if (!clientId && drawCycle?.client_id) clientId = drawCycle.client_id;

    const client = await getRecord(base44, "Client", clientId);
    const vendor = await getRecord(base44, "Vendor", vendorId);
    const invoice = await getRecord(base44, "Document", doc.related_invoice_document_id);

    const clientName = client?.name || "Client";
    const vendorName = vendor?.name || "Vendor";
    const drawCycleName = drawCycle?.name || drawCycle?.project_name || "";
    const projectAddress = client?.address || "";
    const invoiceNumber = invoice?.invoice_number || doc.invoice_number || "";
    const invoiceAmount = invoice?.amount != null ? invoice.amount : doc.amount;
    const retentionAmount = invoice?.retention_amount != null ? invoice.retention_amount : 0;
    const netPaid =
      invoice?.net_paid_amount != null
        ? invoice.net_paid_amount
        : invoiceAmount != null
          ? invoiceAmount - retentionAmount
          : null;
    const releaseKind = doc.document_type === "conditional_lien_release" ? "Conditional" : "Unconditional";

    // Recipients
    const contacts = clientId
      ? asList(await base44.entities.ClientContact.filter({ client_id: clientId, active: true, receives_releases: true }))
      : [];
    const recipients = collectEmails(
      [
        ...contacts.map((c) => c.email),
        ...(Array.isArray(extra_recipients) ? extra_recipients : []),
      ],
      { exclude: CC_EMAILS },
    );

    if (recipients.length === 0) {
      return Response.json({ ok: false, reason: "no_release_contacts", client_name: clientName });
    }
    if (!doc.file_url) {
      return Response.json({ ok: false, reason: "release_file_missing", client_name: clientName });
    }

    const subject = `${clientName} - ${releaseKind} Waiver and Release - ${vendorName}${invoiceNumber ? ` - Invoice ${invoiceNumber}` : ""}`;

    const attachmentName = `${releaseKind}_Waiver_and_Release_${vendorName.replace(/[^A-Za-z0-9]+/g, "_")}.pdf`;

    // Greet the person receiving the release by first name when we know who they are.
    const primaryContact = contacts.find(
      (c) => String(c.email || "").trim().toLowerCase() === String(recipients[0] || "").trim().toLowerCase(),
    );
    const greetingName = primaryContact?.name ? String(primaryContact.name).trim().split(/\s+/)[0] : "";
    const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";

    const intro =
      `Attached is the ${releaseKind.toLowerCase()} waiver and release for ${vendorName}` +
      (drawCycleName ? ` for the draw cycle ${drawCycleName}.` : ".");
    const amountLine =
      netPaid != null
        ? `The net amount paid is ${formatMoney(netPaid)}` +
          (retentionAmount > 0 && invoiceAmount != null
            ? `, after ${formatMoney(retentionAmount)} retention was withheld from ${formatMoney(invoiceAmount)}.`
            : ".")
        : "";

    const projectLine = `${clientName}${
      drawCycle?.project_name && drawCycle.project_name !== clientName ? ` - ${drawCycle.project_name}` : ""
    }`;
    const detailRows = [
      ["Vendor", vendorName],
      ["Invoice number", invoiceNumber],
      ["Invoice total", invoiceAmount != null ? formatMoney(invoiceAmount) : ""],
      ["Retention withheld", retentionAmount > 0 ? formatMoney(retentionAmount) : ""],
      ["Net amount paid", netPaid != null ? formatMoney(netPaid) : ""],
      ["Project", projectLine],
      ["Project address", projectAddress],
      ["Draw cycle", drawCycleName],
    ].filter((row) => row[1]);

    const esc = (value) =>
      String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const detailsHtml = detailRows.length
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;overflow:hidden;">${detailRows
          .map(
            ([label, value], index) =>
              `<tr${index === 0 ? ' style="background:#f8fafc;"' : ""}><td width="42%" style="padding:9px 12px;border-bottom:1px solid #eef2f7;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${esc(
                label,
              )}</td><td style="padding:9px 12px;border-bottom:1px solid #eef2f7;font-size:13px;font-weight:bold;color:#0f172a;">${esc(
                value,
              )}</td></tr>`,
          )
          .join("")}</table>`
      : "";

    const html = `<div style="background:#f8fafc;padding:24px;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;">
    <tr>
      <td style="padding:24px;border-bottom:1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:14px;vertical-align:middle;white-space:nowrap;"><img src="${LOGO_URL}" alt="JLM Development Inc." height="44" style="height:44px;width:auto;display:block;border:0;" /></td>
          <td style="vertical-align:middle;">
            <div style="font-size:18px;font-weight:bold;color:#0f172a;">JLM Development Inc.</div>
            <div style="font-size:13px;color:#64748b;margin-top:2px;">${releaseKind} Waiver and Release</div>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">
        <p style="margin:0 0 12px;">${esc(greeting)}</p>
        <p style="margin:0 0 12px;">${esc(intro)}</p>
        ${amountLine ? `<p style="margin:0;">${esc(amountLine)}</p>` : ""}
        ${detailsHtml}
        <p style="margin:18px 0 0;">Please review, sign, and return the release at your earliest convenience.</p>
        <p style="margin:18px 0 0;">Thank you,<br />JLM Development Inc.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;">Attached: ${esc(attachmentName)}</td>
    </tr>
  </table>
</div>`;

    const bodyLines = [
      greeting,
      "",
      intro,
      ...(amountLine ? ["", amountLine] : []),
      "",
      ...detailRows.map(([label, value]) => `${label}: ${value}`),
      "",
      "Please review, sign, and return the release at your earliest convenience.",
      "",
      "Thank you,",
      "JLM Development Inc.",
    ];
    const emailBody = bodyLines.join("\n");
    const cc = [...CC_EMAILS];

    // Sender = SENDER_OVERRIDE when set, otherwise the connected mailbox
    let sender = SENDER_OVERRIDE;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection("outlook");
      const me = await graphRequest(accessToken, "/me?$select=mail,userPrincipalName,displayName");
      if (!sender) sender = me?.mail || me?.userPrincipalName || "";
    } catch (e) {
      sender = SENDER_OVERRIDE;
    }

    const preview = {
      ok: true,
      recipients,
      cc,
      subject,
      body: emailBody,
      html,
      attachment_name: attachmentName,
      attachment_url: doc.file_url,
      sender,
      client_id: clientId,
      client_name: clientName,
      vendor_name: vendorName,
      invoice_number: invoiceNumber,
      invoice_amount: invoiceAmount,
      draw_cycle_name: drawCycleName,
    };

    if (mode === "preview") {
      return Response.json(preview);
    }

    // Duplicate guard
    const sentLogs = asList(await base44.entities.ReleaseEmailLog.filter({ document_id, status: "sent" }))
      .sort((a, b) => String(b.sent_at || "").localeCompare(String(a.sent_at || "")));
    if (sentLogs.length > 0 && !resend) {
      await base44.entities.ReleaseEmailLog.create({
        client_id: clientId,
        client_name: clientName,
        document_id,
        document_type: doc.document_type,
        draw_cycle_name: drawCycleName,
        vendor_name: vendorName,
        invoice_number: invoiceNumber,
        invoice_amount: invoiceAmount,
        recipients: recipients.join(", "),
        cc_recipients: cc.join(", "),
        subject,
        status: "duplicate",
        sent_at: new Date().toISOString(),
        resend_of: sentLogs[0].id,
      });
      return Response.json({ ok: false, reason: "already_sent", sent_at: sentLogs[0].sent_at, log_id: sentLogs[0].id });
    }

    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection("outlook");

      const pdfRes = await fetch(doc.file_url, { signal: AbortSignal.timeout(30000) });
      if (!pdfRes.ok) throw new Error(`Could not download the release PDF (${pdfRes.status})`);
      const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
      const contentBytes = toBase64(pdfBytes);

      const message = {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
        ccRecipients: cc.map((address) => ({ emailAddress: { address } })),
        attachments: [
          {
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: attachmentName,
            contentType: "application/pdf",
            contentBytes,
          },
        ],
      };
      if (sender) message.from = { emailAddress: { address: sender } };

      await graphRequest(accessToken, "/me/sendMail", {
        method: "POST",
        body: JSON.stringify({ message, saveToSentItems: true }),
      });

      const sentAt = new Date().toISOString();
      const log = await base44.entities.ReleaseEmailLog.create({
        client_id: clientId,
        client_name: clientName,
        document_id,
        document_type: doc.document_type,
        draw_cycle_name: drawCycleName,
        vendor_name: vendorName,
        invoice_number: invoiceNumber,
        invoice_amount: invoiceAmount,
        recipients: recipients.join(", "),
        cc_recipients: cc.join(", "),
        subject,
        status: "sent",
        sent_at: sentAt,
        resend_of: resend ? (resend_of || sentLogs[0]?.id || "") : "",
      });

      return Response.json({ ...preview, status: "sent", sent_at: sentAt, log });
    } catch (error) {
      const log = await base44.entities.ReleaseEmailLog.create({
        client_id: clientId,
        client_name: clientName,
        document_id,
        document_type: doc.document_type,
        draw_cycle_name: drawCycleName,
        vendor_name: vendorName,
        invoice_number: invoiceNumber,
        invoice_amount: invoiceAmount,
        recipients: recipients.join(", "),
        cc_recipients: cc.join(", "),
        subject,
        status: "failed",
        error_message: error.message,
        sent_at: new Date().toISOString(),
        resend_of: resend ? (resend_of || "") : "",
      });
      return Response.json({ ok: false, reason: "send_failed", error: error.message, log });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}