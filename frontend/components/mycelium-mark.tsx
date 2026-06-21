import Link from "next/link"

/**
 * MyceliumMark — the brand glyph: one lit jade node with thin threads
 * reaching out to small neutral spores. Delicate line-work, not a glowing web.
 */
export function MyceliumMark({
  className,
  size = 18,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 8 L2.5 3 M8 8 L13.5 4 M8 8 L3 13 M8 8 L13 12.5 M8 8 L8 1.5"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.5"
      />
      <g fill="currentColor" opacity="0.55">
        <circle cx="2.5" cy="3" r="1.05" />
        <circle cx="13.5" cy="4" r="1.05" />
        <circle cx="3" cy="13" r="1.05" />
        <circle cx="13" cy="12.5" r="1.05" />
        <circle cx="8" cy="1.5" r="1.05" />
      </g>
      <circle cx="8" cy="8" r="2.2" fill="var(--primary)" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Mycelia home"
      className={`flex items-center gap-2.5 ${className ?? ""}`}
    >
      <MyceliumMark className="text-foreground" size={20} />
      <span className="font-display text-[17px] tracking-[-0.01em] text-foreground">
        Mycelia
      </span>
    </Link>
  )
}
