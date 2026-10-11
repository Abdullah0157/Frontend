# Question banks

Each JSON file in `frameworks/banks/<family>/<track>-<level>/` is an array of items.
`scripts/validate-assessment-bank.mjs` checks every file mechanically. That includes running
every coding task's reference and wrong solutions in the real sandbox, and running every
code-output snippet to confirm the keyed answer. `scripts/seed-assessment-bank.mjs` loads
validated items into the `items` table (upsert by `bank_key`).

Design: `frameworks/swe-assessment-design.md`.

## Fields shared by every item

| Field | Rule |
|---|---|
| `bank_key` | Unique stable id, lowercase, dots and dashes: `swe.backend.k.idempotent-retry`. Never reuse or rename. |
| `type` | `mcq` (one answer), `multi_select` (several answers), `sjt` (scenario, options scored 0 to 3), `coding`, `code_review`. |
| `section` | `knowledge` (mcq, multi_select), `coding` (coding), `review` (code_review), `judgement` (sjt). |
| `format` | Knowledge only: `concept`, `code_output` ("what does this print") or `find_bug` ("which line is wrong"). |
| `tracks` | Array: `backend`, `frontend`, `fullstack`, `mobile`, `qa`, `devops`. Backend items are usually `["backend","fullstack"]`. |
| `levels` | Array of `L2` (Junior), `L3` (Mid), `L4` (Senior), `L5` (Lead). |
| `language` | `null` when language-neutral. `"javascript"` or `"python"` when the item shows code that only makes sense in that language (every `code_output` item). A candidate only sees items in the language they chose, or neutral ones. |
| `difficulty` | `easy`, `medium`, `hard` (prior guess, replaced by real statistics later). |
| `primary_skill_code` | One code from the list below. |
| `secondary_skill_codes` | Zero to two codes from the list below. |
| `prompt` | What the candidate reads. Markdown, code in fenced blocks. Plain English (candidates may be non-native speakers). |
| `explanation` | For reviewers only, never shown: why the key is right and every other option is wrong. |
| `languages` | Coding and code-review items only. The languages the item is written in: `["javascript"]`, `["python"]` or both (the default when omitted). Frontend items are JavaScript only (candidates may also answer in TypeScript). A candidate only gets items in their chosen language. |
| `group` | Optional lowercase slug. Items that are near-duplicates share a group, and a candidate never sees two items from the same group. |
| `expected_time_s` | Realistic seconds: knowledge 40 to 75, judgement 50 to 80, review 420 to 540, coding 1200 to 1500. |

## Per type

**mcq**:
- `choices`: 4 strings, all plausible, similar length.
- `answer`: `{ "correct": <index> }`.
- No "all of the above" or "none of the above", because options are shuffled per candidate.

**multi_select**:
- `choices`: 4 to 6 strings.
- `answer`: `{ "correct": [<indexes>] }`, with 2 to 3 correct.
- The prompt must say "Select all that apply."
- Scoring gives partial credit: (right picks minus wrong picks) divided by the number of correct options, floored at 0.

**sjt**:
- `choices`: 4 realistic actions. None of them is a cartoonishly bad option.
- `answer`: `{ "points": [p0, p1, p2, p3] }`, each 0 to 3.
- Exactly one option scores 3, and at least one scores 0 or 1.
- The prompt asks what the candidate would do (first / most likely).

**coding**:
```json
"coding": {
  "function_name": { "javascript": "groupByCustomer", "python": "group_by_customer" },
  "starter": { "javascript": "function groupByCustomer(orders) {\n  // your code\n}\n",
               "python": "def group_by_customer(orders):\n    # your code\n    pass\n" },
  "compare": "exact",
  "visible_tests": [ { "name": "two customers", "calls": [ { "args": [[...]], "expected": {...} } ] } ],
  "hidden_tests":  [ { "name": "empty list", "calls": [ { "args": [[]], "expected": {} } ] } ],
  "reference": { "javascript": "...full solution...", "python": "...full solution..." },
  "wrong": [ { "why": "forgets refunds", "javascript": "...", "python": "..." } ],
  "quality_focus": ["readability", "edge cases", "efficiency"]
}
```
- **Tests:** each test is a fresh program, and `calls` run in order on that same program, so stateful tasks such as a rate limiter work.
  - Args and expected values are JSON only (numbers, strings, booleans, null, arrays, objects with string keys).
  - Python receives the same JSON (dict, list, None).
- **`compare`:** `exact`, `unordered` (top-level array order ignored) or `float` (numbers within 1e-6).
- **Size:** 2 to 3 visible tests and 8 to 15 hidden tests. Hidden tests must include edge cases (empty input, boundaries, duplicates, large input that rules out quadratic solutions when that matters).
- **Solutions:** the reference must pass every test in both languages, and each `wrong` solution must fail at least one hidden test. The validator enforces both.
- **Prompt:** states the input, the output and every rule needed to pass the hidden tests. No hidden surprise rules.

**code_review**:
```json
"review": {
  "code": { "javascript": "...", "python": "..." },
  "issues": [ { "id": "sql_injection", "severity": "critical", "points": 3,
                "description": "query built by string concatenation from req.query.name" } ],
  "ideal_answer": "what a strong Mid engineer writes, most serious first"
}
```
- **The prompt asks:** "List the problems, most serious first, and how you would fix each."
- **Issues:** 3 to 5 real issues of mixed severity (`critical`, `major`, `minor`), plus no more than one red herring the candidate should not flag.

## Skill codes (use only these)

- **Existing:**
  - `engineering.programming.{javascript,typescript,python,python_async,sql}`
  - `engineering.system_design.{trade_offs,consistency,scaling,caching,queueing,data_modeling}`
  - `engineering.debugging.{hypothesis,tools,distributed}`
  - `engineering.operations.{monitoring,incident_response,reliability}`
  - `engineering.craft.{correctness,readability,testing,refactoring}`
  - `behavioral.communication.{clarity,written,listening}`
  - `behavioral.ownership.{accountability,initiative,failure_reflection}`
  - `behavioral.collaboration.{conflict,cross_functional}`
  - `behavioral.leadership.{mentorship,decision_making,setting_norms}`
  - `behavioral.problem_solving.{decomposition,first_principles,pragmatism}`
- **Added for written assessments (v1):**
  - `engineering.backend.{api_design,http}`
  - `engineering.data.{transactions,indexing}`
  - `engineering.security.{injection,auth,data_protection}`
  - `engineering.concurrency.fundamentals`
  - `engineering.performance.complexity`
  - `engineering.tooling.{git,containers}`
  - `engineering.algorithms.data_structures`
  - `engineering.frontend.{components_state,rendering,browser_network,accessibility,css_layout}`


## Non-software families (General workplace, Customer service)

Design: `frameworks/assessment-coverage-design.md`.

**Tracks and levels:**
- `general` with levels `staff` and `manager`.
- `customer_service` with level `agent`.

An item may carry several tracks when it fits both (for example a numbers item `["general","customer_service"]`).

**Sections and types:**

| Section | Types | Family |
|---|---|---|
| `workplace_judgement` | sjt | general |
| `written_communication` | scenario_response (writing task) | general |
| `numbers` | mcq, multi_select | general |
| `detail` | mcq, multi_select | general |
| `instructions` | mcq, multi_select | general |
| `typing` | typing | customer_service |
| `customer_situations` | sjt | customer_service |
| `written_reply` | scenario_response (writing task) | customer_service |
| `accuracy` | mcq, multi_select | customer_service |

### `format: "numbers"`: every calculation item MUST carry `calc`
`calc` is a plain JavaScript arithmetic expression whose result is the keyed answer, for example `"calc": "Math.round(240 * 0.85 * 100) / 100"`. The validator runs it. The keyed option must contain that number, and no other option may contain it.

### Writing tasks (`scenario_response` with a `writing` block)
```json
"writing": {
  "min_words": 60, "max_words": 180,
  "dimensions": [
    { "name": "Empathy", "weight": 0.25, "low": "ignores how the customer feels", "high": "acknowledges the problem and the feeling in the first lines" },
    { "name": "Solves the problem", "weight": 0.35, "low": "...", "high": "..." },
    { "name": "Follows the stated policy", "weight": 0.2, "low": "...", "high": "..." },
    { "name": "Clear and correct writing", "weight": 0.2, "low": "...", "high": "..." }
  ],
  "ideal_answer": "a model answer at least min_words long",
  "must_include": ["the facts a good answer must state"],
  "must_avoid": ["promises the policy forbids, blaming the customer"]
}
```
- 3 to 5 dimensions, with weights that add up to 1.
- The prompt gives everything the candidate needs: the situation, the customer's message and the policy.

### Typing (`type: "typing"`)
```json
"typing": { "passage": "180 to 280 words of realistic customer-service text", "seconds": 120 }
```
- Plain keyboard characters only: straight quotes, no curly quotes, no special symbols.
- No `choices`, `answer` or `explanation`.

### Additional skill codes
- `workplace.{numeracy,attention_to_detail,reading_comprehension}`
- `behavioral.ethics.{integrity,safety}`
- `behavioral.customer.service_orientation`
- `behavioral.leadership.people_management`
- `customer_service.{empathy,de_escalation,problem_resolution,policy_adherence,privacy_verification,written_tone,typing}`

The existing `behavioral.*` codes also apply.

## Consistency rules for scoring situational judgement (all families)

Similar behaviour must earn the same points in every family and every file.
Reviewers apply these rules; a scenario that needs an exception must state why
in its prompt.

1. **First, low-harm issue with a peer.** A private word scores 3. Going to the supervisor scores 2.
2. **The private word has already failed, or the issue is serious** (customers harmed, harassment, safety, fraud, or theft beyond small items). Using the proper channel scores 3.
3. **A hazard.** Making it safe and reporting it now scores 3. Reporting it later scores 2.
4. **You cannot do everything asked.** Telling whoever sets your priorities, early, scores 3.
5. **Being asked to break a rule.** Declining and pointing to the right route scores 3. Openly asking for an exception scores 2. Breaking the rule openly scores 1. Hiding or falsifying scores 0.
6. **Covering up versus self-sacrifice.** Quietly fixing something to hide a problem scores 1. Sacrificing your own time to help scores 2.

**Company rules.** Where the right answer depends on a company rule (gifts, personal contact details, refunds, exceptions), the prompt states the rule, so the answer never depends on local custom.

## English test (track `english`, level `screener`)

Design: `frameworks/english-assessment-design.md`.

**Every English item carries `cefr`** (A1 to C2): the level it is written for.

**Voices** come from the `VOICES` list in `lib/assessment-bank.js` (Indian, Nigerian, Filipino, Kenyan, South African, Singaporean, British, Irish, American, Australian and Canadian). Spread them across items. There is no Pakistani voice, so Indian is the closest.

### Listening (`type: "listening"`, section `listening`)
```json
"audio": { "lines": [ { "voice": "en-IN-NeerjaNeural", "text": "..." }, { "voice": "en-GB-RyanNeural", "text": "..." } ] },
"choices": ["...", "...", "...", "..."], "answer": { "correct": 1 }, "explanation": "...", "cefr": "B1"
```
- 1 to 6 lines and 25 to 140 words in total.
- The prompt is the question shown on screen. The script is never shown to the candidate.

### Speaking (`type: "speaking"`)
`speaking.mode` must match the section:

| Mode | Section | What is given | Rules |
|---|---|---|---|
| `read_aloud` | `read_aloud` | `text`, shown on screen | 35 to 80 words |
| `repeat` | `repeat` | `audio.lines`, one line: the sentence to repeat | 5 to 18 words; played once |
| `short_answer` | `short_answers` | `audio.lines` (the question) and `acceptable` (answers or key ideas that count as right) | |
| `role_play` | `role_play` | `audio.lines` (the customer speaking), `ideal_answer` and `must_include` | |

All modes also take `prep_seconds` (0 to 30) and `max_seconds` (5 to 90).

**Plain keyboard characters only.** Skill codes: `english.{listening,speaking,reading,pronunciation_fluency,grammar_vocabulary}`.

### Reading (`type: "mcq"`, section `reading`)
Short notices, emails and messages, with 4 choices.
