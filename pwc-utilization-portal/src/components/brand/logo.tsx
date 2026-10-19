/**
 * PwC logo lockup.
 *
 * PLACEHOLDER ARTWORK — replace with the official PwC logo SVG from the PwC
 * brand site before go-live (keep the same component API). The wordmark uses
 * currentColor so it inverts correctly in dark mode.
 */
export function PwcLogo({ className, title = "PwC" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 92 44" className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <g transform="skewX(-28)">
        <rect x="58" y="2" width="30" height="5" fill="#FD5108" />
        <rect x="64" y="9" width="24" height="5" fill="#E0301E" />
        <rect x="52" y="9" width="10" height="5" fill="#FFB600" />
      </g>
      <text
        x="2"
        y="38"
        fill="currentColor"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="30"
        letterSpacing="-1"
      >
        pwc
      </text>
    </svg>
  );
}
