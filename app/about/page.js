import Link from 'next/link'

export const metadata = { title: 'About' }

// About page (design option A). Replaced copy that claimed "85k+" and "12k+"
// results JobStream does not have: everything here is true today.
const BELIEFS = [
  { title: 'Show, do not tell', text: 'A CV says what someone has done. A short, fair test shows what they can do now. Both matter; we add the second.' },
  { title: 'People decide', text: 'Scores help hiring teams focus. JobStream never rejects anyone on its own, and every number comes with the evidence behind it.' },
  { title: 'Fair to everyone', text: 'Everyone for a job is tested the same way. Accent is never scored, and candidates get one fair attempt per job.' },
]

export default function AboutPage() {
  return (
    <div className="bg-white pt-16 text-ink">
      <section className="mx-auto max-w-[760px] px-6 pb-16 pt-16 md:pt-24">
        <p className="mb-4 text-sm font-semibold text-brand">About JobStream</p>
        <h1 className="mb-6 text-[40px] font-bold leading-[1.06] tracking-[-0.03em] md:text-[52px]">Hiring should rest on evidence.</h1>
        <p className="mb-4 text-lg text-body">
          Most hiring still starts with a pile of CVs and a guess. Good people get missed because their CV is plain, and confident CVs get
          interviews they cannot back up.
        </p>
        <p className="text-lg text-body">
          JobStream gives every applicant the same short skills test for the job and a brief AI interview, then gives the company a report
          that shows what each person can actually do. It saves hiring teams time, and it gives candidates a fair way to be seen.
        </p>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <h2 className="mb-10 text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">What we believe</h2>
          <div className="flex flex-wrap gap-5">
            {BELIEFS.map((b) => (
              <div key={b.title} className="flex-[1_1_300px] rounded-2xl border border-line bg-white p-7">
                <h3 className="mb-2 text-xl font-semibold">{b.title}</h3>
                <p className="text-body">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[760px] px-6 py-20">
        <h2 className="mb-4 text-[28px] font-bold tracking-[-0.02em] md:text-[32px]">Where we are today</h2>
        <p className="mb-8 text-lg text-body">
          JobStream is new. Tests are ready for software developers, customer service agents, English level and general workplace skills,
          with more fields on the way. We are working with our first companies and would like to hear from yours.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup/company" className="inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3.5 font-semibold text-white hover:bg-brand-dark transition-colors">Post a job</Link>
          <a href="https://www.linkedin.com/company/jobstream-opportunity" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl border border-[#CDD2DA] bg-white px-6 py-3.5 font-semibold text-ink hover:bg-surface transition-colors">Contact us</a>
        </div>
      </section>
    </div>
  )
}
