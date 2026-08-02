"""Adaptive Assessment Engine — real IRT computerized adaptive testing (CAT).

Selects each next item to MAXIMIZE Fisher information at the candidate's current
ability estimate (not "harder if right"), re-estimates θ by Bayesian EAP after
every response, and STOPS when the measurement is precise enough (θ SE below a
threshold), content is covered, or a length cap is hit. Fewer, better-targeted
items → the same precision in less time. Greenfield; verified by properties.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from domain.assessment.irt import Ability, Item, eap_estimate, item_information


def select_next_item(theta: float, pool: list[Item], administered_ids: set[str]) -> Item | None:
    """Pick the unadministered item with maximum Fisher information at θ."""
    candidates = [it for it in pool if it.id not in administered_ids]
    if not candidates:
        return None
    return max(candidates, key=lambda it: item_information(theta, it))


@dataclass
class StoppingConfig:
    max_se: float = 0.32        # target precision (≈ reliability 0.90)
    min_items: int = 4          # never conclude on too little
    max_items: int = 30         # hard cap on length
    min_skills: int = 0         # optional content-coverage floor (distinct skills)


@dataclass
class AdaptiveSession:
    """A live adaptive test. Drive it: next_item() → record(item, correct) → repeat."""
    pool: list[Item]
    config: StoppingConfig = field(default_factory=StoppingConfig)
    prior_mean: float = 0.0
    prior_sd: float = 1.0
    responses: list[tuple[Item, int]] = field(default_factory=list)
    administered_ids: set[str] = field(default_factory=set)
    ability: Ability = field(default=None)  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.ability is None:
            self.ability = eap_estimate([], self.prior_mean, self.prior_sd)

    @property
    def n_administered(self) -> int:
        return len(self.responses)

    @property
    def skills_covered(self) -> set[str]:
        return {it.skill for it, _ in self.responses if it.skill}

    def is_done(self) -> bool:
        n = self.n_administered
        if n < self.config.min_items:
            return False
        if n >= self.config.max_items:
            return True
        if self.config.min_skills and len(self.skills_covered) < self.config.min_skills:
            return False
        if not [it for it in self.pool if it.id not in self.administered_ids]:
            return True  # pool exhausted
        return self.ability.se <= self.config.max_se

    def next_item(self) -> Item | None:
        """The next item to administer, or None when the test is complete."""
        if self.is_done():
            return None
        return select_next_item(self.ability.theta, self.pool, self.administered_ids)

    def record(self, item: Item, correct: bool) -> Ability:
        """Record a response and re-estimate ability (EAP). Returns the new ability."""
        self.responses.append((item, 1 if correct else 0))
        self.administered_ids.add(item.id)
        self.ability = eap_estimate(self.responses, self.prior_mean, self.prior_sd)
        return self.ability

    def report(self) -> dict:
        return {
            "theta": self.ability.theta,
            "se": self.ability.se,
            "reliability": self.ability.reliability,
            "percentile": self.ability.percentile,
            "items_administered": self.n_administered,
            "skills_covered": sorted(self.skills_covered),
            "done": self.is_done(),
        }
