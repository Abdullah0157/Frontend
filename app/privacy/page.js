export const metadata = { title: 'Privacy' }

// Privacy notice. Written from what the code actually does (11 Oct 2026).
// The bracketed details must be filled in by the owner before launch.
const UPDATED = '11 October 2026'

const sections = [
  {
    title: 'Who we are',
    body: [
      'JobStream is run by [YOUR NAME OR COMPANY NAME], [YOUR ADDRESS]. For anything about your data, email [YOUR CONTACT EMAIL].',
    ],
  },
  {
    title: 'What we collect',
    list: [
      'Account details: your name, email address and account type. Passwords are handled by our sign-in provider and we never see them.',
      'Your profile and resume: the text we read from the PDF you upload.',
      'Test and interview answers: what you write, code or choose, how long each answer took, and interview transcripts.',
      'Voice recordings from the English test, so the company can listen to them.',
      'Test integrity notes: for example leaving full screen or the page, or trying to paste text. We note these; we do not record your screen or camera during written tests.',
      'For companies: company details and the jobs you post.',
    ],
  },
  {
    title: 'Why we use it',
    list: [
      'To run the tests and interviews and to mark them.',
      'To give the company you applied to a report on your application.',
      'To keep tests fair and accounts secure.',
      'To improve the questions, using results combined across many people.',
    ],
  },
  {
    title: 'Who can see it',
    body: [
      'When you apply for a job, the company that posted it sees your report, answers, recordings and integrity notes for that job. We do not sell your data or use it for advertising.',
      'Service providers process data for us under contract: our sign-in and database provider (Supabase), our hosting provider, and AI services that mark answers and turn speech into text (Google Gemini and Groq, or models on our own server). They may not use it for anything else.',
    ],
  },
  {
    title: 'How long we keep it',
    list: [
      'Voice recordings are deleted automatically after 90 days.',
      'Other application data is kept while your account is open and for [RETENTION PERIOD] after, so companies can complete their hiring.',
      'You can ask us to delete your account and data at any time.',
    ],
  },
  {
    title: 'Scores and decisions',
    body: [
      'Scores help companies decide; they never decide on their own. JobStream does not reject anyone automatically, and the hiring decision is always made by a person. If you think a score is wrong, email us and we will ask for a human review.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'You can ask to see the data we hold about you, correct it, delete it, or object to how we use it. Email [YOUR CONTACT EMAIL]. If you are not happy with our answer you can complain to your data protection authority (in the UK, the Information Commissioner’s Office).',
    ],
  },
  {
    title: 'Cookies',
    body: [
      'We use only the cookies needed to keep you signed in and to run the site. We do not use advertising or tracking cookies.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="bg-white pt-16 text-ink">
      <article className="mx-auto max-w-[760px] px-6 py-16 md:py-20">
        <h1 className="text-[34px] font-bold tracking-[-0.02em] md:text-[40px]">Privacy</h1>
        <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>
        <p className="mt-8 text-lg text-body">
          This notice explains, in plain English, what JobStream collects when you use it, why, and what you can ask us to do with it.
        </p>
        {sections.map((s) => (
          <section key={s.title} className="mt-10">
            <h2 className="mb-3 text-xl font-semibold">{s.title}</h2>
            {s.body?.map((p) => <p key={p} className="mb-3 text-body">{p}</p>)}
            {s.list && (
              <ul className="list-disc space-y-2 pl-5 text-body">
                {s.list.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}
      </article>
    </div>
  )
}
