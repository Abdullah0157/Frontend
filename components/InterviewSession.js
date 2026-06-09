'use client'

import { useState } from 'react'
import InterviewExperience from './InterviewExperience'
import PermissionGate from './PermissionGate'

/**
 * Client wrapper around InterviewExperience that gates entry on camera + mic
 * permission. Used by /interview/[slug] (company-posted jobs) so candidates
 * can't bypass proctoring.
 */
export default function InterviewSession({ job, prefilledCandidate, resumeText }) {
  const [streams, setStreams] = useState(null)

  if (!streams) {
    return (
      <PermissionGate
        candidateName={prefilledCandidate?.name}
        onReady={setStreams}
        onCancel={() => window.history.back()}
      />
    )
  }

  return (
    <InterviewExperience
      job={job}
      prefilledCandidate={prefilledCandidate}
      resumeText={resumeText}
      cameraStream={streams.cameraStream}
      screenStream={streams.screenStream}
    />
  )
}
