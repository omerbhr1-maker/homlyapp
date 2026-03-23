export function AudioWaveIcon() {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "flex-end", gap: "2px", width: "18px", height: "16px" }}>
      {(["6px","11px","14px","11px"] as const).map((h, i) => (
        <span key={i} style={{ display: "block", width: "3px", height: h, borderRadius: "2px", backgroundColor: "currentColor", transformOrigin: "bottom", animation: "audioWaveBar 0.7s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

export function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function RecipeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M7 3v6" />
      <path d="M17 3v6" />
      <rect x="4" y="6" width="16" height="15" rx="2" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}
