import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CRM — מערכת ניהול פניות',
  description: 'מערכת CRM לניהול פניות לקוחות',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
