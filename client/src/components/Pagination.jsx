import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ meta, onPageChange }) {
  if (!meta || meta.pages <= 1) return null;
  const { page, pages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination">
      <p className="text-sm text-slate-500">Showing <span className="font-medium text-slate-700">{from}-{to}</span> of <span className="font-medium text-slate-700">{total}</span></p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button type="button" className="btn-secondary px-2" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span className="text-sm text-slate-600">Page {page} of {pages}</span>
        <button type="button" className="btn-secondary px-2" onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </nav>
  );
}
