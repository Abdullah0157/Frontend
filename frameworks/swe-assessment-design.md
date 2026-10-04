# Software Engineering Written Assessment: Design v1

Status: DRAFT, waiting for owner approval (4 Oct 2026).
Family: Software Engineering (family 1 of 22). One design, six tracks, four levels.
Builds on: `CLAUDE.md` Part 11 (Assessment Intelligence Layer), `frameworks/skills-taxonomy.yaml`,
`frameworks/swe-backend-v1.yaml`, `lib/assessment.js`, `lib/coding-problems.js`.

---

## 1. What this assessment is for

A company posts a software job. Before anyone spends time on interviews, every applicant takes
this written assessment. The company gets a report per candidate that answers one question:
**can this person do this job, at this level, and how sure are we?**

The report also hands the voice interviewer (Iris) the questions to ask next: the weak spots
to probe, and the answers to verify.

---

## 2. Principles (recruiting experience plus the research)

1. **Test the job, not trivia.** Every question must be something the person meets in the real
   job. This is also the legal test for a hiring assessment (job-relatedness).
2. **The work sample is the heart.** Doing a real task (.33) and job knowledge (.40) are the
   strongest written predictors (Sackett et al., 2022). The voice interview adds the structured
   interview (.42). Together they combine the three best methods we know.
3. **Seniors get shorter tests, not longer.** Strong senior engineers have options and walk
   away from long tests. Senior depth (design, trade-offs) moves into the voice interview.
4. **Never auto-reject.** The report recommends and a human decides. AI hiring tools are
   treated as high-risk in the EU, audited in New York (LL144), and covered by the UK Equality Act.
5. **Every score shows how sure it is.** "Not enough evidence" is an allowed answer.
6. **Built to resist ChatGPT.** Answers are verified live in the voice interview (section 10).
7. **Fair to non-native speakers.** Questions use plain English. We test engineering, not English.

---

## 3. Tracks and levels

### Tracks

| Track | Typical job titles | What is tested on top of the shared core |
|---|---|---|
| Backend | Backend developer, API engineer, Node/Python/Java dev | APIs, databases and SQL, data consistency, caching, queues, security basics |
| Frontend | React/Vue/Angular developer, UI engineer | Components and state, rendering, browser and network, accessibility, CSS layout |
| Full stack | Full stack developer, MERN/Next.js developer | Half backend, half frontend, plus how the two talk (auth, API design) |
| Mobile | iOS, Android, Flutter, React Native developer | App lifecycle, state, offline and sync, performance, store release basics |
| QA / Test automation | QA engineer, SDET, test automation engineer | Test design from a spec, finding bugs, automation code, test strategy |
| DevOps / Cloud | DevOps, SRE, cloud engineer | Linux, containers, CI/CD, cloud basics, monitoring, reading logs and incidents |

Shared core for every track: programming fundamentals, data structures, debugging, Git,
testing basics, security basics, and engineering judgement.

### Levels

| Level | Guide | What changes |
|---|---|---|
| Junior (L2) | 0 to 2 years | Fundamentals and how fast they can learn. Short reasoning section. |
| Mid (L3) | 2 to 5 years | Can deliver a realistic task alone. Reviews code. |
| Senior (L4) | 5+ years | Debugs and extends existing code, reviews pull requests, makes trade-offs, writes a short design. |
| Lead (L5) | Team lead, staff | Reviews a junior's code and writes the feedback, plans technical work, handles people and delivery scenarios. |

Years are a guide only. The company picks the level from the job, not from the candidate's CV.

---

## 4. The five sections

### A. Core knowledge (auto-scored)
- **Measures:** do they know the things the job needs every day.
- **Question types:** single answer, multiple answer, "what does this code print", "which line has the bug".
- **Scoring:** automatic. Multiple-answer questions give partial credit.
- **Skills:** `engineering.programming.*`, `engineering.system_design.*`, `engineering.craft.*`, plus the new track skills (section 12).

### B. Coding task (work sample)
- **Measures:** can they actually build working code.
- **Junior:** two small functions (easy, then medium).
- **Mid:** one realistic task, for example an API handler, a component, or a data transform with edge cases.
- **Senior:** fix a bug in existing code, then extend it.
- **Lead:** replaced by a code review of a junior's pull request, with written feedback (the real work of a lead).
- **Scoring:** 70% hidden test cases (including edge cases they are not shown) and 30% AI quality review against a rubric (readability, naming, edge handling, structure).
- **Languages v1:** JavaScript/TypeScript and Python. The candidate chooses from the languages the job allows.

### C. Code review and debugging (written)
- **Measures:** can they read someone else's code and spot what matters.
- **Format:** a short code snippet or log. "List the problems, most serious first, and how you would fix each."
- **Scoring:** AI marks against a 1 to 5 anchored rubric, quoting the evidence. Two independent AI markers (the existing ensemble) and a human review when they disagree.

### D. Engineering judgement
- **Measures:** what they do in real situations: production incidents, pressure to ship, unclear requirements, trade-offs.
- **Format:** scenario questions with 4 options. Each option has an expert score from 0 to 3, because real situations have better and worse answers, not just one right one.
- **Senior and Lead** also write one short answer: a design ("design a rate limiter for our API") or a plan ("plan moving this service to a new database with no downtime").

### E. Reasoning (Junior only)
- **Measures:** logical and numerical problem solving. This matters most when experience is thin.
- **Format:** 10 short items in 10 minutes.
- **Kept short and watched by the fairness engine**, because reasoning tests can disadvantage some groups. A company can switch it off.

---

## 5. Blueprint per level

Each cell shows items shown, then minutes, then weight in the final score.

| Section | Junior | Mid | Senior | Lead |
|---|---|---|---|---|
| A. Core knowledge | 15 · 12 min · 25% | 20 · 15 min · 25% | 12 · 10 min · 15% | 8 · 6 min · 10% |
| B. Coding task | 2 tasks · 25 min · 40% | 1 task · 25 min · 40% | 1 task · 20 min · 30% | Code review with feedback · 15 min · 25% |
| C. Review and debugging | 1 · 6 min · 10% | 1 · 8 min · 15% | 1 · 10 min · 20% | 1 incident from logs · 10 min · 20% |
| D. Judgement | 5 · 6 min · 10% | 6 · 7 min · 20% | 4 + 1 written design · 15 min · 35% | 6 + 1 written plan · 15 min · 45% |
| E. Reasoning | 10 · 10 min · 15% | off | off | off |
| **Total time** | **about 60 min** | **about 55 min** | **about 55 min** | **about 46 min** |

---

## 6. Example questions (Backend, Mid)

These show the quality bar. Every bank item must be at least this good.

**A. Core knowledge, single answer** (`engineering.system_design.consistency`)
> A mobile app retries a request when the network is slow, and some customers now get two
> orders. Which change fixes this most reliably?
> a) Send a unique request key with each order, and return the existing order if that key was seen before ✔
> b) Increase the app's timeout
> c) Wait one second before saving the order
> d) Wrap the save in try/catch

**A. Core knowledge, code output** (`engineering.programming.javascript`)
> What does this print?
> ```js
> const ids = [1, 2, 3]; let total = 0;
> ids.forEach(async (id) => { total += await price(id) });
> console.log(total);
> ```
> Answer: `0`, because `forEach` does not wait for async callbacks. The distractors are the sum,
> `undefined`, and an error.

**B. Coding task** (`engineering.craft.correctness`, `engineering.system_design.trade_offs`)
> Write `allow(userId, nowMs)` that returns true if this user has made fewer than 5 requests
> in the last 60 seconds, then records the request.
> Hidden tests: exactly 5 requests, a request at exactly 60.000 s, two users who must not
> affect each other, and 10,000 users (memory must not grow forever).

**C. Code review** (`engineering.debugging.hypothesis`, security basics)
> A snippet builds SQL with string concatenation from a query parameter, runs one query per
> item inside a loop, and forgets an `await`.
> Full marks: finds the SQL injection first (most serious), then the missing await (a silent
> wrong result), then the query in a loop (slow). Gives a correct fix for each.

**D. Judgement** (`engineering.operations.incident_response`, `behavioral.ownership.accountability`)
> It is Friday at 5 pm. You find that code released today sometimes charges customers twice.
> Your lead is offline. What do you do first?
> a) Switch off the feature or roll back, post in the team channel what you saw, and note which customers were affected **(3 points)**
> b) Write a quick fix and push it straight to production yourself **(1 point)**
> c) Email customer support about it and log off **(1 point)**
> d) Wait and tell your lead on Monday **(0 points)**

### Examples from the other tracks

- **Frontend:** a list where deleting one item removes the wrong row (index used as key) and a
  counter shows stale values. Fix both and explain why they happened.
- **Mobile:** the app loses the form a user was typing when they rotate the phone or switch apps. Find and fix it.
- **QA:** a one-page spec for a signup form. Write the test cases, then find 5 planted bugs in a demo page.
- **DevOps:** a Dockerfile that builds a 2 GB image running as root, plus a failing deploy log.
  Fix the file and say why the deploy fails.

---

## 7. Scoring and the report

### How scores are combined
1. Each section gets a score from 0 to 100.
2. Section scores are combined with the level's weights into an overall score.
3. Every question is linked to a skill code, so the candidate also gets a **skill map** (strong / ok / weak per skill) that updates their skill graph.

### Bands

| Overall score | Band |
|---|---|
| 80 and above | Strong |
| 65 to 79 | Good |
| 50 to 64 | Borderline |
| Below 50 | Not yet |

Bands are labelled **uncalibrated** until pilot data exists (section 9). Companies can set their own pass mark.

### The company report (the pitch piece)
1. The band, the overall score, and how confident we are.
2. Section scores and the skill map.
3. Their code, with which tests passed and failed.
4. Evidence quotes from their written answers.
5. **Resume versus reality:** what the CV claims against what was tested.
   For example: "CV says 4 years of React. React skills tested at Junior level."
6. Integrity notes, marked "for review" and never an automatic fail.
7. Three to five follow-up questions for the voice interview, aimed at the weak spots and at
   verifying the answers.
8. A clear line: "This is a recommendation. Your team makes the decision."

---

## 8. How a job is linked to an assessment

1. **The company creates a job.** The AI reads the job description and suggests the track,
   level and languages ("Backend, Mid, Python"). The company confirms or edits.
2. **The assessment is attached automatically.** The company can switch the reasoning section
   off and, in a later version, add a few of its own questions.
3. **A candidate applies.** They get the link, take the test, and the report is attached to
   their application.
4. **Candidates above the company's pass mark are invited to the voice interview.** Iris
   starts with the report's follow-up questions.

---

## 9. Question bank: size and quality

### Size
Every candidate should see a different set of questions, so each bank holds at least 5 times
what one test shows.

| Per track and level | Bank size |
|---|---|
| Core knowledge | about 100 questions (shared fundamentals are reused across tracks) |
| Coding tasks | 10 to 15 |
| Review snippets | about 10 |
| Judgement scenarios | about 40 |

### How a question goes live
1. The AI drafts it.
2. It is checked against the checklist below.
3. It is shown to a pilot group.
4. Its statistics are checked.
5. It goes live.
6. It is retired if it leaks online or is shown too often.

### Checklist for every question
- One clearly best answer, and wrong options that sound reasonable.
- No trick wording, no outdated technology, no local or cultural knowledge needed.
- Plain English.
- Linked to one main skill code and one level.

### Calibration
- **First:** simple statistics. Between 30% and 85% of people should get it right, and strong
  candidates must do better on it than weak ones (discrimination above .20).
- **Later:** once a question has about 200 answers, its IRT parameters are fitted, as the
  platform plan in `CLAUDE.md` Part 11 already describes.

---

## 10. Anti-cheating

1. **Different questions per candidate:** a random draw from the bank, shuffled options, a timer per section.
2. **Signals logged as events:** large pastes in the code editor, leaving the tab, typing
   rhythm, and answers finished impossibly fast.
3. **Voice verification:** Iris asks about the candidate's own answers ("talk me through your
   rate limiter"). If they can't explain what they wrote, that is flagged.
4. **No webcam in v1.** It raises privacy issues, has high false positives, and makes candidates drop out. It could become a company option later.
5. **Flags are always "for review".** We claim only what we can measure.

---

## 11. Candidate experience and fairness

### Candidate experience
- **Before the test:** total time, the sections, the languages allowed, and one practice question.
- **Devices:** the knowledge part works on a phone; the coding part needs a desktop.
- **Extra time on request** (accessibility and reasonable adjustments).
- **Short feedback after the test** (strengths and areas to improve). This is good for the company's brand.

### Fairness and legal
- This file plus the job link document why each question is job-related.
- The existing fairness engine (`lib/fairness.js`) runs adverse-impact checks (the four-fifths rule) on cohorts when a company supplies the data.
- A human makes the final decision, and candidates can ask for a review.
- Answers are kept for a set period and deleted on request (UK and EU GDPR).

---

## 12. What exists and what to build

### Already in the codebase
- **Database tables:** `items`, `item_responses`, `assessment_sessions`, `assessment_events`.
- **Assessment engine:** an AI rubric marker for written and code answers (`lib/assessment-scoring.js`) and skill graph updates.
- **Coding:** a runner with hand-written tests (`lib/coding-problems.js`, JavaScript, four difficulty tiers).
- **Frameworks:** a skills list with backend skills, and the Backend L4 interview framework.
- **Engines:** fairness, calibration and decision engines.
- **Questions:** 12 seed Backend items.

### To build
1. **Blueprint config:** sections, weights and timers per track and level. This replaces today's "6 random items".
2. **New question types:** multiple answer, code output, scenario with expert scores, code review, and coding with hidden tests in JavaScript/TypeScript and Python.
3. **Skills list:** add frontend, mobile, testing and devops skills.
4. **Job link:** connect jobs to assessments, with the AI suggesting track and level.
5. **Report v2:** resume versus reality, plus follow-up questions for Iris.
6. **Integrity events:** paste and tab-switch.
7. **Question banks:** start with Backend, Frontend and Full stack, at Junior, Mid and Senior.

---

## 13. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| 1 | Coding languages in v1 | JavaScript/TypeScript and Python. Java, C# and PHP later. |
| 2 | First tracks | Backend, Frontend, Full stack. Then Mobile, QA, DevOps. |
| 3 | First levels | Junior, Mid, Senior. Lead later. |
| 4 | Reasoning section for Junior | Yes, short and monitored, and the company can switch it off. |
| 5 | Webcam proctoring | Off in v1. |
