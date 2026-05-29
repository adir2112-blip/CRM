export const size = { width: 32, height: 32 }
export const contentType = 'image/svg+xml'

export default function Icon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <rect width="32" height="32" rx="8" fill="#2563eb"/>
      <rect x="6" y="8" width="20" height="3" rx="1.5" fill="white" opacity="0.9"/>
      <rect x="6" y="14" width="14" height="3" rx="1.5" fill="white" opacity="0.9"/>
      <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.9"/>
      <circle cx="25" cy="23" r="5" fill="#10b981"/>
    </svg>
  )
}
