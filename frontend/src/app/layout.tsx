import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Barnes AI Candidate Evaluation | Professional Assessment Service',
  description: 'Barnes.nl professional AI-powered candidate evaluation service. Get expert assessments from Finance, HR, and Technical perspectives with our advanced AI technology.',
  keywords: ['Barnes', 'Barnes.nl', 'AI', 'hiring', 'evaluation', 'candidate', 'recruitment', 'professional', 'assessment', 'HR', 'finance', 'technical'],
  authors: [{ name: 'Barnes.nl' }],
  openGraph: {
    title: 'Barnes AI Candidate Evaluation',
    description: 'Professional AI-powered candidate assessment service by Barnes.nl',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Barnes AI Candidate Evaluation',
    description: 'Professional AI-powered candidate assessment service by Barnes.nl',
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-barnes-sans">{children}</body>
    </html>
  )
}