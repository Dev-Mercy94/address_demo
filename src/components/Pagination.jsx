import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowRight } from 'lucide-react';

export function Pagination({ page, limit, total, totalPages, onPageChange, onLimitChange }) {
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);
  const safeTotalPages = Math.max(1, totalPages || 1);

  const handleJump = (e) => {
    e.preventDefault();
    const p = parseInt(jumpPage, 10);
    if (!isNaN(p) && p >= 1 && p <= safeTotalPages) {
      onPageChange(p);
      setJumpPage('');
      setShowJumpInput(false);
    }
  };

  // Generate page numbers range around current page
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(safeTotalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return { pages, showFirst: start > 1, showLast: end < safeTotalPages };
  };

  const { pages, showFirst, showLast } = getPageNumbers();

  return (
    <div className="pagination-wrapper">
      {/* Left side: Record Counter & Per Page Select */}
      <div className="pagination-info-group">
        <div className="pagination-count-badge">
          <span className="pagination-count-label">Showing</span>
          <span className="pagination-count-highlight">{startRecord.toLocaleString()}–{endRecord.toLocaleString()}</span>
          <span className="pagination-count-label">of</span>
          <span className="pagination-count-total">{total.toLocaleString()}</span>
          <span className="pagination-count-label pagination-hide-mobile">records</span>
        </div>

        {onLimitChange && (
          <div className="pagination-limit-group">
            <span className="pagination-limit-label">Rows:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="pagination-limit-select"
              aria-label="Rows per page"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
        )}
      </div>

      {/* Right side / Mobile Center: Navigation Controls */}
      <div className="pagination-controls-group">
        {/* Desktop Page Numbers & Controls */}
        <div className="pagination-buttons-desktop">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className="pagination-btn pagination-btn-nav"
            title="First Page"
          >
            <ChevronsLeft size={16} />
          </button>

          {/* Previous */}
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="pagination-btn pagination-btn-nav"
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          {showFirst && (
            <>
              <button
                type="button"
                onClick={() => onPageChange(1)}
                className="pagination-btn"
              >
                1
              </button>
              <span className="pagination-ellipsis">...</span>
            </>
          )}

          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`pagination-btn ${p === page ? 'active' : ''}`}
            >
              {p}
            </button>
          ))}

          {showLast && (
            <>
              <span className="pagination-ellipsis">...</span>
              <button
                type="button"
                onClick={() => onPageChange(safeTotalPages)}
                className="pagination-btn"
              >
                {safeTotalPages}
              </button>
            </>
          )}

          {/* Next */}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= safeTotalPages}
            className="pagination-btn pagination-btn-nav"
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(safeTotalPages)}
            disabled={page >= safeTotalPages}
            className="pagination-btn pagination-btn-nav"
            title="Last Page"
          >
            <ChevronsRight size={16} />
          </button>
        </div>

        {/* Mobile-Friendly Streamlined Navigation */}
        <div className="pagination-buttons-mobile">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="pagination-mobile-nav-btn"
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>

          <button
            type="button"
            onClick={() => setShowJumpInput(!showJumpInput)}
            className="pagination-mobile-indicator"
            title="Tap to jump to page"
          >
            <span>Page <strong>{page}</strong> of {safeTotalPages}</span>
          </button>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= safeTotalPages}
            className="pagination-mobile-nav-btn"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Jump to Page Form (Desktop or Expanded on Mobile) */}
        {(safeTotalPages > 3 || showJumpInput) && (
          <form onSubmit={handleJump} className={`pagination-jump-form ${showJumpInput ? 'mobile-visible' : ''}`}>
            <input
              type="number"
              min="1"
              max={safeTotalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              placeholder="Jump #"
              className="pagination-jump-input"
            />
            <button type="submit" className="pagination-jump-submit">
              Go
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
