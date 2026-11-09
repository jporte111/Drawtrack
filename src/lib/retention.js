export const DEFAULT_RETENTION_RATE = 5;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Gross invoiced, retention withheld and net paid for one invoice document.
// Invoices recorded before retention was turned on carry no rate, so nothing is withheld on them.
export function invoiceRetention(doc) {
  const gross = Number(doc?.amount) || 0;
  if (doc?.retention_rate == null) {
    return { gross, rate: null, retained: 0, net: gross, tracked: false };
  }
  const rate = Number(doc.retention_rate) || 0;
  const retained =
    doc.retention_amount != null ? Number(doc.retention_amount) : round2((gross * rate) / 100);
  const net =
    doc.net_paid_amount != null ? Number(doc.net_paid_amount) : round2(gross - retained);
  return { gross, rate, retained, net, tracked: true };
}

// Persisted amounts for a given invoice total and retention rate.
export function retentionPatch(gross, rate) {
  if (rate == null || rate === "") {
    return { retention_rate: null, retention_amount: null, net_paid_amount: null };
  }
  const retained = round2(((Number(gross) || 0) * Number(rate)) / 100);
  return {
    retention_rate: Number(rate),
    retention_amount: retained,
    net_paid_amount: round2((Number(gross) || 0) - retained),
  };
}

export function sumRetention(docs = []) {
  return docs.reduce(
    (acc, doc) => {
      const r = invoiceRetention(doc);
      acc.gross += r.gross;
      acc.retained += r.retained;
      acc.net += r.net;
      if (r.tracked) acc.tracked = true;
      return acc;
    },
    { gross: 0, retained: 0, net: 0, tracked: false },
  );
}