import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';

const BLUE = rgb(13 / 255, 110 / 255, 253 / 255);
const DARK = rgb(16 / 255, 24 / 255, 40 / 255);
const GRAY = rgb(102 / 255, 112 / 255, 133 / 255);
const LIGHT_BG = rgb(240 / 255, 242 / 255, 247 / 255);
const WHITE = rgb(1, 1, 1);
const RED = rgb(245 / 255, 34 / 255, 45 / 255);
const GREEN = rgb(22 / 255, 179 / 255, 100 / 255);
const ORANGE = rgb(255 / 255, 138 / 255, 0);
const BORDER = rgb(228 / 255, 231 / 255, 236 / 255);

const MARGIN_L = 50;
const MARGIN_R = 50;
const MARGIN_T = 60;
const MARGIN_B = 50;

function fmtRp(n: number): string { return `Rp ${(n / 1_000_000).toFixed(1)}M`; }
function pct(a: number, b: number): string { return b > 0 ? `${((a / b) * 100).toFixed(1)}%` : 'N/A'; }

async function drawTable(
  page: any, font: any, boldFont: any,
  startY: number, headers: string[], rows: string[][],
  colWidths: number[], opts?: { headerBg?: boolean; pageWidth: number; pageHeight: number },
): Promise<number> {
  const pageWidth = opts?.pageWidth ?? PageSizes.A4[0];
  const pageHeight = opts?.pageHeight ?? PageSizes.A4[1];
  const headerBg = opts?.headerBg !== false;
  const rowH = 18;
  const fontSize = 8;
  let y = startY;

  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header
  let x = MARGIN_L;
  for (let i = 0; i < headers.length; i++) {
    if (headerBg) {
      page.drawRectangle({ x, y: y - 2, width: colWidths[i], height: rowH, color: BLUE });
    }
    page.drawText(headers[i], { x: x + 4, y: y + 3, size: fontSize, font: boldFont, color: headerBg ? WHITE : DARK });
    x += colWidths[i];
  }
  y -= rowH;

  // Rows
  for (const row of rows) {
    if (y < MARGIN_B + 30) break; // overflow protection
    x = MARGIN_L;
    for (let i = 0; i < row.length; i++) {
      page.drawRectangle({ x, y: y - 2, width: colWidths[i], height: rowH, borderColor: BORDER, borderWidth: 0.5 });
      const text = row[i]?.length > 40 ? row[i].slice(0, 38) + '..' : row[i] || '';
      page.drawText(text, { x: x + 4, y: y + 3, size: fontSize, font, color: DARK });
      x += colWidths[i];
    }
    y -= rowH;
  }
  return y;
}

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  const preset = req.nextUrl.searchParams.get('preset') || 'this_month';
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let periodFrom: Date;
  let periodLabel: string;
  switch (preset) {
    case 'today': periodFrom = sod; periodLabel = 'Hari Ini'; break;
    case 'last_7_days': { const f = new Date(sod); f.setDate(f.getDate() - 6); periodFrom = f; periodLabel = '7 Hari Terakhir'; break; }
    case 'last_30_days': { const f = new Date(sod); f.setDate(f.getDate() - 29); periodFrom = f; periodLabel = '30 Hari Terakhir'; break; }
    case 'this_quarter': { const q = Math.floor(now.getMonth() / 3); periodFrom = new Date(now.getFullYear(), q * 3, 1); periodLabel = 'Kuartal Ini'; break; }
    default: { periodFrom = new Date(now.getFullYear(), now.getMonth(), 1); periodLabel = 'Bulan Ini'; break; }
  }

  return runWithTenant(session?.tenantId ?? null, async () => {
    const tf: Record<string, any> = session?.tenantId ? { tenantId: session.tenantId } : {};

    const [
      tenants, totalShipments, deliveredShipments, failedShipments, activeShipments,
      slaBreached, slaTotal, overdueInvoices, invoiceAgg, exceptionCount,
      openExceptions, totalDrivers, totalVehicles, totalCustomers,
      integrationLogs, errorLogs,
      topIntegrations, tenantShipmentCounts,
    ] = await Promise.all([
      prisma.tenant.findMany({ where: tf, select: { id: true, name: true, plan: true, status: true }, orderBy: { name: 'asc' } }),
      prisma.shipment.count({ where: { ...tf, createdAt: { gte: periodFrom } } }),
      prisma.shipment.count({ where: { ...tf, status: 'DELIVERED', createdAt: { gte: periodFrom } } }),
      prisma.shipment.count({ where: { ...tf, status: 'DELIVERY_FAILED', createdAt: { gte: periodFrom } } }),
      prisma.shipment.count({ where: { ...tf, status: { in: ['ORDER_CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DISPATCHED', 'WAREHOUSE_RECEIVED', 'ARRIVED_AT_HUB'] as any }, createdAt: { gte: periodFrom } } }),
      prisma.slaEvent.count({ where: { ...tf, status: 'BREACHED', createdAt: { gte: periodFrom } } }),
      prisma.slaEvent.count({ where: { ...tf, createdAt: { gte: periodFrom } } }),
      prisma.invoice.count({ where: { ...tf, status: 'OVERDUE' } }),
      prisma.invoice.aggregate({ where: { ...tf, status: { not: 'VOID' } }, _sum: { total: true, paidAmount: true }, _count: true }),
      prisma.exception.count({ where: { ...tf, createdAt: { gte: periodFrom } } }),
      prisma.exception.count({ where: { ...tf, status: { in: ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED'] as any } } }),
      prisma.driver.count({ where: tf }),
      prisma.vehicle.count({ where: tf }),
      prisma.customer.count({ where: tf }),
      prisma.integrationLog.count({
        where: session?.tenantId
          ? { integrationConfig: { tenantId: session.tenantId }, createdAt: { gte: periodFrom } }
          : { createdAt: { gte: periodFrom } },
      }),
      prisma.integrationLog.count({
        where: {
          ...(session?.tenantId ? { integrationConfig: { tenantId: session.tenantId } } : {}),
          createdAt: { gte: periodFrom }, OR: [{ statusCode: { gte: 400 } }, { error: { not: null } }],
        },
      }),
      prisma.$queryRaw<{ name: string; count: bigint; errors: bigint }[]>`
        SELECT ic.name, COUNT(*) as count, COUNT(CASE WHEN il."statusCode" >= 400 OR il.error IS NOT NULL THEN 1 END) as errors
        FROM "IntegrationLog" il JOIN "IntegrationConfig" ic ON ic.id = il."integrationId"
        WHERE il."createdAt" >= ${periodFrom}
        ${session?.tenantId ? Prisma.sql`AND ic."tenantId" = ${session.tenantId}` : Prisma.sql``}
        GROUP BY ic.name ORDER BY count DESC LIMIT 5
      `,
      prisma.$queryRaw<{ tenantId: string; cnt: bigint }[]>`
        SELECT s."tenantId", COUNT(*) as cnt FROM "Shipment" s
        WHERE s."createdAt" >= ${periodFrom}
        ${session?.tenantId ? Prisma.sql`AND s."tenantId" = ${session.tenantId}` : Prisma.sql``}
        GROUP BY s."tenantId"
      `,
    ]);

    const shipmentCountMap = new Map(tenantShipmentCounts.map((r) => [r.tenantId, Number(r.cnt)]));
    const totalBilled = Number(invoiceAgg._sum.total || 0);
    const totalPaid = Number(invoiceAgg._sum.paidAmount || 0);
    const collected = totalBilled > 0 ? ((totalPaid / totalBilled) * 100).toFixed(1) : '0.0';
    const successRate = totalShipments > 0 ? ((deliveredShipments / totalShipments) * 100).toFixed(1) : '0.0';
    const slaRate = slaTotal > 0 ? (((slaTotal - slaBreached) / slaTotal) * 100).toFixed(1) : '100.0';
    const apiSuccess = integrationLogs > 0 ? (((integrationLogs - errorLogs) / integrationLogs) * 100).toFixed(1) : '100.0';

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage(PageSizes.A4);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    function newPage() {
      page = pdfDoc.addPage(PageSizes.A4);
      return pageHeight - MARGIN_T;
    }

    function drawSection(y: number, title: string): number {
      if (y < MARGIN_B + 100) y = newPage();
      page.drawText(title, { x: MARGIN_L, y, size: 13, font: boldFont, color: DARK });
      page.drawLine({ start: { x: MARGIN_L, y: y - 3 }, end: { x: MARGIN_L + title.length * 7.5, y: y - 3 }, thickness: 2, color: BLUE });
      return y - 20;
    }

    // ── Title Page ──
    page.drawText('DTMS Platform Intelligence Report', { x: MARGIN_L, y: pageHeight - 100, size: 24, font: boldFont, color: BLUE });
    page.drawText(periodLabel, { x: MARGIN_L, y: pageHeight - 130, size: 14, font, color: GRAY });
    page.drawText(`Generated: ${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, {
      x: MARGIN_L, y: pageHeight - 160, size: 10, font, color: GRAY,
    });
    page.drawLine({ start: { x: MARGIN_L, y: pageHeight - 175 }, end: { x: pageWidth - MARGIN_R, y: pageHeight - 175 }, thickness: 1, color: BORDER });

    let y = pageHeight - 210;

    // ── 1. Executive Summary ──
    y = drawSection(y, '1. Executive Summary');
    const cw = [(pageWidth - MARGIN_L - MARGIN_R) / 5] as number[];
    const cw5 = [...cw, ...cw, ...cw, ...cw, ...cw];
    y = await drawTable(page, font, boldFont, y,
      ['Total Tenant', 'Total Shipment', 'Delivery Rate', 'SLA Achievement', 'API Health'],
      [[String(tenants.length), totalShipments.toLocaleString('id-ID'), `${successRate}%`, `${slaRate}%`, `${apiSuccess}%`]],
      cw5,
      { pageWidth, pageHeight },
    );
    y -= 15;

    // ── 2. Revenue & Billing ──
    y = drawSection(y, '2. Revenue & Billing');
    y = await drawTable(page, font, boldFont, y,
      ['Total Billed', 'Collected', 'Outstanding', 'Overdue', 'Invoices'],
      [[fmtRp(totalBilled), fmtRp(totalPaid), fmtRp(totalBilled - totalPaid), String(overdueInvoices), String(invoiceAgg._count)]],
      cw5,
      { pageWidth, pageHeight },
    );
    const collColor = Number(collected) >= 80 ? GREEN : RED;
    page.drawText(`Collection Rate: ${collected}%`, { x: MARGIN_L, y: y - 2, size: 9, font: boldFont, color: collColor });
    y -= 20;

    // ── 3. Delivery Performance ──
    y = drawSection(y, '3. Delivery Performance');
    y = await drawTable(page, font, boldFont, y,
      ['Total', 'Delivered', 'Failed', 'Active', 'Success Rate'],
      [[String(totalShipments), String(deliveredShipments), String(failedShipments), String(activeShipments), `${successRate}%`]],
      cw5,
      { pageWidth, pageHeight },
    );
    y -= 15;

    // ── 4. SLA Performance ──
    y = drawSection(y, '4. SLA Performance');
    const cw4 = cw5.slice(0, 4);
    y = await drawTable(page, font, boldFont, y,
      ['Total Evaluated', 'Breached', 'On-Time', 'Achievement'],
      [[String(slaTotal), String(slaBreached), String(slaTotal - slaBreached), `${slaRate}%`]],
      cw4,
      { pageWidth, pageHeight },
    );
    y -= 15;

    // ── 5. Exceptions ──
    y = drawSection(y, '5. Exceptions');
    const cw3 = cw5.slice(0, 3);
    y = await drawTable(page, font, boldFont, y,
      ['Total (Period)', 'Open', 'Resolution Rate'],
      [[String(exceptionCount), String(openExceptions), pct(exceptionCount - openExceptions, exceptionCount)]],
      cw3,
      { pageWidth, pageHeight },
    );
    y -= 15;

    // ── 6. Fleet & Workforce ──
    y = drawSection(y, '6. Fleet & Workforce');
    y = await drawTable(page, font, boldFont, y,
      ['Total Drivers', 'Total Vehicles', 'Total Customers'],
      [[String(totalDrivers), String(totalVehicles), String(totalCustomers)]],
      cw3,
      { pageWidth, pageHeight },
    );
    y -= 15;

    // ── 7. Integration Health ──
    y = drawSection(y, '7. Integration Health');
    const cw4b = cw5.slice(0, 4);
    const integrRows = topIntegrations.map((i) => [i.name, String(i.count), String(i.errors), pct(Number(i.errors), Number(i.count))]);
    y = await drawTable(page, font, boldFont, y,
      ['Integration', 'Requests', 'Errors', 'Error Rate'],
      integrRows.length > 0 ? integrRows : [['No data', '-', '-', '-']],
      cw4b,
      { pageWidth, pageHeight },
    );
    y -= 15;

    // ── 8. Tenant Detail ──
    y = drawSection(y, '8. Tenant Detail');
    const cwT = [(pageWidth - MARGIN_L - MARGIN_R) * 0.35, (pageWidth - MARGIN_L - MARGIN_R) * 0.15, (pageWidth - MARGIN_L - MARGIN_R) * 0.2, (pageWidth - MARGIN_L - MARGIN_R) * 0.3];
    const tenantRows = tenants.slice(0, 15).map((t) =>
      [t.name, t.plan || 'FREE', t.status, String(shipmentCountMap.get(t.id) || 0)]
    );
    y = await drawTable(page, font, boldFont, y,
      ['Tenant Name', 'Plan', 'Status', 'Shipments'],
      tenantRows.length > 0 ? tenantRows : [['No tenants', '-', '-', '-']],
      cwT,
      { pageWidth, pageHeight },
    );

    // ── Page 2: Risk + Insights ──
    y = newPage();

    // ── 9. Risk Assessment ──
    y = drawSection(y, '9. Risk Assessment');
    page.drawText('Risk factors: Financial, Operational, Exception, Capacity, Churn.', {
      x: MARGIN_L, y, size: 8, font, color: GRAY,
    });
    y -= 15;
    y = await drawTable(page, font, boldFont, y,
      ['Risk Factor', 'Value'],
      [
        ['Overdue Invoices', String(overdueInvoices)],
        ['SLA Breaches', String(slaBreached)],
        ['Failed Deliveries', String(failedShipments)],
        ['Open Exceptions', String(openExceptions)],
        ['Integration Errors', String(errorLogs)],
      ],
      [(pageWidth - MARGIN_L - MARGIN_R) / 2, (pageWidth - MARGIN_L - MARGIN_R) / 2],
      { pageWidth, pageHeight },
    );
    y -= 15;

    // ── 10. Insights & Recommendations ──
    y = drawSection(y, '10. Key Insights & Recommendations');
    const insights: { text: string; color: any }[] = [];
    insights.push({ text: `Platform has ${tenants.length} active tenants.`, color: DARK });
    insights.push({ text: `Total shipments: ${totalShipments.toLocaleString('id-ID')} with ${successRate}% delivery success rate.`, color: DARK });
    insights.push({ text: Number(successRate) >= 95 ? `Delivery performance excellent (${successRate}%).` : `Delivery success rate (${successRate}%) needs attention. Target: 95%.`, color: Number(successRate) >= 95 ? GREEN : RED });
    if (slaBreached > 0) insights.push({ text: `${slaBreached} SLA breaches (${slaRate}% achievement). Root cause analysis recommended.`, color: ORANGE });
    else insights.push({ text: `No SLA breaches. Achievement: ${slaRate}%.`, color: GREEN });
    if (overdueInvoices > 0) insights.push({ text: `${overdueInvoices} overdue invoices. Outstanding: ${fmtRp(totalBilled - totalPaid)}. Collection: ${collected}%.`, color: RED });
    else insights.push({ text: `All invoices up to date. Collection: ${collected}%.`, color: GREEN });
    if (openExceptions > 0) insights.push({ text: `${openExceptions} open exceptions require resolution.`, color: ORANGE });
    if (Number(apiSuccess) < 99) insights.push({ text: `API health at ${apiSuccess}%. ${errorLogs} errors in period.`, color: ORANGE });
    else insights.push({ text: `API health excellent at ${apiSuccess}%.`, color: GREEN });

    for (const ins of insights) {
      if (y < MARGIN_B + 30) y = newPage();
      page.drawText(`> ${ins.text}`, { x: MARGIN_L + 10, y, size: 9, font, color: ins.color, lineHeight: 12 });
      y -= 16;
    }

    y -= 10;
    if (y < MARGIN_B + 80) y = newPage();
    page.drawText('Recommendations:', { x: MARGIN_L, y, size: 10, font: boldFont, color: DARK });
    y -= 16;
    const recs: string[] = [];
    if (overdueInvoices > 0) recs.push('Follow up with tenants on overdue invoices.');
    if (slaBreached > 0) recs.push('Investigate SLA breach root causes.');
    if (openExceptions > 0) recs.push('Prioritize open exception resolution.');
    if (Number(successRate) < 95) recs.push('Review delivery process to improve success rate.');
    if (Number(apiSuccess) < 99) recs.push('Monitor integration health and fix API errors.');
    if (recs.length === 0) recs.push('All metrics within target. Maintain current performance.');
    for (const rec of recs) {
      if (y < MARGIN_B + 30) y = newPage();
      page.drawText(`* ${rec}`, { x: MARGIN_L + 10, y, size: 9, font, color: rgb(124 / 255, 58 / 255, 237 / 255) });
      y -= 16;
    }

    // ── Signature ──
    y -= 30;
    if (y < MARGIN_B + 80) y = newPage();
    const sigMid = pageWidth / 2;
    page.drawText('Prepared by:', { x: MARGIN_L, y, size: 9, font, color: DARK });
    page.drawText('Approved by:', { x: sigMid + 20, y, size: 9, font, color: DARK });
    y -= 40;
    page.drawLine({ start: { x: MARGIN_L, y }, end: { x: MARGIN_L + 180, y }, thickness: 0.5, color: DARK });
    page.drawLine({ start: { x: sigMid + 20, y }, end: { x: sigMid + 200, y }, thickness: 0.5, color: DARK });
    y -= 14;
    page.drawText('Platform Administrator', { x: MARGIN_L, y, size: 8, font, color: GRAY });
    page.drawText('Director', { x: sigMid + 20, y, size: 8, font, color: GRAY });

    // ── Footer on every page ──
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const pw = p.getWidth();
      const ph = p.getHeight();
      p.drawText(`Page ${i + 1} / ${pages.length}`, { x: pw - MARGIN_R - 60, y: ph - 30, size: 8, font, color: GRAY });
      p.drawText(`DTMS Report | ${periodLabel} | Confidential`, { x: MARGIN_L, y: 25, size: 7, font, color: GRAY });
      p.drawLine({ start: { x: MARGIN_L, y: 38 }, end: { x: pw - MARGIN_R, y: 38 }, thickness: 0.5, color: BORDER });
    }

    const pdfBytes = await pdfDoc.save();
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DTMS_Report_${periodLabel.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.pdf"`,
      },
    });
  });
}
