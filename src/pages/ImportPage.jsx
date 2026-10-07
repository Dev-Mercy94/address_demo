import React, { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { batchImportAddresses, updateAddress, checkDuplicateAddress, batchCheckDuplicateAddresses } from '../services/apiService';
import { parsePdfOrDocumentAddresses, convertBaminiToUnicode, stripDistrictFromAddressLine } from '../utils/pdfHelper';
import { getAreaDetails } from '../utils/areaHelper';
import { Upload, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, Eye, Trash2, Edit3, ArrowRight, Copy, Check } from 'lucide-react';
import { Toast } from '../components/Toast';
import { PageLoader } from '../components/PageLoader';
import { DuplicateModal } from '../components/DuplicateModal';
import { RAW_DISTRICTS_DATA } from '../utils/tamilHelper';

// Helper to validate and format U.Id (e.g. T-0001, M-0001). Rejects digit prefixes like 5-0271, 9-8659
function sanitizeUId(rawUid) {
  if (!rawUid || typeof rawUid !== 'string') return '';
  const clean = rawUid.trim();
  if (/^[A-Za-z]-\d{1,6}$/i.test(clean)) {
    const parts = clean.split('-');
    return `${parts[0].toUpperCase()}-${parts[1].padStart(4, '0')}`;
  }
  return '';
}

function getTamilDistrict(distStr) {
  if (!distStr) return '';
  const cleanStr = distStr.trim();
  const distMatch = RAW_DISTRICTS_DATA.find(d => 
    d.id.toLowerCase() === cleanStr.toLowerCase() || 
    d.en.toLowerCase() === cleanStr.toLowerCase() ||
    d.ta === cleanStr
  );
  if (distMatch && distMatch.ta) {
    return distMatch.ta;
  }
  return cleanStr;
}

// Helper to validate that Pincode is strictly 6 digits
function sanitizePincode(rawPin) {
  if (!rawPin) return '';
  const clean = String(rawPin).replace(/\D/g, '');
  if (clean.length === 6) {
    if (clean.startsWith('6')) return clean;
    if (!clean.startsWith('10') && !clean.startsWith('11')) return clean;
  }
  return '';
}

// Helper to clearly determine and explain why a record was flagged as duplicate
function getDuplicateReason(pair) {
  if (pair && pair.matchReason) return pair.matchReason;
  const imp = pair?.importedItem || {};
  const ex = pair?.existingAddress || {};

  const impPhone = (imp.phone || '').trim();
  const exPhone = (ex.phone || '').trim();
  if (impPhone && exPhone && impPhone.length >= 10 && impPhone === exPhone) {
    return `Same Phone Number: ${impPhone}`;
  }

  const impName = (imp.name || '').trim().toLowerCase().replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ');
  const exName = (ex.name || '').trim().toLowerCase().replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ');
  const impUid = (imp.u_id || '').trim().toLowerCase();
  const exUid = (ex.u_id || '').trim().toLowerCase();

  if (impName && exName && impName === exName) {
    if (impUid && exUid && impUid === exUid) {
      return `Same Name & Unique ID: ${imp.u_id.toUpperCase()}`;
    }
    if (impPhone && exPhone && impPhone === exPhone) {
      return `Same Name & Phone: ${impPhone}`;
    }
    if (imp.pincode && ex.pincode && imp.pincode === ex.pincode) {
      return `Same Contact Name & Pincode: ${imp.pincode}`;
    }
    if (imp.address_line_1 && ex.address_line_1 && imp.address_line_1.toLowerCase() === ex.address_line_1.toLowerCase()) {
      return `Same Contact Name & Street Address`;
    }
    return `Same Contact Name: ${imp.name}`;
  }

  if (impUid && exUid && impUid === exUid) {
    return `Same Unique ID: ${imp.u_id.toUpperCase()}`;
  }

  return 'Matching address record details';
}

const GroupDropdown = ({ value, onChange, onClose }) => {
  const options = ['VIP', 'ADVERTISEMENT', 'HELP', 'CONTRIBUTOR'];

  return (
    <div 
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        right: 0,
        backgroundColor: 'var(--bg-card)',
        padding: '0.75rem',
        borderRadius: '12px',
        width: '200px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        border: '1px solid var(--border-color)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '180px', overflowY: 'auto' }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={(e) => { e.stopPropagation(); onChange(opt); onClose(); }}
            style={{
              width: '100%', 
              textAlign: 'left', 
              padding: '0.5rem 0.75rem', 
              borderRadius: '6px',
              border: '1px solid transparent',
              backgroundColor: value === opt ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: value === opt ? 'var(--accent-primary)' : 'var(--text-primary)',
              fontWeight: value === opt ? 700 : 500,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = value === opt ? 'rgba(99, 102, 241, 0.1)' : 'transparent'}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

// Memoized preview table row to eliminate re-renders on keystroke (100% instant typing)
const PreviewTableRow = React.memo(function PreviewTableRow({
  item,
  globalIdx,
  onItemChange,
  onRemove
}) {
  const [localItem, setLocalItem] = useState(item);
  const [showGroupModal, setShowGroupModal] = useState(false);

  useEffect(() => {
    setLocalItem(item);
  }, [item]);

  const handleChange = (field, val) => {
    let cleanVal = val;
    if (field === 'name' && typeof cleanVal === 'string') {
      cleanVal = cleanVal
        .replace(/(?:Cell|Mobile|Ph|Mob|Tel|Phone)[\s\:\.\-]*\+?\d[\d\s\-]*/gi, '')
        .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, '')
        .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, '')
        .replace(/\b\d{10}\b/g, '')
        .replace(/\b(Cell|Mobile|Phone|Tel|Mob)\b/gi, '');
    }
    setLocalItem(prev => ({ ...prev, [field]: cleanVal }));
    onItemChange(globalIdx, field, cleanVal);
  };

  return (
    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
      <td style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem' }}>
        {globalIdx + 1}
      </td>
      <td style={{ padding: '6px 4px' }}>
        <input
          type="text"
          value={localItem.u_id || ''}
          onChange={(e) => handleChange('u_id', e.target.value)}
          placeholder="T-0001"
          style={{ width: '100%', padding: '4px 4px', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: 600, color: '#4f46e5', fontSize: '0.825rem' }}
        />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <input
          type="text"
          value={localItem.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: 500 }}
        />
      </td>
      <td style={{ padding: '6px 6px' }}>
        <input
          type="text"
          value={localItem.address_line_1 || ''}
          onChange={(e) => handleChange('address_line_1', e.target.value)}
          style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
        />
      </td>
      <td style={{ padding: '6px 4px' }}>
        <input
          type="text"
          value={localItem.district || ''}
          onChange={(e) => handleChange('district', e.target.value)}
          style={{ width: '100%', padding: '4px 4px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.825rem' }}
        />
      </td>
      <td style={{ padding: '6px 4px' }}>
        <input
          type="text"
          value={localItem.pincode || ''}
          onChange={(e) => handleChange('pincode', e.target.value)}
          style={{ width: '100%', padding: '4px 4px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.825rem' }}
        />
      </td>
      <td style={{ padding: '6px 4px' }}>
        <input
          type="text"
          value={localItem.phone || ''}
          onChange={(e) => handleChange('phone', e.target.value)}
          style={{ width: '100%', padding: '4px 4px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.825rem' }}
        />
      </td>
      <td style={{ padding: '6px 4px', position: 'relative' }}>
        {showGroupModal && (
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}
            onClick={(e) => { e.stopPropagation(); setShowGroupModal(false); }}
          />
        )}
        <button
          onClick={() => setShowGroupModal(!showGroupModal)}
          style={{ 
            width: '100%', 
            padding: '4px 6px', 
            borderRadius: '4px', 
            border: '1px solid var(--border-color)', 
            fontSize: '0.78rem', 
            fontWeight: 700, 
            backgroundColor: 'var(--bg-secondary)', 
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          {localItem.addressGroup || 'CONTRIBUTOR'}
          <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>▼</span>
        </button>
        {showGroupModal && (
          <GroupDropdown 
            value={localItem.addressGroup || 'CONTRIBUTOR'} 
            onChange={(val) => handleChange('addressGroup', val)}
            onClose={() => setShowGroupModal(false)}
          />
        )}
      </td>
      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
        <button
          onClick={() => onRemove(globalIdx)}
          className="btn btn-secondary btn-sm"
          style={{ color: 'var(--danger)', padding: '4px 8px' }}
          title="Remove item"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
});


export function ImportPage({ onNavigate, onStatsChange }) {
  const [file, setFile] = useState(null);
  const [showUnstructuredText, setShowUnstructuredText] = useState(false);
  const [rawTextInput, setRawTextInput] = useState('');
  const [previewItems, setPreviewItems] = useState([]);
  const previewItemsRef = useRef(previewItems);

  useEffect(() => {
    previewItemsRef.current = previewItems;
  }, [previewItems]);

  // Staging state: holding lists before final database commit
  const [stagedSuccessList, setStagedSuccessList] = useState([]);
  const [stagedOverwritesList, setStagedOverwritesList] = useState([]);
  const [duplicateDetails, setDuplicateDetails] = useState([]);
  const [invalidList, setInvalidList] = useState([]);
  const [showDuplicateComparison, setShowDuplicateComparison] = useState(true);
  const [showStagedSuccessCards, setShowStagedSuccessCards] = useState(false);
  const [showInvalidCards, setShowInvalidCards] = useState(false);

  const [isParsing, setIsParsing] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isSavingFinal, setIsSavingFinal] = useState(false);
  const [isFinalSaved, setIsFinalSaved] = useState(false);

  const [previewDupModalItem, setPreviewDupModalItem] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const previewLimit = 50;
  const [dupPage, setDupPage] = useState(1);
  const dupLimit = 10;
  const [stagedPage, setStagedPage] = useState(1);
  const stagedLimit = 10;
  const [invalidPage, setInvalidPage] = useState(1);
  const invalidLimit = 10;
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    success: 0,
    duplicates: 0,
    invalid: 0,
    percent: 0
  });
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [complete, setComplete] = useState(false);

  const handleResetImport = () => {
    setFile(null);
    setPreviewItems([]);
    setStagedSuccessList([]);
    setStagedOverwritesList([]);
    setDuplicateDetails([]);
    setInvalidList([]);
    setShowInvalidCards(false);
    setShowDuplicateComparison(false);
    setShowStagedSuccessCards(false);
    setComplete(false);
    setIsFinalSaved(false);
    setProgress({ total: 0, processed: 0, success: 0, duplicates: 0, invalid: 0, percent: 0 });
    const fileInput = document.getElementById('deviceFileInput');
    if (fileInput) fileInput.value = '';
    setToast({ message: 'Cleared preview. Select a new file or paste text.', type: 'info' });
  };

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setComplete(false);
    setIsFinalSaved(false);
    setIsParsing(true);
    setPreviewItems([]);
    setStagedSuccessList([]);
    setStagedOverwritesList([]);
    setDuplicateDetails([]);
    setInvalidList([]);
    setShowInvalidCards(false);
    setShowDuplicateComparison(false);
    setShowStagedSuccessCards(false);
    setProgress({ total: 0, processed: 0, success: 0, duplicates: 0, invalid: 0, percent: 0 });

    const isPdfOrDocOrImage = selectedFile.name.endsWith('.pdf') ||
      selectedFile.name.endsWith('.txt') ||
      selectedFile.name.endsWith('.doc') ||
      selectedFile.name.endsWith('.docx') ||
      selectedFile.name.endsWith('.rtf') ||
      selectedFile.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|bmp)$/i.test(selectedFile.name);

    try {
      if (isPdfOrDocOrImage) {
        const isImg = selectedFile.type?.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(selectedFile.name);
        if (isImg) {
          setToast({ message: 'Processing image via AI OCR... (Note: Uploading the original PDF directly is instant and 100% accurate!)', type: 'info' });
        }
        const extracted = await parsePdfOrDocumentAddresses(selectedFile);
        if (extracted.length === 0) {
          setToast({ message: 'No valid addresses could be extracted from document or image.', type: 'warning' });
        } else {
          const sanitized = extracted.map(item => ({
            ...item,
            u_id: sanitizeUId(item.u_id),
            district: getTamilDistrict(item.district),
            pincode: sanitizePincode(item.pincode, item.district)
          }));
          setPreviewItems(sanitized);
          setToast({ message: `Extracted ${sanitized.length} address records for preview!`, type: 'info' });
        }
      } else {
        // CSV Parsing
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data || [];
            const parsed = rows.map(r => {
              let rawPin = r.Pincode || r.pincode;
              let rawDistrict = r.District || r.district || '';
              let rawArea = r.Area || r.City || r.area || '';
              
              let parsedPincode = sanitizePincode(rawPin);
              let finalDistrict = getTamilDistrict(convertBaminiToUnicode(rawDistrict.trim()));
              let finalArea = convertBaminiToUnicode(rawArea.trim());

              if (!finalDistrict || finalDistrict === '') {
                 if (finalArea) {
                    const areaDet = getAreaDetails(finalArea);
                    if (areaDet) {
                       finalDistrict = getTamilDistrict(areaDet.district);
                       if (!parsedPincode) parsedPincode = areaDet.pincode;
                    }
                 }

                 if (!finalDistrict || finalDistrict === '') {
                   if (parsedPincode) {
                     let tempDist = '';
                     if (parsedPincode.startsWith('628')) tempDist = 'Thoothukudi';
                     else if (parsedPincode.startsWith('627')) tempDist = 'Tenkasi';
                     else if (parsedPincode.startsWith('625')) tempDist = 'Madurai';
                     else if (parsedPincode.startsWith('641') || parsedPincode.startsWith('642')) tempDist = 'Coimbatore';
                     else if (parsedPincode.startsWith('600')) tempDist = 'Chennai';
                     else if (parsedPincode.startsWith('622')) tempDist = 'Pudukkottai';
                     finalDistrict = tempDist ? getTamilDistrict(tempDist) : '';
                   } else {
                     finalDistrict = '';
                   }
                 }
              }

              if (!rawDistrict && !finalDistrict) {
                 if (parsedPincode) {
                   let tempDist = '';
                   if (parsedPincode.startsWith('628')) tempDist = 'Thoothukudi';
                   else if (parsedPincode.startsWith('627')) tempDist = 'Tenkasi';
                   else if (parsedPincode.startsWith('622')) tempDist = 'Pudukkottai';
                   finalDistrict = tempDist ? getTamilDistrict(tempDist) : '';
                 }
              }

              return {
              u_id: sanitizeUId(r['U.Id'] || r.u_id || r.code || ''),
              name: (r.Name || r.name)
                ? convertBaminiToUnicode((r.Name || r.name).trim())
                    .replace(/(?:Cell|Mobile|Ph|Mob|Tel|Phone)[\s\:\.\-]*\+?\d[\d\s\-]*/gi, '')
                    .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, '')
                    .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, '')
                    .replace(/\b\d{10}\b/g, '')
                    .replace(/\b(Cell|Mobile|Phone|Tel|Mob)\b/gi, '')
                    .trim() || 'Contact Name'
                : 'Contact Name',
              door_no: (r['Door No'] || r.door_no) ? convertBaminiToUnicode((r['Door No'] || r.door_no).trim()) : '',
              address_line_1: (r['Address Line 1'] || r.Address || r.address_line_1)
                ? stripDistrictFromAddressLine(convertBaminiToUnicode((r['Address Line 1'] || r.Address || r.address_line_1).trim()), finalDistrict)
                : 'Address Line',
              address_line_2: convertBaminiToUnicode((r['Address Line 2'] || r.address_line_2 || '').trim()),
              area: finalArea || convertBaminiToUnicode((finalDistrict).trim()),
              city: convertBaminiToUnicode((r.City || r.city || finalDistrict).trim()),
              district: finalDistrict,
              state: convertBaminiToUnicode((r.State || r.state || 'Tamil Nadu').trim()),
              country: (r.Country || r.country || 'India').trim(),
              pincode: parsedPincode,
              phone: (r.Phone || r.phone || '').trim(),
              addressGroup: (() => {
                const raw = (r.addressGroup || r.address_group || r['Address Group'] || r.group || r['Group'] || 'CONTRIBUTOR').toString().trim().toUpperCase();
                return ['VIP', 'ADVERTISEMENT', 'HELP', 'CONTRIBUTOR'].includes(raw) ? raw : 'CONTRIBUTOR';
              })(),
              landmark: convertBaminiToUnicode((r.Landmark || r.landmark || '').trim()),
              notes: `Imported from ${selectedFile.name}`
            };
            }).filter(item => item.name && item.address_line_1);


            setPreviewItems(parsed);
            setToast({ message: `Loaded ${parsed.length} records from CSV for preview!`, type: 'info' });
          }
        });
      }
    } catch (err) {
      console.error('File parsing error:', err);
      setToast({ message: 'Failed to read file contents.', type: 'error' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleRawTextParse = async () => {
    if (!rawTextInput || !rawTextInput.trim()) {
      setToast({ message: 'Please paste unstructured address text first.', type: 'warning' });
      return;
    }

    setIsParsing(true);
    setComplete(false);
    setIsFinalSaved(false);
    setPreviewItems([]);
    setStagedSuccessList([]);
    setStagedOverwritesList([]);
    setDuplicateDetails([]);
    setInvalidList([]);
    setShowInvalidCards(false);
    setShowDuplicateComparison(false);
    setShowStagedSuccessCards(false);

    try {
      const extracted = await parsePdfOrDocumentAddresses(null, rawTextInput);
      if (extracted.length === 0) {
        setToast({ message: 'No valid addresses could be extracted from text.', type: 'warning' });
      } else {
        const sanitized = extracted.map(item => ({
          ...item,
          u_id: sanitizeUId(item.u_id),
          district: getTamilDistrict(item.district),
          pincode: sanitizePincode(item.pincode, item.district)
        }));
        setPreviewItems(sanitized);
        setToast({ message: `Parsed ${sanitized.length} unstructured address records!`, type: 'info' });
      }
    } catch (err) {
      console.error('Text parsing error:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const handlePreviewItemChange = useCallback((index, field, value) => {
    if (previewItemsRef.current && previewItemsRef.current[index]) {
      previewItemsRef.current[index] = {
        ...previewItemsRef.current[index],
        [field]: value
      };
    }
  }, []);

  const handleRemovePreviewItem = useCallback((index) => {
    const next = (previewItemsRef.current || []).filter((_, i) => i !== index);
    previewItemsRef.current = next;
    setPreviewItems(next);
    setToast({ message: 'Record removed from preview list.', type: 'info' });
  }, []);

  // Step 1 -> Step 2: Analyze and Separate into Staged Success vs Duplicates WITHOUT saving to DB yet
  const handleProcessAndAnalyze = async () => {
    const items = (previewItemsRef.current && previewItemsRef.current.length > 0)
      ? previewItemsRef.current
      : previewItems;
    if (!items || items.length === 0) return;

    setIsCheckingDuplicates(true);
    setIsParsing(true);
    setComplete(false);
    setIsFinalSaved(false);
    setDuplicateDetails([]);
    setStagedSuccessList([]);
    setStagedOverwritesList([]);
    setInvalidList([]);

    const total = items.length;
    const staged = [];
    const dups = [];
    const invalids = [];
    const seenBatchKeys = new Map();
    const candidateItems = [];

    try {
      // Fast synchronous in-memory pass for invalid & intra-batch duplicates (<1ms)
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const name = (item.name || '').trim();
        const address_line_1 = (item.address_line_1 || '').trim();
        const phone = (item.phone || '').trim();
        const u_id = (item.u_id || '').trim();
        const pincode = (item.pincode || '').trim();

        if (!name || !address_line_1 || name === 'Contact Name') {
          let reason = 'Incomplete address details';
          if (!name || name === 'Contact Name') reason = 'Missing or invalid Contact Name';
          else if (!address_line_1) reason = 'Missing Address Line 1';

          invalids.push({
            ...item,
            invalidReason: reason
          });
          continue;
        }

        // 1. Check Intra-batch duplicate (within the same uploaded file)
        let isIntraDup = false;
        let matchedIntraItem = null;
        let intraReason = '';

        const normItemName = (name || '').trim().toLowerCase().replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ');
        const normItemUid = (u_id || '').trim().toLowerCase();

        // 1a. Phone match (10 digits)
        if (phone && phone.length >= 10 && seenBatchKeys.has(`phone:${phone}`)) {
          isIntraDup = true;
          matchedIntraItem = seenBatchKeys.get(`phone:${phone}`);
          intraReason = `Same Phone Number: ${phone}`;
        }
        // 1b. Name + Pincode match
        else if (normItemName && pincode && seenBatchKeys.has(`name_pin:${normItemName}_${pincode}`)) {
          isIntraDup = true;
          matchedIntraItem = seenBatchKeys.get(`name_pin:${normItemName}_${pincode}`);
          intraReason = `Same Name & Pincode (${pincode})`;
        }
        // 1c. Name + U.Id match
        else if (normItemName && normItemUid && seenBatchKeys.has(`name_uid:${normItemName}_${normItemUid}`)) {
          isIntraDup = true;
          matchedIntraItem = seenBatchKeys.get(`name_uid:${normItemName}_${normItemUid}`);
          intraReason = `Same Name & Unique ID: ${u_id.toUpperCase()}`;
        }
        // 1d. Same U.Id (only if names are compatible/overlapping)
        else if (normItemUid && seenBatchKeys.has(`uid:${normItemUid}`)) {
          const priorItem = seenBatchKeys.get(`uid:${normItemUid}`);
          const priorNormName = (priorItem.name || '').trim().toLowerCase().replace(/\s*\.\s*/g, '.').replace(/\s+/g, ' ');
          const nameOverlap = !normItemName || !priorNormName || normItemName === priorNormName ||
            normItemName.includes(priorNormName) || priorNormName.includes(normItemName) ||
            normItemName.split(/[\s\.]+/).filter(w => w.length > 2).some(w => priorNormName.includes(w));
          if (nameOverlap) {
            isIntraDup = true;
            matchedIntraItem = priorItem;
            intraReason = `Same Unique ID: ${u_id.toUpperCase()}`;
          }
        }

        // Same name in different districts is NOT a duplicate
        if (isIntraDup && matchedIntraItem) {
          const itemDist = (item.district || '').trim().toLowerCase();
          const matchedDist = (matchedIntraItem.district || '').trim().toLowerCase();
          if (itemDist && matchedDist && itemDist !== matchedDist) {
            isIntraDup = false;
            matchedIntraItem = null;
            intraReason = '';
          }
        }

        if (isIntraDup && matchedIntraItem) {
          dups.push({
            importedItem: { ...item },
            existingAddress: {
              ...matchedIntraItem,
              notes: 'Duplicate matching an earlier record in this import file'
            },
            matchReason: intraReason || 'Duplicate found earlier in this file',
            isEarlierInBatch: true
          });
          continue;
        }

        // Record keys in seenBatchKeys for subsequent batch items
        if (phone && phone.length >= 10) seenBatchKeys.set(`phone:${phone}`, item);
        if (normItemUid) seenBatchKeys.set(`uid:${normItemUid}`, item);
        if (normItemName && pincode) seenBatchKeys.set(`name_pin:${normItemName}_${pincode}`, item);
        if (normItemName && normItemUid) seenBatchKeys.set(`name_uid:${normItemName}_${normItemUid}`, item);

        candidateItems.push({ ...item, _tempImportId: `item_${i}` });
      }

      // 2. High-speed bulk checking against database
      const batchSize = 1000;
      for (let i = 0; i < candidateItems.length; i += batchSize) {
        const chunk = candidateItems.slice(i, i + batchSize);
        try {
          const res = await batchCheckDuplicateAddresses(chunk);
          if (res && res.duplicates && res.duplicates.length > 0) {
            for (const dup of res.duplicates) {
              const impDist = (dup.importedItem?.district || '').trim().toLowerCase();
              const exDist = (dup.existingAddress?.district || '').trim().toLowerCase();
              // If same name in different district, do NOT mention as duplicate
              if (impDist && exDist && impDist !== exDist) {
                continue;
              }
              dups.push(dup);
            }
          }

          // Now add everything that wasn't a duplicate to staged
          for (const item of chunk) {
            const isDup = dups.some(d => {
              if (d.importedItem?._tempImportId && item._tempImportId) {
                return d.importedItem._tempImportId === item._tempImportId;
              }
              const imp = d.importedItem;
              if (!imp) return false;
              if (item.u_id && imp.u_id && item.u_id.toLowerCase() === imp.u_id.toLowerCase()) return true;
              if (item.phone && imp.phone && item.phone === imp.phone) return true;
              if (item.name && imp.name && item.name.toLowerCase() === imp.name.toLowerCase()) {
                if (item.pincode && imp.pincode && item.pincode === imp.pincode) return true;
                if (item.address_line_1 && imp.address_line_1 && item.address_line_1.toLowerCase() === imp.address_line_1.toLowerCase()) return true;
                if (!item.phone && !imp.phone) return true;
              }
              return false;
            });
            if (!isDup) {
              staged.push({ ...item });
            }
          }
        } catch (e) {
          console.error('Batch duplicate check failed:', e);
          setToast({ message: `Duplicate check error: ${e.message || 'Server error'}.`, type: 'error' });
          for (const item of chunk) staged.push({ ...item });
        }
      }

      setStagedSuccessList(staged);
      setDuplicateDetails(dups);
      setInvalidList(invalids);
      setProgress({
        total,
        processed: total,
        success: staged.length,
        duplicates: dups.length,
        invalid: invalids.length,
        percent: 100
      });

      if (dups.length > 0) {
        setShowDuplicateComparison(true);
        setShowInvalidCards(false);
        setShowStagedSuccessCards(false);
        setToast({
          message: `Analysis complete: ${staged.length} in Success, ${dups.length} duplicate(s), ${invalids.length} invalid.`,
          type: 'warning'
        });
      } else if (invalids.length > 0) {
        setShowDuplicateComparison(false);
        setShowInvalidCards(true);
        setShowStagedSuccessCards(false);
        setToast({
          message: `Analysis complete: ${staged.length} in Success, ${invalids.length} invalid record(s) need fixing.`,
          type: 'warning'
        });
      } else {
        setShowDuplicateComparison(false);
        setShowInvalidCards(false);
        setShowStagedSuccessCards(false);
        setToast({
          message: `Analysis complete: All ${staged.length} address(es) are unique and staged in Success box!`,
          type: 'success'
        });
      }

      setComplete(true);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const mainEl = document.querySelector('.main-content');
        if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    } catch (err) {
      console.error('Analysis error:', err);
      setToast({ message: 'Error analyzing addresses for duplicates.', type: 'error' });
    } finally {
      setIsCheckingDuplicates(false);
      setIsParsing(false);
    }
  };

  const handleInvalidItemEdit = (index, field, value) => {
    setInvalidList(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const handleFixAndMoveInvalidToSuccess = (index) => {
    const item = invalidList[index];
    if (!item) return;

    const name = (item.name || '').trim();
    const address_line_1 = (item.address_line_1 || '').trim();

    if (!name || name === 'Contact Name' || !address_line_1) {
      setToast({
        message: 'Please provide both a valid Name and Address Line before moving to Success.',
        type: 'warning'
      });
      return;
    }

    const cleanedItem = { ...item };
    delete cleanedItem.invalidReason;

    setStagedSuccessList(prev => [...prev, cleanedItem]);
    setInvalidList(prev => prev.filter((_, i) => i !== index));
    setProgress(prev => ({
      ...prev,
      success: prev.success + 1,
      invalid: Math.max(0, prev.invalid - 1)
    }));
    setToast({
      message: `Fixed "${cleanedItem.name}" and moved to Success (Ready to save)!`,
      type: 'success'
    });
  };

  const handleDiscardInvalid = (index) => {
    const item = invalidList[index];
    setInvalidList(prev => prev.filter((_, i) => i !== index));
    setProgress(prev => ({
      ...prev,
      invalid: Math.max(0, prev.invalid - 1)
    }));
    setToast({ message: `Discarded invalid record #${index + 1}.`, type: 'info' });
  };

  const handleDiscardAllInvalid = () => {
    if (!invalidList || invalidList.length === 0) return;
    const count = invalidList.length;
    setInvalidList([]);
    setProgress(prev => ({
      ...prev,
      invalid: 0
    }));
    setShowInvalidCards(false);
    setToast({ message: `Discarded all ${count} invalid record(s).`, type: 'info' });
  };

  const handleRemoveStagedSuccessItem = (index) => {
    const item = stagedSuccessList[index];
    setStagedSuccessList(prev => prev.filter((_, i) => i !== index));
    setProgress(prev => ({
      ...prev,
      success: Math.max(0, prev.success - 1)
    }));
    setToast({ message: `Removed "${item?.name || 'Record'}" from staging list.`, type: 'info' });
  };

  const handleDuplicateItemEdit = (index, field, value) => {
    let cleanVal = value;
    if (field === 'name' && typeof cleanVal === 'string') {
      cleanVal = cleanVal
        .replace(/(?:Cell|Mobile|Ph|Mob|Tel|Phone)[\s\:\.\-]*\+?\d[\d\s\-]*/gi, '')
        .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, '')
        .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, '')
        .replace(/\b\d{10}\b/g, '')
        .replace(/\b(Cell|Mobile|Phone|Tel|Mob)\b/gi, '');
    }
    setDuplicateDetails(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        importedItem: {
          ...updated[index].importedItem,
          [field]: cleanVal
        }
      };
      return updated;
    });
  };

  // Move duplicate card into the Staged Success (holding list) instead of directly saving to DB
  const handleSaveDuplicateAsNew = (index) => {
    const pair = duplicateDetails[index];
    if (!pair || !pair.importedItem) return;

    setStagedSuccessList(prev => [...prev, pair.importedItem]);
    setDuplicateDetails(prev => prev.filter((_, i) => i !== index));
    setProgress(prev => ({
      ...prev,
      success: prev.success + 1,
      duplicates: Math.max(0, prev.duplicates - 1)
    }));
    setToast({ message: `Added "${pair.importedItem.name}" to Success (Ready to save)!`, type: 'info' });
  };

  // Stage card to overwrite existing record (either database record or earlier intra-batch record)
  const handleUpdateExistingWithImported = (index) => {
    const pair = duplicateDetails[index];
    if (!pair || !pair.importedItem) return;

    const existingId = pair.existingAddress?._id || pair.existingAddress?.id;
    if (existingId) {
      setStagedOverwritesList(prev => [
        ...prev.filter(x => x.existingId !== existingId),
        { existingId, importedItem: pair.importedItem }
      ]);
      setDuplicateDetails(prev => prev.filter((_, i) => i !== index));
      setProgress(prev => ({
        ...prev,
        success: prev.success + 1,
        duplicates: Math.max(0, prev.duplicates - 1)
      }));
      setToast({ message: `Staged "${pair.importedItem.name}" to overwrite existing record upon final confirm!`, type: 'info' });
    } else {
      // Intra-batch overwrite: replace earlier matching item in stagedSuccessList!
      const targetName = (pair.existingAddress?.name || '').toLowerCase();
      const targetUid = (pair.existingAddress?.u_id || '').toLowerCase();
      const targetPhone = (pair.existingAddress?.phone || '');

      setStagedSuccessList(prev => {
        const matchIdx = prev.findIndex(item =>
          (targetUid && (item.u_id || '').toLowerCase() === targetUid) ||
          (targetPhone && item.phone === targetPhone) ||
          (targetName && (item.name || '').toLowerCase() === targetName)
        );
        if (matchIdx !== -1) {
          const updated = [...prev];
          updated[matchIdx] = { ...pair.importedItem };
          return updated;
        }
        return [...prev, pair.importedItem];
      });

      setDuplicateDetails(prev => prev.filter((_, i) => i !== index));
      setProgress(prev => ({
        ...prev,
        duplicates: Math.max(0, prev.duplicates - 1)
      }));
      setToast({ message: `Replaced earlier matching record with "${pair.importedItem.name}" in Success list!`, type: 'info' });
    }
  };

  // Discard duplicate without adding to staging
  const handleDiscardDuplicate = (index) => {
    const pair = duplicateDetails[index];
    setDuplicateDetails(prev => prev.filter((_, i) => i !== index));
    setProgress(prev => ({
      ...prev,
      duplicates: Math.max(0, prev.duplicates - 1)
    }));
    setToast({ message: `Duplicate record for "${pair?.importedItem?.name || 'Item'}" discarded.`, type: 'info' });
  };

  // Move ALL remaining duplicates into Staged Success (holding list as new items)
  const handleSaveAllDuplicatesAsNew = () => {
    if (!duplicateDetails || duplicateDetails.length === 0) return;

    const allNewItems = duplicateDetails.map(p => p.importedItem).filter(Boolean);
    const count = duplicateDetails.length;
    setStagedSuccessList(prev => [...prev, ...allNewItems]);
    setDuplicateDetails([]);
    setProgress(prev => ({
      ...prev,
      success: prev.success + count,
      duplicates: 0
    }));
    setToast({ message: `Moved all ${count} duplicate address(es) into Success as new records!`, type: 'success' });
  };

  // Stage ALL remaining duplicates to OVERWRITE matching existing records
  const handleOverwriteAllDuplicates = () => {
    if (!duplicateDetails || duplicateDetails.length === 0) return;

    let dbOverwritesCount = 0;

    duplicateDetails.forEach(pair => {
      const existingId = pair.existingAddress?._id || pair.existingAddress?.id;
      if (existingId) {
        setStagedOverwritesList(prev => [
          ...prev.filter(x => x.existingId !== existingId),
          { existingId, importedItem: pair.importedItem }
        ]);
        dbOverwritesCount++;
      } else {
        const targetName = (pair.existingAddress?.name || '').toLowerCase();
        const targetUid = (pair.existingAddress?.u_id || '').toLowerCase();
        const targetPhone = (pair.existingAddress?.phone || '');

        setStagedSuccessList(prev => {
          const matchIdx = prev.findIndex(item =>
            (targetUid && (item.u_id || '').toLowerCase() === targetUid) ||
            (targetPhone && item.phone === targetPhone) ||
            (targetName && (item.name || '').toLowerCase() === targetName)
          );
          if (matchIdx !== -1) {
            const updated = [...prev];
            updated[matchIdx] = { ...pair.importedItem };
            return updated;
          }
          return [...prev, pair.importedItem];
        });
      }
    });

    const count = duplicateDetails.length;
    setDuplicateDetails([]);
    setProgress(prev => ({
      ...prev,
      success: prev.success + dbOverwritesCount,
      duplicates: 0
    }));
    setShowDuplicateComparison(false);
    setToast({ message: `Staged all ${count} duplicate address(es) to overwrite matching records!`, type: 'success' });
  };

  // Discard and remove ALL remaining duplicates
  const handleDiscardAllDuplicates = () => {
    if (!duplicateDetails || duplicateDetails.length === 0) return;

    const count = duplicateDetails.length;
    setDuplicateDetails([]);
    setProgress(prev => ({
      ...prev,
      duplicates: 0
    }));
    setShowDuplicateComparison(false);
    setToast({ message: `Removed all ${count} duplicate record(s).`, type: 'info' });
  };

  // Final Commit: Commit ONLY the addresses held in Success (+ staged overwrites) into the database
  const handleFinalCommitSave = async () => {
    const totalToSave = stagedSuccessList.length + stagedOverwritesList.length;
    if (totalToSave === 0) {
      setToast({ message: 'No addresses held in Success to save.', type: 'warning' });
      return;
    }

    setIsSavingFinal(true);
    try {
      if (stagedSuccessList.length > 0) {
        const cleanedList = stagedSuccessList.map(({ _tempImportId, ...rest }) => rest);
        await batchImportAddresses(cleanedList, { force: true });
      }

      if (stagedOverwritesList.length > 0) {
        for (const item of stagedOverwritesList) {
          try {
            const { _tempImportId, ...cleanItem } = item.importedItem || {};
            await updateAddress(item.existingId, cleanItem);
          } catch (e) {
            console.error('Error updating existing address:', e);
          }
        }
      }

      setIsFinalSaved(true);
      if (onStatsChange) onStatsChange();
      setToast({
        message: `🎉 Successfully saved ${totalToSave} address(es)!`,
        type: 'success'
      });
      if (onNavigate) {
        onNavigate('addresses');
      }
    } catch (err) {
      console.error('Final commit error:', err);
      setToast({ message: err.message || 'Failed to save addresses', type: 'error' });
    } finally {
      setIsSavingFinal(false);
    }
  };

  const totalHeldInSuccess = stagedSuccessList.length + stagedOverwritesList.length;

  return (
    <div className="import-page-wrapper">
      <div className="card import-main-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Import & Preview Addresses</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Upload PDF documents or CSV files, preview and edit extracted records, then save cleanly.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowUnstructuredText(!showUnstructuredText)}
              className="btn btn-secondary btn-sm"
              style={{ borderColor: showUnstructuredText ? '#4f46e5' : undefined, color: showUnstructuredText ? '#4f46e5' : undefined }}
            >
              <FileText size={15} /> {showUnstructuredText ? 'Hide Text Paste' : 'Paste Unstructured Text'}
            </button>
          </div>
        </div>

        {/* Drag & Drop Upload Zone (Step 1) */}
        {!complete && !showUnstructuredText && (
          <div
            className="import-upload-dropzone"
            onClick={() => document.getElementById('deviceFileInput').click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
          >
            <input
              id="deviceFileInput"
              type="file"
              accept=".csv,.pdf,.txt,.doc,.docx,.rtf,.png,.jpg,.jpeg,.webp,.bmp"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              style={{ display: 'none' }}
            />

            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              color: '#4f46e5',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.75rem'
            }}>
              {file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.doc') || file.name.endsWith('.rtf')) ? <FileText size={26} /> : <FileSpreadsheet size={26} />}
            </div>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              {file ? file.name : 'Click or Drag & Drop DOCX, WordPad, PDF, CSV, or Image File'}
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB document ready from device` : 'Supports Word Documents (.docx, .doc), WordPad (.rtf, .docx), PDF, CSV spreadsheets, and Image files'}
            </p>
          </div>
        )}

        {/* Paste Unstructured Text Zone (Step 1) */}
        {!complete && showUnstructuredText && (
          <div className="import-raw-text-zone">
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Paste Unstructured Addresses (e.g. 1. Name, Address lines, State, Pincode, Phone):
            </label>
            <textarea
              rows={6}
              value={rawTextInput}
              onChange={(e) => setRawTextInput(e.target.value)}
              placeholder={`1. Priya S\n45, Anna Nagar, Peelamedu, Chennai 600042\nTamil Nadu\nPhone: 9876543211\n\n2. Rahul M\n8/21, MG Road, Gandhipuram, Salem\nTamil Nadu - 636007\n9876543212`}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                marginBottom: '0.75rem',
                boxSizing: 'border-box'
              }}
            />
            <div className="import-raw-text-footer">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Supports multi-line blocks separated by blank lines or numbered indexes (1. Name, 2. Name...)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={handleRawTextParse} className="btn btn-primary btn-sm" disabled={isParsing}>
                  <FileText size={15} /> Parse & Preview Addresses
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Parsing / Analysis Loader */}
        {(isParsing || isCheckingDuplicates) && (
          <PageLoader
            message={isCheckingDuplicates ? "Scanning & checking records for duplicates..." : "Extracting address records..."}
            subMessage="Analyzing addresses against database records"
            minHeight="240px"
            icon={Upload}
          />
        )}

        {/* Step 1: Interactive Preview & Edit Table */}
        {!complete && previewItems.length > 0 && !isParsing && !isCheckingDuplicates && (() => {
          const totalPreviewPages = Math.ceil(previewItems.length / previewLimit);
          const safePreviewPage = Math.min(previewPage, totalPreviewPages || 1);
          const previewStartIndex = (safePreviewPage - 1) * previewLimit;
          const currentItems = (previewItemsRef.current && previewItemsRef.current.length === previewItems.length)
            ? previewItemsRef.current
            : previewItems;
          const currentPreviewChunk = currentItems.slice(previewStartIndex, previewStartIndex + previewLimit);

          return (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Extracted Address Records ({previewItems.length})
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Showing {previewStartIndex + 1}–{Math.min(previewStartIndex + previewLimit, previewItems.length)} of {previewItems.length} records. Edit any field below before scanning:
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleResetImport}
                    className="btn btn-secondary btn-sm"
                    style={{ borderColor: '#ef4444', color: '#dc2626' }}
                    title="Clear current preview and choose a different file"
                  >
                    <Trash2 size={14} /> Cancel / Choose Other File
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px', width: '35px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '8px 6px', width: '70px' }}>U.Id</th>
                      <th style={{ padding: '8px 8px', width: '220px' }}>Name *</th>
                      <th style={{ padding: '8px 10px', minWidth: '320px', width: '360px' }}>Address Line *</th>
                      <th style={{ padding: '8px 6px', width: '100px' }}>District</th>
                      <th style={{ padding: '8px 6px', width: '75px' }}>Pincode</th>
                      <th style={{ padding: '8px 6px', width: '105px' }}>Phone</th>
                      <th style={{ padding: '8px 6px', width: '115px' }}>Group</th>
                      <th style={{ padding: '8px 6px', width: '50px', textAlign: 'center' }}>Action</th>
                    </tr>

                  </thead>
                  <tbody>
                    {currentPreviewChunk.map((item, localIdx) => {
                      const globalIdx = previewStartIndex + localIdx;
                      return (
                        <PreviewTableRow
                          key={`preview-${globalIdx}`}
                          item={item}
                          globalIdx={globalIdx}
                          onItemChange={handlePreviewItemChange}
                          onRemove={handleRemovePreviewItem}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Step 1 Bottom Bar: Pagination & Process Blue Button */}
              <div className="import-step1-bottom-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing {previewStartIndex + 1}–{Math.min(previewStartIndex + previewLimit, previewItems.length)} of {previewItems.length} records
                </span>

                {totalPreviewPages > 1 && (
                  <div className="import-pagination-mini">
                    <button
                      onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                      disabled={safePreviewPage <= 1}
                      className="btn btn-secondary btn-sm"
                    >
                      ‹ Previous
                    </button>
                    <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Page {safePreviewPage} of {totalPreviewPages}
                    </span>
                    <button
                      onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                      disabled={safePreviewPage >= totalPreviewPages}
                      className="btn btn-secondary btn-sm"
                    >
                      Next ›
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleResetImport}
                    className="btn btn-secondary"
                    style={{ borderColor: '#ef4444', color: '#dc2626' }}
                  >
                    <Trash2 size={16} /> Cancel / Choose Other File
                  </button>
                  <button onClick={handleProcessAndAnalyze} className="btn btn-primary">
                    <CheckCircle2 size={17} /> Check & Manage Duplicates
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Step 2: Staging Analysis & Duplicate Review Screen */}
        {complete && !isParsing && !isCheckingDuplicates && (
          <div className="import-container-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isFinalSaved ? '🎉 Import Staging Saved' : 'Address Staging & Duplicate Review'}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isFinalSaved ? '#10b981' : '#4f46e5' }}>
                {isFinalSaved ? '100% SAVED' : 'READY TO CONFIRM'}
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '10px',
              backgroundColor: '#e2e8f0',
              borderRadius: '9999px',
              overflow: 'hidden',
              marginBottom: '1.25rem'
            }}>
              <div style={{
                height: '100%',
                width: '100%',
                background: isFinalSaved ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : 'var(--accent-gradient)',
                transition: 'width 0.3s ease'
              }} />
            </div>

            {/* Counters Box */}
            <div className="import-counters-grid">
              <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Extracted</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{progress.total.toLocaleString()}</div>
              </div>

              <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Processed</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{progress.processed.toLocaleString()}</div>
              </div>

              {/* SUCCESS / HOLDING BOX */}
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '2px solid #86efac',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                textAlign: 'center',
                boxShadow: '0 2px 6px rgba(34, 197, 94, 0.08)'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} color="#16a34a" /> Success
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d' }}>
                  {totalHeldInSuccess.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#166534', marginTop: '2px' }}>
                  {isFinalSaved ? 'Saved' : 'Ready to Save'}
                </div>
              </div>

              {/* DUPLICATES BOX */}
              <div style={{
                backgroundColor: duplicateDetails.length > 0 ? '#fffbeb' : '#ffffff',
                border: duplicateDetails.length > 0 ? '2px solid #fcd34d' : '1px solid var(--border-color)',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: duplicateDetails.length > 0 ? '#92400e' : 'var(--text-muted)', fontWeight: 600 }}>
                  Duplicates
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: duplicateDetails.length > 0 ? '#d97706' : 'var(--text-muted)' }}>
                  {duplicateDetails.length.toLocaleString()}
                </div>
                {duplicateDetails.length > 0 && (
                  <button
                    onClick={() => setShowDuplicateComparison(!showDuplicateComparison)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      marginTop: '0.35rem',
                      fontSize: '0.725rem',
                      padding: '2px 8px',
                      width: '100%',
                      color: '#d97706',
                      borderColor: '#fcd34d',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <Eye size={12} /> {showDuplicateComparison ? 'Hide Compare' : 'Compare & Edit'}
                  </button>
                )}
              </div>

              {/* INVALID BOX */}
              <div style={{
                backgroundColor: invalidList.length > 0 ? '#fef2f2' : '#ffffff',
                border: invalidList.length > 0 ? '2px solid #fca5a5' : '1px solid var(--border-color)',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: invalidList.length > 0 ? '#991b1b' : 'var(--danger)', fontWeight: 600 }}>
                  Invalid
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: invalidList.length > 0 ? '#dc2626' : 'var(--danger)' }}>
                  {invalidList.length.toLocaleString()}
                </div>
                {invalidList.length > 0 && (
                  <button
                    onClick={() => setShowInvalidCards(!showInvalidCards)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      marginTop: '0.35rem',
                      fontSize: '0.725rem',
                      padding: '2px 8px',
                      width: '100%',
                      color: '#dc2626',
                      borderColor: '#fca5a5',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <Eye size={12} /> {showInvalidCards ? 'Hide Invalid' : 'Fix Invalid'}
                  </button>
                )}
              </div>
            </div>

            {/* If No Duplicates Found: Informative Unique Banner & View Staged Cards (Removed per user request) */}

            {/* Staged Unique Address Cards (Collapsible View) */}
            {showStagedSuccessCards && stagedSuccessList.length > 0 && (() => {
              const totalStagedPages = Math.ceil(stagedSuccessList.length / stagedLimit);
              const safeStagedPage = Math.min(stagedPage, totalStagedPages || 1);
              const stagedStartIndex = (safeStagedPage - 1) * stagedLimit;
              const currentStagedChunk = stagedSuccessList.slice(stagedStartIndex, stagedStartIndex + stagedLimit);

              return (
                <div className="import-staged-box">
                  <div className="import-section-header">
                    <div className="import-section-title">
                      <h3 style={{ fontSize: '1.1rem', color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={18} color="#16a34a" /> Staged Addresses Ready to Save ({stagedSuccessList.length})
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Showing {stagedStartIndex + 1}–{Math.min(stagedStartIndex + stagedLimit, stagedSuccessList.length)} of {stagedSuccessList.length} records in Success:
                      </p>
                    </div>

                    {totalStagedPages > 1 && (
                      <div className="import-section-controls">
                        <div className="import-pagination-mini import-top-pagination">
                          <button
                            onClick={() => setStagedPage(p => Math.max(1, p - 1))}
                            disabled={safeStagedPage <= 1}
                            className="btn btn-secondary btn-sm"
                          >
                            ‹ Prev
                          </button>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Page {safeStagedPage} of {totalStagedPages}
                          </span>
                          <button
                            onClick={() => setStagedPage(p => Math.min(totalStagedPages, p + 1))}
                            disabled={safeStagedPage >= totalStagedPages}
                            className="btn btn-secondary btn-sm"
                          >
                            Next ›
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="import-staged-grid">
                    {currentStagedChunk.map((item, localIdx) => {
                      const globalIdx = stagedStartIndex + localIdx;
                      return (
                        <div key={globalIdx} style={{
                          border: '1px solid #dcfce7',
                          borderRadius: '0.5rem',
                          backgroundColor: '#f8fafc',
                          padding: '0.875rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>
                              #{globalIdx + 1} {item.u_id ? `[${item.u_id}]` : ''}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                {isFinalSaved ? 'Saved' : 'Ready to Save'}
                              </span>
                              {!isFinalSaved && (
                                <button
                                  onClick={() => handleRemoveStagedSuccessItem(globalIdx)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: 'var(--danger)', padding: '2px 6px', fontSize: '0.7rem' }}
                                  title="Remove from staging list"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', lineHeight: 1.3 }}>
                            {[item.door_no, item.address_line_1, item.area, item.city].filter(Boolean).join(', ')}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', fontSize: '0.75rem' }}>
                            {item.district && <span className="badge badge-info">{item.district}</span>}
                            {item.pincode && <span className="badge badge-primary">{item.pincode}</span>}
                            {item.phone && <span style={{ color: 'var(--text-muted)' }}>📞 {item.phone}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Pagination for Staged Success Cards */}
                  {totalStagedPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #dcfce7', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Showing {stagedStartIndex + 1}–{Math.min(stagedStartIndex + stagedLimit, stagedSuccessList.length)} of {stagedSuccessList.length} staged records
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => setStagedPage(p => Math.max(1, p - 1))}
                          disabled={safeStagedPage <= 1}
                          className="btn btn-secondary btn-sm"
                        >
                          ‹ Prev
                        </button>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Page {safeStagedPage} of {totalStagedPages}
                        </span>
                        <button
                          onClick={() => setStagedPage(p => Math.min(totalStagedPages, p + 1))}
                          disabled={safeStagedPage >= totalStagedPages}
                          className="btn btn-secondary btn-sm"
                        >
                          Next ›
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Quick Alert when invalid records exist */}
            {invalidList.length > 0 && (
              <div className="import-banner-box import-banner-invalid">
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertCircle size={16} color="#dc2626" /> {invalidList.length} invalid or incomplete address(es) found.
                  </div>
                  <div style={{ fontSize: '0.775rem', color: '#b91c1c' }}>
                    Records missing a contact name or address line. You can fix and move them to Success or discard them:
                  </div>
                </div>

                <div className="import-banner-actions">
                  <button
                    onClick={() => setShowInvalidCards(!showInvalidCards)}
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: '#ffffff', borderColor: '#fca5a5', color: '#dc2626', fontWeight: 700, padding: '6px 12px' }}
                  >
                    <Eye size={14} /> {showInvalidCards ? 'Hide Invalid Cards' : `Review & Fix (${invalidList.length})`}
                  </button>

                  <button
                    onClick={handleDiscardAllInvalid}
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: '#ffffff', borderColor: '#ef4444', color: '#dc2626', fontWeight: 700, padding: '6px 12px' }}
                    title="Discard and remove all invalid records"
                  >
                    <Trash2 size={14} /> Discard All Invalid
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Invalid Address Review & Fix Cards */}
            {showInvalidCards && invalidList.length > 0 && (() => {
              const totalInvalidPages = Math.ceil(invalidList.length / invalidLimit);
              const safeInvalidPage = Math.min(invalidPage, totalInvalidPages || 1);
              const invalidStartIndex = (safeInvalidPage - 1) * invalidLimit;
              const currentInvalidChunk = invalidList.slice(invalidStartIndex, invalidStartIndex + invalidLimit);

              return (
                <div className="import-invalid-box">
                  <div className="import-section-header">
                    <div className="import-section-title">
                      <h3 style={{ fontSize: '1.15rem', color: '#991b1b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={20} color="#dc2626" /> Review & Fix Invalid Addresses ({invalidList.length})
                      </h3>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                        Showing {invalidStartIndex + 1}–{Math.min(invalidStartIndex + invalidLimit, invalidList.length)} of {invalidList.length} invalid records. Correct the missing fields and click "Fix & Move to Success":
                      </p>
                    </div>

                    <div className="import-section-controls">
                      {totalInvalidPages > 1 && (
                        <div className="import-pagination-mini import-top-pagination">
                          <button
                            onClick={() => setInvalidPage(p => Math.max(1, p - 1))}
                            disabled={safeInvalidPage <= 1}
                            className="btn btn-secondary btn-sm"
                          >
                            ‹ Prev
                          </button>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Page {safeInvalidPage} of {totalInvalidPages}
                          </span>
                          <button
                            onClick={() => setInvalidPage(p => Math.min(totalInvalidPages, p + 1))}
                            disabled={safeInvalidPage >= totalInvalidPages}
                            className="btn btn-secondary btn-sm"
                          >
                            Next ›
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => setShowInvalidCards(false)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.775rem' }}
                      >
                        Hide Invalid Cards
                      </button>
                    </div>
                  </div>

                  {/* Invalid Items List */}
                  <div className="import-invalid-grid">
                    {currentInvalidChunk.map((item, localIdx) => {
                      const globalIdx = invalidStartIndex + localIdx;
                      return (
                        <div key={globalIdx} style={{
                          border: '1px solid #fecaca',
                          borderRadius: '0.75rem',
                          backgroundColor: '#fffafb',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>
                                Invalid Record #{globalIdx + 1} {item.u_id ? `[${item.u_id}]` : ''}
                              </span>
                              <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                                {item.invalidReason || 'Needs Correction'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>Name *</label>
                                <input
                                  type="text"
                                  placeholder="Enter Contact / Business Name"
                                  value={item.name || ''}
                                  onChange={(e) => handleInvalidItemEdit(globalIdx, 'name', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: (!item.name || item.name === 'Contact Name') ? '1px solid #ef4444' : '1px solid var(--border-color)',
                                    backgroundColor: (!item.name || item.name === 'Contact Name') ? '#fff1f2' : '#ffffff',
                                    fontSize: '0.85rem'
                                  }}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>Address Line *</label>
                                <input
                                  type="text"
                                  placeholder="Enter Street / Area / Landmark"
                                  value={item.address_line_1 || ''}
                                  onChange={(e) => handleInvalidItemEdit(globalIdx, 'address_line_1', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: !item.address_line_1 ? '1px solid #ef4444' : '1px solid var(--border-color)',
                                    backgroundColor: !item.address_line_1 ? '#fff1f2' : '#ffffff',
                                    fontSize: '0.85rem'
                                  }}
                                />
                              </div>

                              <div className="import-form-row-2">
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Door / Flat No</label>
                                  <input
                                    type="text"
                                    value={item.door_no || ''}
                                    onChange={(e) => handleInvalidItemEdit(globalIdx, 'door_no', e.target.value)}
                                    style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Area / Village</label>
                                  <input
                                    type="text"
                                    value={item.area || ''}
                                    onChange={(e) => handleInvalidItemEdit(globalIdx, 'area', e.target.value)}
                                    style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                                  />
                                </div>
                              </div>

                              <div className="import-form-row-2">
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>District</label>
                                  <input
                                    type="text"
                                    value={item.district || ''}
                                    onChange={(e) => handleInvalidItemEdit(globalIdx, 'district', e.target.value)}
                                    style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pincode</label>
                                  <input
                                    type="text"
                                    value={item.pincode || ''}
                                    onChange={(e) => handleInvalidItemEdit(globalIdx, 'pincode', e.target.value)}
                                    style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                                  />
                                </div>
                              </div>

                              <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phone</label>
                                <input
                                  type="text"
                                  value={item.phone || ''}
                                  onChange={(e) => handleInvalidItemEdit(globalIdx, 'phone', e.target.value)}
                                  style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Invalid Item Actions */}
                          <div className="import-card-actions">
                            <button
                              onClick={() => handleFixAndMoveInvalidToSuccess(globalIdx)}
                              className="btn btn-primary btn-sm"
                              style={{
                                fontSize: '0.75rem',
                                padding: '6px 12px',
                                flex: 1,
                                backgroundColor: '#10b981',
                                borderColor: '#059669',
                                color: '#ffffff'
                              }}
                              title="Validate and move this record into Success list"
                            >
                              <CheckCircle2 size={13} /> Fix & Move to Success
                            </button>

                            <button
                              onClick={() => handleDiscardInvalid(globalIdx)}
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--danger)', borderColor: '#fca5a5', padding: '6px 10px' }}
                              title="Discard this invalid record"
                            >
                              <Trash2 size={13} /> Discard
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Pagination for Invalid Cards */}
                  {totalInvalidPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #fee2e2', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Showing {invalidStartIndex + 1}–{Math.min(invalidStartIndex + invalidLimit, invalidList.length)} of {invalidList.length} invalid records
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => setInvalidPage(p => Math.max(1, p - 1))}
                          disabled={safeInvalidPage <= 1}
                          className="btn btn-secondary btn-sm"
                        >
                          ‹ Prev
                        </button>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Page {safeInvalidPage} of {totalInvalidPages}
                        </span>
                        <button
                          onClick={() => setInvalidPage(p => Math.min(totalInvalidPages, p + 1))}
                          disabled={safeInvalidPage >= totalInvalidPages}
                          className="btn btn-secondary btn-sm"
                        >
                          Next ›
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Quick Alert when duplicates exist */}
            {duplicateDetails.length > 0 && (
              <div className="import-banner-box import-banner-duplicate">
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: 700 }}>
                    ⚠️ {duplicateDetails.length} duplicate address(es) found for review.
                  </div>
                  <div style={{ fontSize: '0.775rem', color: '#b45309' }}>
                    Choose whether to save as new, overwrite existing records, or discard:
                  </div>
                </div>

                <div className="import-banner-actions">
                  <button
                    onClick={handleSaveAllDuplicatesAsNew}
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: '#ecfdf5', borderColor: '#10b981', color: '#047857', fontWeight: 700, padding: '6px 12px' }}
                    title="Move all remaining duplicates into Success as new records"
                  >
                    <CheckCircle2 size={14} /> Save All ({duplicateDetails.length}) as New
                  </button>

                  <button
                    onClick={handleOverwriteAllDuplicates}
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: '#eef2ff', borderColor: '#6366f1', color: '#4338ca', fontWeight: 700, padding: '6px 12px' }}
                    title="Stage all remaining duplicates to overwrite matching existing records"
                  >
                    <Edit3 size={14} /> Overwrite All ({duplicateDetails.length})
                  </button>

                  <button
                    onClick={handleDiscardAllDuplicates}
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: '#fef2f2', borderColor: '#ef4444', color: '#dc2626', fontWeight: 700, padding: '6px 12px' }}
                    title="Discard and remove all remaining duplicate records"
                  >
                    <Trash2 size={14} /> Discard All
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Duplicate Comparison & Holding Cards */}
            {showDuplicateComparison && duplicateDetails.length > 0 && (() => {
              const totalDupPages = Math.ceil(duplicateDetails.length / dupLimit);
              const safeDupPage = Math.min(dupPage, totalDupPages || 1);
              const dupStartIndex = (safeDupPage - 1) * dupLimit;
              const currentDupChunk = duplicateDetails.slice(dupStartIndex, dupStartIndex + dupLimit);

              return (
                <div className="import-compare-box">
                  <div className="import-section-header">
                    <div className="import-section-title">
                      <h3 style={{ fontSize: '1.15rem', color: '#92400e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={20} color="#f59e0b" /> Compare & Resolve Duplicates ({duplicateDetails.length})
                      </h3>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                        Showing {dupStartIndex + 1}–{Math.min(dupStartIndex + dupLimit, duplicateDetails.length)} of {duplicateDetails.length} duplicates. Choose "Save as New" or "Overwrite Existing":
                      </p>
                    </div>

                    <div className="import-section-controls">
                      {totalDupPages > 1 && (
                        <div className="import-pagination-mini import-top-pagination">
                          <button
                            onClick={() => setDupPage(p => Math.max(1, p - 1))}
                            disabled={safeDupPage <= 1}
                            className="btn btn-secondary btn-sm"
                          >
                            ‹ Prev
                          </button>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Page {safeDupPage} of {totalDupPages}
                          </span>
                          <button
                            onClick={() => setDupPage(p => Math.min(totalDupPages, p + 1))}
                            disabled={safeDupPage >= totalDupPages}
                            className="btn btn-secondary btn-sm"
                          >
                            Next ›
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => setShowDuplicateComparison(false)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.775rem' }}
                      >
                        Hide Comparison
                      </button>
                    </div>
                  </div>

                  {/* Comparison Pairs List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {currentDupChunk.map((pair, localIdx) => {
                      const globalIdx = dupStartIndex + localIdx;
                      const isUidMatch = Boolean(
                        pair.importedItem?.u_id &&
                        pair.existingAddress?.u_id &&
                        pair.importedItem.u_id.trim().toLowerCase() === pair.existingAddress.u_id.trim().toLowerCase()
                      );
                      const isPhoneMatch = Boolean(
                        pair.importedItem?.phone &&
                        pair.existingAddress?.phone &&
                        pair.importedItem.phone.trim() === pair.existingAddress.phone.trim()
                      );
                      const isNameMatch = Boolean(
                        pair.importedItem?.name &&
                        pair.existingAddress?.name &&
                        pair.importedItem.name.trim().toLowerCase() === pair.existingAddress.name.trim().toLowerCase()
                      );

                      return (
                        <div key={globalIdx} className="import-dup-pair-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', alignItems: 'start' }}>
                          {/* Match Reason Header Banner - Spans Full Width (both columns) */}
                          <div style={{
                            gridColumn: '1 / -1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            padding: '7px 12px',
                            borderRadius: '0.5rem',
                            backgroundColor: '#fffbeb',
                            border: '1.5px solid #fde68a'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 700, color: '#92400e', flexWrap: 'wrap' }}>
                              <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                              <span>Duplicate Reason:</span>
                              <span style={{
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: '1px solid #fcd34d',
                                fontWeight: 800,
                                fontSize: '0.825rem'
                              }}>
                                {getDuplicateReason(pair)}
                              </span>
                            </div>

                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: pair.isEarlierInBatch ? '#b45309' : '#15803d',
                              backgroundColor: pair.isEarlierInBatch ? '#fff7ed' : '#f0fdf4',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: pair.isEarlierInBatch ? '1px solid #fed7aa' : '1px solid #bbf7d0'
                            }}>
                              {pair.isEarlierInBatch ? '⚠️ Earlier Record in this Upload' : '🌐 Stored in Database'}
                            </span>
                          </div>

                          {/* Column 1: New Imported Address (Duplicate) - LEFT */}
                          <div className="import-dup-col import-dup-col-duplicate">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Import Record #{globalIdx + 1} (Editable)
                              </span>
                              <span className="badge" style={{ fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>Duplicate</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                  <label style={{ fontSize: '0.75rem', color: isNameMatch ? '#dc2626' : 'var(--text-muted)', fontWeight: isNameMatch ? 800 : 600 }}>Name *</label>
                                  {isNameMatch && <span style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 800 }}>★ Matched Name</span>}
                                </div>
                                <input
                                  type="text"
                                  value={pair.importedItem.name}
                                  onChange={(e) => handleDuplicateItemEdit(globalIdx, 'name', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: isNameMatch ? '2px solid #ef4444' : '1px solid var(--border-color)',
                                    backgroundColor: isNameMatch ? '#fef2f2' : '#ffffff',
                                    fontSize: '0.85rem',
                                    fontWeight: 600
                                  }}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Address Line *</label>
                                <input
                                  type="text"
                                  value={pair.importedItem.address_line_1}
                                  onChange={(e) => handleDuplicateItemEdit(globalIdx, 'address_line_1', e.target.value)}
                                  style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: '#ffffff', fontSize: '0.85rem' }}
                                />
                              </div>

                              <div className="import-form-row-2">
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>District</label>
                                  <input
                                    type="text"
                                    value={pair.importedItem.district}
                                    onChange={(e) => handleDuplicateItemEdit(globalIdx, 'district', e.target.value)}
                                    style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: '#ffffff', fontSize: '0.85rem' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pincode</label>
                                  <input
                                    type="text"
                                    value={pair.importedItem.pincode}
                                    onChange={(e) => handleDuplicateItemEdit(globalIdx, 'pincode', e.target.value)}
                                    style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: '#ffffff', fontSize: '0.85rem' }}
                                  />
                                </div>
                              </div>

                              <div className="import-form-row-2">
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <label style={{ fontSize: '0.75rem', color: isPhoneMatch ? '#dc2626' : 'var(--text-muted)', fontWeight: isPhoneMatch ? 800 : 600 }}>Phone</label>
                                    {isPhoneMatch && <span style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 800 }}>★ Matched</span>}
                                  </div>
                                  <input
                                    type="text"
                                    value={pair.importedItem.phone || ''}
                                    onChange={(e) => handleDuplicateItemEdit(globalIdx, 'phone', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      border: isPhoneMatch ? '2px solid #ef4444' : '1px solid var(--border-color)',
                                      backgroundColor: isPhoneMatch ? '#fef2f2' : '#ffffff',
                                      fontSize: '0.85rem'
                                    }}
                                  />
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <label style={{ fontSize: '0.75rem', color: isUidMatch ? '#dc2626' : 'var(--text-muted)', fontWeight: isUidMatch ? 800 : 600 }}>U.Id</label>
                                    {isUidMatch && <span style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 800 }}>★ Matched</span>}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="T-0001"
                                    value={pair.importedItem.u_id || ''}
                                    onChange={(e) => handleDuplicateItemEdit(globalIdx, 'u_id', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      border: isUidMatch ? '2px solid #ef4444' : '1px solid var(--border-color)',
                                      backgroundColor: isUidMatch ? '#fef2f2' : '#ffffff',
                                      fontSize: '0.85rem',
                                      fontWeight: 600,
                                      color: isUidMatch ? '#b91c1c' : '#4f46e5'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Item Actions */}
                            <div className="import-dup-actions">
                              <button
                                onClick={() => handleSaveDuplicateAsNew(globalIdx)}
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.75rem', padding: '6px 10px', flex: 1, minWidth: '95px' }}
                                title="Save this imported item as a new address"
                              >
                                <CheckCircle2 size={13} /> Save as New
                              </button>

                              <button
                                onClick={() => handleUpdateExistingWithImported(globalIdx)}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem', padding: '6px 10px', flex: 1, minWidth: '120px', backgroundColor: '#eef2ff', borderColor: '#6366f1', color: '#4338ca', fontWeight: 600 }}
                                title="Overwrite existing matching record with these details"
                              >
                                <Edit3 size={13} /> Overwrite Existing
                              </button>

                              <button
                                onClick={() => handleDiscardDuplicate(globalIdx)}
                                className="btn btn-secondary btn-sm"
                                style={{ color: 'var(--danger)', borderColor: '#fca5a5', padding: '6px 10px' }}
                                title="Discard duplicate record"
                              >
                                <Trash2 size={13} /> Discard
                              </button>
                            </div>
                          </div>

                          {/* Column 2: Existing Saved Address - RIGHT */}
                          <div className="import-dup-col import-dup-col-existing">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Existing Saved Address
                              </span>
                              <span className="badge" style={{
                                fontSize: '0.7rem',
                                backgroundColor: pair.isEarlierInBatch ? '#fff7ed' : '#dcfce7',
                                color: pair.isEarlierInBatch ? '#9a3412' : '#166534',
                                border: pair.isEarlierInBatch ? '1px solid #fdba74' : '1px solid #86efac'
                              }}>
                                {pair.isEarlierInBatch ? 'Earlier in this File' : 'Currently Stored in Database'}
                              </span>
                            </div>

                            {pair.existingAddress ? (
                              <div style={{ fontSize: '0.85rem' }}>
                                <div style={{
                                  fontWeight: 700,
                                  fontSize: '0.95rem',
                                  color: isNameMatch ? '#dc2626' : 'var(--text-primary)',
                                  marginBottom: '0.25rem'
                                }}>
                                  {pair.existingAddress.name} {isNameMatch && <span style={{ fontSize: '0.725rem', color: '#dc2626', fontWeight: 600 }}>(Matched Name)</span>}
                                </div>
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                                  {[pair.existingAddress.door_no, pair.existingAddress.address_line_1, pair.existingAddress.area, pair.existingAddress.city].filter(Boolean).join(', ')}
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                                  {pair.existingAddress.district && <span className="badge badge-info">{pair.existingAddress.district}</span>}
                                  {pair.existingAddress.pincode && <span className="badge badge-primary">{pair.existingAddress.pincode}</span>}
                                  {pair.existingAddress.phone && (
                                    <span style={{
                                      fontSize: '0.8rem',
                                      color: isPhoneMatch ? '#dc2626' : 'var(--text-muted)',
                                      fontWeight: isPhoneMatch ? 700 : 400
                                    }}>
                                      📞 {pair.existingAddress.phone} {isPhoneMatch && '(Matched)'}
                                    </span>
                                  )}
                                </div>
                                {pair.existingAddress.u_id && (
                                  <div style={{
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    marginTop: '0.65rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: isUidMatch ? '#fef2f2' : 'rgba(79, 70, 229, 0.08)',
                                    color: isUidMatch ? '#dc2626' : '#4f46e5',
                                    border: isUidMatch ? '1.5px solid #ef4444' : '1px solid rgba(79, 70, 229, 0.2)'
                                  }}>
                                    Ref U.ID: {pair.existingAddress.u_id} {isUidMatch && '★ Matched Duplicate'}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Existing matching address details unavailable.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Pagination for Duplicates */}
                  {totalDupPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #fef3c7', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Showing {dupStartIndex + 1}–{Math.min(dupStartIndex + dupLimit, duplicateDetails.length)} of {duplicateDetails.length} duplicates
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => setDupPage(p => Math.max(1, p - 1))}
                          disabled={safeDupPage <= 1}
                          className="btn btn-secondary btn-sm"
                        >
                          ‹ Prev
                        </button>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Page {safeDupPage} of {totalDupPages}
                        </span>
                        <button
                          onClick={() => setDupPage(p => Math.min(totalDupPages, p + 1))}
                          disabled={safeDupPage >= totalDupPages}
                          className="btn btn-secondary btn-sm"
                        >
                          Next ›
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Step 2 Final Action Bar: 3 Clean Buttons */}
            <div className="import-final-action-bar">
              {/* Button 1: Cancel / Select Another File */}
              <button
                onClick={handleResetImport}
                className="btn btn-secondary"
                style={{ borderColor: '#ef4444', color: '#dc2626' }}
              >
                <Trash2 size={16} /> Cancel / Select Another File
              </button>

              <div className="import-final-action-buttons">
                {/* Button 2: Confirm & Save All (N) Addresses from Success Box */}
                <button
                  onClick={handleFinalCommitSave}
                  className="btn"
                  disabled={isSavingFinal || totalHeldInSuccess === 0 || isFinalSaved}
                  style={{
                    backgroundColor: isFinalSaved ? '#10b981' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    padding: '8px 18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                    opacity: (totalHeldInSuccess === 0 && !isFinalSaved) ? 0.6 : 1,
                    cursor: (totalHeldInSuccess === 0 || isFinalSaved) ? 'default' : 'pointer'
                  }}
                >
                  {isFinalSaved ? (
                    <>
                      <Check size={17} /> All ({totalHeldInSuccess}) Addresses Saved
                    </>
                  ) : isSavingFinal ? (
                    <>
                      Saving ({totalHeldInSuccess}) Addresses...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={17} /> Confirm & Save All ({totalHeldInSuccess}) Addresses
                    </>
                  )}
                </button>

                {/* Button 3: View Address Directory */}
                <button
                  onClick={() => {
                    if (onStatsChange) onStatsChange();
                    onNavigate('addresses');
                  }}
                  className="btn btn-primary"
                >
                  View Address Directory <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Duplicate Modal */}
      {previewDupModalItem && (
        <DuplicateModal
          isOpen={!!previewDupModalItem}
          existingAddress={previewDupModalItem}
          onViewExisting={() => {
            setPreviewDupModalItem(null);
            onNavigate('addresses');
          }}
          onContinue={() => setPreviewDupModalItem(null)}
          onCancel={() => setPreviewDupModalItem(null)}
        />
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />
    </div>
  );
}
