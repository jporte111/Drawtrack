import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const invoiceId = body.invoice_id;
    if (!invoiceId) return Response.json({ error: 'invoice_id is required' }, { status: 400 });

    const invoice = await base44.asServiceRole.entities.ClientInvoice
      .get(invoiceId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!invoice) return Response.json({ invoice: null }, { status: 404 });

    return Response.json({ invoice });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}