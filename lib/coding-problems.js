// Curated coding-assessment problem bank, four difficulty tiers.
// Test cases are hand-authored so they are ALWAYS valid and executable — no
// dependence on an LLM to invent runnable tests (which is unreliable). Each
// problem targets a JS function by name; the runner calls fn(...args) and
// deep-compares the return value to `expected`.

export const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', blurb: 'Warm-up · fundamentals', accent: 'emerald' },
  { key: 'medium', label: 'Medium', blurb: 'Core problem solving', accent: 'blue' },
  { key: 'hard', label: 'Hard', blurb: 'Algorithms & edge cases', accent: 'amber' },
  { key: 'expert', label: 'Expert', blurb: 'Dynamic programming', accent: 'purple' },
]

export const PROBLEMS = [
  // ── EASY ────────────────────────────────────────────────────────────────
  {
    id: 'sum-array',
    difficulty: 'easy',
    title: 'Sum of an Array',
    fn: 'sumArray',
    timeLimitMs: 2000,
    description:
      'Given an array of integers `nums`, return the sum of all its elements. Return 0 for an empty array.',
    examples: [
      { input: 'nums = [1, 2, 3, 4]', output: '10' },
      { input: 'nums = [-5, 5]', output: '0' },
    ],
    constraints: ['0 ≤ nums.length ≤ 10⁴', '-1000 ≤ nums[i] ≤ 1000'],
    starterCode: 'function sumArray(nums) {\n  // your code here\n}\n',
    tests: [
      { args: [[1, 2, 3, 4]], expected: 10 },
      { args: [[-5, 5]], expected: 0 },
      { args: [[]], expected: 0, hidden: true },
      { args: [[100, 200, 300]], expected: 600, hidden: true },
      { args: [[-1, -2, -3]], expected: -6, hidden: true },
    ],
  },
  {
    id: 'reverse-string',
    difficulty: 'easy',
    title: 'Reverse a String',
    fn: 'reverseString',
    timeLimitMs: 2000,
    description:
      'Given a string `s`, return the string reversed. Do not use any built-in reverse helper in a single call — but any working solution passes the tests.',
    examples: [
      { input: 's = "hello"', output: '"olleh"' },
      { input: 's = "JobStream"', output: '"maertSboJ"' },
    ],
    constraints: ['0 ≤ s.length ≤ 10⁴'],
    starterCode: 'function reverseString(s) {\n  // your code here\n}\n',
    tests: [
      { args: ['hello'], expected: 'olleh' },
      { args: ['JobStream'], expected: 'maertSboJ' },
      { args: [''], expected: '', hidden: true },
      { args: ['a'], expected: 'a', hidden: true },
      { args: ['racecar'], expected: 'racecar', hidden: true },
    ],
  },

  // ── MEDIUM ──────────────────────────────────────────────────────────────
  {
    id: 'two-sum',
    difficulty: 'medium',
    title: 'Two Sum',
    fn: 'twoSum',
    timeLimitMs: 2000,
    description:
      'Given an array of integers `nums` and an integer `target`, return the indices `[i, j]` (i < j) of the two numbers that add up to `target`. Exactly one solution exists.',
    examples: [
      { input: 'nums = [2, 7, 11, 15], target = 9', output: '[0, 1]' },
      { input: 'nums = [3, 2, 4], target = 6', output: '[1, 2]' },
    ],
    constraints: ['2 ≤ nums.length ≤ 10⁴', 'Exactly one valid answer exists'],
    starterCode: 'function twoSum(nums, target) {\n  // return [i, j]\n}\n',
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1], hidden: true },
      { args: [[1, 5, 3, 8, 2], 10], expected: [1, 2], hidden: true },
      { args: [[-3, 4, 3, 90], 0], expected: [0, 2], hidden: true },
    ],
  },
  {
    id: 'valid-parens',
    difficulty: 'medium',
    title: 'Valid Parentheses',
    fn: 'isValid',
    timeLimitMs: 2000,
    description:
      'Given a string `s` containing just the characters `()[]{}`, return `true` if every bracket is closed by the matching type in the correct order, else `false`.',
    examples: [
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
    ],
    constraints: ['1 ≤ s.length ≤ 10⁴', 's consists only of ()[]{}'],
    starterCode: 'function isValid(s) {\n  // return true or false\n}\n',
    tests: [
      { args: ['()[]{}'], expected: true },
      { args: ['(]'], expected: false },
      { args: ['([{}])'], expected: true, hidden: true },
      { args: ['(('], expected: false, hidden: true },
      { args: ['){'], expected: false, hidden: true },
    ],
  },

  // ── HARD ────────────────────────────────────────────────────────────────
  {
    id: 'longest-substring',
    difficulty: 'hard',
    title: 'Longest Substring Without Repeating Characters',
    fn: 'lengthOfLongestSubstring',
    timeLimitMs: 3000,
    description:
      'Given a string `s`, return the length of the longest substring without repeating characters.',
    examples: [
      { input: 's = "abcabcbb"', output: '3  ("abc")' },
      { input: 's = "bbbbb"', output: '1  ("b")' },
    ],
    constraints: ['0 ≤ s.length ≤ 5·10⁴'],
    starterCode: 'function lengthOfLongestSubstring(s) {\n  // return a number\n}\n',
    tests: [
      { args: ['abcabcbb'], expected: 3 },
      { args: ['bbbbb'], expected: 1 },
      { args: ['pwwkew'], expected: 3, hidden: true },
      { args: [''], expected: 0, hidden: true },
      { args: ['dvdf'], expected: 3, hidden: true },
      { args: ['abba'], expected: 2, hidden: true },
    ],
  },
  {
    id: 'merge-intervals',
    difficulty: 'hard',
    title: 'Merge Intervals',
    fn: 'merge',
    timeLimitMs: 3000,
    description:
      'Given an array of `intervals` where intervals[i] = [start, end], merge all overlapping intervals and return the merged intervals sorted by start.',
    examples: [
      { input: '[[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' },
      { input: '[[1,4],[4,5]]', output: '[[1,5]]' },
    ],
    constraints: ['1 ≤ intervals.length ≤ 10⁴', 'intervals[i].length == 2'],
    starterCode: 'function merge(intervals) {\n  // return merged intervals\n}\n',
    tests: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { args: [[[1, 4], [0, 4]]], expected: [[0, 4]], hidden: true },
      { args: [[[1, 4], [2, 3]]], expected: [[1, 4]], hidden: true },
      { args: [[[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]], expected: [[1, 10]], hidden: true },
    ],
  },

  // ── EXPERT ──────────────────────────────────────────────────────────────
  {
    id: 'coin-change',
    difficulty: 'expert',
    title: 'Coin Change',
    fn: 'coinChange',
    timeLimitMs: 4000,
    description:
      'Given an array of coin denominations `coins` and an integer `amount`, return the fewest number of coins needed to make up that amount. If it cannot be made, return -1. You have an infinite supply of each coin.',
    examples: [
      { input: 'coins = [1,2,5], amount = 11', output: '3  (5+5+1)' },
      { input: 'coins = [2], amount = 3', output: '-1' },
    ],
    constraints: ['1 ≤ coins.length ≤ 12', '0 ≤ amount ≤ 10⁴'],
    starterCode: 'function coinChange(coins, amount) {\n  // return fewest coins or -1\n}\n',
    tests: [
      { args: [[1, 2, 5], 11], expected: 3 },
      { args: [[2], 3], expected: -1 },
      { args: [[1], 0], expected: 0, hidden: true },
      { args: [[1, 2, 5], 100], expected: 20, hidden: true },
      { args: [[186, 419, 83, 408], 6249], expected: 20, hidden: true },
    ],
  },
  {
    id: 'edit-distance',
    difficulty: 'expert',
    title: 'Edit Distance',
    fn: 'minDistance',
    timeLimitMs: 4000,
    description:
      'Given two strings `word1` and `word2`, return the minimum number of operations (insert, delete, or replace a character) required to convert `word1` into `word2`.',
    examples: [
      { input: 'word1 = "horse", word2 = "ros"', output: '3' },
      { input: 'word1 = "intention", word2 = "execution"', output: '5' },
    ],
    constraints: ['0 ≤ word1.length, word2.length ≤ 500'],
    starterCode: 'function minDistance(word1, word2) {\n  // return a number\n}\n',
    tests: [
      { args: ['horse', 'ros'], expected: 3 },
      { args: ['intention', 'execution'], expected: 5 },
      { args: ['', 'abc'], expected: 3, hidden: true },
      { args: ['abc', 'abc'], expected: 0, hidden: true },
      { args: ['sunday', 'saturday'], expected: 3, hidden: true },
    ],
  },
]

export function problemsByDifficulty(difficulty) {
  return PROBLEMS.filter((p) => p.difficulty === difficulty)
}

export function getProblem(id) {
  return PROBLEMS.find((p) => p.id === id) || null
}

// Public shape (no hidden test expectations leaked to the client problem panel;
// hidden tests still run, but their args/expected aren't shown to the candidate).
export function publicProblem(p) {
  if (!p) return null
  return {
    id: p.id,
    difficulty: p.difficulty,
    title: p.title,
    fn: p.fn,
    timeLimitMs: p.timeLimitMs,
    description: p.description,
    examples: p.examples,
    constraints: p.constraints,
    starterCode: p.starterCode,
    // sample (visible) tests only — hidden ones are withheld
    sampleTests: p.tests.filter((t) => !t.hidden).map((t) => ({ args: t.args, expected: t.expected })),
    totalTests: p.tests.length,
  }
}
