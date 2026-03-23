export function AudioWaveIcon() {
  return (
    <svg viewBox="0 0 20 16" className="h-4 w-5" fill="currentColor" aria-hidden="true">
      <rect x="1" y="6" width="2.5" height="4" rx="1.25">
        <animate attributeName="height" values="4;10;4" dur="0.7s" repeatCount="indefinite" begin="0s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
        <animate attributeName="y" values="6;3;6" dur="0.7s" repeatCount="indefinite" begin="0s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
      </rect>
      <rect x="5.5" y="4" width="2.5" height="8" rx="1.25">
        <animate attributeName="height" values="8;14;8" dur="0.7s" repeatCount="indefinite" begin="0.15s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
        <animate attributeName="y" values="4;1;4" dur="0.7s" repeatCount="indefinite" begin="0.15s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
      </rect>
      <rect x="10" y="2" width="2.5" height="12" rx="1.25">
        <animate attributeName="height" values="12;16;12" dur="0.7s" repeatCount="indefinite" begin="0.3s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
        <animate attributeName="y" values="2;0;2" dur="0.7s" repeatCount="indefinite" begin="0.3s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
      </rect>
      <rect x="14.5" y="4" width="2.5" height="8" rx="1.25">
        <animate attributeName="height" values="8;14;8" dur="0.7s" repeatCount="indefinite" begin="0.45s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
        <animate attributeName="y" values="4;1;4" dur="0.7s" repeatCount="indefinite" begin="0.45s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
      </rect>
    </svg>
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
