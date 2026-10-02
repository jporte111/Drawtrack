import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const DOC_TYPES = ['invoice', 'conditional_lien_release', 'unconditional_lien_release'];
// Document.status enum in DrawTrack: 'received' is not a valid value, so unknown statuses fall back to 'pending_payment'
const DOC_STATUSES = ['missing', 'pending_signature', 'needs_correction', 'pending_payment', 'complete', 'na'];

const norm = (s) => (s == null ? '' : String(s).toLowerCase().trim());

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // Auth guard: if JLM_SYNC_KEY is set, body.key must match it
    let syncKey = null;
    try { syncKey = secrets.get('JLM_SYNC_KEY') || null; } catch (e) { syncKey = null; }
    if (syncKey) {
      if (!body.key || String(body.key) !== syncKey) {
        return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const clientName = (body.client_name || '').trim();
    const vendorName = (body.vendor_name || '').trim();
    const vendorEmail = (body.vendor_email || '').trim();
    const documentType = body.document_type;

    if (!clientName || !vendorName || !DOC_TYPES.includes(documentType)) {
      return Response.json({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'client_name, vendor_name and document_type (invoice | conditional_lien_release | unconditional_lien_release) are required'
      });
    }

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // 1. Resolve Client: exact match (case-insensitive), then contains; prefer active
    const clientsPage = await svc.entities.Client.list({ limit: 1000 });
    const clients = clientsPage.items || [];
    let client = clients.find((c) => norm(c.name) === norm(clientName));
    if (!client) client = clients.find((c) => c.status === 'active' && norm(c.name).includes(norm(clientName)));
    if (!client) client = clients.find((c) => norm(c.name).includes(norm(clientName)));
    if (!client) {
      return Response.json({
        ok: false,
        error: 'CLIENT_NOT_FOUND',
        available_clients: clients.map((c) => c.name)
      });
    }

    // 2. Resolve Vendor: by email (case-insensitive), then name contains; prefer active
    const vendorsPage = await svc.entities.Vendor.list({ limit: 1000 });
    const vendors = vendorsPage.items || [];
    let vendor = null;
    if (vendorEmail) vendor = vendors.find((v) => v.email && norm(v.email) === norm(vendorEmail));
    if (!vendor) vendor = vendors.find((v) => v.status === 'active' && norm(v.name).includes(norm(vendorName)));
    if (!vendor) vendor = vendors.find((v) => norm(v.name).includes(norm(vendorName)));
    if (!vendor) {
      if (body.create_vendor_if_missing) {
        const vendorData = {
          name: vendorName,
          status: 'active',
          notes: 'Created automatically by JLM email-triage sync'
        };
        if (vendorEmail) vendorData.email = vendorEmail;
        vendor = await svc.entities.Vendor.create(vendorData);
      } else {
        return Response.json({
          ok: false,
          error: 'VENDOR_NOT_FOUND',
          available_vendors: vendors.slice(0, 20).map((v) => v.name)
        });
      }
    }

    // 3. Find or create ClientVendor for (client_id, vendor_id)
    const cvPage = await svc.entities.ClientVendor.filter(
      { client_id: client.id, vendor_id: vendor.id },
      { limit: 1 }
    );
    let clientVendor = (cvPage.items || [])[0];
    if (!clientVendor) {
      clientVendor = await svc.entities.ClientVendor.create({
        client_id: client.id,
        vendor_id: vendor.id,
        status: 'active',
        notes: 'Linked by JLM email-triage sync'
      });
    }

    // Draw-ledger attachment: find the client's in-progress DrawCycle (most recent), then a matching DrawVendor row
    const cyclesPage = await svc.entities.DrawCycle.filter(
      { client_id: client.id, status: 'in_progress' },
      { sort: '-created_date', limit: 1 }
    );
    const cycle = (cyclesPage.items || [])[0];
    let attachedDrawVendorId = null;
    if (cycle) {
      const dvPage = await svc.entities.DrawVendor.filter(
        { draw_cycle_id: cycle.id, vendor_id: vendor.id },
        { limit: 1 }
      );
      attachedDrawVendorId = ((dvPage.items || [])[0] || {}).id || null;
    }

    // 4. Duplicate check: same invoice_number (case-insensitive) for the same ClientVendor pair
    const invoiceNumber = body.invoice_number != null ? String(body.invoice_number).trim() : '';
    if (invoiceNumber) {
      const dupPage = await svc.entities.Document.filter(
        { client_vendor_id: clientVendor.id },
        { limit: 500, fields: ['invoice_number', 'draw_vendor_id'] }
      );
      const dup = (dupPage.items || []).find((d) => norm(d.invoice_number) === norm(invoiceNumber));
      if (dup) {
        if (!dup.draw_vendor_id && attachedDrawVendorId) {
          await svc.entities.Document.update(dup.id, { draw_vendor_id: attachedDrawVendorId });
        }
        const dupResp = {
          ok: true,
          result: 'duplicate',
          document_id: dup.id,
          vendor_id: vendor.id,
          client_id: client.id,
          client_vendor_id: clientVendor.id
        };
        if (attachedDrawVendorId) dupResp.attached_draw_vendor_id = attachedDrawVendorId;
        else dupResp.draw_vendor_row_missing = true;
        return Response.json(dupResp);
      }
    }

    // 5. Create Document
    let status = body.status || 'received';
    if (!DOC_STATUSES.includes(status)) status = 'pending_payment';

    const docData = {
      client_vendor_id: clientVendor.id,
      document_type: documentType,
      status,
      review_status: 'needs_review',
      source: body.source || 'email-triage'
    };
    if (body.amount != null && isFinite(Number(body.amount))) docData.amount = Number(body.amount);
    if (invoiceNumber) docData.invoice_number = invoiceNumber;
    if (body.invoice_date) docData.invoice_date = body.invoice_date;
    if (body.received_date) docData.received_date = body.received_date;
    if (body.notes) docData.notes = body.notes;
    if (attachedDrawVendorId) docData.draw_vendor_id = attachedDrawVendorId;

    const doc = await svc.entities.Document.create(docData);
    const resp = {
      ok: true,
      result: 'created',
      document_id: doc.id,
      vendor_id: vendor.id,
      client_id: client.id,
      client_vendor_id: clientVendor.id
    };
    if (attachedDrawVendorId) resp.attached_draw_vendor_id = attachedDrawVendorId;
    else resp.draw_vendor_row_missing = true;
    return Response.json(resp);
  } catch (error) {
    return Response.json({ ok: false, error: (error && error.message) || String(error) });
  }
}