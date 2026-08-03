type IconName =
  | 'check'
  | 'cloud'
  | 'edit'
  | 'folder'
  | 'folder-open'
  | 'graph'
  | 'move'
  | 'note'
  | 'preview'
  | 'refresh'
  | 'rename'
  | 'search'
  | 'settings'
  | 'trash'
  | 'x'

interface IconProps {
  name: IconName
  size?: number
}

const paths: Record<IconName, React.ReactNode> = {
  check: <path d="m5 12 4 4L19 6" />,
  cloud: <path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 8.35 4.5 4.5 0 0 0 7 18Z" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  folder: <path d="M3 6.5h6l2 2h10v10.5H3Z" />,
  'folder-open': <path d="M3 7h6l2 2h10l-2 10H4Z" />,
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
  note: (
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v5h4M9 12h6M9 16h6" />
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
