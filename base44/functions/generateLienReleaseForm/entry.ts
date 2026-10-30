import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { PDFDocument, StandardFonts } from 'npm:pdf-lib@1.17.1';

const TEMPLATE_URLS = {
  unconditional: "https://media.base44.com/files/public/6a5e7a0a5cbf866d6d105ac4/17b0fab3f_BLANKUnconditionalWaiverAndReleaseOnProgressPayment1.pdf",
  conditional: "https://media.base44.com/files/public/6a5e7a0a5cbf866d6d105ac4/0d0a32e53_BLANKConditionalWaiverAndReleaseOnProgressPayment.pdf"
};

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Auth is optional — this function only generates a PDF form from passed-in data
    try {
      await base44.auth.me();
    } catch (e) {
      // Continue without auth
    }

    const body = await req.json();
    const { form_type, vendor_name, project_name, draw_amount, fields = {}, debug } = body;

    if (!form_type) {
      return Response.json({ error: 'Missing form_type' }, { status: 400 });
    }

    const templateUrl = TEMPLATE_URLS[form_type];
    if (!templateUrl) {
      return Response.json({ error: 'Invalid form_type. Use "conditional" or "unconditional".' }, { status: 400 });
    }

    const templateResponse = await fetch(templateUrl);
    const templateBytes = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);

    if (debug) {
      const form = pdfDoc.getForm();
      const fields = form.getFields().map(f => ({ name: f.getName(), type: f.constructor.name }));
      return Response.json({ formFields: fields });
    }

    const claimant = (fields.claimant || vendor_name || '').toString().trim();
    if (!claimant) {
      return Response.json({ error: 'Missing required field: claimant (vendor name)' }, { status: 400 });
    }

    const formatMoney = (v) => {
      if (v === null || v === undefined || v === '') return '';
      const n = Number(v);
      if (!isFinite(n)) return '';
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (v) => {
      if (!v) return '';
      const s = String(v).trim();
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
      return s;
    };

    // Fill AcroForm fields by name — every field that exists on this template
    const form = pdfDoc.getForm();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const available = new Set(form.getFields().map((f) => f.getName()));

    const checkAmount = fields.amount ?? draw_amount;
    const values = {
      claimant,
      customer: fields.customer || '',
      location: fields.location || project_name || '',
      owner: fields.owner || '',
      'through date': formatDate(fields.through_date),
      date: formatDate(fields.date),
      maker: fields.maker || '',
      payable: fields.payable || fields.payable_to || '',
      amount: formatMoney(checkAmount),
      amount_2: formatMoney(checkAmount),
      affect: fields.affect || '',
      title: fields.title || '',
    };

    for (const [name, raw] of Object.entries(values)) {
      const value = String(raw ?? '').trim();
      if (!value || !available.has(name)) continue;
      try {
        form.getTextField(name).setText(value);
      } catch (e) {
        // Skip fields that cannot be written as text
      }
    }

    form.updateFieldAppearances(font);

    const filledBytes = await pdfDoc.save();
    const base64 = bytesToBase64(new Uint8Array(filledBytes));

    return Response.json({
      pdf_base64: base64,
      filename: form_type + '_lien_release_' + vendor_name.replace(/\s+/g, '_') + '.pdf'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});