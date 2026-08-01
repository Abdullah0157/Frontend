# Domain Expert Interviewer Engine (DEIE) — Design Specification

> **Status:** Foundational design (v1). Companion to `EVALUATION_ENGINE.md`. The interviewer (Maya) and the evaluator (EIE) are **one system with a shared belief state**, not two systems that hand a transcript across a wall.
>
> **Thesis:** The interviewer's job is not to ask questions. It is to **collect the evidence that most reduces uncertainty in the hiring decision** — an adaptive scientific investigation that stops when the decision is robust, not after N questions.

---

## 0. First principles

1. **The interview is Bayesian experiment design.** Every question is an *experiment* chosen to maximize expected reduction in decision-relevant uncertainty. A question that can't change the decision is not worth asking.
2. **The belief state IS the rubric.** There is no separate "interview state." The interviewer reads and writes the exact same competency posteriors (θ, SE, coverage) the evaluator produces. The evaluator's "Unknown / low-confidence competency" is literally the interviewer's next objective.
3. **Stop on decision-stability, not question count.** Continue only while the remaining uncertainty could still flip the hiring band. Stop when it can't.
4. **Evidence before belief.** No competency is scored without a cited behavioral episode. The interviewer's success metric is *coverage × reliability*, which is also its report card.
5. **Presenter ≠ Planner.** A fast, warm voice (Maya the character) delivers turns. A separate reasoning brain decides *what to investigate*. The character never decides strategy; the strategist never speaks.

---

## 1. The six internal systems

```
                ┌────────────────────────────────────────────────────────┐
                │              DOMAIN EXPERT INTERVIEWER                    │
                │                                                            │
  JD + Resume ──►  (1) Domain Knowledge Engine  ─┐                          │
                │   role model, seniority bar,     │                        │
                │   what "excellent" looks like    │                        │
                │                                  ▼                        │
                │  (2) Interview Strategy Planner ── builds objective set   │
                │      (competencies × importance × required confidence)    │
                │                                  │                        │
                │        ┌─────────────────────────┴──────────────┐         │
                │        ▼                                          │         │
   candidate ──►│  (3) Question Planning Engine  ◄── belief state  │         │
   answer       │      picks MAX information-gain objective        │         │
                │      → one question (Presenter voices it)        │         │
                │        │                                          │         │
                │        ▼                                          │         │
                │  (4) Evidence Extraction Engine → evidence units │         │
                │        │                                          │         │
                │        ▼                                          │         │
                │  (5) Competency Coverage Engine (THE BELIEF STATE)│        │
                │      per competency: status, θ, SE, confidence,   │        │
                │      evidence, contradictions, needs_followup ────┘        │
                │        │                                                   │
                │        ▼                                                   │
                │  (6) Interview Critic → was that worth it? probe/switch?   │
                │        │                                                   │
                │        └──► STOP CONDITION check ──► continue or conclude  │
                └────────────────────────────────────────────────────────┘
                                   shared belief state ⇄ EVALUATION ENGINE
```

### (1) Domain Knowledge Engine
Source of truth for "what good looks like." **Already exists** as `lib/competency-framework.js`: role families, seniority weights, BARS anchors, `interview_signals`, `evidence_requirements`. The DEIE consumes `buildModel(role, seniority)` → the competency set + weights for this candidate. Seniority sets both the **weights** and the **required confidence bar** per competency.

### (2) Interview Strategy Planner
Runs **once, before question 1**. Reads resume + JD + the competency model and produces an **Objective Set**:
```
objective_c = {
  competency_id, importance = weight_c,
  required_confidence = f(seniority, weight_c),   // critical comps need more
  resume_hooks = [specific claims to verify],     // "led 3 teams", "cut latency 60%"
  status = 'unknown', priority
}
```
It also pre-registers **claims to verify** (resume assertions) as first-class objectives — impressive achievements MUST be probed, not accepted.

### (3) Question Planning Engine
Runs **every turn**. Given the belief state, it:
1. computes each objective's **expected information gain** (§5),
2. selects the single highest-value objective,
3. decides **probe deeper** (same competency, go one level down) vs **switch** (new competency) vs **verify** (challenge a claim) vs **resolve contradiction**,
4. emits a **question intent** (target competency, angle, the specific thing to elicit) — the Presenter turns that intent into Maya's natural, warm, single question.
Guarantees: never redundant (skips objectives already `verified`), never generic (always anchored to a resume hook or a prior answer), one question at a time.

### (4) Evidence Extraction Engine
**Already exists** as the EIE rater/extractor (`lib/eie-rate.js`). After each answer it produces **evidence units** (situation→action→outcome, quote, turn, competency, valence, strength, verification) and detects **contradictions** against prior evidence.

### (5) Competency Coverage Engine — the belief state
The heart. For every competency, continuously maintained:
```
belief[competency_id] = {
  status: 'unknown' | 'partial' | 'strong' | 'verified',
  theta, se, confidence,          // from the Bayesian posterior (EIE §4)
  evidence_count, evidence_strength,
  contradictions: [...],
  needs_followup: bool,
  last_updated_turn
}
```
Status ladder (drives everything):
| status | meaning | trigger |
|---|---|---|
| **unknown** | no behavioral evidence | 0 episodes |
| **partial** | some evidence, uncertain | ≥1 episode, confidence < bar |
| **strong** | well-evidenced | confidence ≥ bar |
| **verified** | strong **and** a challenge/verification survived | strong + adversarial probe passed |

This is the **same object** the EIE evaluator reads. One belief state, two consumers.

### (6) Interview Critic
Runs **after every answer**, before the next question. Asks:
- Did confidence for the target competency actually increase? (Δconfidence)
- Was the evidence useful, or did the candidate dodge?
- Is the competency now `verified`? → retire it.
- Should I probe deeper (partial, high importance) or switch (diminishing returns)?
- Did a contradiction appear? → raise a resolution objective.
- **Was that question worth asking?** (logged → trains the planner, feeds Interview-Quality score.)

---

## 2. Internal reasoning pipeline (one turn)

```
observe(answer)
  → extract_evidence(answer)                 # (4)
  → update_belief_state(evidence)            # (5): θ, SE, confidence, contradictions
  → critic.assess(target, Δ)                 # (6)
  → if stop_condition(belief): conclude()     # §12
  → else:
      objective = plan_next(belief)          # (3) argmax expected info gain §5
      intent    = decide_move(objective)     # probe | switch | verify | resolve
      question  = presenter.voice(intent)    # fast model → Maya's one warm question
      ask(question)
```
`plan → act → observe → update` — a control loop, not a script.

---

## 3. State machine (session lifecycle)

```
CONFIGURING → OPENING → INVESTIGATING ⇄ (PROBING | VERIFYING | RESOLVING_CONTRADICTION)
             → CONVERGING → CONCLUDED
                              ↘ (any) → ABORTED (time / disconnect / abuse)
```
- **CONFIGURING** — build model + strategy (before Q1).
- **OPENING** — one warm baseline question (let them tell their story). Establishes prior, not a probe.
- **INVESTIGATING** — the main loop; sub-states are per-turn *moves*.
- **CONVERGING** — most critical competencies `verified`; only mopping up remaining decision-relevant uncertainty.
- **CONCLUDED** — stop condition met → hand belief state to the report.
- **ABORTED** — time cap, disconnect, or safety guardrail; produce a partial profile flagged low-coverage.

---

## 4. Belief update (confidence math)

Reuses the EIE measurement engine exactly (`lib/psychometrics.js`):
- each evidence unit → a graded observation of θ_c,
- posterior θ_c, SE_c via EAP; `confidence_c = marginal reliability`,
- multiple episodes / raters combine via the multi-observation posterior (agreement sharpens, disagreement widens).
No new math — the interviewer and evaluator *share the estimator*. This guarantees they can never disagree.

Required-confidence bar per competency:
```
required_confidence_c = base(seniority) + k · normalized_weight_c
  # critical, high-weight competencies at senior/staff demand more evidence
```

---

## 5. Question selection — information gain

**Objective value** = how much asking about competency *c* is expected to shrink *decision-relevant* uncertainty.

Composite decision uncertainty is `Var(θ_composite) = Σ_c w_c² · SE_c²`. Tightening competency *c* removes (in expectation) a fraction of its term. So:

```
expected_info_gain(c) ≈ w_c² · (SE_c² − E[SE_c²_after_one_more_answer])
                      ∝ w_c² · SE_c² · g(status_c)
```
where `g` boosts `unknown/partial` and zeroes `verified`. Intuition, in one line:

> **Ask about the competency that is simultaneously the most important and the least certain.** (High weight × wide credible interval.)

Refinements layered on top of the base score:
- **+** if an unverified resume claim maps to *c* (verification value).
- **+** if a contradiction touches *c* (resolution value — contradictions are high-information).
- **×** decay per consecutive turn already spent on *c* (avoid grinding one topic).
- **hard-skip** if `status == verified` or `confidence ≥ required_confidence`.

Then choose the **move**:
- `unknown` → **open probe** ("walk me through a time you…").
- `partial` + high value → **deepen** ("what was the hardest version of that? what broke?").
- `strong` + high importance → **verify/challenge** ("that's a strong claim — what would someone who disagreed say?").
- contradiction present → **resolve** ("earlier you said X, here Y — help me reconcile.").

Only the winning objective's intent is generated → the Presenter voices exactly one question.

---

## 6. Knowledge / evidence / risk graphs

- **Knowledge graph** — canonical claims the candidate makes (from resume + answers), each tagged `verified | contradicted | unverified`, linked to the evidence units and competencies they inform. (EIE candidate-graph, per role scope.)
- **Evidence graph** — evidence units ↔ competencies (many-to-many), with strength + verification. Drives the belief state.
- **Risk graph** — accumulating flags: `contradiction`, `fabrication_suspected`, `evasion`, `coached/memorized-sounding`, `overclaim`. Each has severity + the turns that raised it. Feeds `failure_conditions` (e.g., integrity contradiction → decision override) and the report's Top Risks.

**Contradiction handling:** on each answer, run `DetectContradiction(new_claim, knowledge_graph)`. If found → (a) add to risk graph, (b) create a `RESOLVING_CONTRADICTION` objective with high info-gain, (c) the candidate's reconciliation itself becomes evidence for Integrity & Judgment.

---

## 7. Adaptive questioning & follow-up strategy

- **Depth ladder** per competency: surface → detailed → deep → expert. The planner descends only while marginal information > cost; a strong answer earns a harder follow-up on the *same thread*, a weak/dodged answer earns one reframe then a switch (don't badger).
- **Follow-up objectives** are generated by the evaluator's Unknown/thin signals — the loop the current product doesn't yet close: the rubric's follow-up questions feed the planner *live*, not just the final report.
- **Anti-dodge:** if two consecutive answers on *c* yield no usable evidence (Critic: Δconfidence ≈ 0), mark `c` as `evasive`, record the risk, and switch — the *absence* of evidence under direct probing is itself signal.

---

## 8. Seniority & role adaptation

- **Role** → which competencies exist and their weights (`buildModel`). A Sales interview and a Backend interview investigate different things.
- **Seniority** → (a) weight tensor, (b) required-confidence bars, (c) the *altitude* of questions the Presenter uses (IC: "how did you build X"; Staff/Exec: "how did you decide X across teams, and what did you trade off"). The planner passes a `seniority_altitude` hint to the Presenter so Maya's phrasing matches the level.

---

## 9. Stop conditions (decision-stability, not count)

Continue **only while** the remaining uncertainty could still flip the hiring band. Concretely, stop when **any**:

1. **Decision-stable** — the composite P(success) credible interval lies entirely on one side of the hire cut (the band won't change even at the edges of our uncertainty). *This is the primary condition.*
2. **All critical competencies `verified`** (confidence ≥ required bar) and no open contradictions.
3. **Diminishing returns** — the best available `expected_info_gain` < ε for K consecutive turns.
4. **Guardrails** — time cap (e.g., 30 min), question hard-cap (safety net, e.g., 25), disconnect, or abuse.

If stopping via a guardrail before decision-stability → conclude with band `Needs More Evidence` and the list of still-uncertain competencies (honest, not a forced verdict).

```
stop(belief) :=
  decisionStable(belief)                                  # primary
  OR (allCriticalVerified(belief) AND noOpenContradictions(belief))
  OR (maxInfoGain(belief) < EPS for K turns)
  OR guardrailTripped()
```

---

## 10. Sync contract with the Evaluation Engine

The single most important interface. **One belief state; the evaluator owns the math, the interviewer owns the questions.**

```
After every candidate answer:
  evidence      = EIE.extract(answer, knowledgeGraph)     # eie-rate
  belief        = EIE.updateBelief(belief, evidence)       # eie-scoring/psychometrics
  contradictions= EIE.detectContradictions(evidence, KG)
  decision      = EIE.decide(belief)                       # decision-engine (running)
  objectives    = EIE.openObjectives(belief)               # Unknown/partial/needs_followup
  → interviewer plans next question from (belief, objectives, decision)
```
Because both read/write the same `belief` and use the same estimator, **they can never drift**. The evaluator's `coverage` is the interviewer's progress bar; the evaluator's follow-ups are the interviewer's to-do list; the evaluator's `decision-stability` is the interviewer's stop button.

---

## 11. Failure modes & guardrails

| Failure | Detection | Response |
|---|---|---|
| Candidate rambles / off-topic | extractor yields no evidence for target | gentle redirect once → switch; cap topic turns |
| Candidate dodges a probe | Δconfidence ≈ 0 twice on same c | mark `evasive` (risk), switch, note in report |
| Memorized/coached answer | too-polished + fails a novel follow-up | risk flag; ask an unrehearsable variant |
| Fabrication / contradiction | contradiction detector | resolve objective; integrity risk; possible band override |
| Planner picks a bad question | Critic: "not worth asking" | log; down-weight that pattern; recover next turn |
| LLM planner error / invalid intent | schema validation | fall back to next-best objective; never crash the interview |
| Infinite probe loop | K turns on one c with no gain | forced switch |
| Time / disconnect | timers, socket | conclude → partial profile, `Needs More Evidence` |
| Rate-limited model | call fails | Presenter uses a safe generic deepen; planner retries next turn (graceful degradation) |

---

## 12. Database schema

Reuses EIE tables; adds interviewer-runtime state (event-sourced, per `EVALUATION_ENGINE.md` §4).
```sql
interview_sessions (id, candidate_id, job_id, role_family, seniority,
                    framework_version, state, started_at, concluded_at, outcome_band)

interview_objectives (id, session_id, competency_id, importance, required_confidence,
                      status, resume_hooks jsonb, priority)     -- the Strategy Planner output

interview_turns (id, session_id, seq, target_competency, move,   -- probe|switch|verify|resolve
                 question_intent jsonb, question_text, answer_text,
                 info_gain_expected, info_gain_realized, critic_verdict jsonb,
                 model_versions jsonb, ts)

-- belief state is materialized from evidence_units + competency_scores (EIE tables);
-- snapshot per turn for replay/audit:
belief_snapshots (id, session_id, turn_seq, belief jsonb)        -- {comp: {status,theta,se,confidence,...}}

risk_flags (id, session_id, type, severity, competency_id, turns int[], detail, ts)
```
Everything is append-only and replayable: re-run the planner over an old session against a new strategy to A/B test question policies.

---

## 13. API contracts

```
POST /api/interview/plan/start      { sessionId, role, seniority, resume, jd }
      → { objectives[], first_question }              # Strategy Planner + opening
POST /api/interview/plan/next       { sessionId, answer }
      → { belief_delta, decision, next: { question, target_competency, move }
          | { concluded: true, reason, profile } }    # the per-turn loop + stop check
GET  /api/interview/plan/state      { sessionId }
      → { belief[], coverage, decision, objectives_open[] }   # live progress
```
`plan/next` is the whole loop: extract → update belief → critic → stop-check → (question | conclude). The Presenter (voice) is a thin layer that turns `next.question`'s intent into Maya's spoken line; it holds no strategy.

---

## 14. Production architecture

- **Two model tiers.** *Planner/Extractor* = a capable reasoning model (accuracy matters, ~1–2 calls/turn, can tolerate ~1s). *Presenter* = a fast model (latency matters, must feel instant in voice). This keeps voice snappy while the brain thinks.
- **Latency budget per turn:** extract + belief update (fast, mostly local math) ∥ plan (model) → Presenter (fast) → TTS stream. Overlap extraction of turn N with the candidate still speaking where possible.
- **Ensemble on evidence, not on every turn** — full N-rater scoring runs at conclusion (and periodically); per-turn uses a single fast rater for the belief delta, re-scored rigorously at the end. Balances cost vs live adaptivity.
- **Event-sourced & resumable** — browser crash → resume from `belief_snapshots`. Every turn logged with `model_versions` for reproducibility.
- **Graceful degradation** — any model failure falls back to a safe deepen/switch so the interview never stalls; rigorous scoring still happens at conclusion.
- **Idempotent** — replaying `plan/next` with the same (session, answer) is safe.

---

## 15. Pseudocode (the complete interviewer)

```python
def start(session, role, seniority, resume, jd):
    model    = buildModel(role, seniority)               # (1) competency-framework
    strategy = plan_strategy(model, resume, jd)          # (2) objectives + resume hooks
    belief   = init_belief(model)                        # all 'unknown'
    save(session, model, strategy, belief)
    return presenter.voice(opening_intent(strategy))     # OPENING: one warm baseline Q

def next_turn(session, answer):
    st = load(session)
    evidence = extract_evidence(answer, st.knowledge_graph)       # (4)
    st.belief = update_belief(st.belief, evidence)                # (5) Bayesian θ/SE
    contradictions = detect_contradictions(evidence, st.knowledge_graph)
    if contradictions: raise_objectives(st, contradictions)      # risk + resolve
    verdict = critic(st, target=st.last_target, evidence)        # (6)

    if stop(st.belief):                                          # §9 decision-stability
        profile = EIE.finalize(st.belief)                        # rigorous ensemble re-score
        return conclude(session, profile)

    obj  = argmax(st.open_objectives(), key=expected_info_gain)  # §5
    move = decide_move(obj, st.belief)                           # probe|switch|verify|resolve
    q    = presenter.voice(question_intent(obj, move, st.seniority_altitude))  # (3)
    st.last_target = obj.competency_id
    save(session, st)
    return { question: q, target: obj.competency_id, move,
             belief_delta: delta(st), decision: EIE.decide(st.belief) }

def expected_info_gain(obj, belief):
    b = belief[obj.competency_id]
    if b.status == 'verified' or b.confidence >= obj.required_confidence: return -inf
    base = (obj.importance ** 2) * (b.se ** 2) * status_boost(b.status)
    base += verify_bonus(obj) + contradiction_bonus(obj, belief)
    return base * topic_fatigue_decay(obj, belief)
```

---

## 16. What exists vs. what to build (grounded in current code)

**Already built (reuse):**
- `lib/competency-framework.js` → Domain Knowledge Engine (1).
- `lib/eie-rate.js` (extractor/rater) → Evidence Extraction (4).
- `lib/eie-scoring.js` + `lib/psychometrics.js` → belief update / confidence (5, §4).
- `lib/decision-engine.js` → decision-stability signal for the stop condition (9).
- Maya persona in `app/api/interview/route.js` → the Presenter (thin voice layer).

**To build (the interviewer brain):**
1. **Strategy Planner (2)** — resume+JD+model → objective set with resume hooks. *(biggest immediate win.)*
2. **Belief state + per-turn update loop** — run the extractor/scorer after every answer, maintain `belief` + status ladder. *(closes the interviewer↔evaluator loop live.)*
3. **Question Planning Engine (3)** — info-gain selection + move decision → question intent; Presenter voices it.
4. **Interview Critic (6)** + risk graph + contradiction resolution.
5. **Decision-stability stop condition (9)** — replace the fixed 30-min/40-Q cap.
6. **Interview-Quality score** — coverage × reliability × info-gain-efficiency = Maya's report card.

**Recommended build order:** 1 → 2 → 5 → 3 → 6 → 4. Steps 1–2 alone move coverage from ~70% toward near-complete and make Maya target the rubric; step 5 makes interviews end when the decision is confident, not on a timer.

---

## Appendix — design invariants (never violate)
- One belief state, shared with the evaluator. No parallel "interview score."
- No competency scored without a cited behavioral episode.
- Never ask a question that cannot change the decision.
- Impressive claims are verified, never accepted.
- The interviewer recommends evidence; a human decides the hire.
- Stop on decision-stability; a guardrail stop yields `Needs More Evidence`, never a forced verdict.
