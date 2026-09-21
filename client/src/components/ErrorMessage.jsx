import { AlertCircle } from 'lucide-react';

export default function ErrorMessage({ message, className = '' }) {
  if (!message) return null;
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`}>
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
