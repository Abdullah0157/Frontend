# JobStream English Test: Design v1

Status: APPROVED (10 Oct 2026). Owner rule: free options only, nothing paid.
Builds on:
- `frameworks/assessment-coverage-design.md` (families, the job link and the General test).
- `frameworks/swe-assessment-design.md` (engine, report, integrity, fairness).

Research behind it: comparison of Versant, Emmersion, EF SET, Linguaskill, Pipplet, iMocha,
Mettl, TOEIC and SHL SVAR (10 Oct 2026).

---

## 1. What it is for

Companies, especially call centres and BPOs, need to know whether a candidate's English is good
enough for the job. This test answers that on the **CEFR** scale, the international English
scale from A1 (beginner) to C2 (near native). It does so:

- in minutes, on any computer with a microphone;
- at almost no cost per candidate;
- fairly for every accent;
- with the result going straight into the JobStream company report, including recordings
  the hiring manager can listen to.

It works on its own, or as an extra block added to another test (for example the Customer
service test).

---

## 2. Principles

1. **Judge whether the person is easy to understand, never their accent.** The CEFR's own
   2020 update scores pronunciation by intelligibility and dropped the native-speaker model.
   Even top-level speakers keep their accent.
2. **Test the English the job uses:** customer calls, emails, notices and instructions. No
   literature, idioms or culture quizzes.
3. **Machines can be biased by accent.** Research shows speech recognition makes more mistakes
   with some accents, so a recogniser error is never treated as a candidate error (section 7).
4. **Never auto-reject.** The company decides, and candidates who cannot use a microphone (for
   example because of a hearing or speech condition) get a written-only version.
5. **Honest scores.** Until the calibration study (section 8) is done, results are labelled
   "provisional CEFR estimate".

---

## 3. Two formats

| Format | For | Length | Skills |
|---|---|---|---|
| **English Screener** | Voice agents, receptionists, any role that talks to customers | about 18 minutes | Listening, speaking, plus a short reading block |
| **English Full** | Chat and email agents, office roles, international accounts | about 45 minutes | Reading, listening, writing, speaking |

The company picks the format and the **required level** for the job. Defaults:

| Role | Required level |
|---|---|
| Voice agents | B2 |
| Chat, email and back office | B1 |
| Other roles | Company chooses |

---

## 4. The English Screener (about 18 minutes)

| Section | Task | Items | Minutes | What it measures |
|---|---|---|---|---|
| A. Sound check | Say one sentence; the system checks the microphone and background noise | 1 | 1 | Nothing scored. Fixes problems before the test |
| B. Listening | Hear a short customer call or voicemail, answer 1 or 2 questions (each clip plays at most twice) | 6 clips | 5 | Understanding |
| C. Read aloud | Read a short customer-service text aloud | 2 | 2 | Clarity, pace, flow |
| D. Repeat | Hear a sentence, repeat it | 4 | 2 | Listening and speaking together (used by Versant and Emmersion) |
| E. Short answers | Answer simple work questions in a few words | 3 | 2 | Understanding and quick response |
| F. Customer role-play | Hear an upset customer, reply out loud for up to 60 seconds | 1 | 3 | Real job English: politeness, clarity, solving the problem |
| G. Reading | Short notices and messages, multiple choice | 6 | 3 | Reading at work |

## 5. The English Full (about 45 minutes)

| Section | Task | Minutes |
|---|---|---|
| Reading | Emails, notices and policies: multiple choice and fill the gap | 12 |
| Listening | Customer calls and team messages in several accents | 12 |
| Writing | Reply to a customer email (50 to 120 words), plus a short summary | 10 |
| Speaking | Read aloud, short answers, describe a work situation, and the customer role-play | 11 |

The **typing test** can be added for chat and email roles.

---

## 6. How it is scored

**Reading and listening** are marked automatically against the answer key.

**Speaking.** The recording is turned into text by speech-to-text (Whisper). Each task is then
marked on 5 criteria, the same family used by TOEIC and Versant:

| Criterion | Low | High |
|---|---|---|
| Easy to understand | The listener has to guess often | Understood the first time; accent present but no barrier |
| Fluency | Long pauses, many restarts | Steady pace, natural pauses |
| Grammar | Errors block the meaning | Mostly accurate; small slips do not matter |
| Vocabulary | Too few words for the task | Right words for the situation |
| Task completion | Does not do what was asked | Answers fully and politely |

- **Fluency** also uses timing measures from the recording (speaking speed, pause length), which
  do not depend on accent.
- **Short tasks** are scored 0 to 3 and **long tasks** 0 to 5, as TOEIC does.

**Writing** is marked by the same two-marker method as our other writing tasks, with the
fairness rule for non-native writers.

**Results:**
- a **CEFR level for each skill** and an **overall level**;
- a 0 to 100 score;
- **"Meets the required level: yes / no / borderline"** for the job.

---

## 7. Fairness to every accent

1. **No accent score.** "Sounds native" is never a criterion, in any prompt or rubric.
2. **The recogniser is not the judge.** If Whisper is unsure what was said, that recording goes
   to a person instead of counting against the candidate. Raw recognition error is never used as
   a pronunciation score.
3. **Listening in many accents.** Clips use voices from several English-speaking regions (for
   example Indian, Nigerian, Filipino, South African, British, American and Australian, as
   available in our voice service), not only British and American.
4. **Measure the bias.** Before launch, Whisper's error rate is measured separately for
   Pakistani, Indian, Filipino, Nigerian and UK regional speakers. Results are monitored by
   first-language group, comparing scores of people at the same level.
5. **Fair conditions.** A sound check before starting, and one re-record when audio fails.

---

## 8. Making the CEFR levels trustworthy (calibration, free)

1. **Reading and listening anchor:** pilot candidates also take **EF SET** (free, CEFR-scored
   reading and listening) and share their result. Our reading and listening bands are then set so
   that "our B2" lines up with "EF SET B2".
2. **Speaking anchor:** people with good English (volunteers, or the first pilot company's
   trainers) mark about 100 recordings using the free official CEFR speaking descriptors (Council
   of Europe). The AI marking is checked against them, and the speaking bands are adjusted.
3. **Before calibration:** reports say "provisional CEFR estimate". **After:** "CEFR-aligned,
   calibrated against EF SET and human markers".
4. A paid anchor (such as Versant) is not used: the owner rule is free options only.

---

## 9. Cheating and integrity

- Every candidate gets different clips and questions from the bank.
- Prompts are only shown when the timer starts, and there is a short time to begin speaking.
- The usual integrity notes: leaving the page, pasting.
- **Voice check:** if the read-aloud and the role-play sound like different people, the report
  notes it for review.
- **The voice interview** (Iris) can ask a follow-up in English, a natural cross-check.

---

## 10. The company report

- CEFR level per skill, the overall level, and "meets the required level".
- **Listen buttons:** the hiring manager can play the candidate's role-play and read-aloud
  recordings. This is something most competitors do not show.
- The transcript of each spoken answer, with the marker's notes.
- Fairness note: "accent is not scored".

---

## 11. Privacy

- The candidate agrees to being recorded before starting.
- Recordings are kept for 90 days for the company to review, then deleted automatically.
- Recordings are never used for training without separate consent.

---

## 12. What to build

1. **New question types:** listening (audio plus question, play limit) and speaking (record,
   time limit, re-record once).
2. **Browser recording:** sound check, microphone permission, upload.
3. **Speaking marking:** Whisper plus timing measures, the 5-criterion rubric with two markers,
   and a low-confidence route to a person.
4. **Listening clips:** generated with AI voices in several accents (v1); real human recordings
   later.
5. **Question bank (Screener):**
   - 40 listening clips with questions;
   - 20 read-aloud texts;
   - 60 repeat sentences;
   - 40 short questions;
   - 20 role-plays;
   - 80 reading items.

   The Full test adds writing tasks (some reused) and more reading and listening.
6. **Report:** CEFR results, listen buttons, transcripts.
7. **Job link:** English as its own test, or as an add-on block on another test, with the
   required level.

---

## 13. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| 1 | Build the **Screener** first, the Full test after | Yes |
| 2 | Listening clips made with AI voices in several accents for v1, human recordings later | Yes |
| 3 | Keep recordings 90 days for company review, then delete | Yes |
| 4 | Default required levels: voice B2, chat/email B1 | Yes (company can change) |
| 5 | Calibrate for free (EF SET for reading and listening, human markers for speaking) before calling levels "calibrated" | Yes, when the first pilot company is ready (changed 10 Oct: no paid Versant study) |
| 6 | Speech-to-text: Groq Whisper free tier now (already used by JobStream), free local Whisper when the free tier is not enough | Yes |
