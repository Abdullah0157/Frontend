'use client'

import { useState } from 'react'
import InterviewExperience from './InterviewExperience'
import PermissionGate from './PermissionGate'
import { enterFullscreen } from './InterviewFocus'

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
        onReady={(s) => {
          enterFullscreen() // still inside the "Begin Interview" click
          // VoiceChat uses Web Speech API for mic independently — release the test stream
          s.micStream?.getTracks().forEach((t) => t.stop())
          setStreams(s)
        }}
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
