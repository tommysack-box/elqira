interface LoadingScreenProps {
  label?: string;
}

export function LoadingScreen({ label = 'Loading application' }: LoadingScreenProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-[#f7f9fb]" aria-busy="true" aria-live="polite">
      <div className="app-spinner" role="status" aria-label={label} />
    </div>
  );
}
