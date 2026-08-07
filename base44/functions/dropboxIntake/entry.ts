import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

async function listFolder(accessToken, path, recursive) {
  let res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive }),
  });
  if (!res.ok) return { ok: false, status: res.status, body: await res.text() };
  let data = await res.json();
  let entries = data.entries || [];
  while (data.has_more) {
    const cont = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor: data.cursor }),
    });
    if (!cont.ok) break;
    data = await cont.json();
    entries = entries.concat(data.entries || []);
  }
  return { ok: true, entries };
}

function matchFolder(name, folders) {
  const a = (name || '').toLowerCase();
  return folders.find((f) => {
    const b = (f.name || '').toLowerCase();
    return b === a || b.includes(a) || a.includes(b);
  });
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const baseFolder = body.folder_path || '/NAMASTE/CLIENTS';

    let connection;
    try {
      connection = await base44.asServiceRole.connectors.getConnection('dropbox');
    } catch (_e) {
      return Response.json({ error: 'Dropbox connector not connected.' }, { status: 400 });
    }
    const accessToken = connection.accessToken;

    // Dedupe set from all dropbox-sourced documents
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

    // List base folder (non-recursive) to get client subfolders
    const baseList = await listFolder(accessToken, baseFolder, false);
    if (!baseList.ok) {
      return Response.json({ error: 'Dropbox base folder list failed', detail: baseList.body }, { status: 502 });
    }
    const clientFolders = baseList.entries.filter((e) => e['.tag'] === 'folder');

    const clients = await base44.asServiceRole.entities.Client.filter({ status: 'active' });
    const clientResults = [];
    let totalImported = 0;
    let totalSkipped = 0;

    for (const client of clients) {
      const cf = matchFolder(client.name, clientFolders);
      if (!cf) {
        clientResults.push({ client: client.name, status: 'no_folder' });
        continue;
      }
      const clientPath = cf.path_display;

      // Recursive list of the client folder
      const cList = await listFolder(accessToken, clientPath, true);
      if (!cList.ok) {
        clientResults.push({ client: client.name, status: 'list_failed', detail: cList.body });
        continue;
      }
      const files = cList.entries.filter((e) => e['.tag'] === 'file');

      // Draw cycles for this client
      const cycles = await base44.asServiceRole.entities.DrawCycle.filter({ client_id: client.id });
      const activeCycles = cycles
        .filter((c) => c.status === 'draft' || c.status === 'in_progress')
        .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
      const latestActive = activeCycles[0] || null;

      let imported = 0;
      let skipped = 0;
      const fileResults = [];

      for (const file of files) {
        // Only files under .../Clients/<project>/Vendors/<vendor>/
        const rel = file.path_display.slice(clientPath.length);
        const parts = rel.split('/').filter(Boolean);
        const vIdx = parts.indexOf('Vendors');
        if (vIdx < 0 || vIdx < 2 || parts[vIdx - 2] !== 'Clients') { skipped++; continue; }
        const projectFolder = parts[vIdx - 1];
        const vendorFolder = parts[vIdx + 1];
        if (!vendorFolder) { skipped++; continue; }
        if (importedPaths.has(file.path_lower)) { skipped++; continue; }

        try {
          const dlRes = await fetch('https://content.dropboxapi.com/2/files/download', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Dropbox-API-Arg': JSON.stringify({ path: file.path_lower }) },
          });
          if (!dlRes.ok) { fileResults.push({ name: file.name, status: 'download_failed' }); skipped++; continue; }
          const buf = await dlRes.arrayBuffer();
          const blob = new Blob([buf], { type: 'application/octet-stream' });
          const upload = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
          const fileUrl = upload.file_url;

          // Extract financial fields (best-effort)
          let extracted = null;
          try {
            const ext = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
              file_url: fileUrl,
              json_schema: {
                type: 'object',
                properties: {
                  amount: { type: 'number' },
                  invoice_number: { type: 'string' },
                  invoice_date: { type: 'string' },
                },
              },
            });
            if (ext && ext.status === 'success' && ext.output) extracted = ext.output;
          } catch (_e) { /* extraction optional */ }

          // Vendor from folder name
          let vendor = vendors.find((v) => v.name && v.name.toLowerCase() === vendorFolder.toLowerCase());
          if (!vendor) vendor = vendors.find((v) => v.name && (v.name.toLowerCase().includes(vendorFolder.toLowerCase()) || vendorFolder.toLowerCase().includes(v.name.toLowerCase())));
          if (!vendor) {
            vendor = await base44.asServiceRole.entities.Vendor.create({ name: vendorFolder, vendor_type: 'other', status: 'active' });
            vendors.push(vendor);
          }
          const clientVendors = await base44.asServiceRole.entities.ClientVendor.filter({ client_id: client.id });
          if (!clientVendors.some((cv) => cv.vendor_id === vendor.id)) {
            await base44.asServiceRole.entities.ClientVendor.create({ client_id: client.id, vendor_id: vendor.id, status: 'active' });
          }

          // Draw cycle: match project folder to project_name, else latest active
          const cycle = activeCycles.find((c) => {
            const p = (c.project_name || '').toLowerCase();
            const f = projectFolder.toLowerCase();
            return p && (p === f || p.includes(f) || f.includes(p));
          }) || latestActive;
          if (!cycle) { fileResults.push({ name: file.name, status: 'no_active_draw' }); skipped++; continue; }

          const drawVendors = await base44.asServiceRole.entities.DrawVendor.filter({ draw_cycle_id: cycle.id });
          let dv = drawVendors.find((d) => d.vendor_id === vendor.id);
          if (!dv) {
            dv = await base44.asServiceRole.entities.DrawVendor.create({
              draw_cycle_id: cycle.id,
              vendor_id: vendor.id,
              scope_of_work: '',
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
            notes: `[Dropbox] ${file.path_lower}`,
          });
          await base44.asServiceRole.entities.Document.create({
            draw_vendor_id: dv.id,
            document_type: 'conditional_lien_release',
            status: 'missing',
            related_invoice_document_id: invDoc.id,
            source: 'dropbox',
          });

          importedPaths.add(file.path_lower);
          imported++;
          fileResults.push({ name: file.name, project: projectFolder, vendor: vendorFolder, status: 'imported' });
        } catch (e) {
          fileResults.push({ name: file.name, status: 'error', error: e.message });
        }
      }

      totalImported += imported;
      totalSkipped += skipped;
      clientResults.push({ client: client.name, folder: clientPath, imported, skipped, files: fileResults });
    }

    return Response.json({ imported: totalImported, skipped: totalSkipped, base_folder: baseFolder, clients: clientResults });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}