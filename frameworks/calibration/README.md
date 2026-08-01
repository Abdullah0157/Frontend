# Calibration Study Protocol — SWE-Backend v1

The calibration study is how we prove (or disprove) that the framework anchors are concrete enough for humans to score consistently, and that Iris agrees with humans. Until this passes, the framework is a draft.

## Why this exists

If two senior engineers reading the same transcript give scores 3 points apart, our anchors are bad — no amount of Iris tuning fixes that. We fix the anchors first, then measure Iris against calibrated humans.

Without this study, every enterprise buyer will ask *"how do you know your scores are consistent?"* and we will have no answer.

---

## Study design (Round 1)

**Sample:** 20 real interview transcripts from `interview_candidates` table. Selection:
- 6 hires who worked out (>12 months tenure, positive review) — if we have this data
- 6 hires who didn't work out (terminated or resigned <12 months) — if we have this data
- 8 candidates we didn't hire — mix of clear-nos and close-calls
- If outcome data isn't available yet, stratify by original Iris score instead: 5 scored 8+, 5 scored 6-7, 5 scored 4-5, 5 scored below 4

**Reviewers:** 3 senior backend engineers (L5+ equivalent).
- 2 internal, 1 external contractor ideally
- Each reviewer scores ALL 20 transcripts independently
- Blind to Iris's scores until they submit
- Blind to each other's scores

**Deliverable per reviewer per transcript:** one filled-out `scoring-template.md` file.

**File naming:** `results/round-1/session-<id>-reviewer-<name>.md`

---

## What we measure

### 1. Human-human agreement (per competency)
For each competency, compute **Cohen's κ** (or ICC for continuous 1-9) across the 3 reviewer pairs.

- **κ > 0.75** — excellent, anchors are clear
- **κ 0.6–0.75** — acceptable, minor anchor refinement
- **κ 0.4–0.6** — anchors need real work; refine and re-run round
- **κ < 0.4** — competency is broken; redesign or drop

### 2. Iris-human agreement (per competency)
After human scoring is complete, compute Iris vs. average-human κ.

- **Iris-human κ within 0.1 of human-human κ** — Iris is calibrated
- **Iris-human κ meaningfully lower** — Iris scoring prompt needs work
- **Iris consistently biased high or low** — systematic scoring bias; fix in prompt or via calibration offset

### 3. Anchor ambiguity signals
Count how often each anchor was flagged "ambiguous" in the "Anchor felt ambiguous?" question. Any anchor flagged by ≥ 2 reviewers gets rewritten in v1.1.

### 4. Missing / irrelevant competency signals
If ≥ 2 reviewers flag the same "missing competency," we may add it in v2.
If ≥ 2 reviewers flag a framework competency as "irrelevant for this candidate's role" repeatedly, we may split the framework by sub-role (e.g., SWE-Backend-Distributed vs SWE-Backend-CRUD).

---

## Exit criteria — when is Level 0 done?

All must be true before moving to Level 1 (schema migration):

- [ ] All 6 competencies have human-human κ ≥ 0.6 in Round 1 OR ≥ 0.75 after one anchor-refinement round
- [ ] Iris-human κ within 0.15 of human-human κ per competency (after Iris prompt fixes if needed)
- [ ] No competency has ≥ 2 reviewers flagging it as "irrelevant for this role"
- [ ] Study writeup drafted (1 page): what we measured, what we found, what we changed in the framework, what confidence we now have

---

## Timeline expectation

- **Week 1:** Select 20 transcripts, recruit 3 reviewers, distribute framework + template
- **Week 2:** Reviewers score independently (~30-40 min per transcript = ~10-15 hrs per reviewer)
- **Week 3:** Analysis, anchor refinement, Iris prompt calibration, decision on Level 1 go/no-go

Do not skip Round 2 if Round 1 has any κ below 0.6. A framework that fails calibration and gets shipped anyway locks in bad scores forever.

---

## Directory layout

```
frameworks/
├── swe-backend-v1.yaml                    # the framework itself
└── calibration/
    ├── README.md                           # this file
    ├── scoring-template.md                 # what reviewers fill out
    ├── selected-transcripts.md             # (create) list of the 20 chosen sessions
    ├── analysis/
    │   └── round-1-report.md               # (create after study) findings + κ values
    └── results/
        └── round-1/
            ├── session-<id>-reviewer-alex.md
            ├── session-<id>-reviewer-priya.md
            └── session-<id>-reviewer-sam.md
```

---

## Common pitfalls to avoid

1. **Reviewer sees Iris's score first.** Contaminates the study — reviewer anchors on it. The template explicitly puts the Iris comparison section AT THE END.
2. **Reviewers discuss transcripts before scoring.** Kills independence. Reviewers do not talk about any transcript until all scores are submitted.
3. **Using synthetic or Iris-scored transcripts.** Only real interviews. Iris-generated transcripts have systematic patterns that will artificially inflate agreement.
4. **Scoring on the same day as the interview.** Reviewer bias from recency and freshness. Wait at least 48 hours between interview and scoring.
5. **One "expert" is much more senior than others.** Junior reviewers anchor on senior opinions in discussion. Match seniority within 1 band.
6. **Fixing anchors mid-study.** If you notice ambiguity in transcript #3, DO NOT rewrite the anchor and continue. Finish the round with the same framework, then refine.
