export default function PanelLoadingSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-curro-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted text-xs uppercase tracking-widest">Loading panel…</p>
      </div>
    </div>
  );
}
