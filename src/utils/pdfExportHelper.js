/**
 * Utility functions for exporting address records directly to PDF format
 * with exact filename formatting: {DistrictName}_{DD-MM-YYYY}.pdf
 * Features a pixel-perfect 9 rows x 4 columns (36 boxes per A4 sheet) grid layout.
 */
import { RAW_DISTRICTS_DATA } from './tamilHelper';

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
    if (filterInfo.group && filterInfo.group !== 'ALL') parts.push(filterInfo.group);
    if (filterInfo.pincode) parts.push(`PIN_${filterInfo.pincode.trim()}`);
    if (parts.length === 0) parts.push('All_Districts');
  } else {
    parts.push('All_Districts');
  }

  const cleanPrefix = parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = formatDateDDMMYYYY();
  return `${cleanPrefix}_${dateStr}.${extension}`;
}

let depsLoaded = false;

function loadPdfDependencies() {
  if (depsLoaded && window.html2canvas && window.jspdf) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const loadScript = (src, globalName) => {
      return new Promise((res, rej) => {
        if (window[globalName]) return res();
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = () => res();
        script.onerror = () => rej(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf')
    ]).then(() => {
      depsLoaded = true;
      resolve();
    }).catch(reject);
  });
}

/**
 * Sanitizes address field text to remove metadata/import noise words like:
 * - "Imported from Kadayanallur Tk.pdf"
 * - "Relation: "
 * - "Mention: "
 * - "Import: "
 */
function cleanFieldText(val) {
  if (!val) return '';
  let text = String(val);
  // Remove full import sentences / references e.g. "Imported from Kadayanallur Tk.pdf"
  text = text.replace(/imported\s+from\s+[^\n\r,\.;]+/gi, '');
  text = text.replace(/imported\s+from/gi, '');
  text = text.replace(/\.pdf\b/gi, '');
  // Clean prefixes while keeping actual relationship / info text
  text = text.replace(/relation\s*:\s*/gi, '');
  text = text.replace(/mention\s*:\s*/gi, '');
  text = text.replace(/import\s*:\s*/gi, '');
  // Clean dangling commas, dashes, colons and excess spaces
  text = text
    .replace(/,\s*,+/g, ',')
    .replace(/^\s*[,.\-:]\s*/, '')
    .replace(/\s*[,.\-:]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text;
}

/**
 * Directly downloads the 4-column x 9-row directory grid PDF file (36 address cards per A4 page)
 * with neat borders, high readability, and clean typography.
 */
export async function exportAddressesToPdf(addresses = [], filterInfo = 'All Districts') {
  if (!addresses || addresses.length === 0) {
    return { success: false, message: 'No records available to export', count: 0 };
  }

  await loadPdfDependencies();

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
      padding: 10px 12px 10px 12px;
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
      border-bottom: 1.5px solid #000000;
      padding-bottom: 2px;
      margin-bottom: 4px;
      height: 22px;
      width: 100%;
      flex-shrink: 0;
    }
    .header-title {
      font-size: 13px;
      font-weight: 800;
      color: #000000;
      letter-spacing: 0.01em;
    }
    .header-page-num {
      font-size: 13px;
      font-weight: 800;
      color: #000000;
    }
    .grid-table {
      width: 100%;
      height: 1074px;
      table-layout: fixed;
      border-collapse: collapse;
      margin: 0;
      padding: 0;
      flex: 1;
    }
    .grid-table tr {
      height: 119.3px;
      max-height: 119.3px;
    }
    .grid-table td {
      width: 25%;
      height: 119.3px;
      max-height: 119.3px;
      vertical-align: top;
      padding: 2.5px 4px;
      box-sizing: border-box;
      border: 1px solid #000000;
      overflow: hidden;
    }
    .address-cell-content {
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      font-size: 8px;
      line-height: 1.15;
      color: #000000;
      overflow: hidden;
      word-break: break-word;
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

    if (!html2canvas || !JsPdfConstructor) {
      throw new Error("Failed to load PDF libraries.");
    }

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
              return `<td><div class="address-cell-content" style="visibility: hidden;"></div></td>`;
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

  const uId = cleanFieldText(addr.u_id);
  const name = cleanFieldText(addr.name);
  const notes = cleanFieldText(addr.notes);

  // Line 1: Door No + Address Line 1 / Street
  const door = cleanFieldText(addr.door_no);
  const line1Raw = cleanFieldText(addr.address_line_1 || addr.street);
  let streetLine = '';
  if (door && line1Raw) {
    streetLine = `${door}, ${line1Raw}`;
  } else if (door) {
    streetLine = door;
  } else if (line1Raw) {
    streetLine = line1Raw;
  }

  // Line 2: Area / Address Line 2 / Landmark
  const line2Raw = cleanFieldText(addr.address_line_2);
  const areaRaw = cleanFieldText(addr.area);
  const landmarkRaw = cleanFieldText(addr.landmark);
  const areaParts = [line2Raw, areaRaw, landmarkRaw].filter(Boolean);
  let areaLine = areaParts.join(', ');

  // Line 3: City / Post Office
  let cityLine = cleanFieldText(addr.city);
  if (cityLine && !cityLine.toLowerCase().includes('po')) {
    cityLine = `${cityLine} Po`;
  }

  // Line 4: District & Pincode Line
  let distStr = cleanFieldText(addr.district);
  if (distStr) {
    const distMatch = RAW_DISTRICTS_DATA.find(d => 
      d.id.toLowerCase() === distStr.toLowerCase() || 
      d.en.toLowerCase() === distStr.toLowerCase()
    );
    if (distMatch && distMatch.ta) {
      distStr = distMatch.ta;
    }
  }
  if (distStr && !distStr.toLowerCase().includes('tk') && !distStr.toLowerCase().includes('dt') && !distStr.includes('மாவட்டம்')) {
    distStr = `${distStr} மாவட்டம்`;
  }
  const pinStr = cleanFieldText(addr.pincode);
  let districtLine = distStr;
  if (districtLine && pinStr) {
    districtLine = `${districtLine} ${pinStr}`;
  } else if (!districtLine && pinStr) {
    districtLine = `PIN: ${pinStr}`;
  }

  // Phone number (Cell : ...)
  let phoneStr = cleanFieldText(addr.phone);
  if (phoneStr) {
    phoneStr = `Cell : ${phoneStr}`;
  }

  return `
    <div class="address-cell-content">
      ${uId ? `<div style="font-weight: 800; font-size: 8.8px; color: #000000; margin-bottom: 0.5px; font-family: 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-variant-numeric: tabular-nums; font-feature-settings: 'zero' 0;">${escapeHtml(uId)}</div>` : ''}
      ${name ? `<div style="font-weight: 700; font-size: 8.8px; color: #000000; margin-bottom: 0.5px;">${escapeHtml(name)}</div>` : ''}
      ${notes ? `<div style="font-size: 8px; color: #000000; font-weight: 500;">${escapeHtml(notes)}</div>` : ''}
      ${streetLine ? `<div style="font-size: 8px; color: #000000;">${escapeHtml(streetLine)}</div>` : ''}
      ${areaLine ? `<div style="font-size: 8px; color: #000000;">${escapeHtml(areaLine)}</div>` : ''}
      ${cityLine ? `<div style="font-size: 8px; color: #000000;">${escapeHtml(cityLine)}</div>` : ''}
      ${districtLine ? `<div style="font-size: 8px; color: #000000;">${escapeHtml(districtLine)}</div>` : ''}
      ${phoneStr ? `<div style="font-weight: 700; font-size: 8.4px; color: #000000; margin-top: auto; padding-top: 1px;">${escapeHtml(phoneStr)}</div>` : ''}
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

  const headers = ['U.Id', 'Name', 'Door No', 'Address Line 1', 'Address Line 2', 'Area', 'City', 'District', 'State', 'Pincode', 'Phone', 'addressGroup', 'Landmark', 'Notes'];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = addresses.map(a => [
    escapeCsv(a.u_id || ''),
    escapeCsv(a.name || ''),
    escapeCsv(a.door_no || ''),
    escapeCsv(a.address_line_1 || a.street || ''),
    escapeCsv(a.address_line_2 || ''),
    escapeCsv(a.area || ''),
    escapeCsv(a.city || ''),
    escapeCsv(a.district || ''),
    escapeCsv('தமிழ்நாடு'),
    escapeCsv(a.pincode || ''),
    escapeCsv(a.phone || ''),
    escapeCsv(a.addressGroup || 'CONTRIBUTOR'),
    escapeCsv(a.landmark || ''),
    escapeCsv(a.notes || '')
  ].join(','));

  const csvContentStr = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContentStr], { type: 'text/csv;charset=utf-8;' });
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

/**
 * Exports address records to a Microsoft Word (.doc) file containing an HTML table,
 * which natively supports UTF-8 Tamil rendering and includes basic table borders.
 */
export function exportAddressesToWord(addresses = [], filterInfo = 'All Districts') {
  if (!addresses || addresses.length === 0) {
    return { success: false, message: 'No records available to export', count: 0 };
  }

  const fileName = getExportFilename(filterInfo, 'doc');
  const headers = ['U.Id', 'Name', 'Door No', 'Address Line 1', 'Address Line 2', 'Area', 'City', 'District', 'State', 'Pincode', 'Phone', 'Group', 'Landmark', 'Notes'];

  let tableHtml = '<table border="1" style="border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 11px;">';
  tableHtml += '<tr>' + headers.map(h => `<th style="background-color: #f3f4f6; padding: 6px; text-align: left;">${escapeHtml(h)}</th>`).join('') + '</tr>';
  
  addresses.forEach(a => {
    tableHtml += '<tr>';
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.u_id)}</td>`;
    tableHtml += `<td style="padding: 4px; font-weight: bold;">${escapeHtml(a.name)}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.door_no)}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.address_line_1 || a.street)}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.address_line_2)}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.area)}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.city)}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.district)}</td>`;
    tableHtml += `<td style="padding: 4px;">தமிழ்நாடு</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.pincode)}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.phone)}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.addressGroup || 'CONTRIBUTOR')}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.landmark)}</td>`;
    tableHtml += `<td style="padding: 4px;">${escapeHtml(a.notes)}</td>`;
    tableHtml += '</tr>';
  });
  tableHtml += '</table>';

  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Export</title>
    </head>
    <body>
      ${tableHtml}
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
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
