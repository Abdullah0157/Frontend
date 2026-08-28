// Single source of truth for how long an expert interview runs.
//
// The duration was configurable but the words weren't: six user-facing strings
// hardcoded "30 minutes", so setting NEXT_PUBLIC_INTERVIEW_MINUTES=5 produced a
// 5-minute interview that still told the candidate it would take 30. Anything
// that mentions the length should import from here.
export const INTERVIEW_MINUTES = Number(process.env.NEXT_PUBLIC_INTERVIEW_MINUTES) || 30
export const INTERVIEW_DURATION_S = INTERVIEW_MINUTES * 60

// "5-minute" / "30-minute"
export const interviewLengthLabel = `${INTERVIEW_MINUTES}-minute`
// "5 minutes" / "30 minutes"
export const interviewLengthWords = `${INTERVIEW_MINUTES} minutes`
