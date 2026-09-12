/**
 * Utility functions for exporting address records directly to PDF format
 * with exact filename formatting: {DistrictName}_{DD-MM-YYYY}.pdf
 * Features a 2-addresses-per-row table grid and high-visibility Skyblue theme.
 */

export function formatDateDDMMYYYY(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function getExportFilename(filterInfo, extension = 'pdf') {
  const parts = [];
  if (typeof filterInfo === 'string') {
    const clean = (!filterInfo || filterInfo.toUpperCase() === 'ALL') ? 'All_Districts' : filterInfo.trim();
    parts.push(clean);
  } else if (filterInfo && typeof filterInfo === 'object') {
    if (filterInfo.district && filterInfo.district !== 'ALL') parts.push(filterInfo.district);
    if (filterInfo.city) parts.push(filterInfo.city.trim());
    if (filterInfo.area) parts.push(filterInfo.area.trim());
    if (filterInfo.pincode) parts.push(`PIN_${filterInfo.pincode.trim()}`);
    if (parts.length === 0) parts.push('All_Districts');
  } else {
    parts.push('All_Districts');
  }

  const cleanPrefix = parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = formatDateDDMMYYYY();
  return `${cleanPrefix}_${dateStr}.${extension}`;
}

let html2pdfLoader = null;

function loadHtml2PdfLibrary() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (html2pdfLoader) return html2pdfLoader;

  html2pdfLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="html2pdf"]');
    if (existing && window.html2pdf) {
      return resolve(window.html2pdf);
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (window.html2pdf) {
        resolve(window.html2pdf);
      } else {
        reject(new Error('html2pdf library loaded but global object not found'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load html2pdf library'));
    document.head.appendChild(script);
  });

  return html2pdfLoader;
}

/**
 * Directly downloads the 4-column directory book styled PDF file with clean borders
 * rendered page-by-page as isolated, discrete A4 portrait pages (36 boxes per page: 4 cols x 9 rows)
 * with header pagination ({District} - Po & Tk and page numbers) and zero slicing across pages.
 */
export async function exportAddressesToPdf(addresses = [], filterInfo = 'All Districts') {
  if (!addresses || addresses.length === 0) {
    return { success: false, message: 'No records available to export', count: 0 };
  }

  await loadHtml2PdfLibrary();

  const rawFileName = getExportFilename(filterInfo, 'pdf');
  const fileName = rawFileName.endsWith('.pdf') ? rawFileName : `${rawFileName}.pdf`;

  let districtTitle = 'All Districts';
  if (typeof filterInfo === 'string') {
    if (filterInfo && filterInfo !== 'ALL' && filterInfo.toLowerCase() !== 'all districts') {
      districtTitle = filterInfo;
    }
  } else if (filterInfo && typeof filterInfo === 'object') {
    if (filterInfo.district && filterInfo.district !== 'ALL' && filterInfo.district.toLowerCase() !== 'all districts') {
      districtTitle = filterInfo.district;
    }
  }

  const subHeaderTitle = `${districtTitle} - Po & Tk`;

  // Exactly 36 addresses per page (4 columns x 9 rows)
  const PAGE_SIZE = 36;
  const totalPages = Math.ceil(addresses.length / PAGE_SIZE) || 1;

  // Create an in-memory document frame for HTML layout rendering
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '0px';
  iframe.style.top = '0px';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-9999';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const baseCss = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Noto Sans Tamil', 'Mukta Malar', 'Latha', 'Vijaya', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background-color: #ffffff;
      color: #000000;
      width: 794px;
      margin: 0;
      padding: 0;
    }
    .pdf-page-container {
      width: 794px;
      height: 1122px;
      max-height: 1122px;
      padding: 16px 14px 12px 14px;
      box-sizing: border-box;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.2px solid #000000;
      padding-bottom: 4px;
      margin-bottom: 6px;
      width: 100%;
    }
    .header-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #000000;
      letter-spacing: 0.02em;
    }
    .header-page-num {
      font-size: 13.5px;
      font-weight: 800;
      color: #000000;
    }
    .grid-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 3px;
      margin: 0;
      padding: 0;
      flex: 1;
    }
    .grid-table td {
      width: 25%;
      vertical-align: top;
      padding: 0;
      height: 112px;
      box-sizing: border-box;
    }
  `;

  // Initialize iframe document
  iframe.contentDocument.open();
  iframe.contentDocument.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${baseCss}</style>
    </head>
    <body></body>
    </html>
  `);
  iframe.contentDocument.close();

  await new Promise(r => setTimeout(r, 100));

  try {
    const html2canvas = window.html2canvas;
    const JsPdfConstructor = window.jspdf?.jsPDF || window.jsPDF;

    if (html2canvas && JsPdfConstructor) {
      const pdf = new JsPdfConstructor({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      for (let p = 0; p < totalPages; p++) {
        const pageNum = p + 1;
        const pageAddresses = addresses.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);

        const rowChunks = [];
        for (let r = 0; r < 9; r++) {
          rowChunks.push(pageAddresses.slice(r * 4, (r + 1) * 4));
        }

        const rowsHtml = rowChunks.map(row => {
          const cellsHtml = [0, 1, 2, 3].map(c => {
            const item = row[c];
            if (item) {
              return `<td>${renderDirectoryAddressBox(item)}</td>`;
            } else {
              return `<td><div style="height: 112px; visibility: hidden;"></div></td>`;
            }
          }).join('');
          return `<tr>${cellsHtml}</tr>`;
        }).join('');

        const pageHtml = `
          <div class="pdf-page-container">
            <div class="page-header">
              <div class="header-title">${escapeHtml(subHeaderTitle)}</div>
              <div class="header-page-num">${pageNum}</div>
            </div>
            <table class="grid-table">
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `;

        iframe.contentDocument.body.innerHTML = pageHtml;

        // Brief delay for DOM reflow
        await new Promise(r => setTimeout(r, 60));

        const pageEl = iframe.contentDocument.body.firstElementChild;
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1122
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        if (p > 0) {
          pdf.addPage('a4', 'portrait');
        }
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const pdfBlob = pdf.output('blob');
      const purePdfBlob = new Blob([pdfBlob], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(purePdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.type = 'application/pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
      }, 5000);

      return { success: true, fileName, count: addresses.length };
    } else {
      // Fallback html2pdf
      const html2pdf = await loadHtml2PdfLibrary();
      const allPagesHtml = [];
      for (let p = 0; p < totalPages; p++) {
        const pageNum = p + 1;
        const pageAddresses = addresses.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);

        const rowChunks = [];
        for (let r = 0; r < 9; r++) {
          rowChunks.push(pageAddresses.slice(r * 4, (r + 1) * 4));
        }

        const rowsHtml = rowChunks.map(row => {
          const cellsHtml = [0, 1, 2, 3].map(c => {
            const item = row[c];
            if (item) return `<td>${renderDirectoryAddressBox(item)}</td>`;
            else return `<td><div style="height: 112px; visibility: hidden;"></div></td>`;
          }).join('');
          return `<tr>${cellsHtml}</tr>`;
        }).join('');

        allPagesHtml.push(`
          <div class="pdf-page-container" style="page-break-after: always;">
            <div class="page-header">
              <div class="header-title">${escapeHtml(subHeaderTitle)}</div>
              <div class="header-page-num">${pageNum}</div>
            </div>
            <table class="grid-table">
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `);
      }
      iframe.contentDocument.body.innerHTML = allPagesHtml.join('');
      await new Promise(r => setTimeout(r, 200));

      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      await html2pdf().set(opt).from(iframe.contentDocument.body).save();
      return { success: true, fileName, count: addresses.length };
    }
  } catch (err) {
    console.error('PDF export error:', err);
    throw err;
  } finally {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }
}

function renderDirectoryAddressBox(addr) {
  if (!addr) return '';

  const uId = (addr.u_id || '').trim();
  const name = (addr.name || '').trim();
  const notes = (addr.notes || '').trim();

  // Line 1: Door No + Address Line 1 / Street
  const door = (addr.door_no || '').trim();
  const line1Raw = (addr.address_line_1 || addr.street || '').trim();
  let streetLine = '';
  if (door && line1Raw) {
    streetLine = `${door}, ${line1Raw}`;
  } else if (door) {
    streetLine = door;
  } else if (line1Raw) {
    streetLine = line1Raw;
  }

  // Line 2: Area / Address Line 2 / Landmark
  const line2Raw = (addr.address_line_2 || '').trim();
  const areaRaw = (addr.area || '').trim();
  const landmarkRaw = (addr.landmark || '').trim();
  const areaParts = [line2Raw, areaRaw, landmarkRaw].filter(Boolean);
  let areaLine = areaParts.join(', ');

  // Line 3: City / Post Office
  let cityLine = (addr.city || '').trim();
  if (cityLine && !cityLine.toLowerCase().includes('po')) {
    cityLine = `${cityLine} Po`;
  }

  // Line 4: District & Pincode Line
  let distStr = (addr.district || '').trim();
  if (distStr && !distStr.toLowerCase().includes('tk') && !distStr.toLowerCase().includes('dt')) {
    distStr = `${distStr} Tk & Dt`;
  }
  const pinStr = (addr.pincode || '').trim();
  let districtLine = distStr;
  if (districtLine && pinStr) {
    districtLine = `${districtLine} ${pinStr}`;
  } else if (!districtLine && pinStr) {
    districtLine = `PIN: ${pinStr}`;
  }

  // Phone number (Cell : ...)
  let phoneStr = (addr.phone || '').trim();
  if (phoneStr) {
    phoneStr = `Cell : ${phoneStr}`;
  }

  return `
    <div style="
      border: 1px solid #000000;
      background-color: #ffffff;
      padding: 3px 4.5px;
      height: 112px;
      max-height: 112px;
      min-height: 112px;
      font-size: 8.8px;
      line-height: 1.22;
      color: #000000;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      overflow: hidden;
      word-break: break-word;
      box-sizing: border-box;
      border-radius: 1px;
    ">
      ${uId ? `<div style="font-weight: 800; font-size: 9.3px; color: #000000; margin-bottom: 1px; font-family: 'JetBrains Mono', monospace, Arial, sans-serif;">${escapeHtml(uId)}</div>` : ''}
      ${name ? `<div style="font-weight: 700; font-size: 9.3px; color: #000000; margin-bottom: 1px;">${escapeHtml(name)}</div>` : ''}
      ${notes ? `<div style="font-size: 8.4px; color: #000000; font-weight: 500;">${escapeHtml(notes)}</div>` : ''}
      ${streetLine ? `<div style="font-size: 8.4px; color: #000000;">${escapeHtml(streetLine)}</div>` : ''}
      ${areaLine ? `<div style="font-size: 8.4px; color: #000000;">${escapeHtml(areaLine)}</div>` : ''}
      ${cityLine ? `<div style="font-size: 8.4px; color: #000000;">${escapeHtml(cityLine)}</div>` : ''}
      ${districtLine ? `<div style="font-size: 8.4px; color: #000000;">${escapeHtml(districtLine)}</div>` : ''}
      ${phoneStr ? `<div style="font-weight: 700; font-size: 8.8px; color: #000000; margin-top: auto; padding-top: 1px;">${escapeHtml(phoneStr)}</div>` : ''}
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Exports address records directly to a cleanly formatted CSV file
 * with UTF-8 BOM encoding for perfect Tamil & English display in Excel/Notepad.
 */
export function exportAddressesToCsv(addresses = [], filterInfo = 'All Districts') {
  if (!addresses || addresses.length === 0) {
    return { success: false, message: 'No records available to export', count: 0 };
  }

  const fileName = getExportFilename(filterInfo, 'csv');

  const headers = ['U.Id', 'Name', 'Door No', 'Address Line 1', 'Address Line 2', 'Area', 'City', 'District', 'State', 'Country', 'Pincode', 'Phone', 'Landmark', 'Notes'];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = addresses.map(a => [
    escapeCsv(a.u_id || ''),
    escapeCsv(a.name || ''),
    escapeCsv(a.door_no || ''),
    escapeCsv(a.address_line_1 || ''),
    escapeCsv(a.address_line_2 || ''),
    escapeCsv(a.area || ''),
    escapeCsv(a.city || ''),
    escapeCsv(a.district || ''),
    escapeCsv(a.state || 'Tamil Nadu'),
    escapeCsv(a.country || 'India'),
    escapeCsv(a.pincode || ''),
    escapeCsv(a.phone || ''),
    escapeCsv(a.landmark || ''),
    escapeCsv(a.notes || '')
  ].join(','));

  const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, fileName, count: addresses.length };
}

