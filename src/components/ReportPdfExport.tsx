'use client';

import { useState, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignaturePad from './SignaturePad';
import { Modal, btnPrimary, btnGhost } from './ui';

export type ReportData = {
  totalCount: number;
  deliveries: number;
  returned: number;
  failed: number;
  successRate: number;
  failedRate: number;
  avgHours: number;
  statusMap: Record<string, number>;
  drivers: { name: string; employeeId: string; score: number; delivered: number; failed: number; onTime: number }[];
  trend: { date: string; count: number }[];
  topDestinations: [string, number][];
  shipments: {
    trackingNumber: string;
    sender: string;
    receiver: string;
    destination: string;
    status: string;
    driver: string;
    createdAt: string;
  }[];
  tenantName: string;
};

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    ORDER_CREATED: 'Dibuat', PICKED_UP: 'Diambil', IN_TRANSIT: 'Dalam Perjalanan',
    AT_WAREHOUSE: 'Di Gudang', OUT_FOR_DELIVERY: 'Dikirim', DELIVERED: 'Terkirim',
    DELIVERY_FAILED: 'Gagal', RETURNED: 'Dikembalikan', CANCELLED: 'Dibatalkan',
    RESCHEDULED: 'Dijadwalkan Ulang',
  };
  return map[s] || s;
}

async function computeHash(data: ReportData): Promise<string> {
  const payload = JSON.stringify({
    t: data.totalCount, d: data.deliveries, f: data.failed,
    r: data.returned, s: data.successRate,
  });
  const enc = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function ReportPdfExport({ data }: { data: ReportData }) {
  const [open, setOpen] = useState(false);
  const [signature, setSignature] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [generating, setGenerating] = useState(false);

  const generatePdf = useCallback(async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const W = 210;
      const M = 15;
      const CW = W - M * 2;
      let y = M;

      const hash = await computeHash(data);
      const now = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

      // ── HEADER ──
      doc.setFillColor(13, 110, 253);
      doc.rect(0, 0, W, 38, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('DTMS', M, 16);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Delivery Tracking Management System', M, 22);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN OPERASIONAL PENGIRIMAN', M, 33);
      y = 46;

      // ── META ──
      doc.setTextColor(102, 112, 133);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Perusahaan: ${data.tenantName || 'Semua Tenant'}`, M, y);
      doc.text(`Dicetak: ${now}`, W - M, y, { align: 'right' });
      y += 4;
      doc.text(`Total Data: ${data.totalCount.toLocaleString('id-ID')} shipment`, M, y);
      doc.text(`Hash: ${hash.slice(0, 32)}...`, W - M, y, { align: 'right' });
      y += 6;

      // ── KPI SUMMARY ──
      doc.setFillColor(247, 249, 252);
      doc.roundedRect(M, y, CW, 22, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(102, 112, 133);
      const kpis = [
        { label: 'Total', value: data.totalCount.toLocaleString('id-ID') },
        { label: 'Terkirim', value: `${data.deliveries.toLocaleString('id-ID')} (${data.successRate}%)` },
        { label: 'Gagal', value: `${data.failed.toLocaleString('id-ID')} (${data.failedRate}%)` },
        { label: 'Rata-rata', value: data.avgHours > 0 ? `${data.avgHours} jam` : '-' },
      ];
      const kw = CW / kpis.length;
      kpis.forEach((k, i) => {
        const kx = M + i * kw + kw / 2;
        doc.setTextColor(102, 112, 133);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(k.label, kx, y + 6, { align: 'center' });
        doc.setTextColor(16, 24, 40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(k.value, kx, y + 14, { align: 'center' });
      });
      y += 28;

      // ── STATUS BREAKDOWN ──
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 24, 40);
      doc.text('Status Shipment', M, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [['Status', 'Jumlah', 'Persentase']],
        body: Object.entries(data.statusMap).map(([st, cnt]) => [
          statusLabel(st),
          cnt.toLocaleString('id-ID'),
          data.totalCount ? `${Math.round((cnt / data.totalCount) * 100)}%` : '0%',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [13, 110, 253], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: M, right: M },
        styles: { cellPadding: 2 },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 8;

      // ── DRIVER SCORING ──
      if (data.drivers.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 24, 40);
        doc.text('Skor Driver', M, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [['Driver', 'Employee ID', 'Skor', 'Terkirim', 'Gagal', 'On-Time']],
          body: data.drivers.map((d) => [
            d.name, d.employeeId, String(d.score),
            String(d.delivered), String(d.failed), String(d.onTime),
          ]),
          theme: 'grid',
          headStyles: { fillColor: [13, 110, 253], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: M, right: M },
          styles: { cellPadding: 2 },
          columnStyles: { 2: { cellWidth: 18 }, 3: { cellWidth: 22 }, 4: { cellWidth: 18 }, 5: { cellWidth: 22 } },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── TREND 7 HARI ──
      if (data.trend.length > 0) {
        if (y > 240) { doc.addPage(); y = M; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 24, 40);
        doc.text('Trend 7 Hari', M, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [['Tanggal', 'Jumlah Shipment']],
          body: data.trend.map((t) => [t.date, String(t.count)]),
          theme: 'grid',
          headStyles: { fillColor: [13, 110, 253], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: M, right: M },
          styles: { cellPadding: 2 },
          columnStyles: { 1: { cellWidth: 35 } },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── TOP DESTINASI ──
      if (data.topDestinations.length > 0) {
        if (y > 240) { doc.addPage(); y = M; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 24, 40);
        doc.text('Top Destinasi', M, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [['No', 'Destinasi', 'Jumlah']],
          body: data.topDestinations.map(([name, cnt], i) => [String(i + 1), name, String(cnt)]),
          theme: 'grid',
          headStyles: { fillColor: [13, 110, 253], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: M, right: M },
          styles: { cellPadding: 2 },
          columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 25 } },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── SHIPMENT DETAIL (top 25) ──
      if (data.shipments.length > 0) {
        if (y > 220) { doc.addPage(); y = M; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 24, 40);
        doc.text('Detail Shipment Terbaru', M, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [['Resi', 'Pengirim', 'Penerima', 'Status', 'Driver', 'Dibuat']],
          body: data.shipments.slice(0, 25).map((s) => [
            s.trackingNumber, s.sender, s.receiver, statusLabel(s.status), s.driver || '-', s.createdAt,
          ]),
          theme: 'grid',
          headStyles: { fillColor: [13, 110, 253], fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          margin: { left: M, right: M },
          styles: { cellPadding: 1.5 },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 28 },
            2: { cellWidth: 28 },
            3: { cellWidth: 24 },
            4: { cellWidth: 25 },
            5: { cellWidth: 30 },
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── DIGITAL SIGNATURE ──
      const sigSectionHeight = 52;
      if (y + sigSectionHeight > 270) { doc.addPage(); y = M; }

      // Separator line
      doc.setDrawColor(228, 231, 236);
      doc.setLineWidth(0.3);
      doc.line(M, y, W - M, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 24, 40);
      doc.text('TANDA TANGAN DIGITAL', M, y);
      y += 8;

      if (signature) {
        try {
          const imgW = 50;
          const imgH = 22;
          doc.addImage(signature, 'PNG', M, y, imgW, imgH);
          // Box around signature
          doc.setDrawColor(228, 231, 236);
          doc.setLineWidth(0.3);
          doc.roundedRect(M - 1, y - 1, imgW + 2, imgH + 2, 1, 1, 'S');
        } catch { /* signature image invalid */ }
      }

      const infoX = M + 60;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(102, 112, 133);
      doc.text('Nama:', infoX, y + 4);
      doc.text('Jabatan:', infoX, y + 10);
      doc.text('Tanggal:', infoX, y + 16);
      doc.text('Hash Verifikasi:', infoX, y + 22);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 24, 40);
      doc.text(signerName || '-', infoX + 28, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(signerTitle || '-', infoX + 28, y + 10);
      doc.text(now, infoX + 28, y + 16);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(13, 110, 253);
      doc.text(hash, infoX + 28, y + 22);

      y += sigSectionHeight;

      // ── FOOTER on every page ──
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(163, 174, 193);
        doc.text(
          `DTMS Report • Halaman ${i} dari ${totalPages} • Dicetak ${now} • Hash: ${hash.slice(0, 16)}…`,
          W / 2, 290, { align: 'center' }
        );
        doc.setDrawColor(228, 231, 236);
        doc.setLineWidth(0.2);
        doc.line(M, 286, W - M, 286);
      }

      // ── DOWNLOAD ──
      const filename = `DTMS-Laporan-${new Date().toISOString().slice(0, 10)}${signerName ? '-' + signerName.replace(/\s+/g, '_') : ''}.pdf`;
      doc.save(filename);
      setOpen(false);
    } finally {
      setGenerating(false);
    }
  }, [data, signature, signerName, signerTitle]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B5ED7]">
        Export PDF + TTD
      </button>

      <Modal open={open} title="Export Laporan PDF" onClose={() => setOpen(false)} wide>
        <div className="space-y-5">
          <div className="rounded-lg bg-[#F7F9FC] p-3 text-xs text-[#667085]">
            Laporan akan di-export dalam bentuk PDF lengkap dengan tanda tangan digital sebagai bukti dokumen yang sah.
            Hash verifikasi SHA-256 disertakan untuk memastikan integritas dokumen.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#667085]">Nama Penandatangan *</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="block w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] placeholder-[#98A2B3] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#667085]">Jabatan</label>
              <input
                type="text"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="Contoh: Operations Manager"
                className="block w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] placeholder-[#98A2B3] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#667085]">Tanda Tangan Digital *</label>
            <SignaturePad onChange={setSignature} />
          </div>

          <div className="flex justify-end gap-2 border-t border-[#E4E7EC] pt-4">
            <button onClick={() => setOpen(false)} className={btnGhost}>Batal</button>
            <button
              onClick={generatePdf}
              disabled={generating || !signerName || !signature}
              className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {generating ? 'Membuat PDF...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
