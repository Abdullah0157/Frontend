# Evaluation Intelligence Engine (EIE) — Scientific Design Specification

> **Status:** Foundational design (v1). This document specifies the measurement science, architecture, data model, algorithms, prompts, and validation strategy for JobStream's evaluation moat. It supersedes the ad-hoc "invent-a-rubric-at-report-time" approach and the `expert-rubric.js` v2 composite (which becomes a *special case* of §6).
>
> **North star:** An enterprise can defend any hiring decision this engine influences to a plaintiff's expert witness, an EEOC auditor, and their own board. Every score has evidence, confidence, and uncertainty; every conclusion is traceable; nothing is hallucinated certainty.

---

## 0. Why the status quo is scientifically wrong

Almost every "AI interviewer" (and our own current code) makes four category errors:

1. **Wrong estimand.** They output a point score (e.g. "8/10"). But hiring is *measurement of a latent trait under uncertainty*. A point score with no interval conflates a well-measured average candidate with a barely-measured strong one — the single most consequential error in applied psychometrics.
2. **Holistic combination.** They ask one model for a gestalt "overall." Sixty years of decision research (Meehl 1954; Dawes 1979; Grove et al. 2000 meta-analysis, *k*=136; Kuncel et al. 2013) show **mechanical/actuarial combination of predictors reliably beats holistic clinical judgment** — including expert judgment. The model may *rate evidence*; it must not *combine* it by feel.
3. **Rubric invented per interview.** Non-comparable across candidates, non-calibratable, and legally indefensible (fails the job-relatedness and consistency tests of the *Uniform Guidelines on Employee Selection Procedures*, 29 CFR 1607).
4. **The rater is unvalidated.** An LLM judge has measurable biases (position, verbosity, sycophancy, self-preference) and miscalibration. Treating its output as ground truth, rather than as a *noisy instrument to be calibrated*, is the equivalent of shipping a bathroom scale with no units.

The EIE fixes all four by construction.

---

## 1. Research foundations (principles extracted, then improved)

We do not copy Google/Amazon/McKinsey/SHL. We extract the *invariant principles* their systems rely on and re-found them on explicit measurement theory.

### 1.1 Structured assessment beats unstructured (the core empirical fact)
- Structured interviews have substantially higher operational validity and far higher inter-rater reliability than unstructured ones. Classic estimates: Schmidt & Hunter (1998); McDaniel et al. (1994) meta-analysis. **Important modern correction:** Sackett, Zhang, Berry & Lievens (2022) re-did the range-restriction corrections and showed many textbook validities were *overstated*; structured interviews, job-knowledge tests, work samples, and general mental ability remain among the strongest, but we cite **corrected operational validities** and never oversell.
- **Principle used:** fixed competencies, fixed anchors, same evidentiary bar for every candidate. Structure is where reliability comes from.

### 1.2 Behavioral Event Interviewing / Critical Incident Technique
- Flanagan (1954), McClelland (1973), Boyatzis (1982): past *behavior on real incidents* predicts future behavior better than hypotheticals or self-report. Amazon's Leadership-Principle "tell me about a time…" and McKinsey's PEI are operationalizations.
- **Principle used:** the interview and the extractor hunt for **concrete behavioral episodes** (situation → action → outcome → reflection), not opinions. Evidence units are episodes, not adjectives.

### 1.3 Competency modeling & KSAOs
- Competencies decompose into Knowledge, Skills, Abilities, Other characteristics (KSAOs); O*NET and the competency-modeling literature (Campion et al. 2011) give the taxonomy discipline.
- **Principle used:** a 3-layer competency graph (§3), each node defined behaviorally and tied to job relevance.

### 1.4 BARS + Frame-of-Reference training
- Behaviorally Anchored Rating Scales (Smith & Kendall 1963) attach concrete behavior descriptions to each scale point, cutting rater drift. Frame-of-Reference training (Bernardin & Buckley 1981; Roch et al. 2012 meta-analysis) further raises accuracy and inter-rater agreement.
- **Principle used:** every competency ships with **anchored levels** (§3.3), and the rater prompt *is* a frame-of-reference training protocol.

### 1.5 Psychometrics: CTT, IRT, and especially Generalizability Theory
- Classical Test Theory: reliability, SEM, attenuation.
- Item Response Theory (Rasch/2PL; Samejima's Graded Response Model for ordered categories): places persons and items on a common latent scale — the basis for our θ estimation and adaptive follow-ups.
- **Generalizability Theory** (Cronbach, Gleser, Nanda & Rajaratnam 1972; Brennan 2001) is the *right* framework here because our signal is inherently multi-faceted: `person × competency × task × rater(prompt/model/seed) × occasion`. G-theory decomposes variance into these components and yields a **G-coefficient** (dependability) per competency. This is how we honestly report reliability for a multi-signal AI assessment. **This is a differentiator — almost no one applies G-theory to LLM raters.**

### 1.6 Validity & fairness (the legal + ethical spine)
- Validity trinity: content, criterion (predictive/concurrent), construct; plus validity generalization.
- Fairness/law: *Uniform Guidelines* (job-relatedness, adverse-impact 4/5ths rule), Differential Item Functioning (DIF), measurement invariance across subgroups, NYC Local Law 144 (annual independent bias audit for automated employment decision tools), EEOC guidance, GDPR Art. 22 (right to explanation / human review).
- **Principle used:** §8 bakes adverse-impact monitoring, DIF, invariance testing, blinding, and mandatory human-in-the-loop for adverse actions into the runtime, not as an afterthought.

### 1.7 Decision science
- **Mechanical combination** (Grove/Meehl) → algorithmic aggregation.
- **Robust weighting** (Dawes 1979, "robust beauty of improper linear models"): unit/near-unit weights are hard to beat when data is scarce — so early weights are theory-driven and *deliberately simple*, not overfit.
- **Bayesian inference** for evidence accumulation and uncertainty.
- **Signal detection / utility** (Taylor-Russell 1939; Cronbach & Gleser 1965; Boudreau utility analysis): cut scores are chosen by **expected utility given base rate and selection ratio**, not by a round number.
- **Calibration** (Brier score; Expected Calibration Error): a "70% hire-success" claim must be *empirically* 70% once outcomes exist.

### 1.8 What the elite systems actually teach us
- **Google structured hiring:** fixed rubric, multiple independent interviewers, a *hiring committee* that reviews evidence packets and overrides no one on gut — evidence-first, committee-mechanical.
- **Amazon Bar Raiser:** written STAR narratives, Leadership-Principle-mapped, a trained independent raiser guarding the bar, "disagree and commit," explicit *raise-the-bar* base-rate discipline.
- **McKinsey PEI + case:** distinct competencies (personal impact, entrepreneurial drive, leadership, problem solving) each probed for depth on real incidents.
- **SHL/Criteria:** psychometric validation, norm groups, adverse-impact reporting, documented reliability/validity.
- **Extracted meta-principle:** *independent evidence collection → structured, anchored rating → mechanical aggregation → committee-style explainable decision → validation against outcomes.* The EIE is this pipeline, made rigorous and automated.

### 1.9 LLM-as-rater science
- Known failure modes: position bias, verbosity/length bias, self-preference, sycophancy, prompt sensitivity, miscalibration, hallucinated quotes.
- Mitigations we use: forced evidence grounding + quote verification, adversarial refutation, ensembling across seeds/models (treated as raters for G-theory), rubric/anchor conditioning (frame-of-reference), abstention on low evidence, and continuous calibration against human raters and outcomes.

---

## 2. Architecture — subsystems & data flow

```
                         ┌───────────────────────────────────────────────┐
   JD + Resume  ─────────►  (A) COMPETENCY SELECTION & WEIGHTING          │
                         │      role-adaptive; human-reviewable            │
                         └───────────────┬───────────────────────────────┘
                                         ▼
   Interview / assessment turns ─►  (B) EVIDENCE ENGINE
                                        - extract behavioral episodes
                                        - verify quotes vs transcript
                                        - detect contradictions (RAG on candidate graph)
                                        - strength + reliability tagging
                                         │  (Evidence Units)
                                         ▼
                                    (C) RATING ENGINE (LLM as instrument)
                                        - map each evidence unit to a competency
                                          BARS level, with confidence
                                        - ensemble across seeds/models (raters)
                                         │  (per-competency graded observations)
                                         ▼
                                    (D) MEASUREMENT ENGINE (Bayesian + G-theory)
                                        - posterior over θ_c per competency
                                        - reliability (G-coefficient), SEM, credible interval
                                        - abstain → "Unknown" if information < threshold
                                         │  (Competency Profile w/ uncertainty)
                                         ▼
        ┌────────────── (E) UNCERTAINTY / ADAPTIVE ENGINE ◄── loops back to interview
        │                    - target next question at max expected information
        │                      for the lowest-confidence *decision-relevant* competency
        ▼
   (F) FAIRNESS & VALIDITY LAYER   → adverse impact, DIF, invariance, blinding, audit log
                                         │
                                         ▼
   (G) DECISION ENGINE                → mechanical aggregation → utility-based band
                                        + probabilities (labeled by validation status)
                                         │
                                         ▼
   (H) REPORT ENGINE                  → elite-committee report (evidence-mapped, explainable)
                                         │
                                         ▼
   (I) CALIBRATION & OUTCOME LOOP     → golden sets, human κ/ICC, Brier vs hire outcomes,
                                        re-fit weights & likelihoods, version everything
```

Every subsystem is independently versioned, testable, and A/B-able. **(I) is the moat**: outcome-linked recalibration compounds and cannot be copied with prompts.

---

## 3. The Competency Framework

### 3.1 Three layers
1. **Universal competencies** — cross-role KSAOs (cognitive, execution, interpersonal, integrity, motivation). Always measured; weighted differently per role.
2. **Role-family competencies** — e.g. *System Design*, *Code Quality* (SWE); *Product Sense*, *Prioritization* (PM); *Discovery*, *Negotiation* (Sales).
3. **Seniority expectations** — the *same* competency has different anchors and weights at IC3 vs Staff vs Executive (scope, ambiguity, blast radius).

### 3.2 The universal library (organized taxonomy)

| Cluster | Competencies |
|---|---|
| **Cognitive** | Structured Problem Solving · Decision Quality · Strategic Thinking · Cognitive Flexibility · Learning Velocity |
| **Execution** | Ownership & Bias for Action · Adaptability · Delivery/Results |
| **Interpersonal** | Communication · Collaboration · Customer Thinking · Executive Presence |
| **Leadership** | People Leadership · Influence without Authority · Growth Potential |
| **Domain/Technical** | Technical Depth · Craft/Quality (role-specialized in §7) |
| **Integrity/Motivation** | Integrity & Judgment · Business Acumen · Motivation & Role Fit |

The 40 items in the brief map onto these clusters (Communication/Technical/Behavioral/etc. are **rollup projections** of this graph, see §6.4 — not independent scorers, which would double-count variance).

### 3.3 Competency object — canonical schema
Every competency node carries **all** of the following (this is the "for every competency generate…" requirement, made into a data contract):

```jsonc
{
  "id": "problem_solving",
  "name": "Structured Problem Solving",
  "cluster": "cognitive",
  "definition": "Decomposes ambiguous problems, forms hypotheses, tests them against evidence, and converges on a defensible solution.",
  "scientific_basis": "GMA is the single strongest predictor of job performance (Sackett 2022, corrected); structured problem probes are its behavioral proxy.",
  "why_it_matters": "Predicts performance on novel, non-routine work — where value is created and where memorized answers fail.",
  "observable_behaviors": ["states assumptions", "decomposes before solving", "seeks disconfirming evidence", "quantifies tradeoffs"],
  "positive_indicators": ["identifies the crux", "revises approach when a test fails", "separates signal from noise"],
  "negative_indicators": ["jumps to solution", "cannot say why an approach failed", "confuses activity with progress"],
  "interview_signals": ["a real debugging story with a wrong turn", "explicit tradeoff articulation"],
  "evidence_sources": ["voice_interview", "coding_assessment", "system_design", "work_sample"],
  "bars_anchors": {
    "5": "Reframed an ambiguous problem, generated competing hypotheses, ran the cheapest discriminating test first, and explained why the discarded paths were wrong.",
    "4": "Structured decomposition and clear tradeoffs; handled an edge case with a sound method.",
    "3": "Solved the standard case competently; less convincing on novelty or when a test failed.",
    "2": "Formulaic; little evidence of hypothesis testing or adaptation.",
    "1": "Jumped to an answer; no reasoning under difficulty; wrong on fundamentals."
  },
  "evidence_requirements": { "min_episodes_for_confident": 2, "requires_failure_probe": true },
  "weight_by_role":      { "software_engineer": 0.9, "sales": 0.5, "designer": 0.7 },
  "weight_by_seniority": { "ic3": 0.7, "senior": 0.9, "staff": 1.0, "exec": 0.9 },
  "risk_indicators": ["confident but wrong", "cannot articulate own reasoning"],
  "failure_conditions": ["fabricates a method", "no disconfirmation ever considered"],
  "improvement_recommendations": ["practice hypothesis-first debugging", "post-mortem writing"]
}
```

### 3.4 Fully-worked examples
Four are elaborated in Appendix A (Structured Problem Solving, Ownership & Bias for Action, Communication, System Design). The remaining competencies follow the identical template; §3.5 is how they're produced without hand-writing 40 shallow copies.

### 3.5 Role-adaptive generation (JD → competency model)
1. Parse JD → extract role family, seniority band, and the *job-relevant* competency subset (content-validity step — every competency must trace to a JD requirement; this is the legal job-relatedness anchor).
2. Produce a **weight vector** `w_c` from `weight_by_role × weight_by_seniority`, normalized.
3. **Human-in-the-loop review** of the generated model before it goes live (Uniform Guidelines expects documented, job-related standards). Generated competency drafts are quarantined as `status: draft` until reviewed — never auto-live.
4. Version the resulting `competency_framework_version` and stamp it on every score (reproducibility).

---

## 4. Measurement Engine — the core science

### 4.1 The estimand
For candidate *p* and competency *c*, estimate latent standing **θ_c ∈ ℝ** (standardized, ~N(0,1) in the norm population). We never emit θ without an interval.

### 4.2 Evidence likelihood (Graded Response Model)
Each evidence unit *e* rated at BARS level *k ∈ {1..5}* for competency *c* is an ordered-categorical observation of θ_c. Using Samejima's Graded Response Model, the probability of observing level ≥ k is:

```
P(rating ≥ k | θ) = 1 / (1 + exp(-a_c (θ - b_{c,k})))
```

- `a_c` = discrimination (how sharply this competency's anchors separate ability) — starts theory-set, later fit from data.
- `b_{c,k}` = anchor thresholds (difficulty of clearing BARS level k) — from the anchor calibration study.
- Each evidence unit also carries a **weight** `ω_e ∈ (0,1]` = strength × verification × reliability (§5), which tempers its likelihood contribution (a verified, high-strength episode informs θ more than a thin aside).

### 4.3 Bayesian posterior
```
prior:      θ_c ~ N(μ_role_seniority, σ0²)         # base-rate prior, not zero-information
posterior:  p(θ_c | E_c) ∝ p(θ_c) · Π_e P(rating_e | θ_c)^{ω_e}
```
Computed by EAP (Expected A Posteriori) over a fixed θ-grid (fast, deterministic, no sampler needed at inference time). Outputs:
- **θ̂_c** = posterior mean (report on a scaled metric too, e.g. 0–100 or stanine).
- **SE(θ̂_c)** = posterior SD → **credible interval** (e.g. 90%).
- **Information I_c** = posterior precision (1/variance) → drives confidence & adaptivity.

### 4.4 Reliability via Generalizability Theory
Treat `prompt/model/seed` variants as **raters** and `question/assessment` as **tasks**. From the ensemble, estimate variance components σ²(person), σ²(competency), σ²(task), σ²(rater), σ²(residual) and compute a **G-coefficient** per competency:
```
G_c = σ²(person) / (σ²(person) + σ²(rater)/n_raters + σ²(task)/n_tasks + σ²(residual)/(n_raters·n_tasks))
```
`G_c` is reported as the competency's reliability. A decision may not rest on a competency whose G < threshold (default 0.60) — it is flagged **low-reliability** and routed to the Uncertainty Engine.

### 4.5 Confidence vs Uncertainty (they are different, and we report both)
- **Confidence** = f(Information I_c, G_c, evidence count, verification rate). A single scalar in [0,1] for UI.
- **Uncertainty** = the **credible interval width** on θ. Wide interval ⇒ we don't know, regardless of the point estimate.
- **Unknown state:** if I_c below `INFO_MIN` or episodes < `min_episodes_for_confident`, the competency is emitted as `"unknown"` — *not* a low score. Unknown ≠ bad. This distinction is the single biggest honesty upgrade over every competitor.

### 4.6 Rater calibration (making the LLM a trustworthy instrument)
- **Ensemble** N raters (seed/model/prompt-order permutations); disagreement feeds σ²(rater).
- **Position/verbosity/self-preference debiasing:** randomize option order, penalize length as a signal, forbid the rater from seeing prior scores.
- **Verification/refutation:** an adversarial pass tries to *refute* each rating from the transcript; unrefuted ratings gain weight, refuted ones lose it.
- **Calibration tracking:** rater-predicted confidence vs realized correctness (against human labels and outcomes) → Brier score & ECE; recalibrate (temperature/Platt scaling) per model version.

---

## 5. Evidence Engine

### 5.1 Evidence Unit — schema
```jsonc
{
  "id": "ev_0192",
  "competency_id": "ownership",
  "session_id": "sess_...",
  "turn_ref": 14,                       // 1-indexed transcript turn (verifiable)
  "modality": "voice_interview",
  "episode": { "situation": "...", "action": "...", "outcome": "...", "reflection": "..." },
  "quote": "I re-architected it to rank findings by confidence and only surface high-value ones.",
  "quote_type": "direct" | "paraphrase" | "not_assessed",
  "valence": "positive" | "negative",
  "bars_level": 4,                      // rater output
  "strength": 0.0-1.0,                  // specificity + consequence + first-personness
  "verification": 0.0-1.0,              // quote grounded in transcript?
  "reliability": 0.0-1.0,               // rater agreement on this unit
  "weight": 0.0-1.0,                    // ω_e = strength × verification × reliability
  "contradicts": ["ev_0177"],           // detected contradictions
  "need_more_evidence": false
}
```

### 5.2 Pipeline
1. **Segment** transcript into candidate turns.
2. **Extract episodes** (Situation-Action-Outcome-Reflection); reject non-behavioral opinions.
3. **Map** each episode to competencies (a unit may inform several).
4. **Verify** every quote against the source turn (normalize + fuzzy match); unverifiable direct quotes → downweighted and flagged (reuses the spirit of the current `validateReport`).
5. **Contradiction detection:** RAG over the candidate's own evidence graph; conflicting claims (resume vs interview, turn 3 vs turn 15) flagged for the report and for a follow-up.
6. **Strength scoring:** specificity, presence of metrics/consequence, first-person ownership, failure/edge content.
7. **`need_more_evidence`** raised when a decision-relevant competency has thin/again-only evidence → Uncertainty Engine.

### 5.3 Anti-gaming
Multi-modal corroboration (must *code* AND *explain* AND *defend live*), behavioral consistency (claim vs demonstrated skill), and contradiction flags make LLM-assisted cheating break down. We report detection honestly with a measured false-positive rate; we never hard-reject on a single anomaly.

---

## 6. Scoring System (multidimensional — no naked 1–10)

### 6.1 Per-competency score object
```jsonc
{
  "competency_id": "problem_solving",
  "theta": 0.82, "theta_scaled_0_100": 74,
  "credible_interval_90": [0.30, 1.34],
  "se": 0.32,
  "confidence": 0.71,
  "reliability_G": 0.68,
  "evidence_count": 3, "verified_evidence_count": 2,
  "state": "measured" | "unknown" | "low_reliability",
  "top_evidence_ids": ["ev_0192","ev_0201"],
  "framework_version": "eie-2025.1", "model_versions": {...}
}
```

### 6.2 The many scores the brief asks for — and where each comes from
- **Raw** = θ̂ (posterior mean). **Weighted** = θ̂ × w_c into the composite. **Evidence score** = Σω_e. **Confidence** = §4.5. **Reliability** = G_c. **Consistency** = 1 − contradiction density. **Verification** = verified/total evidence.
- **Behavior / Technical / Leadership / Communication / Learning / Risk scores** = **cluster rollups** (§6.4).
- **Composite** = §6.3. **Hiring / Success / Promotion / Retention** = §9 (Decision Engine), *labeled with validation status*.

### 6.3 Composite — mechanical, uncertainty-aware
```
θ_composite = Σ_c w_c · θ̂_c   (over MEASURED competencies only; unknowns excluded, not zeroed)
SE_composite = sqrt( Σ_c w_c² · SE_c² )
coverage = Σ_c∈measured w_c   // fraction of the decision weight actually measured
```
`coverage` is reported: a composite built on 40% of the weight is explicitly "insufficiently measured." **We never silently impute an unknown as average.**

### 6.4 Cluster rollups (the projection layer)
"Technical", "Communication", "Leadership", etc. are weighted rollups of their member competencies — projections of one coherent measurement, so shared variance isn't double-counted. This is why we do **not** run separate independent "communication scorer" and "leadership scorer" models.

---

## 7. Role-specific rubrics

Each role family = a selection over the universal graph + role competencies + role-tuned anchors/weights. Sketch (full anchor sets generated via §3.5, human-reviewed):

| Role family | Signature competencies (beyond universal) |
|---|---|
| **Software / Backend / Frontend / Full-Stack** | System Design · Code Quality & Craft · Debugging Rigor · Technical Communication |
| **DevOps / Cloud / Security** | Reliability Engineering · Threat Modeling · Automation Judgment · Incident Response |
| **Data Scientist / ML / AI Engineer** | Statistical Reasoning · Experiment Design · Model Evaluation · Data Intuition |
| **Product / Project Manager** | Product Sense · Prioritization · Metrics/Experimentation · Stakeholder Alignment |
| **Designer** | Craft · User Empathy · Critique/Iteration · Systems Thinking |
| **Sales / CS / Support** | Discovery · Objection Handling · Negotiation · Customer Empathy |
| **Marketing / Finance / HR / Legal / Ops** | Domain Judgment · Analytical Rigor · Compliance Sensibility · Stakeholder Comms |
| **Healthcare / Teachers / Researchers** | Domain Mastery · Ethical Judgment · Explanation/Pedagogy · Evidence Standards |
| **Executives** | Strategic Thinking · People Leadership · Capital Allocation · Judgment under Ambiguity |

The **role-family × competency × seniority** weight tensor is the calibratable asset; it starts theory-set (Dawes-robust simple weights) and is refit from outcome data (§10).

---

## 8. Fairness, Bias & Validity layer

Runs on **every** assessment, not on a compliance quarterly:
- **Job-relatedness gate:** a competency with no JD linkage cannot enter a decision.
- **Adverse impact:** selection-rate ratios by protected group vs the 4/5ths rule; alert on breach.
- **DIF & measurement invariance:** does the same θ produce different ratings across groups? Test configural/metric/scalar invariance on accumulating data.
- **Blinding/counterfactual:** strip name/gender/age/school cues from the rating context; counterfactual probes (swap identity signals, expect stable θ).
- **Frame-of-reference conditioning** in the rater prompt reduces idiosyncratic drift.
- **Human-in-the-loop:** the engine never issues an adverse action autonomously (GDPR Art. 22; EEOC). It recommends; a human decides.
- **Bias audit export** (NYC LL144-ready) and full **audit log**: every score's inputs, prompts, model versions, and evidence are reproducible.

---

## 9. Decision Engine

### 9.1 From posteriors to a recommendation (mechanical)
Given competency posteriors, the role weight vector, and a **utility-derived cut score** (not a round number):
- Compute `P(θ_composite ≥ τ_role_seniority)` by integrating the composite posterior — this is the probability the candidate clears the bar, *with* its uncertainty.
- Choose τ by **expected utility** (Taylor-Russell / Cronbach-Gleser) from base rate + selection ratio + cost of a bad hire vs missed good hire — configurable per org.

### 9.2 Seven-band output + a first-class "Unknown"
```
Strong Hire        P(clear bar) ≥ 0.85  AND coverage ≥ 0.8  AND no critical failure flag
Hire               0.70–0.85
Hire w/ Reservations  0.55–0.70  (name the reservations = lowest decision-relevant competencies)
Borderline         0.45–0.55
No Hire            0.20–0.45
Strong No Hire     < 0.20  OR a failure_condition triggered (e.g. integrity)
Needs More Evidence   coverage < 0.6  OR any decision-critical competency = unknown/low-reliability
```
`Needs More Evidence` is a **decision**, not a hedge — it routes to §5.2/§E with targeted follow-ups instead of forcing a false verdict.

### 9.3 Predictions — with scientific integrity
Performance, promotion, and retention predictions are emitted **only with an explicit validation status**:
- `validation_status: "uncalibrated_prior"` before outcome data exists — shown as a theory-based estimate with a wide interval and a visible disclaimer. **We do not claim predictive validity we have not earned.** (Claiming otherwise is the fastest way to lose an enterprise's trust and a lawsuit.)
- `validation_status: "calibrated"` once §10 has sufficient outcomes; then predictions carry a measured AUC/Brier.

---

## 10. Calibration & Outcome loop (the compounding moat)
- **Golden set:** ~500 assessments per role family, scored by trained human raters; compute AI–human agreement (Cohen's κ, ICC) — target ICC ≥ 0.75.
- **Test–retest / internal consistency:** re-rate transcripts across seeds → G-theory reliability over time.
- **Criterion validity:** once hires accrue performance/retention signals (`outcome_signals`), fit and monitor predictive validity (AUC, Brier, calibration curves); **refit** GRM parameters (`a_c`, `b_{c,k}`) and role weights.
- **Regression suite:** every prompt/model change re-runs the golden set; ship only if agreement and calibration don't regress (canary + version pinning).
- **Everything versioned:** `(framework_version, anchor_version, prompt_hash, model_id, weight_vector_version)` on every stored score → full reproducibility and auditability.

---

## 11. Data model (Postgres; queryable, not a JSON blob)

```sql
-- Framework (versioned, calibratable)
competency_frameworks(id, version, status, published_at)
competencies(id, framework_id, key, name, cluster, definition, scientific_basis,
             observable_behaviors jsonb, positive_indicators jsonb, negative_indicators jsonb,
             evidence_requirements jsonb, discrimination_a numeric, status)
competency_anchors(id, competency_id, level int, descriptor text, threshold_b numeric)
role_families(id, framework_id, code, name)
competency_weights(id, role_family_id, seniority_band, competency_id, weight numeric)

-- Runtime (event-sourced; reuse interview_sessions)
assessment_sessions(id, candidate_id, job_id, framework_version, state, coverage numeric)
evidence_units(id, session_id, competency_id, turn_ref int, modality, episode jsonb,
               quote text, quote_type, valence, bars_level int,
               strength numeric, verification numeric, reliability numeric, weight numeric,
               contradicts jsonb, need_more_evidence bool, created_at)
competency_scores(id, session_id, candidate_id, competency_id, framework_version,
                  theta numeric, se numeric, ci_low numeric, ci_high numeric,
                  confidence numeric, reliability_g numeric, state text,
                  evidence_count int, verified_count int, model_versions jsonb, computed_at)
decisions(id, session_id, band text, p_clear_bar numeric, composite_theta numeric,
          composite_se numeric, coverage numeric, cut_score numeric, rationale jsonb,
          human_reviewed_by, human_decision, created_at)

-- Fairness & validation
fairness_audits(id, job_id, period, adverse_impact jsonb, dif jsonb, invariance jsonb)
rater_calibration(id, model_id, prompt_hash, brier numeric, ece numeric, icc_vs_human numeric, at)
outcome_signals(id, hire_id, type, value, source, ts)          -- the flywheel
score_outcome_links(id, competency_score_id, outcome_signal_id) -- criterion validity joins
```

Indexes on `(competency_id, theta)`, `(job_id, band)`, `(framework_version)` — so "all candidates with problem_solving θ>1 and coverage>0.8 for role X" is a query, not a scan.

---

## 12. API design

```
POST /api/eie/framework/generate        { jobDescription } → draft competency model (status=draft)
POST /api/eie/framework/:id/publish      (human review gate)
POST /api/eie/evidence/extract          { sessionId, turns } → EvidenceUnit[]
POST /api/eie/score                      { sessionId } → CompetencyScore[] + coverage
GET  /api/eie/next-question              { sessionId } → { competency_id, question, expected_info_gain }
POST /api/eie/decide                     { sessionId } → Decision (band, P, rationale)
GET  /api/eie/report/:sessionId          → full committee report (§14.3)
GET  /api/eie/rank                        { competency_id | role, domain } → percentile cohort
POST /api/eie/outcome                     { hireId, type, value } → ingest outcome (calibration)
```
All mutating scores are idempotent per `(sessionId, framework_version, model_versions)`; re-running is free and reproducible.

---

## 13. AI prompt design (each prompt = a validated instrument, not "optimization")

Five specialized prompts, each single-responsibility, each independently calibratable:

1. **Interviewer (Presenter)** — BEI protocol; asks for concrete episodes with a failure probe; one question at a time (this is the existing Maya/Iris persona, kept thin).
2. **Evidence Extractor** — transcript → EvidenceUnit[] with verified quotes and SAOR episodes; forbidden from scoring.
3. **Competency Rater** — *frame-of-reference protocol*: given a competency + its BARS anchors + one evidence unit, return `{bars_level, confidence, justifying_quote}`. Must cite; must be able to output `not_assessed`. Ensembled across seeds/models.
4. **Adversarial Verifier** — tries to refute each rating from the transcript; returns `{refuted: bool, reason}`. Majority-refuted ratings are downweighted.
5. **Decision Synthesizer** — writes the *explanation* from the mechanical decision (it explains, it does not decide the number).

Prompt-design invariants: forced evidence, forced confidence, explicit permission to say "unknown," no visibility of other scores (independence), randomized option order (anti-position-bias).

---

## 14. Schemas, responses, and the report

### 14.1 Example score API response
```json
{
  "sessionId": "sess_8842", "framework_version": "eie-2025.1", "coverage": 0.83,
  "competencies": [
    { "competency_id": "problem_solving", "theta": 0.82, "theta_scaled_0_100": 74,
      "credible_interval_90": [0.30, 1.34], "confidence": 0.71, "reliability_G": 0.68,
      "state": "measured", "evidence_count": 3, "verified_evidence_count": 2,
      "top_evidence_ids": ["ev_0192","ev_0201"] },
    { "competency_id": "people_leadership", "state": "unknown",
      "reason": "no behavioral episode elicited", "confidence": 0.18,
      "followup_question": "Tell me about a time you had to turn around an underperformer." }
  ]
}
```

### 14.2 Example decision
```json
{ "band": "Hire with Reservations", "p_clear_bar": 0.63, "composite_theta": 0.58,
  "composite_se": 0.27, "coverage": 0.83, "cut_score": 0.40,
  "reservations": ["people_leadership (unknown)", "strategic_thinking (θ=0.1, wide CI)"],
  "critical_failures": [], "human_review_required": true }
```

### 14.3 The elite-committee report (structure)
Executive Summary · Overall Recommendation (band + P + one-paragraph "why") · Top Strengths (evidence-linked) · Top Risks · **Unknown Areas** (explicitly) · Evidence Map (competency → quotes → turns) · Competency Breakdown (θ, CI, confidence, G per competency) · Confidence & Reliability Analysis · Technical / Communication / Leadership / Behavior rollups · Growth & Promotion Potential (labeled validation status) · Learning Velocity · Role Fit & Coverage · Interview Quality (did we actually probe enough?) · **Recommended Next Steps** · **Suggested Follow-Up Questions** (from the Uncertainty Engine) · Suggested Reference-Check Areas (targeted at low-confidence, high-weight competencies).

---

## 15. Pseudocode (end-to-end)

```python
def evaluate(session, jd):
    model   = select_and_weight_competencies(jd)          # §3.5, human-reviewed
    turns   = session.transcript
    evidence = extract_evidence(turns)                     # §5 (+ verify + contradictions)
    ratings  = ensemble_rate(evidence, model.anchors)      # §4.6 N raters
    ratings  = adversarial_verify(ratings, turns)          # downweight refuted

    scores = {}
    for c in model.competencies:
        obs = [r for r in ratings if r.competency == c.id]
        if information(obs) < INFO_MIN or episodes(obs) < c.min_episodes:
            scores[c] = Unknown(followup=generate_followup(c))     # §4.5 abstain
        else:
            post = bayesian_theta(obs, prior=c.prior, grm=c.grm)   # §4.3 EAP
            scores[c] = Score(theta=post.mean, se=post.sd, ci=post.ci90,
                              G=g_coefficient(obs), confidence=conf(post, obs))

    if coverage(scores, model.w) < COVERAGE_MIN or any_critical_unknown(scores):
        return decision("Needs More Evidence", followups=collect_followups(scores))

    comp = composite(scores, model.w)                      # §6.3 mechanical
    p    = prob_clear_bar(comp, cut=utility_cut(jd))       # §9.1
    band = band_from(p, coverage, failures(scores))        # §9.2
    fairness_check(scores, session)                        # §8
    return report(band, p, scores, evidence)               # §14.3, human-in-loop
```

---

## 16. Failure modes, edge cases, scale, testing, production

- **Failure modes:** LLM miscalibration (→ ensemble + Brier recalibration); hallucinated quote (→ verification gate downweights); thin interview (→ Unknown + follow-ups, never a guessed score); prompt/model drift (→ version pinning + regression suite); adverse impact (→ fairness gate + human review); over-claimed prediction (→ validation_status labels).
- **Edge cases:** non-English (route to a validated locale model or mark Unknown), candidate refuses to answer (Unknown, not penalized as low), contradictory evidence (surface both; do not average away), extremely short/long transcripts (coverage governs).
- **Scale:** EAP over a fixed grid is O(grid×evidence) and trivially parallel; scores materialized and indexed; ensemble raters run concurrently with a concurrency cap; heavy work is idempotent and cacheable per version.
- **Testing:** unit tests on the measurement math (posterior monotonicity, coverage, band thresholds — deterministic); golden-set regression on prompts; property tests (more positive evidence never lowers θ; adding an Unknown never raises coverage); fairness simulations on synthetic subgroups.
- **Production:** every score reproducible from `(inputs, versions)`; audit log immutable; canary rollout on framework/prompt changes; SLA via cached materialized scores; PII blinding at the rating boundary.

---

## 17. How this connects to the current codebase (build sequence)

The existing pieces are the seed, not throwaway:
- `lib/expert-rubric.js` v2 (weighted composite + confidence + percentile) → **becomes the degenerate case** of §6 with one rater, no GRM, flat prior. Keep it running while the EIE lands behind it.
- `validateReport()` (quote grounding) → the **verification** step of §5.2.
- `interview_sessions` + transcript → the **event source** for §5.
- Maya/Iris personas → the thin **Presenter** of §13.

**Phased delivery (each phase shippable, each raises rigor):**
1. **Competency graph + anchors + evidence units** (tables §11, extractor + rater prompts §13). Replace per-interview invented rubric with fixed, versioned competencies. *Deliverable: evidence-linked, anchored scores.*
2. **Measurement Engine** (Bayesian θ + credible intervals + Unknown/abstain + coverage). *Deliverable: scores with honest uncertainty, no naked 1–10.*
3. **Ensemble + G-theory reliability + adversarial verify.** *Deliverable: reported reliability, calibrated raters.*
4. **Decision Engine (utility cut, 7 bands, Needs-More-Evidence) + committee report.** *Deliverable: explainable recommendations.*
5. **Fairness layer + audit export.** *Deliverable: LL144/EEOC-ready.*
6. **Outcome loop + recalibration.** *Deliverable: the compounding, criterion-validated moat.*

---

## Appendix A — Fully-worked competencies
*(Structured Problem Solving, Ownership & Bias for Action, Communication, System Design — each rendered with the full §3.3 schema including 5-level BARS anchors, indicators, evidence requirements, and role/seniority weights. Generated and human-reviewed per §3.5.)*

## Appendix B — Statistical notes
GRM (Samejima 1969); EAP estimation (Bock & Mislevy 1982); G-theory (Brennan 2001); utility cut scores (Taylor-Russell 1939; Cronbach-Gleser 1965); calibration (Brier 1950; ECE); mechanical vs holistic combination (Meehl 1954; Grove et al. 2000; Kuncel et al. 2013); robust weights (Dawes 1979); corrected operational validities (Sackett, Zhang, Berry & Lievens 2022).
