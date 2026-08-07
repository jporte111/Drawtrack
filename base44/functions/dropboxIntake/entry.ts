import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const baseFolder = body.folder_path || '/DrawTrack Invoices';

    let connection;
    try {
      connection = await base44.asServiceRole.connectors.getConnection('dropbox');
    } catch (_e) {
      return Response.json({ error: 'Dropbox connector not connected.' }, { status: 400 });
    }
    const accessToken = connection.accessToken;

    // Dedupe set built once from all dropbox-sourced documents
    const existing = await base44.asServiceRole.entities.Document.filter({ source: 'dropbox' });
    const importedPaths = new Set(
      existing
        .map((d) => {
          const m = (d.notes || '').match(/\[Dropbox\] (.+)$/);
          return m ? m[1] : null;
        })
        .filter(Boolean)
    );

    const today = new Date().toISOString().split('T')[0];
    const vendors = await base44.asServiceRole.entities.Vendor.list();

    const clients = await base44.asServiceRole.entities.Client.filter({ status: 'active' });
    const clientResults = [];
    let totalImported = 0;
    let totalSkipped = 0;

    for (const client of clients) {
      const folderPath = `${baseFolder}/${client.name}`;
      const listRes = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath, recursive: false }),
      });
      if (!listRes.ok) {
        // Folder doesn't exist for this client — skip silently
        clientResults.push({ client: client.name, folder: folderPath, imported: 0, skipped: 0, note: 'folder_not_found' });
        continue;
      }
      const listData = await listRes.json();
      const files = (listData.entries || []).filter((e) => e['.tag'] === 'file');

      let imported = 0;
      let skipped = 0;
      const fileResults = [];

      for (const file of files) {
        const pathLower = file.path_lower;
        if (importedPaths.has(pathLower)) { skipped++; continue; }
        try {
          const dlRes = await fetch('https://content.dropboxapi.com/2/files/download', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Dropbox-API-Arg': JSON.stringify({ path: pathLower }) },
          });
          if (!dlRes.ok) { fileResults.push({ name: file.name, status: 'download_failed' }); skipped++; continue; }
          const buf = await dlRes.arrayBuffer();
          const blob = new Blob([buf], { type: 'application/octet-stream' });
          const upload = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
          const fileUrl = upload.file_url;

          let extracted = null;
          try {
            const ext = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
              file_url: fileUrl,
              json_schema: {
                type: 'object',
                properties: {
                  vendor_name: { type: 'string' },
                  amount: { type: 'number' },
                  invoice_number: { type: 'string' },
                  invoice_date: { type: 'string' },
                  scope_of_work: { type: 'string' },
                },
              },
            });
            if (ext && ext.status === 'success' && ext.output) extracted = ext.output;
          } catch (_e) { /* extraction optional */ }

          const vendorName = (extracted && extracted.vendor_name) || file.name.replace(/\.[^.]+$/, '');
          let vendor = vendors.find((v) => v.name && v.name.toLowerCase() === vendorName.toLowerCase());
          if (!vendor) vendor = vendors.find((v) => v.name && (v.name.toLowerCase().includes(vendorName.toLowerCase()) || vendorName.toLowerCase().includes(v.name.toLowerCase())));
          if (!vendor) {
            vendor = await base44.asServiceRole.entities.Vendor.create({ name: vendorName, vendor_type: 'other', status: 'active' });
            vendors.push(vendor);
          }

          const clientVendors = await base44.asServiceRole.entities.ClientVendor.filter({ client_id: client.id });
          if (!clientVendors.some((cv) => cv.vendor_id === vendor.id)) {
            await base44.asServiceRole.entities.ClientVendor.create({ client_id: client.id, vendor_id: vendor.id, status: 'active' });
          }

          const cycles = await base44.asServiceRole.entities.DrawCycle.filter({ client_id: client.id });
          const cycle = cycles
            .filter((c) => c.status === 'draft' || c.status === 'in_progress')
            .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''))[0];
          if (!cycle) { fileResults.push({ name: file.name, status: 'no_active_draw' }); skipped++; continue; }

          const drawVendors = await base44.asServiceRole.entities.DrawVendor.filter({ draw_cycle_id: cycle.id });
          let dv = drawVendors.find((d) => d.vendor_id === vendor.id);
          if (!dv) {
            dv = await base44.asServiceRole.entities.DrawVendor.create({
              draw_cycle_id: cycle.id,
              vendor_id: vendor.id,
              scope_of_work: (extracted && extracted.scope_of_work) || '',
              status: 'pending',
            });
          }

          const invDoc = await base44.asServiceRole.entities.Document.create({
            draw_vendor_id: dv.id,
            document_type: 'invoice',
            status: 'complete',
            file_url: fileUrl,
            amount: (extracted && extracted.amount) || null,
            invoice_number: (extracted && extracted.invoice_number) || null,
            invoice_date: (extracted && extracted.invoice_date) || null,
            received_date: today,
            source: 'dropbox',
            notes: `[Dropbox] ${pathLower}`,
          });
          await base44.asServiceRole.entities.Document.create({
            draw_vendor_id: dv.id,
            document_type: 'conditional_lien_release',
            status: 'missing',
            related_invoice_document_id: invDoc.id,
            source: 'dropbox',
          });

          importedPaths.add(pathLower);
          imported++;
          fileResults.push({ name: file.name, status: 'imported', vendor: vendorName });
        } catch (e) {
          fileResults.push({ name: file.name, status: 'error', error: e.message });
        }
      }

      totalImported += imported;
      totalSkipped += skipped;
      clientResults.push({ client: client.name, folder: folderPath, imported, skipped, files: fileResults });
    }

    return Response.json({ imported: totalImported, skipped: totalSkipped, base_folder: baseFolder, clients: clientResults });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}