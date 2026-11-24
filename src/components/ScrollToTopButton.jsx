import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      const scrolled = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrolled > 120) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    document.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
      document.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <button
      type="button"
      className="scroll-to-top-btn"
      onClick={scrollToTop}
      title="Scroll to Top"
      aria-label="Scroll to top"
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: '#ea580c',
        backgroundImage: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
        color: '#ffffff',
        border: '2px solid rgba(255, 255, 255, 0.5)',
        boxShadow: '0 4px 18px rgba(234, 88, 12, 0.5), 0 2px 6px rgba(0, 0, 0, 0.25)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px) scale(1.08)';
        e.currentTarget.style.boxShadow = '0 6px 24px rgba(234, 88, 12, 0.65), 0 4px 10px rgba(0, 0, 0, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 18px rgba(234, 88, 12, 0.5), 0 2px 6px rgba(0, 0, 0, 0.25)';
      }}
    >
      <ArrowUp size={22} strokeWidth={2.5} />
    </button>
  );
}
