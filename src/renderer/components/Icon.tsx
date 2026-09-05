type IconName =
  | 'bookmark'
  | 'calendar'
  | 'check'
  | 'cloud'
  | 'command'
  | 'edit'
  | 'folder'
  | 'folder-open'
  | 'folder-plus'
  | 'graph'
  | 'move'
  | 'note'
  | 'note-plus'
  | 'lightbulb'
  | 'preview'
  | 'refresh'
  | 'rename'
  | 'search'
  | 'settings'
  | 'sparkles'
  | 'trash'
  | 'x'

interface IconProps {
  name: IconName
  size?: number
}

const paths: Record<IconName, React.ReactNode> = {
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  cloud: <path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 8.35 4.5 4.5 0 0 0 7 18Z" />,
  command: (
    <>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="7" r="2.5" />
      <circle cx="7" cy="17" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M9.5 7h5M7 9.5v5M17 9.5v5M9.5 17h5" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  folder: <path d="M3 6.5h6l2 2h10v10.5H3Z" />,
  'folder-open': <path d="M3 7h6l2 2h10l-2 10H4Z" />,
  'folder-plus': (
    <>
      <path d="M3 6.5h6l2 2h10v10.5H3Z" />
      <path d="M12 11.5v5M9.5 14h5" />
    </>
  ),
  graph: (
    <>
      <circle cx="6" cy="6" r="2.25" />
      <circle cx="18" cy="7" r="2.25" />
      <circle cx="12" cy="18" r="2.25" />
      <path d="m8 7 7.8-.1M7.3 8l3.4 7.8M16.8 9l-3.5 6.8" />
    </>
  ),
  move: (
    <>
      <path d="M4 12h15" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M8.5 15.5a6 6 0 1 1 7 0c-.8.6-1.2 1.3-1.3 2.2H9.8c-.1-.9-.5-1.6-1.3-2.2Z" />
      <path d="M9.5 21h5M10 18h4" />
    </>
  ),
  note: (
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v5h4M9 12h6M9 16h6" />
    </>
  ),
  'note-plus': (
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v5h4M12 11v6M9 14h6" />
    </>
  ),
  preview: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M7.2 7.2A7 7 0 0 1 19 10M5 14a7 7 0 0 0 11.8 2.8" />
    </>
  ),
  rename: (
    <>
      <path d="M4 6h10M4 18h10M9 6v12" />
      <path d="m16 16 4-4 2 2-4 4-3 1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21H9.6v-.09A1.7 1.7 0 0 0 8.54 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3V9.6h.09A1.7 1.7 0 0 0 4.6 8.54a1.7 1.7 0 0 0-.34-1.88L4.2 6.6 7.03 3.77l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.09A1.7 1.7 0 0 0 15.46 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.18.37.52.73 1 .95.2.09.42.14.65.14H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 2 1.35 4.65L18 8l-4.65 1.35L12 14l-1.35-4.65L6 8l4.65-1.35Z" />
      <path d="m18.5 14 .75 2.25L21.5 17l-2.25.75L18.5 20l-.75-2.25L15.5 17l2.25-.75ZM5 14l.65 1.85L7.5 16.5l-1.85.65L5 19l-.65-1.85-1.85-.65 1.85-.65Z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />
}

export default function Icon({ name, size = 16 }: IconProps): React.JSX.Element {
  return (
    <svg
      className="ui-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}
