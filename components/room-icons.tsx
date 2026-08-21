// Inline icons for the room surface — no dependency, and they inherit color.
// The design's arrow/check/cross glyphs (↑ ▦ ✓ ✕ ▲ ▼ ↵ ♪ ★) live here as
// components so weight and size stay consistent across screens.

type IconProps = { size?: number; className?: string };

function svgProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };
}

export function ShareIcon({ size = 17, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

export function QrIcon({ size = 17, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3" />
      <path d="M21 14v.01" />
      <path d="M14 21h3" />
      <path d="M21 17v4" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} strokeWidth={2.6}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} strokeWidth={2.4}>
      <path d="m5 15 7-7 7 7" />
    </svg>
  );
}

export function ArrowDownIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} strokeWidth={2.4}>
      <path d="m5 9 7 7 7-7" />
    </svg>
  );
}

export function EnterIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M20 6v6a2 2 0 0 1-2 2H5" />
      <path d="m8 11-3 3 3 3" />
    </svg>
  );
}

export function StarIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} fill="currentColor" strokeWidth={0}>
      <path d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.6l5.9-.8z" />
    </svg>
  );
}

export function NoteIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="8" cy="18" r="3" />
      <path d="M11 18V5l9-2v11" />
      <circle cx="17" cy="14" r="3" />
    </svg>
  );
}

export function ReplayIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

export function SkipIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 12h13" />
      <path d="m12 7 5 5-5 5" />
      <path d="M20 6v12" />
    </svg>
  );
}
