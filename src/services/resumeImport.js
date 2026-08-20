/**
 * Parse + lightly validate an uploaded resume file.
 *
 * The upload must be a JSON resume in the same schema the app renders (the
 * profile shape: header, profileSummary, professionalExperience, …). We don't
 * hard-validate every restriction here — the canvas surfaces those as flags —
 * we just make sure it's the right *shape* and fill in identity metadata.
 */
export async function parseResumeFile(file) {
  if (!file) throw new Error('No file selected.')
  if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
    throw new Error('Please upload a .json resume (same format as the template).')
  }
  let data
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  return normalizeResume(data, file.name)
}

export function normalizeResume(data, filename = 'resume') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('A resume must be a JSON object.')
  }
  if (!data.header || typeof data.header !== 'object') {
    throw new Error('Missing "header" — this doesn’t look like a resume in the expected format.')
  }
  const hasContent =
    data.profileSummary || data.professionalExperience || data.academicProjects || data.keySkills
  if (!hasContent) {
    throw new Error('This doesn’t look like a resume in the expected format.')
  }

  const slug =
    filename.replace(/\.json$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() ||
    'resume'

  return {
    ...data,
    profileId: data.profileId || `${slug}-${Date.now().toString(36)}`,
    profileName: data.profileName || data.header?.name || slug,
    profileRole: data.profileRole || 'Uploaded',
  }
}
