import JSZip from 'jszip';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

if (typeof window !== 'undefined' && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
    window.pdfjsLib = pdfjsLib;
  } catch (e) {
    console.warn('PDF.js worker setup warning:', e);
  }
}

export async function loadPdfJsLibrary() {
  if (pdfjsLib && pdfjsLib.getDocument) {
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
    }
    return pdfjsLib;
  }
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    return window.pdfjsLib;
  }
  return pdfjsLib;
}

export function normalizeAndRepairTamilOCR(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/(\u0BBE)\1+/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export async function preprocessImageForTamilOCR(imageFile) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 1. Create native resolution canvas to detect document bounds
      const detectCanvas = document.createElement('canvas');
      detectCanvas.width = img.width;
      detectCanvas.height = img.height;
      const detectCtx = detectCanvas.getContext('2d');
      detectCtx.drawImage(img, 0, 0);

      let cropX = 0, cropY = 0, cropW = img.width, cropH = img.height;

      // Sample pixels to find bright white document bounding box (excluding dark viewer borders in screenshots)
      try {
        const imgData = detectCtx.getImageData(0, 0, img.width, img.height);
        const d = imgData.data;

        let minY = 0, maxY = img.height - 1;
        const rowStep = Math.max(1, Math.floor(img.height / 300));
        const colStep = Math.max(1, Math.floor(img.width / 200));

        for (let y = 0; y < img.height; y += rowStep) {
          let brightCount = 0;
          let totalCount = 0;
          for (let x = 0; x < img.width; x += colStep) {
            const idx = (y * img.width + x) * 4;
            const gray = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
            if (gray > 160) brightCount++;
            totalCount++;
          }
          if (brightCount / totalCount > 0.35) {
            minY = y;
            break;
          }
        }

        for (let y = img.height - 1; y >= 0; y -= rowStep) {
          let brightCount = 0;
          let totalCount = 0;
          for (let x = 0; x < img.width; x += colStep) {
            const idx = (y * img.width + x) * 4;
            const gray = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
            if (gray > 160) brightCount++;
            totalCount++;
          }
          if (brightCount / totalCount > 0.35) {
            maxY = y;
            break;
          }
        }

        let minX = 0, maxX = img.width - 1;
        for (let x = 0; x < img.width; x += colStep) {
          let brightCount = 0;
          let totalCount = 0;
          for (let y = minY; y <= maxY; y += rowStep * 2) {
            const idx = (y * img.width + x) * 4;
            const gray = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
            if (gray > 160) brightCount++;
            totalCount++;
          }
          if (brightCount / totalCount > 0.35) {
            minX = x;
            break;
          }
        }

        for (let x = img.width - 1; x >= 0; x -= colStep) {
          let brightCount = 0;
          let totalCount = 0;
          for (let y = minY; y <= maxY; y += rowStep * 2) {
            const idx = (y * img.width + x) * 4;
            const gray = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
            if (gray > 160) brightCount++;
            totalCount++;
          }
          if (brightCount / totalCount > 0.35) {
            maxX = x;
            break;
          }
        }

        if (maxX > minX + 200 && maxY > minY + 200) {
          cropX = minX;
          cropY = minY;
          cropW = maxX - minX;
          cropH = maxY - minY;
        }
      } catch (e) {
        console.warn('Auto-crop detection warning:', e);
      }

      // Check if this document image is a multi-column directory page (portrait orientation with height > 1.15 * width)
      const isMultiColumnSheet = cropH > cropW * 1.15 && cropW >= 300;

      if (isMultiColumnSheet) {
        // Slice into 4 distinct vertical column canvases (skipping top 4% document page header like "Sanju Typed ... 1")
        const columns = [];
        const numCols = 4;
        const colWidthFraction = 1.0 / numCols;
        const startY = cropY + cropH * 0.04;
        const colHeight = cropH * 0.95;

        for (let c = 0; c < numCols; c++) {
          const colCanvas = document.createElement('canvas');
          const colCtx = colCanvas.getContext('2d');
          const colX = cropX + cropW * (c * colWidthFraction);
          const colW = cropW * colWidthFraction;

          const scale = Math.max(1.8, Math.min(3.0, 1500 / colW));
          colCanvas.width = Math.round(colW * scale);
          colCanvas.height = Math.round(colHeight * scale);

          colCtx.drawImage(
            img,
            colX, startY, colW, colHeight,
            0, 0, colCanvas.width, colCanvas.height
          );

          // Binarize column image for crisp OCR recognition
          const cData = colCtx.getImageData(0, 0, colCanvas.width, colCanvas.height);
          const cd = cData.data;
          for (let i = 0; i < cd.length; i += 4) {
            const gray = 0.299 * cd[i] + 0.587 * cd[i + 1] + 0.114 * cd[i + 2];
            const v = gray > 145 ? 255 : (gray < 75 ? 0 : gray);
            cd[i] = v;
            cd[i + 1] = v;
            cd[i + 2] = v;
          }
          colCtx.putImageData(cData, 0, 0);
          columns.push(colCanvas);
        }

        resolve({ isColumns: true, columns });
      } else {
        // Single cropped canvas for general images
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = Math.max(1.5, Math.min(2.5, 2000 / Math.max(cropW, cropH)));
        canvas.width = Math.round(cropW * scale);
        canvas.height = Math.round(cropH * scale);

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const v = gray > 140 ? 255 : (gray < 70 ? 0 : gray);
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve({ isColumns: false, canvas });
      }
    };
    img.onerror = reject;
    if (typeof imageFile === 'string') {
      img.src = imageFile;
    } else if (imageFile instanceof Blob) {
      img.src = URL.createObjectURL(imageFile);
    } else {
      reject(new Error('Invalid image file'));
    }
  });
}

function loadTesseractLibrary() {
  return Promise.resolve(Tesseract);
}

function loadJSZipLibrary() {
  return Promise.resolve(JSZip);
}

function parseRtfText(rtfStr) {
  if (!rtfStr) return '';
  return rtfStr
    .replace(/\\par[d]?/gi, '\n')
    .replace(/\\line/gi, '\n')
    .replace(/\\(?:[a-zA-Z]+\d*|'[\da-fA-F]{2}|[\{\}\\])/g, '')
    .replace(/[\{\}]/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n');
}

const DISTRICTS_LIST = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Erode',
  'Dindigul', 'Kanchipuram', 'Chengalpattu', 'Tiruppur', 'Vellore', 'Thanjavur',
  'Tirunelveli', 'Tuticorin', 'Thoothukudi', 'Nagercoil', 'Kanyakumari', 'Karur',
  'Ariyalur', 'Cuddalore', 'Dharmapuri', 'Kallakurichi', 'Krishnagiri', 'Mayiladuthurai',
  'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram',
  'Ranipet', 'Sivaganga', 'Tenkasi', 'Theni', 'Tirupathur', 'Tiruvallur', 'Tiruvannamalai',
  'Tiruvarur', 'Viluppuram', 'Virudhunagar'
];

const TAMIL_DISTRICT_MAP = {
  'சென்னை': 'Chennai',
  'கோயம்புத்தூர்': 'Coimbatore',
  'கோவை': 'Coimbatore',
  'மதுரை': 'Madurai',
  'திருச்சி': 'Tiruchirappalli',
  'திருச்சிராப்பள்ளி': 'Tiruchirappalli',
  'சேலம்': 'Salem',
  'ஈரோடு': 'Erode',
  'திண்டுக்கல்': 'Dindigul',
  'காஞ்சீபுரம்': 'Kanchipuram',
  'காஞ்சிபுரம்': 'Kanchipuram',
  'செங்கல்பட்டு': 'Chengalpattu',
  'திருப்பூர்': 'Tiruppur',
  'வேலூர்': 'Vellore',
  'தஞ்சாவூர்': 'Thanjavur',
  'தஞ்சை': 'Thanjavur',
  'திருநெல்வேலி': 'Tirunelveli',
  'நெல்லை': 'Tirunelveli',
  'தூத்துக்குடி': 'Thoothukudi',
  'கன்னியாகுமரி': 'Kanyakumari',
  'நாகர்கோவில்': 'Kanyakumari',
  'கரூர்': 'Karur',
  'அரியலூர்': 'Ariyalur',
  'கடலூர்': 'Cuddalore',
  'தர்மபுரி': 'Dharmapuri',
  'கள்ளக்குறிச்சி': 'Kallakurichi',
  'கிருஷ்ணகிரி': 'Krishnagiri',
  'மயிலாடுதுறை': 'Mayiladuthurai',
  'நாகப்பட்டினம்': 'Nagapattinam',
  'நாமக்கல்': 'Namakkal',
  'நீலகிரி': 'Nilgiris',
  'பெரம்பலூர்': 'Perambalur',
  'புதுக்கோட்டை': 'Pudukkottai',
  'இராமநாதபுரம்': 'Ramanathapuram',
  'ராமநாதபுரம்': 'Ramanathapuram',
  'ராணிப்பேட்டை': 'Ranipet',
  'சிவகங்கை': 'Sivaganga',
  'தென்காசி': 'Tenkasi',
  'தேனி': 'Theni',
  'திருப்பத்தூர்': 'Tirupathur',
  'திருவள்ளூர்': 'Tiruvallur',
  'திருவண்ணாமலை': 'Tiruvannamalai',
  'திருவாரூர்': 'Tiruvarur',
  'விழுப்புரம்': 'Viluppuram',
  'விருதுநகர்': 'Virudhunagar'
};

export function convertBaminiToUnicode(text) {
  if (!text || typeof text !== 'string') return text;

  // Track protected English tokens
  const protectedTokens = [];
  function protect(str, regex, replacement) {
    return str.replace(regex, (match, ...groups) => {
      const idx = protectedTokens.length;
      const key = `\uE100${idx}\uE101`;
      let repl = match;
      if (typeof replacement === 'function') {
        repl = replacement(match, ...groups);
      } else if (replacement !== undefined) {
        repl = replacement;
      }
      protectedTokens.push(repl);
      return key;
    });
  }

  let str = text;

  // 1. Protect Card IDs (e.g. T-0001, M-0001, A-0001, ஆ-0001, etc. Must strictly start with an alphabet letter)
  str = protect(str, /(?:^|[\s\n\r\t,;\(\)\{\}\[\]•·\-\–—])(?:[A-Za-z]|ஆ)[-\s\.\:—_–~]?\s*0*\d{1,5}\b/g);

  // 2. Protect Relationship Prefixes (S/o, W/o, D/o, C/o) while preserving newlines & spacing
  str = protect(str, /(^|[\r\n\s,;\(])(S|W|D|C)\s*[\/\.]\s*o\b[\.\:]?/gim, (m, lead, rel) => {
    return `${lead}${rel.toUpperCase()}/o. `;
  });

  // 3. Protect Standard English Titles (Dr., Er., Mr., Mrs., Ms., Ex., Dy.)
  str = protect(str, /\b(?:Dr|Er|Mr|Mrs|Ms|Ex|Dy)\b\.?/gi, (m) => {
    const clean = m.replace(/\./g, '');
    return `${clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()}.`;
  });

  // 4. Protect Qualifications & Degrees (e.g. B.Com, B.Sc, B.Sc., M.Sc, B.Ed, B.Ed., M.Ed, M.Tech, MBBS, MD, BE, BL, etc.)
  const DEGREE_REGEXES = [
    /\bB\.?\s*Com\.?\b/gi,
    /\bM\.?\s*Com\.?\b/gi,
    /\bB\.?\s*Sc\.?\b/gi,
    /\bM\.?\s*Sc\.?\b/gi,
    /\bB\.?\s*Ed\.?\b/gi,
    /\bM\.?\s*Ed\.?\b/gi,
    /\bM\.?\s*Tech\.?\b/gi,
    /\bB\.?\s*Tech\.?\b/gi,
    /\bM\.?\s*Phil\.?\b/gi,
    /\bMBBS\b/gi,
    /\bMD\b/g,
    /\bBE\b/g,
    /\bB\.E\.?\b/gi,
    /\bBL\b/gi,
    /\bB\.L\.?\b/gi,
    /\bMA\b/g,
    /\bBA\b/g,
    /\bDRO\b/gi,
    /\bRetd\b/gi,
    /\bTNEB\b/gi,
    /\bTNSTC\b/gi,
    /\bBSNL\b/gi,
    /\bSBI\b/gi,
    /\bLIC\b/gi,
    /\bIOB\b/gi,
    /\bPNB\b/gi,
    /\bSETC\b/gi,
    /\bVAO\b/gi,
    /\bAAO\b/gi,
    /\bRMS\b/gi,
    /\bBPM\b/gi,
    /\bBDO\b/gi,
    /\bTNHB\b/gi,
    /\bN\.?G\.?O\.?\b/gi,
    /\bKR\b/g,
    /\bEB\b/g,
    /\bPC\b/g,
    /\bSM\b/g,
    /\bHM\b/g,
    /\bColony\b/gi,
    /\bLine\b/gi,
    /\bStreet\b/gi,
    /\bPost\s*Office\b/gi,
    /\bRailway\b/gi,
    /\bPWD\b/gi,
    /\bSSA\b/gi,
    /\bCSR\b/gi,
    /\bEC\s*Incharge\b/gi,
    /\bManager\b/gi,
    /\bIB\b/g,
    /\bBank\b/gi,
    /\bAgri\b/gi,
    /\bCell\s*[\:\.]?/gi,
    /\bMobile\b/gi,
    /\bPhone\b/gi,
    /\bPh\b/gi,
    /\bTel\b/gi,
    /\bDoor\b/gi,
    /\bPo\b/gi,
    /\bTk\b/gi,
    /\bDt\b/gi,
    /\bDr\b/gi,
    /\bDE\b/gi,
    /\bDI\b/gi,
    /\bTE\b/gi,
    /\bPO\b/g,
    /\bTK\b/g,
    /\bDT\b/g,
    /\bDR\b/g,
    /\bPin\b/gi,
    /\bPincode\b/gi,
    /\bPIN\b/g,
    /\bD\b(?=\s*\d{4,6})/gi,
    /\bTamil\s*Nadu\b/gi,
    /\bIndia\b/gi
  ];

  for (const reg of DEGREE_REGEXES) {
    str = protect(str, reg);
  }

  // 5. Protect Standalone English Initials & Multi-letter Initials (e.g. "A.", "P.", "S.", "M.", "K.", "I.C.", "MDC.", "KRP.", "Er.M.", "Dr.S.", "TC.", "KM.", "MP.", "IR.")
  str = protect(str, /(?<![A-Za-z0-9])([A-Z]{1,4})\.(?=(?:[A-Za-z0-9\u0B80-\u0BFF\s,\(\)\[\]\`#\n\r]|$))/g, (m, initial) => {
    return `${initial}.`;
  });

  // 6. Protect Door numbers & alphanumeric box addresses (e.g. "L 59", "D 32", "13 A", "48 AB1", "19 E", "163 C", "9 CKS", "17 F", "5/271", "1/82 F")
  str = protect(str, /\b[A-Z]\s*\d+\b/g);
  str = protect(str, /\b\d+\s*[A-Z](?:\d+)?\b/g);
  str = protect(str, /\b\d+\/\d+(?:\s*\(\s*\d+\s*\))?\b/g);
  str = protect(str, /\b\d+\/\d+\s*[A-Z]?\b/g);

  // 7. Protect Phone Numbers & Pincodes
  str = protect(str, /(?<!\d)(?:[6-9]\d{9}|[6-9]\d{4}\s*\d{5}|[1-9]\d{2}\s*\d{3}|[1-9]\d{5})(?!\d)/g);

  // Sri
  str = str.replace(/=rf;jp/g, 'ஸ்ரீசக்தி');
  str = str.replace(/=/g, 'ஸ்ரீ');

  // Convert comma symbol '>' in Bamini to ','
  str = str.replace(/>/g, ', ');

  // English comma followed by space or after a word
  str = str.replace(/,\s+/g, '\uE200 ');
  str = str.replace(/([a-zA-Z0-9]),/g, '$1\uE200 ');

  // Special Bamini typewriter ligatures
  str = str.replace(/;\$/g, 'க்கூ');
  str = str.replace(/\$/g, 'கூ');

  const consonants = 'f|q|r|Q|l|z|j|e|g|b|k|a|u|y|t|o|s|w|d|\\[|\\\\]|\\]|S|`|h';

  // Double pre-base combinations:
  // h is only long O Aa-sign if not part of hp (ரி), hP (ரீ), or h; (ர்)
  str = str.replace(new RegExp(`N(${consonants})h(?![pP;])`, 'g'), '$1ோ');
  str = str.replace(new RegExp(`n(${consonants})h(?![pP;])`, 'g'), '$1ொ');
  str = str.replace(new RegExp(`N(${consonants})s(?![pP;])`, 'g'), '$1ௌ');
  str = str.replace(new RegExp(`n(${consonants})s(?![pP;])`, 'g'), '$1ௌ');

  // Pre-base single vowels: N -> ே, n -> ெ, i -> ை
  str = str.replace(new RegExp(`N(${consonants})`, 'g'), '$1ே');
  str = str.replace(new RegExp(`n(${consonants})`, 'g'), '$1ெ');
  str = str.replace(new RegExp(`i(${consonants})`, 'g'), '$1ை');

  // Multi-char Bamini glyphs:
  const multiCharMap = [
    // Two-character consonant + vowel / pulli
    { re: /f;/g, rep: 'க்' },
    { re: /q;/g, rep: 'ங்' },
    { re: /r;/g, rep: 'ச்' },
    { re: /Q;/g, rep: 'ஞ்' },
    { re: /l;/g, rep: 'ட்' },
    { re: /z;/g, rep: 'ண்' },
    { re: /j;/g, rep: 'த்' },
    { re: /e;/g, rep: 'ந்' },
    { re: /h;/g, rep: 'ர்' },
    { re: /b;/g, rep: 'ப்' },
    { re: /g;/g, rep: 'ப்' },
    { re: /k;/g, rep: 'ம்' },
    { re: /a;/g, rep: 'ய்' },
    { re: /u;/g, rep: 'ர்' },
    { re: /y;/g, rep: 'ல்' },
    { re: /t;/g, rep: 'வ்' },
    { re: /o;/g, rep: 'ழ்' },
    { re: /s;/g, rep: 'ள்' },
    { re: /w;/g, rep: 'ற்' },
    { re: /d;/g, rep: 'ன்' },
    { re: /\[;/g, rep: 'ஜ்' },
    { re: /\];/g, rep: 'ஸ்' },
    { re: /S;/g, rep: 'ஷ்' },
    { re: /\\;/g, rep: 'ஷ்' },
    { re: /`;/g, rep: 'ஹ்' },

    // Special u / uu combinations
    { re: /F\+/g, rep: 'கூ' },
    { re: /F/g, rep: 'கு' },
    { re: /G\+/g, rep: 'பூ' },
    { re: /G/g, rep: 'பு' },
    { re: /q\+/g, rep: 'ஙூ' },
    { re: /R\+/g, rep: 'சூ' },
    { re: /R/g, rep: 'சு' },
    { re: /Q\+/g, rep: 'ஞூ' },
    { re: /b\+/g, rep: 'டீ' },
    { re: /b/g, rep: 'டி' },
    { re: /B/g, rep: 'டீ' },
    { re: /L\+/g, rep: 'டூ' },
    { re: /L/g, rep: 'டு' },
    { re: /\^/g, rep: 'டூ' },
    { re: /zP/g, rep: 'ணீ' },
    { re: /zp/g, rep: 'ணி' },
    { re: /Z\+/g, rep: 'ணூ' },
    { re: /Z/g, rep: 'ணு' },
    { re: /jP/g, rep: 'தீ' },
    { re: /jp/g, rep: 'தி' },
    { re: /J\+/g, rep: 'தூ' },
    { re: /J/g, rep: 'து' },
    { re: /eP/g, rep: 'நீ' },
    { re: /ep/g, rep: 'நி' },
    { re: /E\+/g, rep: 'நூ' },
    { re: /E/g, rep: 'நு' },
    { re: /gP/g, rep: 'பீ' },
    { re: /gp/g, rep: 'பி' },
    { re: /kP/g, rep: 'மீ' },
    { re: /kp/g, rep: 'மி' },
    { re: /K\+/g, rep: 'மூ' },
    { re: /K/g, rep: 'மு' },
    { re: /aP/g, rep: 'யீ' },
    { re: /ap/g, rep: 'யி' },
    { re: /A\+/g, rep: 'யூ' },
    { re: /A/g, rep: 'யு' },
    { re: /hP/g, rep: 'ரீ' },
    { re: /hp/g, rep: 'ரி' },
    { re: /U\+/g, rep: 'ரூ' },
    { re: /U/g, rep: 'ரு' },
    { re: /yP/g, rep: 'லீ' },
    { re: /yp/g, rep: 'லி' },
    { re: /Y\+/g, rep: 'லூ' },
    { re: /Y/g, rep: 'லு' },
    { re: /tP/g, rep: 'வீ' },
    { re: /tp/g, rep: 'வி' },
    { re: /T\+/g, rep: 'வூ' },
    { re: /T/g, rep: 'வு' },
    { re: /oP/g, rep: 'ழீ' },
    { re: /op/g, rep: 'ழி' },
    { re: /O\+/g, rep: 'ழூ' },
    { re: /O/g, rep: 'ழு' },
    { re: /sP/g, rep: 'ளீ' },
    { re: /sp/g, rep: 'ளி' },
    { re: /S\+/g, rep: 'ளூ' },
    { re: /S/g, rep: 'ளு' },
    { re: /wP/g, rep: 'றீ' },
    { re: /wp/g, rep: 'றி' },
    { re: /W\+/g, rep: 'றூ' },
    { re: /W/g, rep: 'று' },
    { re: /dP/g, rep: 'னீ' },
    { re: /dp/g, rep: 'னி' },
    { re: /D\+/g, rep: 'னூ' },
    { re: /D/g, rep: 'னு' },

    // Grantha glyphs
    { re: /\[\{/g, rep: 'ஜு' },
    { re: /\[\}/g, rep: 'ஜூ' },
    { re: /\[p/g, rep: 'ஜி' },
    { re: /\[P/g, rep: 'ஜீ' },
    { re: /\[/g, rep: 'ஜ' },

    { re: /\]\{/g, rep: 'ஸு' },
    { re: /\]\}/g, rep: 'ஸூ' },
    { re: /\]p/g, rep: 'ஸி' },
    { re: /\]P/g, rep: 'ஸீ' },
    { re: /\]/g, rep: 'ஸ' },

    { re: /S\{/g, rep: 'ஷு' },
    { re: /S\}/g, rep: 'ஷூ' },
    { re: /Sp/g, rep: 'ஷி' },
    { re: /SP/g, rep: 'ஷீ' },
    { re: /\\\{/g, rep: 'ஷு' },
    { re: /\\\}/g, rep: 'ஷூ' },
    { re: /\\p/g, rep: 'ஷி' },
    { re: /\\P/g, rep: 'ஷீ' },
    { re: /\\/g, rep: 'ஷ' },

    { re: /`\{/g, rep: 'ஹு' },
    { re: /`\}/g, rep: 'ஹூ' },
    { re: /`p/g, rep: 'ஹி' },
    { re: /`P/g, rep: 'ஹீ' },
    { re: /`/g, rep: 'ஹ' },
    { re: /#/g, rep: 'ஷு' },

    // Consonants with Aa (ா) sign
    { re: /fh/g, rep: 'கா' },
    { re: /qh/g, rep: 'ஙா' },
    { re: /rh/g, rep: 'சா' },
    { re: /Qh/g, rep: 'ஞா' },
    { re: /lh/g, rep: 'டா' },
    { re: /zh/g, rep: 'ணா' },
    { re: /jh/g, rep: 'தா' },
    { re: /eh/g, rep: 'நா' },
    { re: /gh/g, rep: 'பா' },
    { re: /bh/g, rep: 'பா' },
    { re: /kh/g, rep: 'மா' },
    { re: /ah/g, rep: 'யா' },
    { re: /uh/g, rep: 'ரா' },
    { re: /yh/g, rep: 'லா' },
    { re: /th/g, rep: 'வா' },
    { re: /oh/g, rep: 'ழா' },
    { re: /sh/g, rep: 'ளா' },
    { re: /wh/g, rep: 'றா' },
    { re: /dh/g, rep: 'னா' },
    { re: /\[h/g, rep: 'ஜா' },
    { re: /\]h/g, rep: 'ஸா' },
    { re: /Sh/g, rep: 'ஷா' },
    { re: /\\h/g, rep: 'ஷா' },
    { re: /`h/g, rep: 'ஹா' },

    // Standalone vowels
    { re: /xs/g, rep: 'ஔ' },
    { re: /m/g, rep: 'அ' },
    { re: /M/g, rep: 'ஆ' },
    { re: /\,/g, rep: 'இ' },
    { re: /</g, rep: 'ஈ' },
    { re: /c/g, rep: 'உ' },
    { re: /C/g, rep: 'ஊ' },
    { re: /v/g, rep: 'எ' },
    { re: /V/g, rep: 'ஏ' },
    { re: /I/g, rep: 'ஐ' },
    { re: /x/g, rep: 'ஒ' },
    { re: /X/g, rep: 'ஓ' },
    { re: /%/g, rep: 'ஃ' },

    // Single consonants
    { re: /f/g, rep: 'க' },
    { re: /q/g, rep: 'ங' },
    { re: /r/g, rep: 'ச' },
    { re: /Q/g, rep: 'ஞ' },
    { re: /l/g, rep: 'ட' },
    { re: /z/g, rep: 'ண' },
    { re: /j/g, rep: 'த' },
    { re: /e/g, rep: 'ந' },
    { re: /g/g, rep: 'ப' },
    { re: /b/g, rep: 'ப' },
    { re: /k/g, rep: 'ம' },
    { re: /a/g, rep: 'ய' },
    { re: /u/g, rep: 'ர' },
    { re: /y/g, rep: 'ல' },
    { re: /t/g, rep: 'வ' },
    { re: /o/g, rep: 'ழ' },
    { re: /s/g, rep: 'ள' },
    { re: /w/g, rep: 'ற' },
    { re: /d/g, rep: 'ன' },
    { re: /h/g, rep: 'ா' },
    { re: /;/g, rep: '்' },
    { re: /P/g, rep: 'ீ' },
    { re: /p/g, rep: 'ி' },
    { re: /\{/g, rep: 'ு' },
    { re: /\}/g, rep: 'ூ' }
  ];

  for (const { re, rep } of multiCharMap) {
    str = str.replace(re, rep);
  }

  // Restore protected English comma
  str = str.replace(/\uE200/g, ',');

  // Restore protected tokens in reverse order
  for (let idx = protectedTokens.length - 1; idx >= 0; idx--) {
    const key = `\uE100${idx}\uE101`;
    str = str.split(key).join(protectedTokens[idx]);
  }

  return str.replace(/[ \t]+/g, ' ').trim();
}

export function stripDistrictFromAddressLine(addressStr, detectedDistrict = '') {
  if (!addressStr || typeof addressStr !== 'string') return '';
  let str = addressStr;

  const targetTerms = new Set();
  if (detectedDistrict) {
    targetTerms.add(detectedDistrict);
    for (const [tName, engName] of Object.entries(TAMIL_DISTRICT_MAP)) {
      if (engName.toLowerCase() === detectedDistrict.toLowerCase()) {
        targetTerms.add(tName);
      }
    }
  }

  for (const d of DISTRICTS_LIST) targetTerms.add(d);
  for (const tName of Object.keys(TAMIL_DISTRICT_MAP)) targetTerms.add(tName);

  for (const term of targetTerms) {
    if (!term || term.length < 2) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Notice: Do NOT use \b because Unicode/Tamil characters are non-word (\W) characters in JavaScript regex.
    // Use (?:^|[\s,;/\-]+) for start boundary and (?=$|[\s,;/\-\.]+) for end boundary,
    // with negative lookahead to preserve road/street names like 'மதுரை ரோடு' (Madurai Road).
    const pattern = new RegExp(
      '(?:^|[\\s,;\\/\\-]+)' + escaped + '(?:\\s*(?:Dt|District|மாவட்டம்|மாநிலம்))?\\.?' +
      '(?![\\s\\-]*(?:ரோடு|சாலை|தெரு|நகர்|வீதி|சந்து|லேன்|Road|Street|Nagar|Salai|Lane|Avenue|St|Rd))' +
      '(?=$|[\\s,;\\/\\-\\.]+)',
      'gi'
    );
    str = str.replace(pattern, ' ');
  }

  return str
    .replace(/\s+,\s+/g, ', ')
    .replace(/,+/g, ',')
    .replace(/^[,;\s\.\/\-]+|[,;\s\.\/\-]+$/g, '')
    .trim();
}

function deMashHorizontalGridText(fullText) {
  if (!fullText) return fullText;
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

  let multiHeaderLinesCount = 0;
  for (const l of lines) {
    const matches = l.match(/\b(?:[A-Za-z]|ஆ)[-\s]?\d{1,5}\b/gi);
    if (matches && matches.length >= 2) {
      multiHeaderLinesCount++;
    }
  }

  if (multiHeaderLinesCount === 0) return fullText;

  const colStreams = [];

  for (const l of lines) {
    let parts = l.split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean);
    
    if (parts.length <= 1 && (l.match(/\b(?:[A-Za-z]|ஆ)[-\s]?\d{1,5}\b/gi) || []).length >= 2) {
      parts = l.split(/(?=\b(?:[A-Za-z]|ஆ)[-\s]?\d{1,5}\b)/i).map(p => p.trim()).filter(Boolean);
    }

    if (parts.length === 0) continue;

    for (let c = 0; c < parts.length; c++) {
      while (colStreams.length <= c) {
        colStreams.push([]);
      }
      colStreams[c].push(parts[c]);
    }
  }

  const resultBlocks = [];
  for (const stream of colStreams) {
    if (stream.length > 0) {
      resultBlocks.push(stream.join('\n'));
    }
  }

  return resultBlocks.join('\n\n');
}

function extractTextFromOcrWordsByColumns(data) {
  const words = data?.words || [];
  if (!words || words.length === 0) return data?.text || '';

  const validWords = words.filter(w => w.text && w.text.trim());
  if (validWords.length === 0) return data?.text || '';

  let minX = Infinity;
  let maxX = -Infinity;
  for (const w of validWords) {
    if (w.bbox) {
      if (w.bbox.x0 < minX) minX = w.bbox.x0;
      if (w.bbox.x1 > maxX) maxX = w.bbox.x1;
    }
  }
  const width = maxX - minX;
  if (width <= 0) return data?.text || '';

  const cardHeaderX = [];
  for (const w of validWords) {
    if (/\b(?:[A-Za-z]|ஆ)[-\s\.]?0*\d{1,5}\b/i.test(w.text) && w.bbox) {
      cardHeaderX.push((w.bbox.x0 + w.bbox.x1) / 2);
    }
  }

  let numCols = 1;
  let colThresholds = [];

  if (cardHeaderX.length >= 2) {
    cardHeaderX.sort((a, b) => a - b);
    const clusters = [];
    for (const x of cardHeaderX) {
      let found = false;
      for (const cl of clusters) {
        const avg = cl.reduce((s, v) => s + v, 0) / cl.length;
        if (Math.abs(x - avg) < width * 0.15) {
          cl.push(x);
          found = true;
          break;
        }
      }
      if (!found) clusters.push([x]);
    }
    if (clusters.length >= 2) {
      numCols = clusters.length;
      const colCenters = clusters.map(cl => cl.reduce((s, v) => s + v, 0) / cl.length).sort((a, b) => a - b);
      for (let i = 0; i < colCenters.length - 1; i++) {
        colThresholds.push((colCenters[i] + colCenters[i + 1]) / 2);
      }
    }
  }

  // Single-column natural reading order reconstruction
  if (numCols <= 1 || colThresholds.length === 0) {
    const lineMap = new Map();
    for (const w of validWords) {
      const cy = w.bbox ? (w.bbox.y0 + w.bbox.y1) / 2 : 0;
      const yKey = Math.round(cy / 14) * 14;
      if (!lineMap.has(yKey)) lineMap.set(yKey, []);
      lineMap.get(yKey).push(w);
    }
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => a - b);
    const lines = [];
    for (const y of sortedY) {
      const lineWords = lineMap.get(y).sort((a, b) => (a.bbox?.x0 || 0) - (b.bbox?.x0 || 0));
      lines.push(lineWords.map(w => w.text.trim()).filter(Boolean).join(' '));
    }
    return lines.join('\n');
  }

  // Multi-column grouping
  const colWordsMap = new Map();
  for (let c = 0; c < numCols; c++) colWordsMap.set(c, []);

  for (const w of validWords) {
    const cx = w.bbox ? (w.bbox.x0 + w.bbox.x1) / 2 : minX;
    let colIdx = 0;
    for (let i = 0; i < colThresholds.length; i++) {
      if (cx > colThresholds[i]) colIdx = i + 1;
    }
    colWordsMap.get(colIdx).push(w);
  }

  const columnBlocks = [];
  for (let c = 0; c < numCols; c++) {
    const cWords = colWordsMap.get(c);
    if (cWords.length === 0) continue;

    const lineMap = new Map();
    for (const w of cWords) {
      const y = w.bbox ? Math.round((w.bbox.y0 + w.bbox.y1) / 2 / 12) * 12 : 0;
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push(w);
    }
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => a - b);
    const colLines = [];
    for (const y of sortedY) {
      const lineWords = lineMap.get(y).sort((a, b) => (a.bbox?.x0 || 0) - (b.bbox?.x0 || 0));
      colLines.push(lineWords.map(w => w.text.trim()).filter(Boolean).join(' '));
    }
    columnBlocks.push(colLines.join('\n'));
  }

  return columnBlocks.join('\n\n');
}

export function extractEverySingleBoxFromPdfPage(contentItems) {
  const validItems = (contentItems || []).filter(it => it && it.str && it.str.trim() && !isPdfMetadata(it.str));
  if (validItems.length === 0) return [];

  // Group items into box tokens by detecting Card Header anchors (e.g. T-0001, T -0001, M-0001)
  let boxes = [];
  let currentBoxTokens = [];

  for (let i = 0; i < validItems.length; i++) {
    const it = validItems[i];
    const text = it.str.trim();

    let isHeader = false;
    let nextCombined = text;
    if (validItems[i + 1]) {
      nextCombined = `${text} ${validItems[i + 1].str.trim()}`;
    }
    let nextCombined2 = nextCombined;
    if (validItems[i + 2]) {
      nextCombined2 = `${nextCombined} ${validItems[i + 2].str.trim()}`;
    }

    if (/^(?:[A-Za-z]|ஆ)\s*[-\–—_~]\s*\d{1,6}$/i.test(text) ||
        /^(?:[A-Za-z]|ஆ)\s*[-\–—_~]\s*\d{1,6}$/i.test(nextCombined) ||
        /^(?:[A-Za-z]|ஆ)\s*[-\–—_~]\s*\d{1,6}$/i.test(nextCombined2)) {
      isHeader = true;
    }

    if (isHeader && currentBoxTokens.length > 0) {
      boxes.push(currentBoxTokens);
      currentBoxTokens = [];
    }

    currentBoxTokens.push(it);
  }

  if (currentBoxTokens.length > 0) {
    boxes.push(currentBoxTokens);
  }

  const validBoxes = [];
  for (const bTokens of boxes) {
    const bText = bTokens.map(t => t.str).join(' ');
    if (/\b(?:[A-Za-z]|ஆ)[-\s]?0*\d{1,5}\b/i.test(bText)) {
      const lineMap = new Map();
      for (const t of bTokens) {
        const y = Math.round((t.transform ? t.transform[5] : 0) / 3) * 3;
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y).push(t);
      }
      const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
      const lines = [];
      for (const y of sortedY) {
        const lineWords = lineMap.get(y).sort((a, b) => (a.transform ? a.transform[4] : 0) - (b.transform ? b.transform[4] : 0));
        let lineStr = '';
        for (const w of lineWords) {
          const wStr = w.str.trim();
          if (!wStr) continue;
          if (lineStr && !lineStr.endsWith(' ') && !lineStr.endsWith('.') && !wStr.startsWith('.') && !wStr.startsWith('-') && !lineStr.endsWith('-')) {
            lineStr += ' ' + wStr;
          } else {
            lineStr += wStr;
          }
        }
        if (lineStr.trim()) lines.push(lineStr.trim());
      }
      if (lines.length > 0) {
        validBoxes.push(lines.join('\n'));
      }
    }
  }

  // If no card header anchors were found, fallback to 2D column clustering
  if (validBoxes.length === 0) {
    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    for (const it of validItems) {
      const x = it.transform ? it.transform[4] : 0;
      const y = it.transform ? it.transform[5] : 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const pageWidth = maxX - minX || 500;
    const colStep = pageWidth / 4;
    const colThresholds = [minX + colStep, minX + 2 * colStep, minX + 3 * colStep];
    const colItems = [[], [], [], []];

    for (const it of validItems) {
      const x = it.transform ? it.transform[4] : minX;
      let colIdx = 0;
      if (x > colThresholds[2]) colIdx = 3;
      else if (x > colThresholds[1]) colIdx = 2;
      else if (x > colThresholds[0]) colIdx = 1;
      colItems[colIdx].push(it);
    }

    for (let c = 0; c < 4; c++) {
      const items = colItems[c];
      if (items.length === 0) continue;
      const lineMap = new Map();
      for (const it of items) {
        const y = Math.round((it.transform ? it.transform[5] : 0) / 3) * 3;
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y).push(it);
      }
      const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
      const colLines = [];
      for (const y of sortedY) {
        const lineWords = lineMap.get(y).sort((a, b) => (a.transform ? a.transform[4] : 0) - (b.transform ? b.transform[4] : 0));
        let lineStr = lineWords.map(w => w.str.trim()).filter(Boolean).join(' ');
        if (lineStr) colLines.push(lineStr);
      }
      if (colLines.length > 0) {
        validBoxes.push(colLines.join('\n'));
      }
    }
  }

  return validBoxes;
}

export function parseSingleBoxToAddress(boxContent, fileName = 'Imported PDF') {
  if (!boxContent || typeof boxContent !== 'string') return null;

  const unicodeText = normalizeAndRepairTamilOCR(convertBaminiToUnicode(boxContent));
  const rawLines = unicodeText.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;

  // 1. Extract U.Id (e.g. T-0001, M-0001, A-0001, etc. Must strictly have an alphabet letter prefix and hyphen)
  let uId = getCardCode(boxContent) || getCardCode(unicodeText) || '';
  if (!uId) {
    const uMatch = boxContent.match(/(?:^|[\s\n\r\t,;\(\)\{\}\[\]•·])(?<![A-Za-z0-9])([A-Za-z]|ஆ)\s*[-\–—_~]\s*0*(\d{1,6})\b/i) ||
                   unicodeText.match(/(?:^|[\s\n\r\t,;\(\)\{\}\[\]•·])(?<![A-Za-z0-9])([A-Za-z]|ஆ)\s*[-\–—_~]\s*0*(\d{1,6})\b/i);
    if (uMatch) {
      let pfx = uMatch[1].toUpperCase();
      if (pfx === 'ஆ') pfx = 'M';
      if (/^[A-Z]$/.test(pfx)) {
        uId = `${pfx}-${String(parseInt(uMatch[2], 10)).padStart(4, '0')}`;
      }
    }
  }
  if (uId && !/^[A-Za-z]-\d{4,}$/.test(uId)) {
    uId = '';
  }

  // 2. Extract Phone Number
  let phone = '';
  const phoneMatch = unicodeText.match(/(?:Cell|Mobile|Ph|Mob|Tel|Phone)?\s*[\:\.\-]?\s*(?<!\d)([6-9]\d{4}\s*\d{5}|[6-9]\d{9})(?!\d)/i);
  if (phoneMatch) {
    const cleanPh = phoneMatch[1].replace(/\s+/g, '');
    if (cleanPh.length === 10) {
      phone = cleanPh;
    }
  }

  // 3. Extract strictly 6-digit Pincode (e.g. 627811, 627805, 628303, 625014, 641001)
  let pincode = '';
  const pincodeMatch = unicodeText.match(/(?:DE|Dr|DI|Dt|Pin|Pincode|PIN)?\s*(?<!\d)(6\d{2})\s*(\d{3})(?!\d)|(?:DE|Dr|DI|Dt|Pin|Pincode|PIN)?\s*(?<!\d)(6\d{5})(?!\d)|(?:DE|Dr|DI|Dt|Pin|Pincode|PIN)?\s*(?<!\d)([1-9]\d{2})\s*(\d{3})(?!\d)|(?:DE|Dr|DI|Dt|Pin|Pincode|PIN)?\s*(?<!\d)([1-9]\d{5})(?!\d)/i);
  if (pincodeMatch) {
    let cand = '';
    if (pincodeMatch[1] && pincodeMatch[2]) cand = pincodeMatch[1] + pincodeMatch[2];
    else if (pincodeMatch[3]) cand = pincodeMatch[3];
    else if (pincodeMatch[4] && pincodeMatch[5]) cand = pincodeMatch[4] + pincodeMatch[5];
    else if (pincodeMatch[6]) cand = pincodeMatch[6];

    const cleanPin = cand.replace(/\D/g, '');
    if (cleanPin.length === 6 && cleanPin !== phone && !cleanPin.startsWith('10') && !cleanPin.startsWith('11')) {
      pincode = cleanPin;
    }
  }

  // 4. Extract District
  let detectedDistrict = '';
  let hasExplicitDistrict = false;

  // Use Pincode to determine District First (Strongest signal)
  let possibleDistricts = null;
  if (pincode) {
    if (pincode.startsWith('628')) detectedDistrict = 'Thoothukudi';
    else if (pincode.startsWith('627')) possibleDistricts = ['Tenkasi', 'Tirunelveli'];
    else if (pincode.startsWith('625')) detectedDistrict = 'Madurai';
    else if (pincode.startsWith('641') || pincode.startsWith('642')) detectedDistrict = 'Coimbatore';
    else if (pincode.startsWith('600')) detectedDistrict = 'Chennai';
    else if (pincode.startsWith('622')) detectedDistrict = 'Pudukkottai';
  }

  // Fallback to text matching if pincode didn't uniquely determine it
  if (!detectedDistrict) {
    for (const [tName, engDistrict] of Object.entries(TAMIL_DISTRICT_MAP)) {
      if (unicodeText.includes(tName)) {
        if (!possibleDistricts || possibleDistricts.includes(engDistrict)) {
          detectedDistrict = engDistrict;
          hasExplicitDistrict = true;
          break;
        }
      }
    }
    if (!hasExplicitDistrict) {
      for (const d of DISTRICTS_LIST) {
        if (new RegExp(`\\b${d}\\b`, 'i').test(unicodeText)) {
          if (!possibleDistricts || possibleDistricts.includes(d)) {
            detectedDistrict = d;
            hasExplicitDistrict = true;
            break;
          }
        }
      }
    }
    if (!detectedDistrict) {
      detectedDistrict = possibleDistricts ? possibleDistricts[0] : 'Tenkasi'; // Final fallback
    }
  }

  if (!pincode || pincode.length !== 6) {
    pincode = detectedDistrict === 'Thoothukudi' ? '628303' : 
              (detectedDistrict === 'Tenkasi' ? '627811' : 
              (detectedDistrict === 'Coimbatore' ? '641001' : 
              (detectedDistrict === 'Madurai' ? '625014' : 
              (detectedDistrict === 'Chennai' ? '600001' : '627811'))));
  }

  // 5. Extract Post Office / Area / Village Name
  let areaName = '';
  const poMatch = unicodeText.match(/([\u0B80-\u0BFF\w\s]+?)\s*(?:Po|P\.O\.|போஸ்ட்|Tk|Taluk|தாலுகா)\b/i);
  if (poMatch) {
    let poCand = poMatch[1].replace(/^(S\/o|W\/o|D\/o|C\/o|&)\s*/i, '').trim();
    const poWords = poCand.split(/[\s,]+/).filter(Boolean);
    if (poWords.length > 0) {
      const lastWord = poWords[poWords.length - 1];
      if (lastWord.length >= 3 && !/^(Po|Tk|Dt|Dr|DE|DI|Cell|Tel|Ph|Mob)$/i.test(lastWord)) {
        areaName = lastWord;
      }
    }
  }

  // 6. Extract Door No
  let doorNo = '';
  const doorMatch = unicodeText.match(/(?:^|[\s,;])(?:(\d+[\/\-]\d+(?:\s*\(\s*\d+\s*\))?)|(?:No\.?\s*(\d+[A-Za-z]?))|(?:Door\s*No\.?\s*(\d+[A-Za-z]?))|([1-9]\d{0,3}\s*[\/\-]\s*\d+[A-Za-z]?)|(\bL\s*\d+\b))/i);
  if (doorMatch) {
    const rawDoor = (doorMatch[1] || doorMatch[2] || doorMatch[3] || doorMatch[4] || doorMatch[5] || doorMatch[0]).trim();
    if (!/\b(Tamil|India|Phone|Mobile|Pincode|Cell|\d{5,6}|\d{10}|T|M|Tk|Po|Dt)\b/i.test(rawDoor) && !/^(?:[A-Za-z]|ஆ)\s*-\s*\d+/i.test(rawDoor)) {
      doorNo = rawDoor;
    }
  }

  // 7. Parse Name, Relation, and Address Lines
  const contentLines = rawLines.filter(line => {
    // Skip U.Id only line (e.g. T-0001, M-0001)
    if (/^(?:[A-Za-z]|ஆ)[-\s\.\:—_–~]?\s*0*\d{1,5}$/i.test(line.trim())) return false;
    // Skip pure Cell line
    if (/^Cell\s*[\:\.]?\s*\d+/i.test(line)) return false;
    // Skip page headers
    if (/Sanju\s*Typed|Ten\s*-\s*Po|Po\s*&\s*Tk|\bPage\s*\d+\b/i.test(line)) return false;
    if (/^Sanju|^Ten\s*-|^வுநn/i.test(line)) return false;
    return true;
  });

  let name = '';
  let relation = '';
  let addressLines = [];

  for (let i = 0; i < contentLines.length; i++) {
    let line = contentLines[i].replace(/^(?:[A-Za-z]|ஆ)[-\s\.\:—_–~]?\s*0*\d{1,5}\b\s*/i, '').trim();
    if (!line) continue;

    // Check if line contains relationship (S/o, W/o, D/o, C/o)
    const relMatch = line.match(/(?:^|[\s,;])(S\/o|W\/o|D\/o|C\/o)[\.\:\s]*([^\n,;]+)/i);

    if (!name) {
      if (relMatch && relMatch.index !== undefined) {
        const beforeRel = line.substring(0, relMatch.index).replace(/^[,;\s]+|[,;\s]+$/g, '').trim();
        name = beforeRel || line;
        relation = `${relMatch[1].toUpperCase()}.${relMatch[2].trim()}`;
      } else {
        const split = splitNameAndAddressLine(line);
        name = split.name;
        if (split.address && split.address.trim()) {
          addressLines.push(split.address.trim());
        }
      }
    } else {
      if (relMatch && !relation) {
        relation = line;
      }
      addressLines.push(line);
    }
  }

  if (!name) {
    name = contentLines[0] || 'Contact Name';
  }

  // Assemble full address line
  let fullAddress = addressLines.join(', ')
    .replace(/(?:Cell|Mobile|Ph|Mob|Tel)?\s*[\:\.\-]?\s*(?<!\d)[6-9]\d{4}\s*\d{5}(?!\d)/gi, '')
    .replace(/(?:Cell|Mobile|Ph|Mob|Tel)?\s*[\:\.\-]?\s*(?<!\d)[6-9]\d{9}(?!\d)/gi, '')
    .replace(/(?:DE|Dr|DI|Dt|Pin|Pincode|PIN)?\s*(?<!\d)[1-9]\d{2}\s*\d{3}(?!\d)/gi, '')
    .replace(/(?:DE|Dr|DI|Dt|Pin|Pincode|PIN)?\s*(?<!\d)[1-9]\d{5}(?!\d)/gi, '')
    .replace(/Cell\s*[\:\.]?/gi, '')
    .replace(/\s+,\s+/g, ', ')
    .replace(/,+/g, ',')
    .replace(/^[,;\s]+|[,;\s]+$/g, '')
    .trim();

  // Clean district name out of address line so it is not duplicated
  fullAddress = stripDistrictFromAddressLine(fullAddress, detectedDistrict);

  if (!fullAddress) {
    fullAddress = `${name}'s Address`;
  }

  const finalArea = areaName || (detectedDistrict || 'Tenkasi');

  return {
    u_id: uId,
    name: name
      .replace(/(?:Cell|Mobile|Ph|Mob|Tel|Phone)[\s\:\.\-]*\+?\d[\d\s\-]*/gi, '')
      .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, '')
      .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, '')
      .replace(/\b\d{10}\b/g, '')
      .replace(/\b(Cell|Mobile|Phone|Tel|Mob)\b/gi, '')
      .replace(/[,;]/g, '')
      .trim()
      .substring(0, 70),
    door_no: doorNo,
    address_line_1: fullAddress.substring(0, 160),
    address_line_2: '',
    area: finalArea.substring(0, 50),
    city: finalArea.substring(0, 50),
    district: detectedDistrict,
    state: 'Tamil Nadu',
    country: 'India',
    pincode: pincode,
    phone: phone,
    landmark: '',
    notes: relation ? `Relation: ${relation}` : `Imported from ${fileName}`
  };
}

export async function parsePdfOrDocumentAddresses(file, rawText = null) {
  if (rawText && typeof rawText === 'string') {
    const convertedText = normalizeAndRepairTamilOCR(convertBaminiToUnicode(rawText));
    return parseUnstructuredBlocks(convertedText, 'Pasted Unstructured Text');
  }

  if (!file) return [];

  const fileName = file.name || 'Uploaded File';
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(fileName);

  if (isPdf) {
    try {
      const pdfjs = await loadPdfJsLibrary();
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const allExtractedAddresses = [];
      const fallbackTextLines = [];
      let totalItemsFound = 0;

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        const items = content.items || [];
        totalItemsFound += items.length;

        // 1. Precise Grid Box Extraction: Every single box is extracted as one address!
        const boxBlocks = extractEverySingleBoxFromPdfPage(items);

        if (boxBlocks && boxBlocks.length > 0) {
          for (const box of boxBlocks) {
            const parsedAddr = parseSingleBoxToAddress(box, fileName);
            if (parsedAddr && (parsedAddr.u_id || (parsedAddr.name && parsedAddr.name !== 'Contact Name' && !parsedAddr.name.includes('Sanju')))) {
              allExtractedAddresses.push(parsedAddr);
            }
          }
        } else {
          for (const item of items) {
            if (item.str && item.str.trim()) {
              fallbackTextLines.push(item.str.trim());
            }
          }
        }
      }

      // If Grid Box Parser successfully extracted boxes, return them directly!
      if (allExtractedAddresses.length > 0) {
        return allExtractedAddresses;
      }

      // If fallback text items exist, try unstructured multi-line block parsing
      if (fallbackTextLines.length > 0) {
        const fullText = convertBaminiToUnicode(fallbackTextLines.join('\n'));
        const blockAddresses = parseUnstructuredBlocks(fullText, fileName);
        if (blockAddresses && blockAddresses.length > 0) {
          return blockAddresses;
        }
      }

      // Step 3: If PDF contains no text items (scanned image PDF), fallback to Tesseract OCR!
      if (totalItemsFound === 0 && typeof document !== 'undefined') {
        const tesseract = await loadTesseractLibrary();
        const ocrAddresses = [];

        for (let i = 1; i <= Math.min(10, pdfDoc.numPages); i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          let result;
          try {
            result = await tesseract.recognize(canvas, 'tam+eng');
          } catch (ocrErr) {
            result = await tesseract.recognize(canvas, 'eng');
          }

          const columnOcrText = extractTextFromOcrWordsByColumns(result?.data);
          const fullText = normalizeAndRepairTamilOCR(convertBaminiToUnicode(columnOcrText || result?.data?.text || ''));
          const pageParsed = parseUnstructuredBlocks(fullText, `${fileName} (Page ${i})`);
          if (pageParsed.length > 0) {
            ocrAddresses.push(...pageParsed);
          }
        }

        if (ocrAddresses.length > 0) {
          return ocrAddresses;
        }
      }
    } catch (err) {
      console.warn('PDF parsing error:', err);
    }
  } else if (isImage) {
    try {
      const tesseract = await loadTesseractLibrary();
      const preprocessed = await preprocessImageForTamilOCR(file);
      
      let fullText = '';
      if (preprocessed && preprocessed.isColumns && preprocessed.columns.length > 0) {
        const columnTexts = [];
        for (let c = 0; c < preprocessed.columns.length; c++) {
          const colCanvas = preprocessed.columns[c];
          let colResult;
          try {
            colResult = await tesseract.recognize(colCanvas, 'tam+eng');
          } catch (ocrErr) {
            colResult = await tesseract.recognize(colCanvas, 'eng');
          }
          if (colResult?.data?.text) {
            columnTexts.push(colResult.data.text.trim());
          }
        }
        fullText = normalizeAndRepairTamilOCR(convertBaminiToUnicode(columnTexts.join('\n\n')));
      } else {
        const singleCanvas = (preprocessed && preprocessed.canvas) ? preprocessed.canvas : preprocessed;
        let result;
        try {
          result = await tesseract.recognize(singleCanvas, 'tam+eng');
        } catch (ocrErr) {
          console.warn('Tamil OCR model fallback to eng:', ocrErr);
          result = await tesseract.recognize(singleCanvas, 'eng');
        }
        
        const columnOcrText = extractTextFromOcrWordsByColumns(result?.data);
        fullText = normalizeAndRepairTamilOCR(convertBaminiToUnicode(columnOcrText || result?.data?.text || ''));
      }

      const addresses = parseUnstructuredBlocks(fullText, fileName);
      if (addresses.length > 0) return addresses;
      return parseSingleLineTableRows(fullText, fileName);
    } catch (err) {
      console.warn('OCR image parsing error:', err);
    }
  } else if (fileName.toLowerCase().endsWith('.docx')) {
    try {
      const JSZip = await loadJSZipLibrary();
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const xmlFile = zip.file('word/document.xml');
      if (xmlFile) {
        const xmlText = await xmlFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Extract Word Tables (<w:tbl>)
        const { extractedRows, textLines } = extractDocxTablesAndParagraphs(xmlDoc);

        if (extractedRows && extractedRows.length > 0) {
          const docxTableAddresses = processDocxTableRows(extractedRows, fileName);
          if (docxTableAddresses && docxTableAddresses.length > 0) {
            return docxTableAddresses;
          }
        }

        const fullText = convertBaminiToUnicode(textLines.join('\n'));
        const blockAddresses = parseUnstructuredBlocks(fullText, fileName);
        if (blockAddresses && blockAddresses.length > 0) return blockAddresses;
        return parseSingleLineTableRows(fullText, fileName);
      }
    } catch (err) {
      console.warn('DOCX file parsing error:', err);
    }
  } else if (fileName.toLowerCase().endsWith('.rtf')) {
    try {
      const rtfText = await file.text();
      const cleanText = parseRtfText(rtfText);
      const fullText = convertBaminiToUnicode(cleanText);
      const blockAddresses = parseUnstructuredBlocks(fullText, fileName);
      if (blockAddresses && blockAddresses.length > 0) return blockAddresses;
      return parseSingleLineTableRows(fullText, fileName);
    } catch (err) {
      console.warn('RTF WordPad parsing error:', err);
    }
  } else {
    // TXT or plain document file (.doc / .txt)
    try {
      const rawFileText = await file.text();
      const fullText = convertBaminiToUnicode(rawFileText);
      const blockAddresses = parseUnstructuredBlocks(fullText, fileName);
      if (blockAddresses && blockAddresses.length > 0) return blockAddresses;
      return parseSingleLineTableRows(fullText, fileName);
    } catch (err) {
      console.warn('File reading error:', err);
    }
  }

  return [];
}

function isPdfMetadata(str) {
  if (!str || str.length < 2) return true;
  if (/^%PDF/i.test(str)) return true;
  if (/^(endobj|startxref|trailer|xref|stream|endstream|BT|ET|\d+\s+\d+\s+obj|<<|>>|\/Type|\/Rotate|\/Pages|\/Size)$/i.test(str)) return true;
  if (/(AFRelationship|C2PA|Manifest|Catalog|MediaBox|Font|Type1|Helvetica|SSL Corporation|OpenAI|BaseFont|ProcSet|\/Prev|\/Root|00000 n)/i.test(str)) return true;
  if (/[\uFFFD\x00-\x08\x0B\x0C\x0E-\x1F]/.test(str)) return true;
  return false;
}

function processOriginalExtractedRows(rows, fileName) {
  const addresses = [];

  for (const rawTokens of rows) {
    const tokens = rawTokens.map(t => convertBaminiToUnicode(t));
    const fullLine = tokens.join(' ');

    // Skip table header row
    if (/S\.No|Name|Address|City|District|State|Pincode|Phone/i.test(fullLine) && tokens.length <= 8 && !/\d{6}/.test(fullLine)) {
      continue;
    }
    if (isPdfMetadata(fullLine)) continue;

    // Find pincode and phone tokens
    const pincodeToken = tokens.find(t => /\b[1-9][0-9]{5}\b/.test(t));
    const phoneToken = tokens.find(t => /\b[6-9][0-9]{9}\b/.test(t));

    if (!pincodeToken && !phoneToken) continue;

    const pincode = pincodeToken ? pincodeToken.match(/\b[1-9][0-9]{5}\b/)[0] : '600001';
    const phone = phoneToken ? phoneToken.match(/\b[6-9][0-9]{9}\b/)[0] : '';

    // Filter out serial numbers (1-100), pincode, phone, state, and country
    const contentTokens = tokens.filter(t => 
      !/^\d{1,3}$/.test(t) &&
      t !== pincodeToken &&
      t !== phoneToken &&
      !/^(Tamil Nadu|India|State)$/i.test(t)
    );

    if (contentTokens.length < 1) continue;

    // Detect district
    let detectedDistrict = 'Coimbatore';
    for (const d of DISTRICTS_LIST) {
      if (new RegExp(`\\b${d}\\b`, 'i').test(fullLine)) {
        detectedDistrict = d;
        break;
      }
    }

    // Name is the first non-numeric content token
    const firstToken = contentTokens[0] ? contentTokens[0].trim() : '';
    if (!firstToken || firstToken.length < 2) continue;
    let name = convertBaminiToUnicode(firstToken);
    let addressPart = contentTokens.slice(1).join(' ').trim();
    if (addressPart) {
      addressPart = convertBaminiToUnicode(addressPart);
      addressPart = stripDistrictFromAddressLine(addressPart, detectedDistrict);
    }
    if (!addressPart) addressPart = `${name}'s Address`;

    addresses.push({
      name: name.replace(/[,;]/g, '').trim().substring(0, 60),
      door_no: (addressPart.match(/\b\d+[\/\-]\d+\b|\bNo\.\s*\d+\b|\bDoor\s*No?:\s*\d+\b/i) || [''])[0],
      address_line_1: addressPart.substring(0, 100),
      address_line_2: '',
      area: detectedDistrict,
      city: detectedDistrict,
      district: detectedDistrict,
      state: 'Tamil Nadu',
      country: 'India',
      pincode,
      phone,
      landmark: '',
      notes: `Imported from ${fileName}`
    });
  }

  return addresses;
}

function getCardCode(line) {
  if (!line || typeof line !== 'string') return null;
  const clean = line.trim();

  // Match card code strictly starting with an isolated alphabet letter followed by hyphen:
  // e.g. "M-0001", "T-0001", "A-0001", "ஆ-0001", "T-10"
  // Words like Dt, Tk, Dr, No, Door, Cell are strictly disallowed as U.Id prefixes!
  const m = clean.match(/(?:^|[\s\n\r\t,;\(\)\{\}\[\]•·])(?<![A-Za-z0-9])([A-Za-z]|ஆ)\s*[-\–—_~]\s*0*(\d{1,6})\b/i);
  if (m) {
    let prefix = m[1].toUpperCase();
    if (prefix === 'ஆ') prefix = 'M';
    if (/^[A-Z]$/.test(prefix)) {
      const num = parseInt(m[2], 10);
      if (num >= 1 && num <= 99999) {
        return `${prefix}-${String(num).padStart(4, '0')}`;
      }
    }
  }

  return null;
}

function isCardStartLine(line) {
  if (!line) return false;
  if (getCardCode(line)) return true;
  if (/^\d{1,3}[\.\)]\s+/.test(line.trim())) return true;
  return false;
}

function splitNameAndAddressLine(line) {
  if (!line || typeof line !== 'string') return { name: line, address: '' };

  // Remove leading index prefix or U.Id if still present
  let clean = line.replace(/^(?:[A-Za-z]|ஆ)[-\s\.]?0*\d{1,5}\b\s*/i, '').trim();
  clean = clean.replace(/^\d{1,3}[\.\)]\s*/, '').trim();
  clean = clean.replace(/^\d{1,3}[\.\)]\s*/, '').trim();

  const addressKeywords = [
    'தெற்கு\\s*காலனி', 'மேலக்காலனி', 'மேற்குகாலனி', 'வடக்கு\\s*காலனி', 'கிழக்கு\\s*காலனி',
    'தெற்கு\\s*தெரு', 'மேற்கு\\s*தெரு', 'வடக்கு\\s*தெரு', 'கிழக்கு\\s*தெரு', 'தெற்குக்கலனி',
    'மேலக்கலனி', 'தெற்கு', 'வடக்கு', 'மேற்கு', 'கிழக்கு', 'மேல', 'கீழ', 'காலனி', 'காலணி', 'கலனி',
    'தெரு', 'நகர்', 'நகரி', 'கிராமம்', 'ரோடு', 'சாலை', 'வீதி', 'சந்து', 'லேன்', 'அடுக்ககம்',
    'பிளாட்', 'பில்டிங்', 'அவுஸ்', 'நாரைக்கிணறு', 'நாரைகிணறு', 'ஓட்டப்பிடாரம்', 'ஒட்டப்பிடாரம்',
    'No\\.?\\s*\\d+', 'Door\\s*No\\.?\\s*\\d+', 'Po\\b', 'Tk\\b', 'Dt\\b', 'Dr\\b', 'DE\\b', 'DI\\b', 'TE\\b', 'D\\b'
  ];

  const addressSplitRegex = new RegExp(`(?:^|[\\s,;])(${addressKeywords.join('|')})`, 'i');

  const match = clean.match(addressSplitRegex);
  if (match && match.index !== undefined) {
    const splitIdx = match.index + (match[0].startsWith(' ') || match[0].startsWith(',') || match[0].startsWith(';') ? 1 : 0);
    if (splitIdx > 0) {
      const namePart = clean.substring(0, splitIdx).trim();
      const addressPart = clean.substring(splitIdx).trim();
      if (namePart.length >= 2) {
        return {
          name: namePart.replace(/^[,;\s]+|[,;\s]+$/g, '').trim(),
          address: addressPart
        };
      }
    }
  }

  return { name: clean.replace(/^[,;\s]+|[,;\s]+$/g, '').trim(), address: '' };
}

function segmentIntoAddressBlocks(fullText) {
  if (!fullText) return [];

  const text = deMashHorizontalGridText(fullText);

  const pincodePattern = /(?:(?:DE|Dr|DI|Dt|TE|D|Pin|Pincode|PIN|P\.O\.|Po)\.?\s*)?(?<!\d)([1-9]\d{2})\s*(\d{3})(?!\d)|(?:(?:DE|Dr|DI|Dt|TE|D|Pin|Pincode|PIN|P\.O\.|Po)\.?\s*)?(?<!\d)([1-9]\d{5})(?!\d)/gi;
  const phonePattern = /(?:Cell|Mobile|Ph|Mob|Tel|DI|DE|Dr|Dt)?\s*[\:\.\-]?\s*(?<!\d)([6-9]\d{4}\s*\d{5}|[6-9]\d{9})(?!\d)/gi;
  const uidGlobalRegex = /(?:^|[\s\n\r\t,;\(\)\{\}\[\]•·])(?<![A-Za-z0-9])([A-Za-z]|ஆ)\s*[-\–—_~]\s*0*(\d{1,6})\b/gi;

  // 1. Check if multi-line text consists of self-contained address lines
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let isEachLineAnAddress = false;

  if (rawLines.length >= 2) {
    let linesWithPinOrDistrictOrUid = 0;
    for (const line of rawLines) {
      const hasUid = /(?:^|[\s\n\r\t,;\(\)\{\}\[\]•·])(?<![A-Za-z0-9])([A-Za-z]|ஆ)\s*[-\–—_~]\s*0*(\d{1,6})\b/i.test(line);
      pincodePattern.lastIndex = 0;
      const hasPin = pincodePattern.test(line);
      const hasDistrictOrTk = /தூத்துக்குடி|திருநெல்வேலி|தென்காசி|சென்னை|கோவை|மதுரை|Salem|Coimbatore|Chennai|Madurai|Tk|Po|Dt|Dr|Taluk|தாலுகா/i.test(line);
      if (hasUid || hasPin || hasDistrictOrTk) {
        linesWithPinOrDistrictOrUid++;
      }
    }
    if (linesWithPinOrDistrictOrUid >= rawLines.length * 0.7) {
      isEachLineAnAddress = true;
    }
  }

  let primaryBlocks = [];

  if (isEachLineAnAddress) {
    for (const line of rawLines) {
      let uId = '';
      const uMatch = line.match(/(?:^|[\s\n\r\t,;\(\)\{\}\[\]•·])(?<![A-Za-z0-9])([A-Za-z]|ஆ)\s*[-\–—_~]\s*0*(\d{1,6})\b/i);
      if (uMatch) {
        let pfx = uMatch[1].toUpperCase();
        if (pfx === 'ஆ') pfx = 'M';
        if (/^[A-Z]$/.test(pfx)) {
          uId = `${pfx}-${String(parseInt(uMatch[2], 10)).padStart(4, '0')}`;
        }
      }
      primaryBlocks.push({ uId, content: line });
    }
  } else {
    // 2. Continuous text: Match valid M-code, T-code, or other alphabet U.Id anchors across the entire text
    const uidAnchors = [];
    let m;
    uidGlobalRegex.lastIndex = 0;
    while ((m = uidGlobalRegex.exec(text)) !== null) {
      const rawMatch = m[0].trim();
      const matchIndex = m.index;
      let prefix = m[1].toUpperCase();
      if (prefix === 'ஆ') prefix = 'M';
      if (!/^[A-Z]$/.test(prefix)) continue;
      const numPart = m[2];
      if (numPart) {
        const num = parseInt(numPart, 10);
        // Check surrounding context: if preceded by Dr, Dt, DE, DI, Tk, Po -> ignore as it's a pincode label
        const beforeContext = text.substring(Math.max(0, matchIndex - 6), matchIndex);
        if (/Dr|Dt|DE|DI|Tk|Po|Tel|Cell/i.test(beforeContext)) {
          continue;
        }
        if (num >= 1 && num <= 99999) {
          uidAnchors.push({
            uId: `${prefix}-${String(num).padStart(4, '0')}`,
            start: matchIndex,
            raw: rawMatch
          });
        }
      }
    }

    if (uidAnchors.length > 0) {
      if (uidAnchors[0].start > 0) {
        const leadingText = text.substring(0, uidAnchors[0].start).trim();
        if (leadingText.length > 10) {
          primaryBlocks.push({ uId: '', content: leadingText });
        }
      }

      for (let i = 0; i < uidAnchors.length; i++) {
        const current = uidAnchors[i];
        const next = uidAnchors[i + 1];
        const startPos = current.start;
        const endPos = next ? next.start : text.length;
        const blockContent = text.substring(startPos, endPos).trim();
        if (blockContent) {
          primaryBlocks.push({
            uId: current.uId,
            content: blockContent
          });
        }
      }
    } else {
      // If no U.Id anchors, check if numbered lines exist
      const cleanLines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !isPdfMetadata(line));

      let cur = [];
      for (const line of cleanLines) {
        if (/^\d{1,3}[\.\)]\s+/.test(line) && cur.length > 0) {
          primaryBlocks.push({ uId: '', content: cur.join('\n') });
          cur = [];
        }
        cur.push(line);
      }
      if (cur.length > 0) {
        primaryBlocks.push({ uId: '', content: cur.join('\n') });
      }
      if (primaryBlocks.length === 0) {
        primaryBlocks.push({ uId: '', content: text.trim() });
      }
    }
  }

  // 3. Sub-divide any block if it contains multiple pincodes or multiple phone numbers (regardless of uId)
  const finalBlocks = [];

  for (const block of primaryBlocks) {
    const content = block.content;

    // Find all pincode match positions
    const pinMatches = [];
    let pinMatch;
    pincodePattern.lastIndex = 0;
    while ((pinMatch = pincodePattern.exec(content)) !== null) {
      pinMatches.push({
        start: pinMatch.index,
        end: pinMatch.index + pinMatch[0].length,
        val: (pinMatch[1] && pinMatch[2]) ? (pinMatch[1] + pinMatch[2]) : (pinMatch[3] || pinMatch[0])
      });
    }

    // Find all phone match positions
    const phoneMatches = [];
    let pMatch;
    phonePattern.lastIndex = 0;
    while ((pMatch = phonePattern.exec(content)) !== null) {
      phoneMatches.push({
        start: pMatch.index,
        end: pMatch.index + pMatch[0].length,
        val: pMatch[1].replace(/\s+/g, '')
      });
    }

    // Split after every pincode boundary (and optional immediate phone number)
    if (pinMatches.length >= 1) {
      let lastCut = 0;
      for (let i = 0; i < pinMatches.length; i++) {
        const curPin = pinMatches[i];

        // Check if there is an immediately adjacent phone number right after this pincode
        const afterPinText = content.substring(curPin.end);
        const adjacentPhoneMatch = afterPinText.match(/^\s*[\:\.\-,\/]?\s*(?:Cell|Mobile|Ph|Mob|Tel|Phone)?\s*[\:\.\-]?\s*(?<!\d)([6-9]\d{4}\s*\d{5}|[6-9]\d{9})(?!\d)/i);

        let pinBoundaryEnd = curPin.end;
        if (adjacentPhoneMatch && adjacentPhoneMatch.index !== undefined) {
          pinBoundaryEnd = curPin.end + adjacentPhoneMatch[0].length;
        }

        if (i === pinMatches.length - 1) {
          const subChunk = content.substring(lastCut, pinBoundaryEnd).trim();
          if (subChunk) {
            finalBlocks.push({
              uId: i === 0 ? block.uId : '',
              content: subChunk
            });
          }

          // Check if there is meaningful trailing text AFTER this last pincode (which is another address!)
          const trailingText = content.substring(pinBoundaryEnd).trim();
          if (trailingText.length >= 8 && !/^[,\.\-\s]+$/.test(trailingText)) {
            finalBlocks.push({
              uId: '',
              content: trailingText
            });
          }
          lastCut = pinBoundaryEnd;
        } else {
          const nextPin = pinMatches[i + 1];
          let splitPoint = pinBoundaryEnd;
          const nextNl = content.indexOf('\n', splitPoint);
          if (nextNl !== -1 && nextNl < nextPin.start) {
            splitPoint = nextNl + 1;
          }

          const subChunk = content.substring(lastCut, splitPoint).trim();
          if (subChunk) {
            finalBlocks.push({
              uId: i === 0 ? block.uId : '',
              content: subChunk
            });
          }
          lastCut = splitPoint;
        }
      }
    }
    // If block has multiple phone numbers (and no pincode), split after each phone boundary!
    else if (phoneMatches.length >= 2) {
      let lastCut = 0;
      for (let i = 0; i < phoneMatches.length; i++) {
        const curPhone = phoneMatches[i];
        if (i === phoneMatches.length - 1) {
          const subChunk = content.substring(lastCut).trim();
          if (subChunk) {
            finalBlocks.push({
              uId: i === 0 ? block.uId : '',
              content: subChunk
            });
          }
        } else {
          const nextPhone = phoneMatches[i + 1];
          const nextNl = content.indexOf('\n', curPhone.end);
          const splitPoint = (nextNl !== -1 && nextNl < nextPhone.start) ? nextNl + 1 : curPhone.end;
          const subChunk = content.substring(lastCut, splitPoint).trim();
          if (subChunk) {
            finalBlocks.push({
              uId: i === 0 ? block.uId : '',
              content: subChunk
            });
          }
          lastCut = splitPoint;
        }
      }
    } else {
      finalBlocks.push(block);
    }
  }

  return finalBlocks;
}

function parseUnstructuredBlocks(fullText, fileName) {
  if (!fullText) return [];

  const rawBlocks = segmentIntoAddressBlocks(fullText);
  const results = [];

  for (const block of rawBlocks) {
    const blockText = block.content;
    const lines = blockText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Skip generic document header titles
    if (lines.length === 1 && !/\d{4,6}|\d{10}|(?:[A-Za-z]|ஆ)[-\s]?\d{2,5}/i.test(lines[0]) && !block.uId && lines[0].length < 15) continue;

    let uId = block.uId || getCardCode(blockText) || '';
    if (!uId) {
      const uMatch = blockText.match(/(?:^|[\s\n\r\t,;\(\)\{\}\[\]•·])(?<![A-Za-z0-9])([A-Za-z]|ஆ)\s*[-\–—_~]\s*0*(\d{1,6})\b/i);
      if (uMatch) {
        let pfx = uMatch[1].toUpperCase();
        if (pfx === 'ஆ') pfx = 'M';
        if (/^[A-Z]$/.test(pfx)) {
          uId = `${pfx}-${String(parseInt(uMatch[2], 10)).padStart(4, '0')}`;
        }
      }
    }
    if (uId && !/^[A-Za-z]-\d{4,}$/.test(uId)) {
      uId = '';
    }

    let phone = '';
    let pincode = '';
    let doorNo = '';
    let areaName = '';
    let state = 'Tamil Nadu';

    // 1. Extract Phone Number (10-digit mobile or landline with STD area code)
    const phoneMatch = blockText.match(/(?:Cell|Mobile|Ph|Mob|Tel|Phone|DI|DE|Dr|Dt)?\s*[\:\.\-]?\s*(?<!\d)(0\d{2,4}\s*[\-\s]?\s*\d{5,8}|[6-9]\d{4}\s*\d{5}|[6-9]\d{9})(?!\d)/i);
    if (phoneMatch) {
      const cleanPhone = phoneMatch[1].replace(/\s+/g, '');
      if (cleanPhone.length >= 8 && cleanPhone.length <= 12) {
        phone = cleanPhone;
      }
    }

    // 2. Extract strictly 6-digit Pincode FIRST to help with District matching
    const pincodeMatch = blockText.match(/(?:DE|Dr|DI|Dt|TE|D|Pin|Pincode|PIN|P\.O\.|Po)?\.?\s*(?<!\d)(6\d{2})\s*(\d{3})(?!\d)|(?:DE|Dr|DI|Dt|TE|D|Pin|Pincode|PIN|P\.O\.|Po)?\.?\s*(?<!\d)(6\d{5})(?!\d)|(?:DE|Dr|DI|Dt|TE|D|Pin|Pincode|PIN|P\.O\.|Po)?\.?\s*(?<!\d)([1-9]\d{2})\s*(\d{3})(?!\d)|(?:DE|Dr|DI|Dt|TE|D|Pin|Pincode|PIN|P\.O\.|Po)?\.?\s*(?<!\d)([1-9]\d{5})(?!\d)/i);
    if (pincodeMatch) {
      let cand = '';
      if (pincodeMatch[1] && pincodeMatch[2]) cand = pincodeMatch[1] + pincodeMatch[2];
      else if (pincodeMatch[3]) cand = pincodeMatch[3];
      else if (pincodeMatch[4] && pincodeMatch[5]) cand = pincodeMatch[4] + pincodeMatch[5];
      else if (pincodeMatch[6]) cand = pincodeMatch[6];

      const cleanPin = cand.replace(/\D/g, '');
      if (cleanPin.length === 6 && cleanPin !== phone && !cleanPin.startsWith('10') && !cleanPin.startsWith('11')) {
        pincode = cleanPin;
      }
    }

    let detectedDistrict = '';
    let hasExplicitDistrict = false;

    // Use Pincode to determine District First
    let possibleDistricts = null;
    if (pincode) {
      if (pincode.startsWith('628')) detectedDistrict = 'Thoothukudi';
      else if (pincode.startsWith('627')) possibleDistricts = ['Tenkasi', 'Tirunelveli'];
      else if (pincode.startsWith('625')) detectedDistrict = 'Madurai';
      else if (pincode.startsWith('641') || pincode.startsWith('642')) detectedDistrict = 'Coimbatore';
      else if (pincode.startsWith('600')) detectedDistrict = 'Chennai';
      else if (pincode.startsWith('622')) detectedDistrict = 'Pudukkottai';
    }

    // Fallback to text matching
    if (!detectedDistrict) {
      for (const [tName, engDistrict] of Object.entries(TAMIL_DISTRICT_MAP)) {
        if (blockText.includes(tName)) {
          if (!possibleDistricts || possibleDistricts.includes(engDistrict)) {
            detectedDistrict = engDistrict;
            hasExplicitDistrict = true;
            break;
          }
        }
      }
      if (!hasExplicitDistrict) {
        for (const d of DISTRICTS_LIST) {
          if (new RegExp(`\\b${d}\\b`, 'i').test(blockText)) {
            if (!possibleDistricts || possibleDistricts.includes(d)) {
              detectedDistrict = d;
              hasExplicitDistrict = true;
              break;
            }
          }
        }
      }
      if (!detectedDistrict) {
        detectedDistrict = possibleDistricts ? possibleDistricts[0] : 'Tenkasi'; // Final fallback
      }
    }

    if (!pincode || pincode.length !== 6) {
      pincode = detectedDistrict === 'Thoothukudi' ? '628303' : 
                (detectedDistrict === 'Tenkasi' ? '627811' : 
                (detectedDistrict === 'Coimbatore' ? '641001' : 
                (detectedDistrict === 'Madurai' ? '625014' : 
                (detectedDistrict === 'Chennai' ? '600001' : '627811'))));
    }

    // 4. Extract Post Office / Taluk / Village Area
    const poMatch = blockText.match(/([\u0B80-\u0BFF\w\s]+?)\s*(?:Po|P\.O\.|போஸ்ட்|Tk|Taluk|தாலுகா)\b/i);
    if (poMatch) {
      let poCand = poMatch[1].replace(/^(S\/o|W\/o|D\/o|C\/o|&)\s*/i, '').trim();
      const poWords = poCand.split(/[\s,]+/).filter(Boolean);
      if (poWords.length > 0) {
        const lastWord = poWords[poWords.length - 1];
        if (lastWord.length >= 3 && !/^(Po|Tk|Dt|Dr|DE|DI|TE|D|Cell|Tel|Ph|Mob)$/i.test(lastWord)) {
          areaName = lastWord;
        }
      }
    }
    if (!areaName) {
      if (blockText.includes('ஓட்டப்பிடாரம்') || blockText.includes('ஒட்டப்பிடாரம்')) areaName = 'ஓட்டப்பிடாரம்';
      else if (blockText.includes('நாரைக்கிணறு') || blockText.includes('நாரைகிணறு')) areaName = 'நாரைக்கிணறு';
    }

    // 5. Door No
    const doorMatch = blockText.match(/\b(?:\d+[\/\-]\d+|No\.?\s*\d+|Door\s*No\.?\s*\d+)\b/i);
    if (doorMatch && !/\b(Tamil|India|Phone|Mobile|Pincode|Cell|\d{5,6}|\d{10})\b/i.test(doorMatch[0])) {
      doorNo = doorMatch[0];
    }

    // 6. Name and Address Line 1 extraction
    let cleanedText = blockText
      .replace(/(?:^|\b)(?:[A-Za-z]|ஆ)[-\s\.\:—_–~]?\s*0*\d{1,6}\b/gi, '')
      .replace(/(?:Cell|Phone|Mobile|Ph|Mob|Tel|DI|DE|Dr|Dt|TE|D)?\s*[\:\.\-]?\s*(?<!\d)(?:0\d{2,4}\s*[\-\s]?\s*\d{5,8}|[6-9]\d{4}\s*\d{5}|[6-9]\d{9})(?!\d)/gi, '')
      .replace(/\b0\d{2,4}\s*[-\:]\s*/g, '')
      .replace(/(?:DE|Dr|DI|Dt|TE|D|Pin|Pincode|PIN|Po|P\.O\.)?\.?\s*(?<!\d)[1-9]\d{2}\s*\d{3}(?!\d)/gi, '')
      .replace(/(?:DE|Dr|DI|Dt|TE|D|Pin|Pincode|PIN|Po|P\.O\.)?\.?\s*(?<!\d)[1-9]\d{4,5}(?!\d)/gi, '')
      .replace(/Tamil\s*Nadu(\s*[\-\:]\s*\d{6})?/gi, '')
      .replace(/Cell\s*[\:\.]?/gi, '')
      .replace(/\b(?:Dt|Dr|DE|DI|TE|D|Po)\b\.?/gi, '')
      .trim();

    const textLines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);
    let name = '';
    let addressParts = [];

    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];
      if (!line) continue;
      if (/^(?:10\d{3}|1\d{4}|\d{4,6}|0\d{2,4}\s*[-\:]?)$/.test(line)) continue;

      if (!name) {
        const split = splitNameAndAddressLine(line);
        name = split.name;
        if (split.address && split.address.trim()) {
          addressParts.push(split.address.trim());
        }
      } else {
        addressParts.push(line);
      }
    }

    if (!name && textLines.length > 0) {
      name = textLines[0];
    }

    if (name) {
      name = convertBaminiToUnicode(name).trim();
    }

    let fullAddressLine = addressParts.join(', ')
      .replace(/\s+,\s+/g, ', ')
      .replace(/,+/g, ',')
      .replace(/^[,;\s]+|[,;\s]+$/g, '')
      .trim();

    if (fullAddressLine) {
      fullAddressLine = convertBaminiToUnicode(fullAddressLine).trim();
      fullAddressLine = stripDistrictFromAddressLine(fullAddressLine, detectedDistrict);
    }

    const finalArea = areaName ? convertBaminiToUnicode(areaName) : (detectedDistrict || 'Tenkasi');

    // ONLY push if name is valid (at least 2 chars, not pure digits, not metadata or document headers)
    if (name && name.length >= 2 && !/^\d+$/.test(name) && !isPdfMetadata(name) && !/^(?:Sanju|Page\s*\d+|Ten\s*-\s*Po)/i.test(name)) {
      if (!fullAddressLine) {
        fullAddressLine = `${name}'s Address`;
      }
      results.push({
        u_id: uId,
        name: name.substring(0, 70),
        door_no: doorNo,
        address_line_1: fullAddressLine.substring(0, 140),
        address_line_2: '',
        area: finalArea.substring(0, 50),
        city: finalArea.substring(0, 50),
        district: detectedDistrict,
        state: state,
        country: 'India',
        pincode: pincode,
        phone: phone,
        landmark: '',
      });
    } else if (results.length > 0 && (phone || fullAddressLine)) {
      // If this block has no name but has a phone number or address fragment, attach it to the PREVIOUS record instead of creating a dummy ghost record!
      const prev = results[results.length - 1];
      if (!prev.phone && phone) {
        prev.phone = phone;
      }
      if (fullAddressLine && !prev.address_line_1.includes(fullAddressLine)) {
        prev.address_line_1 = `${prev.address_line_1}, ${fullAddressLine}`.substring(0, 140);
      }
    }
  }

  // Preserve document order while deduplicating
  const orderedResults = [];
  const seenUids = new Map();
  const seenNonUidKeys = new Set();

  for (const item of results) {
    if (item.u_id) {
      if (!seenUids.has(item.u_id)) {
        seenUids.set(item.u_id, orderedResults.length);
        orderedResults.push(item);
      } else {
        const existingIdx = seenUids.get(item.u_id);
        const existing = orderedResults[existingIdx];
        const scoreExisting = (existing.name ? existing.name.length : 0) + (existing.phone ? 50 : 0) + (existing.address_line_1 ? existing.address_line_1.length : 0);
        const scoreNew = (item.name ? item.name.length : 0) + (item.phone ? 50 : 0) + (item.address_line_1 ? item.address_line_1.length : 0);

        if (scoreNew > scoreExisting) {
          if (!item.phone && existing.phone) item.phone = existing.phone;
          orderedResults[existingIdx] = item;
        } else if (item.phone && !existing.phone) {
          existing.phone = item.phone;
        }
      }
    } else {
      if (item.name && item.name.length >= 2 && !/^\d+$/.test(item.name) && (item.phone || (item.address_line_1 && item.address_line_1.length >= 5))) {
        const key = `${item.name.toLowerCase().trim()}_${item.pincode}_${item.phone}`;
        if (!seenNonUidKeys.has(key)) {
          seenNonUidKeys.add(key);
          orderedResults.push(item);
        }
      }
    }
  }

  return orderedResults;
}

function parseSingleLineTableRows(fullText, fileName) {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
  const addresses = [];

  for (const rawLine of lines) {
    const line = convertBaminiToUnicode(rawLine);
    if (isPdfMetadata(line)) continue;
    if (/S\.No|Name|Address|City|District|State|Pincode|Phone/i.test(line) && !/\d{6}/.test(line)) continue;

    const pincodeMatch = line.match(/\b[1-9][0-9]{5}\b/);
    const phoneMatch = line.match(/\b[6-9][0-9]{9}\b/);

    if (!pincodeMatch && !phoneMatch) continue;

    const pincode = pincodeMatch ? pincodeMatch[0] : '600001';
    const phone = phoneMatch ? phoneMatch[0] : '';

    let detectedDistrict = 'Coimbatore';
    for (const d of DISTRICTS_LIST) {
      if (new RegExp(`\\b${d}\\b`, 'i').test(line)) {
        detectedDistrict = d;
        break;
      }
    }

    const tokens = line.split(/\s+/).filter(t =>
      !/^\d{1,3}$/.test(t) &&
      t !== pincode &&
      t !== phone &&
      !/^(Tamil|Nadu|India|State)$/i.test(t)
    );

    if (tokens.length < 1) continue;

    const firstToken = tokens[0] ? tokens[0].trim() : '';
    if (!firstToken || firstToken.length < 2) continue;

    let name = convertBaminiToUnicode(firstToken);
    let addressPart = tokens.slice(1).join(' ').trim();
    if (addressPart) {
      addressPart = convertBaminiToUnicode(addressPart);
      addressPart = stripDistrictFromAddressLine(addressPart, detectedDistrict);
    }
    if (!addressPart) addressPart = `${name}'s Address`;

    const doorMatch = line.match(/\b(?:\d+[\/\-]\d+|No\.?\s*\d+|Door\s*No\.?\s*\d+|\d{1,4}[A-Za-z]?)\b/i);

    addresses.push({
      name: name.replace(/[,;]/g, '').trim().substring(0, 60),
      door_no: doorMatch ? doorMatch[0] : '',
      address_line_1: addressPart.substring(0, 100),
      address_line_2: '',
      area: detectedDistrict,
      city: detectedDistrict,
      district: detectedDistrict,
      state: 'Tamil Nadu',
      country: 'India',
      pincode: pincode,
      phone: phone,
      landmark: '',
      notes: `Imported from ${fileName}`
    });
  }

  return addresses;
}

function extractDocxTablesAndParagraphs(xmlDoc) {
  const extractedRows = [];
  const textLines = [];

  const tables = xmlDoc.getElementsByTagName('w:tbl');
  for (const tbl of tables) {
    const rows = tbl.getElementsByTagName('w:tr');
    for (const tr of rows) {
      const cells = tr.getElementsByTagName('w:tc');
      const rowTokens = [];
      for (const tc of cells) {
        const texts = tc.getElementsByTagName('w:t');
        let cellText = '';
        for (const t of texts) {
          cellText += t.textContent;
        }
        if (cellText.trim()) {
          rowTokens.push(cellText.trim());
        }
      }
      if (rowTokens.length > 0) {
        extractedRows.push(rowTokens);
        textLines.push(rowTokens.join(' '));
      }
    }
  }

  const paragraphs = xmlDoc.getElementsByTagName('w:p');
  for (const p of paragraphs) {
    let parent = p.parentNode;
    let isInsideTable = false;
    while (parent) {
      if (parent.nodeName === 'w:tc' || parent.nodeName === 'w:tbl') {
        isInsideTable = true;
        break;
      }
      parent = parent.parentNode;
    }
    if (!isInsideTable) {
      const texts = p.getElementsByTagName('w:t');
      let lineText = '';
      for (const t of texts) {
        lineText += t.textContent;
      }
      if (lineText.trim()) {
        textLines.push(lineText.trim());
      }
    }
  }

  return { extractedRows, textLines };
}

function processDocxTableRows(extractedRows, fileName) {
  const addresses = [];
  const seenKeys = new Set();

  const STREET_KEYWORDS = [
    'தெரு', 'தெரு.', 'காலணிதெரு', 'காலணி தெரு', 'நடுதெரு', 'வடக்குத்தெரு', 
    'கிழக்குத்தெரு', 'மேற்குத்தெரு', 'தெற்குதெரு', 'நம்பிராஜன் தெரு', 'கோவில்தெரு', 
    'பெருமாள்கோவில் தெரு', 'சாலையூர்', 'ரோடு', 'சாளை', 'நகர்', 'காலனி', 
    'street', 'road', 'st', 'rd', 'nagar', 'colony'
  ];

  const DESIGNATIONS_REGEX = /\b(ExArmy|Ex-Army|Ex\s*Army|Teacher|BE|B\.E\.?|ME|M\.E\.?|MCA|M\.C\.A\.?|BSc|B\.Sc\.?|BA|B\.A\.?|MA|M\.A\.?|MABL|M\.A\.B\.L\.?|BEd|B\.Ed\.?|BJP|DMK|AIADMK|CR|C\.R\.?|ஆசிரியர்|இராணுவம்|மேசன்|வணிகர்|ஓட்டுநர்|ரயில்வே|இபி)\b/gi;

  const isCodeFormat = (str) => {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    if (s.length < 2 || s.length > 12) return false;
    if (/\s/.test(s)) return false; // Codes do not have spaces
    if (/^\d+$/.test(s)) return false; // Pure numbers (e.g. 122, 130) are S.No, NOT U.Id!
    return /^[A-Za-z]{1,4}[-_\/]?\d{2,6}$/i.test(s) || /^T-?\d+$/i.test(s);
  };

  for (const tokens of extractedRows) {
    if (!tokens || tokens.length === 0) continue;
    const rawFullLine = tokens.join(' ');

    // Skip table header row e.g. S.No | Code | Name/Details | Street
    if (/S\.No|Code|Name|Details|Street|Address|Pincode|Phone/i.test(tokens[0]) && /Name|Details|Street|Address/i.test(rawFullLine)) {
      continue;
    }

    let nameDetails = '';
    let street = '';
    let code = '';

    if (tokens.length >= 4) {
      if (isCodeFormat(tokens[1])) {
        code = tokens[1];
        nameDetails = tokens[2] || '';
        street = tokens.slice(3).join(', ');
      } else {
        nameDetails = tokens[1] || tokens[2] || '';
        street = tokens.slice(2).join(', ');
      }
    } else if (tokens.length === 3) {
      if (/^\d+\.?$/.test(tokens[0])) {
        if (isCodeFormat(tokens[1])) {
          code = tokens[1];
          nameDetails = tokens[2];
        } else {
          nameDetails = tokens[1];
          street = tokens[2];
        }
      } else if (isCodeFormat(tokens[0])) {
        code = tokens[0];
        nameDetails = tokens[1];
        street = tokens[2];
      } else {
        nameDetails = tokens[0];
        street = tokens.slice(1).join(', ');
      }
    } else if (tokens.length === 2) {
      if (isCodeFormat(tokens[1])) {
        code = tokens[1];
        nameDetails = ''; // No person name present in this row!
      } else if (isCodeFormat(tokens[0])) {
        code = tokens[0];
        nameDetails = tokens[1];
      } else {
        nameDetails = tokens[0];
        street = tokens[1];
      }
    } else {
      nameDetails = tokens[0];
    }

    // Skip rows that have no nameDetails or where nameDetails is just a code (e.g. T-0118, T-0126)
    if (!nameDetails || nameDetails.length < 2 || isCodeFormat(nameDetails)) continue;

    // Validate Unique ID (u_id) - leave empty if not a valid code format!
    let u_id = isCodeFormat(code) ? code.trim() : '';
    if (!u_id && /T-?\d{3,5}/i.test(rawFullLine)) {
      const uMatch = rawFullLine.match(/\bT-?\d{3,5}\b/i);
      if (uMatch) u_id = uMatch[0];
    }

    // Convert legacy Tamil font encodings (Bamini / Suntommy / TAM) to Unicode Tamil
    let convNameDetails = convertBaminiToUnicode(nameDetails).trim();
    let convStreet = convertBaminiToUnicode(street).trim();

    // 1. Extract and Strip Phone Numbers (10-digit mobile or landline with area code)
    let phone = '';
    const phoneRegex = /\b[6-9]\d{9}\b|\b0\d{2,4}\s*\d{6,8}\b/g;
    const phoneMatch = (convNameDetails + ' ' + convStreet + ' ' + rawFullLine).match(phoneRegex);

    if (phoneMatch && phoneMatch.length > 0) {
      phone = phoneMatch[0];
    }

    // Completely REMOVE phone numbers from Name and Street text
    convNameDetails = convNameDetails.replace(phoneRegex, '').trim();
    convStreet = convStreet.replace(phoneRegex, '').replace(/,\s*,/g, ',').trim();

    // 2. Extract and Strip Pincode (6-digit starting 1-9)
    let pincode = '627358';
    const pinRegex = /\b[1-9]\d{5}\b/g;
    const pinMatch = (convNameDetails + ' ' + convStreet + ' ' + rawFullLine).match(pinRegex);

    if (pinMatch && pinMatch.length > 0) {
      pincode = pinMatch[0];
    }

    // Completely REMOVE pincodes from Name and Street text
    convNameDetails = convNameDetails.replace(pinRegex, '').trim();
    convStreet = convStreet.replace(pinRegex, '').replace(/,\s*,/g, ',').trim();

    // 3. Extract Door Number, Relations & Designations from Name
    let doorNo = '';
    let cleanName = convNameDetails;
    let extractedDesignation = '';
    let extractedRelation = '';

    // Remove prefixes like (டோ), (டோர்), (Door), (No)
    cleanName = cleanName.replace(/^\([^\)]+\)\s*/g, '').replace(/^டோ\.?\s*/i, '').replace(/^டோர்\.?\s*/i, '').trim();

    // Split Relation (S/o, W/o, D/o, C/o) from cleanName
    const relSplitMatch = cleanName.match(/^(.+?)\s*,?\s*\b(S\/o|W\/o|D\/o|C\/o|s\/o|w\/o|d\/o|c\/o|த\/பெ|க\/பெ)\b\.?\s*(.+)$/i);
    if (relSplitMatch) {
      cleanName = relSplitMatch[1].trim();
      extractedRelation = `${relSplitMatch[2]}. ${relSplitMatch[3].replace(/[,;]/g, '').trim()}`;
    }

    // Extract Designations (BE, ExArmy, Teacher, BJP, MABL, MCA, etc.) from cleanName
    const desigMatches = cleanName.match(DESIGNATIONS_REGEX);
    if (desigMatches) {
      extractedDesignation = desigMatches.join(' ');
      cleanName = cleanName.replace(DESIGNATIONS_REGEX, '').trim();
    }

    // Check if cleanName starts or ends with door number (e.g. "21D அம்மன்" or "A. முருகன் 13" or "S. கணேசன் 23 ஏ" or "சுந்தரராஜன் 30")
    const leadingDoorMatch = cleanName.match(/^(\d{1,4}[A-Za-zஅ-ஹ]?)\s+(.+)$/);
    const trailingDoorMatch = cleanName.match(/^(.+?)\s+(\d{1,4}(?:\s+[ஏbBcC])?)$/);

    if (leadingDoorMatch) {
      doorNo = leadingDoorMatch[1];
      cleanName = leadingDoorMatch[2];
    } else if (trailingDoorMatch) {
      cleanName = trailingDoorMatch[1];
      doorNo = trailingDoorMatch[2];
    }

    // Check street text for door numbers if doorNo not found yet
    if (!doorNo) {
      const streetDoorMatch = convStreet.match(/\b(?:\d+[\/\-]\d+[A-Z]?|No\.?\s*\d+|Door\s*No\.?\s*\d+)\b/i);
      if (streetDoorMatch) {
        doorNo = streetDoorMatch[0];
      }
    }

    // Clean up trailing commas or numbers from cleanName
    cleanName = cleanName.replace(/[,;:]/g, '').replace(/\s+/g, ' ').trim();

    // 4. FRAGMENT / DUPLICATE ROW FILTER (e.g. Record 3 "காலணிதெரு")
    const nameLower = cleanName.toLowerCase();
    const isStreetNameOnly = STREET_KEYWORDS.some(kw => nameLower === kw.toLowerCase() || nameLower === kw.toLowerCase() + 'தெரு');

    if (!cleanName || cleanName.length < 2 || isStreetNameOnly || /^\d+$/.test(cleanName)) {
      continue; // SKIP FRAGMENT / DUP ROW!
    }

    // 5. Construct Address Line 1 (starts with door number, followed by designations/relations, followed by street)
    let addressLineParts = [];
    if (doorNo) {
      addressLineParts.push(doorNo);
    }
    if (extractedRelation) {
      addressLineParts.push(extractedRelation);
    }
    if (extractedDesignation) {
      addressLineParts.push(extractedDesignation);
    }

    if (convStreet) {
      // Strip any residual phone or pincode numbers from convStreet
      let cleanSt = convStreet.replace(phoneRegex, '').replace(pinRegex, '').replace(/^[\s,]+|[\s,]+$/g, '').trim();
      if (cleanSt && !addressLineParts.includes(cleanSt)) {
        addressLineParts.push(cleanSt);
      }
    }

    let finalAddressLine = addressLineParts.join(', ').replace(/,\s*,/g, ',').replace(phoneRegex, '').replace(pinRegex, '').trim();
    if (!finalAddressLine) {
      finalAddressLine = `${cleanName}'s Address`;
    }

    // Deduplication check
    const dedupKey = `${cleanName.toLowerCase()}_${pincode}_${phone}`;
    if (seenKeys.has(dedupKey)) {
      continue; // SKIP EXACT DUPLICATE!
    }
    seenKeys.add(dedupKey);

    let detectedDistrict = 'Tirunelveli';
    for (const [tName, engDistrict] of Object.entries(TAMIL_DISTRICT_MAP)) {
      if (rawFullLine.includes(tName) || fileName.includes(tName)) {
        detectedDistrict = engDistrict;
        break;
      }
    }

    addresses.push({
      u_id: u_id,
      name: cleanName.substring(0, 60),
      door_no: doorNo,
      address_line_1: finalAddressLine.substring(0, 120),
      address_line_2: '',
      area: fileName.includes('தச்சநல்லூர்') || rawFullLine.includes('தச்சநல்லூர்') ? 'Thachanallur' : detectedDistrict,
      city: detectedDistrict,
      district: detectedDistrict,
      state: 'Tamil Nadu',
      country: 'India',
      pincode: pincode,
      phone: phone,
      landmark: '',
      notes: `Imported from ${fileName}`
    });
  }

  return addresses;
}


