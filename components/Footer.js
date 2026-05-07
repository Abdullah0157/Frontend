import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-transparent pt-24 pb-16 border-t border-slate-100 relative z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-10">
          {/* Brand / Socials */}
          <div className="flex flex-col items-center md:items-start gap-6">
            <span className="text-xl font-black tracking-tighter text-slate-900 uppercase">JobStream</span>
            <div className="flex space-x-6">
              <a href="https://www.linkedin.com/company/jobstream-opportunity" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
              </a>
            </div>
          </div>

          {/* Essential Links */}
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4">
            <Link href="/jobs" className="text-xs font-black text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em]">Find Remote Jobs</Link>
            <Link href="/blog" className="text-xs font-black text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em]">Blog</Link>
            <a 
              href="https://www.linkedin.com/company/jobstream-opportunity" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs font-black text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em]"
            >
              Contact Us
            </a>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-50 text-center">
          <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">
            © 2026 JOBSTREAM. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  )
}

