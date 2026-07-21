import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { form_type, vendor_name, project_name, draw_amount } = body;

    if (!form_type || !vendor_name || !project_name) {
      return Response.json({ error: 'Missing required fields: form_type, vendor_name, project_name' }, { status: 400 });
    }

    const templateUrl = TEMPLATE_URLS[form_type];
    if (!templateUrl) {
      return Response.json({ error: 'Invalid form_type. Use "conditional" or "unconditional".' }, { status: 400 });
    }

    const templateResponse = await fetch(templateUrl);
    const templateBytes = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);

    const pages = pdfDoc.getPages();
    const page = pages[0];
    const { height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;
    const textColor = rgb(0, 0, 0);

    const amountText = draw_amount
      ? '$' + Number(draw_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';

    // Identifying Information section
    // Labels start at x~50, data goes after the colon at x~160
    const dataX = 160;

    // Name of Claimant (line 10 from top)
    page.drawText(vendor_name, { x: dataX, y: height - 175, size: fontSize, font, color: textColor });
    // Job Location (line 12 from top, skipping Name of Customer)
    page.drawText(project_name, { x: dataX, y: height - 205, size: fontSize, font, color: textColor });

    // Amount field
    if (amountText) {
      if (form_type === 'unconditional') {
        // "$" on its own line after body text
        page.drawText(amountText, { x: 72, y: height - 345, size: fontSize, font, color: textColor });
      } else {
        // "Amount of Check: $" — data goes after the $ sign
        page.drawText(amountText, { x: 165, y: height - 345, size: fontSize, font, color: textColor });
      }
    }

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