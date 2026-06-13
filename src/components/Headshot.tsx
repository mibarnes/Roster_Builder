import { useState } from 'react'
import { getInitials } from '../utils/playerHelpers.ts'

interface HeadshotProps {
  url: string | null
  name: string
  /** Fallback glyph when no headshot (position abbrev for cards, initials for modal). */
  fallback?: string
  /** Square size in px. */
  size: number
  className?: string
}

/**
 * ESPN player headshot with a graceful, dark-theme-consistent fallback.
 * Renders the photo (lazy-loaded) when a url is present and hasn't errored;
 * otherwise an initials/position chip so cards never show a broken image.
 */
export default function Headshot({ url, name, fallback, size, className = '' }: HeadshotProps) {
  const [errored, setErrored] = useState(false)
  const dim = { width: size, height: size }
  const showImg = url != null && !errored
  const fallbackText = fallback ?? getInitials(name)

  if (showImg) {
    return (
      <img
        src={url}
        alt={`${name} headshot`}
        loading="lazy"
        onError={() => setErrored(true)}
        style={dim}
        className={`rounded-full object-cover bg-gray-900 ring-1 ring-white/10 ${className}`}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={`${name} (no photo)`}
      style={dim}
      className={`rounded-full bg-gray-900 ring-1 ring-white/10 flex items-center justify-center font-black text-gray-400 uppercase ${className}`}
    >
      <span style={{ fontSize: Math.max(9, Math.round(size * 0.36)) }}>{fallbackText}</span>
    </div>
  )
}
