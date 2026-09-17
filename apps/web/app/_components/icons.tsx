const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export const MicIcon = () => (
  <svg {...base}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
  </svg>
)

export const SpeakerIcon = () => (
  <svg {...base}>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </svg>
)

export const DownloadIcon = () => (
  <svg {...base}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
)

export const StopIcon = () => (
  <svg {...base}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
)
