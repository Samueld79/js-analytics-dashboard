import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getBillingInvoice, listBillingIssuers } from '../services/billing';
import { getClientByIdOrSlug } from '../services/clients';
import type { BillingInvoice, BillingIssuer, Client } from '../lib/supabase';
import { formatCopPlain } from '../lib/utils';
import brandLogo from '../assets/brand-logo.png';

// Nombre de archivo sin caracteres raros (espacios, tildes aparte ya
// permitidas, símbolos) — mismo criterio que OrganigramaOutput.tsx.
function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]/g, '_');
}

function formatInvoiceDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const monthShort = date
    .toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' })
    .replace('.', '');
  const monthCap = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
  return `${date.getUTCDate()} ${monthCap}. de ${date.getUTCFullYear()}`;
}

// Vista imprimible de una cuenta de cobro — solo admin (RequireAgencyAdmin
// en App.tsx). @media print (ver index.css) oculta el resto de la app y
// deja solo la hoja A4. NUNCA renderizar datos de billing_issuers fuera de
// esta vista con sesión de admin (este repo es público).
export function InvoicePrintPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const [invoice, setInvoice] = useState<BillingInvoice | null>(null);
  const [issuer, setIssuer] = useState<BillingIssuer | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const autoDownloadFiredRef = useRef(false);
  const wantsAutoDownload = searchParams.get('descargar') === '1';

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const inv = await getBillingInvoice(invoiceId);
      if (cancelled) return;
      if (!inv) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const [issuers, clientRecord] = await Promise.all([
        listBillingIssuers(),
        getClientByIdOrSlug(inv.client_id),
      ]);
      if (cancelled) return;
      setInvoice(inv);
      setIssuer(issuers.find((i) => i.key === inv.issuer_key) ?? null);
      setClient(clientRecord);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  // Descarga directa del PDF (sin pasar por "Imprimir"): captura la hoja con
  // html2pdf.js, importado dinámicamente para no inflar el bundle principal.
  async function handleDownloadPdf() {
    const element = sheetRef.current;
    if (!element || !invoice) return;

    setDownloading(true);
    // Durante la captura: sin sombra y con la altura exacta de una A4, para
    // que html2canvas no deje una segunda página en blanco por el shadow/
    // min-height normales de la hoja en pantalla. Se restauran en finally.
    const prevBoxShadow = element.style.boxShadow;
    const prevMinHeight = element.style.minHeight;
    element.style.boxShadow = 'none';
    element.style.minHeight = '296mm';

    try {
      const logo = element.querySelector('img');
      if (logo) {
        if (!logo.complete) {
          await new Promise<void>((resolve) => {
            logo.addEventListener('load', () => resolve(), { once: true });
            logo.addEventListener('error', () => resolve(), { once: true });
          });
        }
        try {
          await logo.decode();
        } catch {
          // Si decode() falla (navegador sin soporte o imagen ya cacheada
          // de forma rara), seguimos — el load/complete de arriba ya basta.
        }
      }

      const html2pdf = (await import('html2pdf.js')).default;
      const invoiceNumber = String(invoice.invoice_number).padStart(5, '0');
      const clientNamePart = sanitizeForFilename(client?.name ?? 'Cliente');

      const worker = html2pdf();
      // El runtime real de html2pdf.js sí soporta `pagebreak` (desde hace
      // varias versiones) pero node_modules/html2pdf.js/type.d.ts no lo
      // declara — se añade acá vía intersección en vez de pelear con el
      // merge de declaraciones ambientales del paquete.
      type SetOptions = Parameters<typeof worker.set>[0] & { pagebreak?: { mode?: string } };
      const pdfOptions: SetOptions = {
        margin: 0,
        filename: `Cuenta_de_cobro_${invoiceNumber}_${clientNamePart}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' },
      };

      await worker.set(pdfOptions).from(element).save();
    } finally {
      element.style.boxShadow = prevBoxShadow;
      element.style.minHeight = prevMinHeight;
      setDownloading(false);
    }
  }

  // ?descargar=1 -> dispara la descarga automática una sola vez apenas la
  // cuenta termine de cargar, sin cerrar ni redirigir la vista.
  useEffect(() => {
    if (!wantsAutoDownload || autoDownloadFiredRef.current || loading || !invoice) return;
    autoDownloadFiredRef.current = true;
    void handleDownloadPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAutoDownload, loading, invoice]);

  if (loading) {
    return <div className="page-content"><p className="empty-note">Cargando cuenta de cobro...</p></div>;
  }

  if (notFound || !invoice) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <h3>No se encontró la cuenta de cobro</h3>
          <p>Puede que el enlace sea incorrecto o que no tengas acceso.</p>
        </div>
      </div>
    );
  }

  const subtotal = invoice.items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const issuerLines = issuer
    ? [
        issuer.legal_name,
        issuer.nit ? `NIT: ${issuer.nit}` : null,
        issuer.email ? `Correo: ${issuer.email}` : null,
        issuer.phone ? `Contacto: ${issuer.phone}` : null,
        issuer.address ? `Dirección: ${issuer.address}` : null,
      ].filter(Boolean)
    : [];

  const paymentDetails =
    issuer?.account_type && issuer.bank_name && issuer.account_number
      ? `Favor consignar en cuenta de ${issuer.account_type} ${issuer.bank_name} · Número: ${issuer.account_number}.`
      : null;

  return (
    <div className="invoice-print-page">
      <div className="invoice-print-toolbar" style={{ gap: 8 }}>
        <button className="btn-secondary" onClick={() => window.print()}>
          Imprimir
        </button>
        <button className="btn-primary" onClick={() => void handleDownloadPdf()} disabled={downloading}>
          {downloading ? 'Generando PDF...' : 'Descargar PDF'}
        </button>
      </div>

      <div className="invoice-sheet" ref={sheetRef}>
        <div className="invoice-sheet-topbar" />

        <div className="invoice-header">
          <div className="invoice-logo-block">
            <img src={brandLogo} alt="Growth Strategy" className="invoice-logo" />
            {issuerLines.length > 0 && (
              <div className="invoice-issuer-block">
                {issuerLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </div>

          <div className="invoice-header-right">
            <p className="invoice-date">{formatInvoiceDate(invoice.issue_date)}</p>
            <h1 className="invoice-title">CUENTA DE COBRO</h1>
            <div className="invoice-number-box">#{String(invoice.invoice_number).padStart(5, '0')}</div>
          </div>
        </div>

        <p className="invoice-billed-to">
          <span>Cobrada a</span> {client?.name ?? '—'}
        </p>

        <table className="invoice-items-table">
          <thead>
            <tr>
              <th>Cant.</th>
              <th>Descripción</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td>{item.qty}</td>
                <td>{item.description}</td>
                <td>{item.value != null ? formatCopPlain(item.value) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div className="invoice-total-box">
            <span>Subtotal</span>
            <strong>{formatCopPlain(subtotal)}</strong>
          </div>
          <div className="invoice-total-box">
            <span>Total</span>
            <strong>{formatCopPlain(invoice.total)}</strong>
          </div>
        </div>

        <div className="invoice-payment-details">
          <p className="invoice-section-label">Detalles de pago</p>
          {paymentDetails && <p>{paymentDetails}</p>}
          <p>Caduca a los {invoice.valid_days} días.</p>
        </div>

        <div className="invoice-signature-box">
          <span>Firma</span>
        </div>

        <div className="invoice-footer">
          <p>
            NOTA: Factura cambiaria de compraventa, esta se asimila en todos sus efectos legales a la letra de cambio (Art.
            774 del C. De C.), causará intereses por mora a la tasa máxima legal autorizada.
          </p>
        </div>
      </div>
    </div>
  );
}
