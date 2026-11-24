import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, Languages, Sparkles } from 'lucide-react';
import { isTamilText, transliterateToTamil } from '../utils/tamilHelper';

export function SearchBar({ value, onChange, loading, langMode, onLangModeChange }) {
  const [inputValue, setInputValue] = useState(value || '');
  const [currentMode, setCurrentMode] = useState(() => {
    return localStorage.getItem('address_search_lang_mode') || 'EN';
  });

  const [transliteratedPreview, setTransliteratedPreview] = useState('');

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    if (langMode) {
      setCurrentMode(langMode);
    }
  }, [langMode]);

  const handleModeToggle = (mode) => {
    setCurrentMode(mode);
    localStorage.setItem('address_search_lang_mode', mode);
    if (onLangModeChange) {
      onLangModeChange(mode);
    }

    if (inputValue) {
      if (mode === 'TA' && !isTamilText(inputValue)) {
        const converted = transliterateToTamil(inputValue);
        onChange(converted);
      } else {
        onChange(inputValue);
      }
    }
  };

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setInputValue(newVal);

    if (!newVal) {
      setTransliteratedPreview('');
      onChange('');
      return;
    }

    const isTamil = isTamilText(newVal);

    if (currentMode === 'TA' && !isTamil) {
      const taConverted = transliterateToTamil(newVal);
      setTransliteratedPreview(taConverted);
      // Pass the Tamil transliterated search query to parent onChange
      onChange(taConverted);
    } else {
      if (isTamil) {
        setTransliteratedPreview('');
      } else {
        const taConverted = transliterateToTamil(newVal);
        setTransliteratedPreview(taConverted);
      }
      onChange(newVal);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setTransliteratedPreview('');
    onChange('');
  };

  return (
    <div className="search-bar-root" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', minWidth: 0 }}>
      <div className="search-input-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
        {/* Main Search Input Container */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <div style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none'
          }}>
            {loading ? (
              <Loader2 size={17} className="pulse-loader" style={{ borderColor: 'rgba(234, 88, 12, 0.3)', borderTopColor: '#ea580c' }} />
            ) : (
              <Search size={17} />
            )}
          </div>

          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={
              currentMode === 'TA'
                ? 'தேடுக (பெயர், முகவரி...)'
                : 'Search name, district, address...'
            }
            className="form-input"
            style={{
              paddingLeft: '2.3rem',
              paddingRight: inputValue ? '2.2rem' : '0.75rem',
              height: '40px',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              fontWeight: 600,
              backgroundColor: 'var(--bg-input)',
              borderColor: currentMode === 'TA' ? '#ea580c' : undefined,
              width: '100%',
              boxSizing: 'border-box'
            }}
          />

          {inputValue && (
            <button
              onClick={handleClear}
              style={{
                position: 'absolute',
                right: '0.6rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '50%'
              }}
              title="Clear Search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* English | Tamil Toggle Button */}
        <div className="lang-toggle-container" style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
          padding: '2px',
          height: '40px',
          flexShrink: 0
        }}>
          <button
            type="button"
            className={`lang-toggle-btn ${currentMode === 'EN' ? 'active' : ''}`}
            onClick={() => handleModeToggle('EN')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: currentMode === 'EN' ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor: currentMode === 'EN' ? '#ea580c' : 'transparent',
              border: 'none',
              borderRadius: '0.4rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            English
          </button>

          <button
            type="button"
            className={`lang-toggle-btn ${currentMode === 'TA' ? 'active' : ''}`}
            onClick={() => handleModeToggle('TA')}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: currentMode === 'TA' ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor: currentMode === 'TA' ? '#ea580c' : 'transparent',
              border: 'none',
              borderRadius: '0.4rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              whiteSpace: 'nowrap'
            }}
            title="Tamil Transliteration Mode (e.g. murali → முரளி)"
          >
            <Languages size={13} />
            <span>தமிழ்</span>
          </button>
        </div>
      </div>

      {/* Live Transliteration Preview Badge */}
      {transliteratedPreview && transliteratedPreview !== inputValue && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.75rem',
          color: '#8b5cf6',
          paddingLeft: '0.5rem'
        }}>
          <Sparkles size={12} />
          <span>Tamil matching: <strong>{transliteratedPreview}</strong></span>
        </div>
      )}
    </div>
  );
}

