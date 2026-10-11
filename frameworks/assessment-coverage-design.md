# Assessment coverage: every job gets a test

Status: APPROVED (5 Oct 2026, all 5 decisions as recommended). Built: family list, General workplace (Staff, Manager), Customer service (Agent).
Covers: (1) how every job post is linked to an assessment, whatever the industry;
(2) the General workplace assessment, the fallback for any job; (3) the Call
centre / customer service assessment, the next industry test.
Builds on: `frameworks/swe-assessment-design.md` (the engine, report, anti-cheating
and fairness rules there apply to every family).

---

## 1. How every job post gets a test

### The family list
JobStream keeps a list of the 22 job families. Each one is marked **ready** or
**coming soon**, and each has its own tracks and levels.

| # | Family | Status |
|---|---|---|
| 1 | Software engineering | Ready: Backend, Frontend, Full stack (Mid) |
| 7 | Customer service and call centre | Next (this document) |
| 6 | Sales and business development | Coming soon |
| 11 | Administration and virtual assistant | Coming soon |
| 2 | Data and AI | Coming soon |
| 9 | Finance and accounting | Coming soon |
| Others (16) | Healthcare, education, HR, marketing, legal, and the rest | Coming soon |

### When a company posts a job
1. **"Suggest from description"** reads the job and picks the family, track and level.
   For example, "Customer Support Agent, night shift, chat and email" becomes
   Customer service, Chat and email, Agent.
2. **If that family's test is ready,** it is attached.
3. **If it is not ready yet,** the General workplace assessment is attached instead,
   with a note: "A Customer service test is coming. The general test is used until then."
   The company can also pick the General test for any job on purpose.
4. **When a family's test becomes ready,** new job posts get it automatically. Jobs that
   already have candidates keep their test, so every candidate on a job is compared fairly.

---

## 2. General workplace assessment (any job)

**Purpose.** It gives every job a fair, job-relevant screen from day one, measuring the
skills almost every job needs. It predicts less than an industry test, and the report
says so. It is the safety net, not the goal.

**Length:** about 30 minutes, short enough for high-volume hiring. It works on a phone.

| Section | What the candidate does | Items | Minutes | Weight |
|---|---|---|---|---|
| A. Workplace judgement | "What would you do?" situations with customers, colleagues, managers, mistakes, deadlines, honesty and safety | 8 | 8 | 30% |
| B. Written communication | Write a short work email for a given situation (AI-marked: clear, polite, complete, correct) | 1 | 8 | 25% |
| C. Numbers at work | Percentages, totals, discounts, reading a small table | 8 | 7 | 20% |
| D. Attention to detail | Spot the mismatch between two records, find the error in a list | 8 | 5 | 15% |
| E. Following instructions | Read a short work policy and answer questions about it | 4 | 4 | 10% |

**Two versions:**
- **Staff** (entry and mid roles).
- **Manager**, with situations about leading people, priorities and difficult conversations.

**Fairness:**
- Plain English at a simple reading level.
- No general-knowledge or culture-specific questions.
- The maths stays at everyday work level.
- Results are monitored for adverse impact, like every test.

**Bank sizes (Staff):** 40 situations, 10 email tasks, 40 numbers, 40 detail, 20
instructions. Manager adds 30 leadership situations and 6 email tasks.

---

## 3. Customer service and call centre assessment

### Tracks and levels

| Track | Typical jobs | v1? |
|---|---|---|
| **Customer service** (inbound calls, chat, email) | Customer service agent, support representative, chat agent | **Yes** |
| Telesales (outbound) | Telesales agent, appointment setter | Later (shares the Sales family) |
| Collections | Collections agent | Later |
| Technical support | Helpdesk agent, IT support level 1 | Later (shares IT support) |

**Levels:**
- **Agent** (v1).
- Senior agent / quality analyst (later).
- Team leader (later; uses the Manager situations).

### Customer service, Agent: the test (about 22 minutes)

| Section | What the candidate does | Items | Minutes | Weight |
|---|---|---|---|---|
| A. Typing | Type a short customer-service passage for 2 minutes | 1 | 3 | 15% |
| B. Customer situations | Upset callers, refunds outside policy, abusive customers, escalation, privacy checks, a customer who asks for a manager | 8 | 8 | 30% |
| C. Written reply | Reply to an upset customer's email or chat (AI-marked: empathy, solves the problem, follows the stated policy, clear, correct) | 1 | 6 | 25% |
| D. Accuracy and numbers | Work out a refund or a bill, read account notes, spot the wrong detail in a customer record | 8 | 5 | 30% |

**The job can change two things:**
- **Typing weight.** For chat and email roles it rises to 25% and section D drops to 20%.
- **The typing pass mark** (see below).

### What is NOT in the written test, and why
- **Spoken English, tone of voice and listening** are judged in the **voice interview**,
  which is the natural partner for a call-centre test. The written test does not use audio
  recordings, because recorded accents can disadvantage candidates unfairly.
- **Company product knowledge** can be added by the company later (private questions).

### New question type: the typing test
- The candidate sees a short passage (about 80 to 120 words of real customer-service text)
  and types it for 2 minutes.
- **Measured:** speed (words per minute), mistakes, net speed (speed after mistakes) and accuracy.
- **Pasting is blocked and recorded.** The time between keystrokes is checked, so
  auto-typing tools show up as an integrity note.
- **Default pass marks** (the company can change them):

| Role | Net speed | Accuracy |
|---|---|---|
| Chat and email agents | 35 words per minute | 95% |
| Voice agents | 25 words per minute | 92% |

- **Scoring:** full marks at or above the pass mark, then a gentle slope below it, so one
  slow minute does not wipe out the candidate.

### Bank sizes (Agent)
10 typing passages, 40 customer situations, 10 written reply tasks, 40 accuracy and
numbers questions.

---

## 4. Order of work

1. **Family list plus the General assessment.** Every job post gets a test immediately.
2. **Customer service, Agent level,** including the typing test.
3. **Sales,** then **Admin / virtual assistant,** then **Data analyst** (needs an SQL sandbox),
   then **Finance** (needs a table task).
4. **More levels** (Junior, Senior, Lead, Team leader) for the families that are ready.
5. **The other 16 families,** in the order companies ask for them.

---

## 5. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| 1 | Build the General workplace assessment as the fallback for any job | Yes |
| 2 | Call centre v1 is Customer service, Agent level (telesales and collections later) | Yes |
| 3 | Default typing pass marks | Chat/email 35 words a minute at 95%; voice 25 at 92% (company can change) |
| 4 | Spoken English and listening judged in the voice interview, not with audio in the written test | Yes |
| 5 | Test language | English only for now; other languages (for example Urdu or Arabic) later |
