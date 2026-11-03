import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { collectEmails, formatDateValue, formatMoney, graphRequest } from "../../shared/outlookMail.ts";

const COMPANY = "JLM Development Inc.";

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

function buildHtml(invoice, client) {
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
          <div style="font-size:18px;font-weight:bold;color:#0f172a;">${COMPANY}</div>
          <div style="font-size:13px;color:#64748b;margin-top:2px;">Invoice ${esc(invoice.invoice_number)}</div>
        </td>
        <td style="padding:24px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:#64748b;">
          ${invoice.invoice_date ? `<div>Date: ${formatDateValue(invoice.invoice_date)}</div>` : ""}
          ${invoice.due_date ? `<div>Due: ${formatDateValue(invoice.due_date)}</div>` : ""}
        </td>
      </tr>
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
        <td colspan="2" style="padding:20px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;">
          Thank you,<br/>${COMPANY}
        </td>
      </tr>
    </table>
  </div>`;
}

function buildText(invoice, client) {
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const total = invoice.total != null ? invoice.total : items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const lines = [
    `${COMPANY}`,
    `Invoice ${invoice.invoice_number}`,
    invoice.invoice_date ? `Date: ${formatDateValue(invoice.invoice_date)}` : "",
    invoice.due_date ? `Due: ${formatDateValue(invoice.due_date)}` : "",
    "",
    `Bill To: ${invoice.bill_to_name || client?.name || ""}`,
    invoice.project_name ? `Project: ${invoice.project_name}` : "",
    "",
    ...items.map((i) => `${i.description}: ${formatMoney(i.amount)}`),
    "",
    `Total Due: ${formatMoney(total)}`,
    invoice.notes ? `\n${invoice.notes}` : "",
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

    const subject = `Invoice ${invoice.invoice_number}${invoice.project_name ? ` - ${invoice.project_name}` : ""}`;
    const html = buildHtml(invoice, client);
    const text = buildText(invoice, client);

    try {
      const message = {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
      };
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
    });

    return Response.json({ ok: true, recipients, subject, text, sent_at: sentAt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}