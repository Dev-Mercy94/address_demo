import React, { useState, useEffect, useMemo } from 'react';
import { fetchAddresses } from '../services/apiService';
import { Download, FileText, FileSpreadsheet, Building2, MapPin, Hash, Map, FilterX, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Toast } from '../components/Toast';
import { exportAddressesToPdf, exportAddressesToCsv, getExportFilename } from '../utils/pdfExportHelper';
import { SORTED_TAMIL_DISTRICTS } from '../utils/tamilHelper';

export function ExportPage() {
  const [allRecords, setAllRecords] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState('all'); // 'all' or 'filtered'
  const [filters, setFilters] = useState({
    district: 'ALL',
    city: 'ALL',
    area: 'ALL',
    pincode: 'ALL'
  });
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // Load complete address records once on mount for instant reactive sorting and cascading filter options
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoadingData(true);
      try {
        const res = await fetchAddresses({ limit: 10000, page: 1 });
        if (isMounted) {
          setAllRecords(res.addresses || []);
        }
      } catch (err) {
        console.error('Failed to load addresses for export:', err);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  // District matching helper
  const isDistrictMatch = (addrDistrict, targetDistrict) => {
    if (!targetDistrict || targetDistrict === 'ALL') return true;
    if (!addrDistrict) return false;
    const a = addrDistrict.trim().toLowerCase();
    const t = targetDistrict.trim().toLowerCase();
    if (a === t) return true;

    // Check Tamil translation helper
    const distInfo = SORTED_TAMIL_DISTRICTS.find(d => 
      d.id.toLowerCase() === t || d.en.toLowerCase() === t || d.ta.toLowerCase() === t
    );
    if (distInfo) {
      if (a === distInfo.id.toLowerCase() || a === distInfo.en.toLowerCase() || a === distInfo.ta.toLowerCase()) {
        return true;
      }
    }
    return false;
  };

  // 1. Filtered addresses based on currently selected District
  const districtMatchedRecords = useMemo(() => {
    if (filters.district === 'ALL') return allRecords;
    return allRecords.filter(r => isDistrictMatch(r.district, filters.district));
  }, [allRecords, filters.district]);

  // 2. Filtered addresses based on District + City
  const cityMatchedRecords = useMemo(() => {
    if (filters.city === 'ALL' || !filters.city.trim()) return districtMatchedRecords;
    const c = filters.city.trim().toLowerCase();
    return districtMatchedRecords.filter(r => (r.city || '').trim().toLowerCase() === c);
  }, [districtMatchedRecords, filters.city]);

  // 3. Filtered addresses based on District + City + Area
  const areaMatchedRecords = useMemo(() => {
    if (filters.area === 'ALL' || !filters.area.trim()) return cityMatchedRecords;
    const a = filters.area.trim().toLowerCase();
    return cityMatchedRecords.filter(r => {
      const areaField = (r.area || '').toLowerCase();
      const line1 = (r.address_line_1 || '').toLowerCase();
      const line2 = (r.address_line_2 || '').toLowerCase();
      return areaField.includes(a) || line1.includes(a) || line2.includes(a);
    });
  }, [cityMatchedRecords, filters.area]);

  // 4. Final matching records: District + City + Area + Pincode
  const matchingRecords = useMemo(() => {
    if (exportType === 'all') return allRecords;
    if (filters.pincode === 'ALL' || !filters.pincode.trim()) return areaMatchedRecords;
    const p = filters.pincode.trim();
    return areaMatchedRecords.filter(r => String(r.pincode || '').trim().startsWith(p));
  }, [exportType, allRecords, areaMatchedRecords, filters.pincode]);

  // Dynamic cascading option lists with record counts
  const availableDistricts = useMemo(() => {
    const counts = {};
    allRecords.forEach(r => {
      const d = (r.district || 'Other').trim();
      counts[d] = (counts[d] || 0) + 1;
    });

    return SORTED_TAMIL_DISTRICTS.map(d => {
      // Find matching count in records
      let count = 0;
      Object.keys(counts).forEach(k => {
        if (isDistrictMatch(k, d.id)) {
          count += counts[k];
        }
      });
      return {
        ...d,
        count
      };
    });
  }, [allRecords]);

  // Cities available within selected district
  const availableCities = useMemo(() => {
    const map = {};
    districtMatchedRecords.forEach(r => {
      const c = (r.city || '').trim();
      if (c) {
        map[c] = (map[c] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [districtMatchedRecords]);

  // Areas available within selected district & city
  const availableAreas = useMemo(() => {
    const map = {};
    cityMatchedRecords.forEach(r => {
      const a = (r.area || '').trim();
      if (a) {
        map[a] = (map[a] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [cityMatchedRecords]);

  // Pincodes available within selected district, city & area
  const availablePincodes = useMemo(() => {
    const map = {};
    areaMatchedRecords.forEach(r => {
      const p = (r.pincode || '').trim();
      if (p) {
        map[p] = (map[p] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  }, [areaMatchedRecords]);

  // Reset dependent filters when parent filter changes
  const handleDistrictChange = (newDistrict) => {
    setFilters({
      district: newDistrict,
      city: 'ALL',
      area: 'ALL',
      pincode: 'ALL'
    });
  };

  const handleCityChange = (newCity) => {
    setFilters(prev => ({
      ...prev,
      city: newCity,
      area: 'ALL',
      pincode: 'ALL'
    }));
  };

  const handleAreaChange = (newArea) => {
    setFilters(prev => ({
      ...prev,
      area: newArea,
      pincode: 'ALL'
    }));
  };

  const handlePincodeChange = (newPincode) => {
    setFilters(prev => ({
      ...prev,
      pincode: newPincode
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      district: 'ALL',
      city: 'ALL',
      area: 'ALL',
      pincode: 'ALL'
    });
  };

  const hasActiveFilters = Boolean(
    (filters.district && filters.district !== 'ALL') ||
    (filters.city && filters.city !== 'ALL') ||
    (filters.area && filters.area !== 'ALL') ||
    (filters.pincode && filters.pincode !== 'ALL')
  );

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      if (!matchingRecords || matchingRecords.length === 0) {
        setToast({ message: 'Validation Warning: No records found matching the selected export filters.', type: 'warning' });
        setExporting(false);
        return;
      }

      const filterInfo = exportType === 'filtered' ? {
        district: filters.district !== 'ALL' ? filters.district : 'All Districts',
        city: filters.city !== 'ALL' ? filters.city : '',
        area: filters.area !== 'ALL' ? filters.area : '',
        pincode: filters.pincode !== 'ALL' ? filters.pincode : ''
      } : 'All Districts';

      const res = await exportAddressesToPdf(matchingRecords, filterInfo);
      if (res?.success) {
        setToast({ message: `Download Validated: Successfully generated and downloaded PDF with ${res.count} records (${res.fileName}).`, type: 'success' });
      } else {
        setToast({ message: res?.message || 'Validation Notice: Export completed.', type: 'info' });
      }
    } catch (err) {
      console.error('PDF Export error:', err);
      setToast({ message: err.message || 'Validation Error: Failed to export PDF file.', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    try {
      if (!matchingRecords || matchingRecords.length === 0) {
        setToast({ message: 'Validation Warning: No records found matching the selected export filters.', type: 'warning' });
        return;
      }

      const filterInfo = exportType === 'filtered' ? {
        district: filters.district !== 'ALL' ? filters.district : 'All Districts',
        city: filters.city !== 'ALL' ? filters.city : '',
        area: filters.area !== 'ALL' ? filters.area : '',
        pincode: filters.pincode !== 'ALL' ? filters.pincode : ''
      } : 'All Districts';

      const res = exportAddressesToCsv(matchingRecords, filterInfo);
      if (res?.success) {
        setToast({ message: `Download Validated: Successfully generated and downloaded CSV with ${res.count} records (${res.fileName}).`, type: 'success' });
      } else {
        setToast({ message: res?.message || 'Validation Notice: Export completed.', type: 'info' });
      }
    } catch (err) {
      console.error('CSV Export error:', err);
      setToast({ message: err.message || 'Validation Error: Failed to export CSV file.', type: 'error' });
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <div className="card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="export-page-icon" style={{
            width: '44px',
            height: '44px',
            borderRadius: '0.625rem',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            flexShrink: 0
          }}>
            <Download className="export-page-icon-svg" size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem' }}>Export Addresses (PDF &amp; CSV)</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Directly download address records in neat PDF format or standard CSV spreadsheet file for instant importing.
            </p>
          </div>
        </div>

        {/* Export Mode Selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 1rem',
            borderRadius: '0.625rem',
            border: '1px solid var(--border-color)',
            backgroundColor: exportType === 'all' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
            borderColor: exportType === 'all' ? 'var(--accent-primary)' : 'var(--border-color)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
            <input
              type="radio"
              name="exportType"
              value="all"
              checked={exportType === 'all'}
              onChange={() => setExportType('all')}
            />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Export All Records</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Downloads complete address records directly as CSV or PDF
              </div>
            </div>
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 1rem',
            borderRadius: '0.625rem',
            border: '1px solid var(--border-color)',
            backgroundColor: exportType === 'filtered' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
            borderColor: exportType === 'filtered' ? 'var(--accent-primary)' : 'var(--border-color)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
            <input
              type="radio"
              name="exportType"
              value="filtered"
              checked={exportType === 'filtered'}
              onChange={() => setExportType('filtered')}
            />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Export Filtered Records</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Filter by District, City, Area, or Pincode to download targeted subsets
              </div>
            </div>
          </label>
        </div>

        {/* Multi-Field Cascading Filter Controls */}
        {exportType === 'filtered' && (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Dynamic Filter Selection
                </span>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <FilterX size={13} /> Clear Filters
                </button>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem'
            }}>
              {/* 1. District Filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Building2 size={14} style={{ color: '#2563eb' }} /> District
                </label>
                <select
                  value={filters.district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="form-select"
                  style={{ height: '40px', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <option value="ALL">All Districts</option>
                  {availableDistricts.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.ta} ({d.en})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. City Filter (Cascading) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={14} style={{ color: '#2563eb' }} /> City / Town
                </label>
                <select
                  value={filters.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="form-select"
                  style={{ height: '40px', fontSize: '0.85rem', fontWeight: 600 }}
                  disabled={availableCities.length === 0}
                >
                  <option value="ALL">
                    All Cities
                  </option>
                  {availableCities.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Area / Street Filter (Cascading) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Map size={14} style={{ color: '#2563eb' }} /> Area / Street
                </label>
                <select
                  value={filters.area}
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className="form-select"
                  style={{ height: '40px', fontSize: '0.85rem', fontWeight: 600 }}
                  disabled={availableAreas.length === 0}
                >
                  <option value="ALL">
                    All Areas
                  </option>
                  {availableAreas.map(a => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Pincode Filter (Cascading) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Hash size={14} style={{ color: '#2563eb' }} /> Pincode
                </label>
                <select
                  value={filters.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  className="form-select"
                  style={{ height: '40px', fontSize: '0.85rem', fontWeight: 600 }}
                  disabled={availablePincodes.length === 0}
                >
                  <option value="ALL">
                    All Pincodes
                  </option>
                  {availablePincodes.map(p => (
                    <option key={p.code} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Live Matching Count Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.15rem',
          borderRadius: '0.625rem',
          backgroundColor: (matchingRecords.length === 0) ? 'rgba(239, 68, 68, 0.08)' : 'rgba(37, 99, 235, 0.08)',
          border: `1px solid ${(matchingRecords.length === 0) ? 'rgba(239, 68, 68, 0.25)' : 'rgba(37, 99, 235, 0.25)'}`,
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {matchingRecords.length === 0 ? (
              <AlertCircle size={20} style={{ color: '#ef4444' }} />
            ) : (
              <CheckCircle2 size={20} style={{ color: '#2563eb' }} />
            )}
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {loadingData ? (
                'Loading address records...'
              ) : (
                <>
                  Ready to export: <span style={{ color: '#2563eb' }}>{matchingRecords.length}</span> record{matchingRecords.length === 1 ? '' : 's'}.
                </>
              )}
            </span>
          </div>

          {hasActiveFilters && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {filters.district !== 'ALL' && (
                <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>{filters.district}</span>
              )}
              {filters.city !== 'ALL' && (
                <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{filters.city}</span>
              )}
              {filters.area !== 'ALL' && (
                <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>{filters.area}</span>
              )}
              {filters.pincode !== 'ALL' && (
                <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>{filters.pincode}</span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons: Export CSV & Export PDF */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportCsv}
            disabled={matchingRecords.length === 0 || loadingData}
            className="btn btn-secondary"
            style={{
              padding: '0.65rem 1.35rem',
              fontSize: '0.95rem',
              borderColor: '#059669',
              color: '#059669',
              fontWeight: 700
            }}
          >
            <FileSpreadsheet size={18} /> Export CSV
          </button>

          <button
            onClick={handleExportPdf}
            disabled={exporting || matchingRecords.length === 0 || loadingData}
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.35rem', fontSize: '0.95rem' }}
          >
            {exporting ? (
              <div className="pulse-loader" />
            ) : (
              <>
                <FileText size={18} /> Export PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />
    </div>
  );
}
