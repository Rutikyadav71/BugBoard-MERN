import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmationModal({ open, title, message, confirmLabel = 'Confirm', danger = false, loading = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
        <div className="flex gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'}`}><AlertTriangle size={20} /></span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>{loading ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
