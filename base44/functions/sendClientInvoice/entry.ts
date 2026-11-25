import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { collectEmails, formatDateValue, formatMoney, graphRequest, toBase64 } from "../../shared/outlookMail.ts";

import { COMPANY, LOGO_URL } from "../../shared/emailBrand.ts";

// Outlook's sendMail accepts roughly 4 MB per message, attachments included.
const MAX_ATTACH_BYTES = 2800000;

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  csv: "text/csv",
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function asList(result: any) {
  if (!result) return [];
  return Array.isArray(result) ? result : result.items || [];
}

function extFromUrl(url: string) {
  const match = String(url || "").split("?")[0].match(/\.([A-Za-z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : "pdf";
}

function attachmentName(label: string, ext: string) {
  const base = String(label || "attachment")
    .replace(/\.[A-Za-z0-9]{2,5}$/, "")
    .replace(/[^A-Za-z0-9 ._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${base || "attachment"}.${ext}`;
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"]/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
  ));
}

function rowsHtml(invoice) {
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;">${esc(item.description)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;text-align:right;white-space:nowrap;">${formatMoney(item.amount)}</td>
      </tr>`,
    )
    .join("");
}

function buildHtml(invoice, client, links, note) {
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const total = invoice.total != null ? invoice.total : items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const billTo = [invoice.bill_to_name || client?.name, invoice.bill_to_address || client?.address]
    .filter(Boolean)
    .map(esc)
    .join("<br/>");

  return `
  <div style="background:#f8fafc;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;">
      <tr>
        <td style="padding:24px;border-bottom:1px solid #e5e7eb;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:12px;vertical-align:middle;">
                <img src="${LOGO_URL}" alt="JLM Development Inc." height="38" style="height:38px;display:block;border:0;" />
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:18px;font-weight:bold;color:#0f172a;">${COMPANY}</div>
                <div style="font-size:13px;color:#64748b;margin-top:2px;">Invoice ${esc(invoice.invoice_number)}</div>
              </td>
            </tr>
          </table>
        </td>
        <td style="padding:24px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:#64748b;">
          ${invoice.invoice_date ? `<div>Date: ${formatDateValue(invoice.invoice_date)}</div>` : ""}
        </td>
      </tr>
      ${note ? `<tr><td colspan="2" style="padding:24px 24px 0;font-size:14px;line-height:1.6;color:#334155;white-space:pre-line;">${esc(note)}</td></tr>` : ""}
      <tr>
        <td colspan="2" style="padding:24px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Bill To</div>
          <div style="font-size:14px;color:#0f172a;line-height:1.5;">${billTo || ""}</div>
          ${invoice.project_name ? `<div style="font-size:13px;color:#64748b;margin-top:8px;">Project: ${esc(invoice.project_name)}</div>` : ""}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0 24px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th align="left" style="padding:10px 12px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">Description</th>
              <th align="right" style="padding:10px 12px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">Amount</th>
            </tr>
            ${rowsHtml(invoice)}
            <tr>
              <td style="padding:14px 12px;font-size:14px;font-weight:bold;color:#0f172a;">Total Due</td>
              <td style="padding:14px 12px;font-size:15px;font-weight:bold;color:#0f172a;text-align:right;white-space:nowrap;">${formatMoney(total)}</td>
            </tr>
          </table>
        </td>
      </tr>
      ${invoice.notes ? `<tr><td colspan="2" style="padding:0 24px 20px;font-size:13px;color:#475569;line-height:1.6;white-space:pre-line;">${esc(invoice.notes)}</td></tr>` : ""}
      <tr>
        <td colspan="2" style="padding:0 24px 24px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:8px;">
                <a href="${esc(links.invoiceUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none;padding:12px 18px;border-radius:6px;">View / Download Invoice</a>
              </td>
              ${links.payUrl ? `<td><a href="${esc(links.payUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none;padding:12px 18px;border-radius:6px;">Pay ${formatMoney(total)} Online</a></td>` : ""}
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:20px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;">
          Thank you,<br/>${COMPANY}
        </td>
      </tr>
    </table>
  </div>`;
}

function buildText(invoice, client, links, note) {
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const total = invoice.total != null ? invoice.total : items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const lines = [
    note || "",
    "",
    `${COMPANY}`,
    `Invoice ${invoice.invoice_number}`,
    invoice.invoice_date ? `Date: ${formatDateValue(invoice.invoice_date)}` : "",
    "",
    `Bill To: ${invoice.bill_to_name || client?.name || ""}`,
    invoice.project_name ? `Project: ${invoice.project_name}` : "",
    "",
    ...items.map((i) => `${i.description}: ${formatMoney(i.amount)}`),
    "",
    `Total Due: ${formatMoney(total)}`,
    invoice.notes ? `\n${invoice.notes}` : "",
    "",
    `View / download invoice: ${links.invoiceUrl}`,
    links.payUrl ? `Pay online: ${links.payUrl}` : "",
    "",
    `Thank you,\n${COMPANY}`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.approved !== true) {
      return Response.json({ ok: false, reason: "approval_required" }, { status: 400 });
    }
    const note = String(body.note || "").trim();
    const invoiceId = body.invoice_id;
    if (!invoiceId) return Response.json({ ok: false, reason: "missing_invoice" }, { status: 400 });

    const invoice = await base44.entities.ClientInvoice.get(invoiceId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!invoice) return Response.json({ ok: false, reason: "invoice_not_found" }, { status: 404 });

    const client = invoice.client_id
      ? await base44.entities.Client.get(invoice.client_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)))
      : null;

    const requested = Array.isArray(body.recipients) ? body.recipients : [];
    let recipients = collectEmails(requested);

    if (recipients.length === 0 && invoice.client_id) {
      const found = await base44.entities.ClientContact.filter({ client_id: invoice.client_id, active: true });
      const contacts = Array.isArray(found) ? found : found.items || [];
      recipients = collectEmails(contacts.map((c) => c.email));
    }

    if (recipients.length === 0) {
      return Response.json({ ok: false, reason: "no_recipients" });
    }

    let accessToken;
    try {
      ({ accessToken } = await base44.asServiceRole.connectors.getConnection("outlook"));
    } catch (error) {
      return Response.json({ ok: false, reason: "outlook_not_connected", error: error.message });
    }

    let sender = "";
    try {
      const me = await graphRequest(accessToken, "/me?$select=mail,userPrincipalName");
      sender = me?.mail || me?.userPrincipalName || "";
    } catch (error) {
      sender = "";
    }

    const appUrl =
      req.headers.get("x-base44-app-url") ||
      req.headers.get("origin") ||
      "https://devious-draw-track-pro.base44.app";
    const invoiceUrl = `${appUrl.replace(/\/$/, "")}/invoice/${invoice.id}`;
    const payUrl = invoice.pay_url || "";

    const subject = `Invoice ${invoice.invoice_number}${invoice.project_name ? ` - ${invoice.project_name}` : ""}`;
    const html = buildHtml(invoice, client, { invoiceUrl, payUrl }, note);
    const text = buildText(invoice, client, { invoiceUrl, payUrl }, note);

    const attachments: any[] = [];
    const attachedNames: string[] = [];
    const skipped: string[] = [];
    let attachedBytes = 0;

    const addAttachment = async (url: string, name: string, contentType: string) => {
      try {
        const fileRes = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!fileRes.ok) {
          skipped.push(name);
          return;
        }
        const bytes = new Uint8Array(await fileRes.arrayBuffer());
        if (attachedBytes + bytes.byteLength > MAX_ATTACH_BYTES) {
          skipped.push(name);
          return;
        }
        attachedBytes += bytes.byteLength;
        attachments.push({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name,
          contentType,
          contentBytes: toBase64(bytes),
        });
        attachedNames.push(name);
      } catch {
        skipped.push(name);
      }
    };

    // Every supporting vendor invoice filed against this draw.
    if (invoice.draw_cycle_id) {
      const drawVendors = asList(await base44.entities.DrawVendor.filter({ draw_cycle_id: invoice.draw_cycle_id }));
      const dvIds = drawVendors.map((dv: any) => dv.id);
      if (dvIds.length > 0) {
        const [docs, vendors] = await Promise.all([
          base44.entities.Document.filter({ draw_vendor_id: { $in: dvIds } }),
          base44.entities.Vendor.list(),
        ]);
        const vendorNames = new Map(asList(vendors).map((v: any) => [v.id, v.name]));
        const dvById = new Map(drawVendors.map((dv: any) => [dv.id, dv]));
        const invoiceDocs = asList(docs)
          .filter((d: any) => (d.document_type === "invoice" || d.document_type === "receipt") && d.file_url)
          .sort((a: any, b: any) => String(a.invoice_number || "").localeCompare(String(b.invoice_number || "")));
        for (const d of invoiceDocs as any[]) {
          const dv: any = dvById.get(d.draw_vendor_id);
          const vendor = vendorNames.get(dv?.vendor_id) || dv?.vendor_name || "Vendor";
          const ext = extFromUrl(d.file_url);
          const label = `${vendor}${d.invoice_number ? ` - Invoice ${d.invoice_number}` : ""}`;
          await addAttachment(
            d.file_url,
            attachmentName(label, ext),
            CONTENT_TYPES[ext] || "application/octet-stream",
          );
        }
      }
    }

    // Budget progress report generated by the app and uploaded privately.
    if (body.budget_report_uri) {
      const reportName = attachmentName(body.budget_report_name || "Budget Progress Report", "pdf");
      try {
        const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
          file_uri: body.budget_report_uri,
          expires_in: 600,
        });
        const signedUrl = signed?.signed_url || signed?.data?.signed_url;
        if (signedUrl) await addAttachment(signedUrl, reportName, "application/pdf");
        else skipped.push(reportName);
      } catch (error) {
        skipped.push(reportName);
      }
    }

    try {
      const message: any = {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
      };
      if (attachments.length > 0) message.attachments = attachments;
      await graphRequest(accessToken, "/me/sendMail", {
        method: "POST",
        body: JSON.stringify({ message, saveToSentItems: true }),
      });
    } catch (error) {
      return Response.json({ ok: false, reason: "send_failed", error: error.message });
    }

    const sentAt = new Date().toISOString();
    await base44.entities.ClientInvoice.update(invoiceId, {
      status: "sent",
      sent_at: sentAt,
      sent_to: recipients.join(", "),
      email_note: note,
      approved_at: sentAt,
      approved_by: user.email || user.full_name || "",
    });

    return Response.json({
      ok: true,
      recipients,
      subject,
      text,
      invoice_url: invoiceUrl,
      sent_at: sentAt,
      sender,
      attachments: attachedNames,
      skipped_attachments: skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}