import React from 'react';
import { TAMIL_ALPHABET_HEADERS } from '../utils/tamilHelper';

export function AlphabetFilter({ selectedAlphabet, onSelectAlphabet, langMode = 'TA' }) {
  const englishAlphabets = ['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
  const activeAlphabets = langMode === 'TA' ? TAMIL_ALPHABET_HEADERS : englishAlphabets;

  return (
    <div className="alphabet-filter-container" style={{
      marginBottom: '1.25rem',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '0.75rem',
      padding: '0.6rem 0.875rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.35rem',
      overflowX: 'auto',
      whiteSpace: 'nowrap'
    }}>
      <span className="alphabet-filter-label" style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.05em',
        marginRight: '0.5rem',
        flexShrink: 0
      }}>
        {langMode === 'TA' ? 'அகரிவரிசை Index (அ-ன):' : 'A-Z Index:'}
      </span>

      <div className="alphabet-filter-buttons" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'nowrap' }}>
        {activeAlphabets.map((letter) => {
          const isSelected = (selectedAlphabet || 'ALL') === letter;
          return (
            <button
              key={letter}
              onClick={() => onSelectAlphabet(letter)}
              style={{
                minWidth: '28px',
                height: '28px',
                padding: '0 0.35rem',
                fontSize: '0.8rem',
                fontWeight: isSelected ? 800 : 600,
                borderRadius: '0.375rem',
                border: isSelected ? '1px solid #ea580c' : '1px solid transparent',
                backgroundColor: isSelected ? '#ea580c' : 'transparent',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = '#fff3ed';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}

