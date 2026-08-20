/**
 * Agent-stage prompts. The main *tailoring* prompt is reused from the shared
 * governing module (src/ai/resumeCustomization.js); these add the two stages
 * that make the agent quality-focused: JD understanding and self-critique.
 */

/** Stage 1 — turn a raw JD into structured requirements the tailor can target. */
export function buildJdParsePrompt(jobDescription) {
  return [
    'Extract structured hiring requirements from the JOB DESCRIPTION below.',
    'Return ONLY this JSON (no prose):',
    '{',
    '  "role": <target job title>,',
    '  "seniority": <e.g. entry / mid / senior / lead>,',
    '  "domain": <industry or function>,',
    '  "mustHaveSkills": [<the non-negotiable skills/competencies>],',
    '  "niceToHaveSkills": [<preferred but optional>],',
    '  "keywords": [<ATS keywords a recruiter scans for — 8 to 15>],',
    '  "responsibilities": [<the core things this role does — 3 to 6>]',
    '}',
    '',
    '===== JOB DESCRIPTION =====',
    (jobDescription || '').trim(),
  ].join('\n')
}

/**
 * Stage 3 — grade the tailored resume against the JD + GLIM guidelines, and say
 * concretely how to improve it. Drives the targeted improvement loop.
 */
export function buildCritiquePrompt({ tailoredProfile, jobDescription, requirements, restrictionsGuidelines }) {
  return [
    'You are a strict placement-committee reviewer. Grade the TAILORED RESUME for this JOB.',
    'Judge on: (a) relevance to the JD requirements, (b) keyword coverage, (c) adherence to the GLIM writing guidelines (action-verb + quantified-impact bullets, crisp JD-relevant summary, no fluff), and (d) truthfulness (it must not claim more than the base résumé supports).',
    '',
    'Return ONLY this JSON (no prose):',
    '{',
    '  "score": <integer 0-100 overall fit-and-quality>,',
    '  "jdCoverage": { "covered": [<JD keywords/skills clearly present>], "missing": [<JD keywords/skills absent that the candidate could truthfully claim>] },',
    '  "weaknesses": [<short, specific problems>],',
    '  "suggestions": [ { "section": <resume section key>, "issue": <what is weak>, "fix": <concrete, truthful change> } ]',
    '}',
    'Only suggest changes the candidate can support from their real experience. Do NOT invent facts.',
    '',
    '===== JOB DESCRIPTION =====',
    (jobDescription || '').trim(),
    '',
    '===== JD REQUIREMENTS (parsed) =====',
    JSON.stringify(requirements, null, 2),
    '',
    '===== GLIM GUIDELINES (summary) =====',
    JSON.stringify(restrictionsGuidelines, null, 2),
    '',
    '===== TAILORED RESUME =====',
    JSON.stringify(tailoredProfile, null, 2),
  ].join('\n')
}

/**
 * Stage 4 — apply the critique's suggestions to the resume, staying truthful and
 * within limits. Reuses the base résumé as ground truth.
 */
export function buildImprovePrompt({ baseResume, tailoredProfile, suggestions, missingKeywords, restrictions }) {
  return [
    'Improve the TAILORED RESUME using the REVIEW SUGGESTIONS, while keeping every claim truthful to the BASE RESUME and every limit in RESTRICTIONS.',
    'Weave in any MISSING KEYWORDS only where they accurately describe real experience. Keep the same JSON shape as the tailored resume.',
    '',
    'Return ONLY this JSON: { "profile": <improved resume>, "changeLog": [ { "section": <string>, "change": <string>, "rationale": <string> } ] }',
    '',
    '===== REVIEW SUGGESTIONS =====',
    JSON.stringify(suggestions, null, 2),
    '',
    '===== MISSING KEYWORDS =====',
    JSON.stringify(missingKeywords || [], null, 2),
    '',
    '===== RESTRICTIONS (limits) =====',
    JSON.stringify(restrictions, null, 2),
    '',
    '===== BASE RESUME (ground truth) =====',
    JSON.stringify(baseResume, null, 2),
    '',
    '===== TAILORED RESUME (to improve) =====',
    JSON.stringify(tailoredProfile, null, 2),
  ].join('\n')
}
