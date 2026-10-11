import './styles/globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ParticleBackground from '@/components/ParticleBackground'
import NavProgress from '@/components/NavProgress'
import Script from 'next/script'

export const metadata = {
  title: { default: 'JobStream: skills tests and AI interviews for hiring', template: '%s | JobStream' },
  description: 'Companies post a job, candidates take a role-matched skills test and a short AI interview, and the company gets a scored report with the evidence.',
  icons: {
    icon: '/jobstream-icon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Inter is self-hosted (see globals.css); preload the main file. */}
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="flex flex-col min-h-screen font-sans antialiased text-slate-900 bg-white relative">
        <NavProgress />
        <ParticleBackground />
        <Header />
        <main className="flex-grow relative z-10">
          {children}
        </main>
        <Footer />
        <Script src="/chatbot.js" strategy="lazyOnload" />
      </body>
    </html>
  )
}
