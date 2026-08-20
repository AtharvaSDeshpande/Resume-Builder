import { generateJSONFromParts } from './gemini.js'
import { normalizeResume } from '../services/resumeImport.js'

/**
 * Convert a resume PDF (in the known one-page template) into the profile JSON
 * schema, using Gemini via Firebase AI Logic. The PDF is sent inline so the
 * model sees the real layout — no fragile client-side PDF text parsing.
 *
 * Extraction is faithful: content is transcribed, never invented, summarised,
 * or trimmed to fit restrictions (the canvas flags any overflow afterwards).
 */

// The exact target shape. Kept explicit so the model maps sections precisely.
const SCHEMA_SKELETON = {
  header: { name: '', meta: ['', '', ''], logo: { line1: 'GREAT', line2: 'LAKES', line3: 'CHENNAI' } },
  profileSummary: { summary: '' },
  professionalExperience: [{ heading: '', bullets: [''] }],
  academicProjects: [{ title: '', bullets: [''] }],
  qualifications: [{ degree: '', institute: '', score: '', year: '' }],
  keySkills: [''],
  certificates: [''],
  awards: [''],
  positionsOfResponsibility: [''],
  extraCurriculars: [''],
  languages: [''],
  footer: { left: '', right: '' },
}

function buildSystem() {
  return [
    'You extract a resume from a PDF into a STRICT JSON object with a fixed schema.',
    'The PDF uses a known single-page, two-column template. Transcribe the REAL content faithfully:',
    '  • Do NOT invent, summarise, translate, reorder, or omit anything.',
    '  • Copy text verbatim (fix only obvious PDF artefacts like hyphenation splits and stray line breaks).',
    '  • Each bullet point becomes its own array item. Each qualifications table row becomes one object.',
    '  • The header "meta" is the small italic lines at the top-left (age/gender, experience, portfolio link), in order.',
    '  • If a lead word or phrase in a bullet (or one skill in the summary) is bold, wrap it in **double asterisks**.',
    '  • Leave "header.logo" as the default GREAT/LAKES/CHENNAI object.',
    '  • If a section is absent in the PDF, use an empty array (or empty string).',
    'Output ONLY the JSON object — no markdown, no commentary.',
  ].join('\n')
}

function buildInstruction() {
  return [
    'Extract the attached resume PDF into exactly this JSON shape (same keys and nesting):',
    JSON.stringify(SCHEMA_SKELETON, null, 2),
    '',
    'Section-header → key mapping: PROFILE SUMMARY→profileSummary, PROFESSIONAL EXPERIENCE→professionalExperience',
    '(heading = the "Title | Company | Dates" line), ACADEMIC PROJECTS→academicProjects (title = the project name line),',
    'QUALIFICATIONS→qualifications (table rows), KEY SKILLS→keySkills, CERTIFICATES→certificates,',
    'AWARDS & ACHIEVEMENTS→awards, POSITIONS OF RESPONSIBILITY→positionsOfResponsibility,',
    'EXTRA-CURRICULARS→extraCurriculars, LANGUAGES→languages. The centered name → header.name;',
    'the bottom-left/right small text → footer.left / footer.right.',
    '',
    'Return the JSON now.',
  ].join('\n')
}

/** Encode a File as base64 (chunked to avoid call-stack limits on big files). */
async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** @returns {Promise<object>} a normalized profile ready to save. */
export async function extractResumeFromPdf(file) {
  const data = await fileToBase64(file)
  const parts = [
    { inlineData: { mimeType: 'application/pdf', data } },
    { text: buildInstruction() },
  ]
  const raw = await generateJSONFromParts({ system: buildSystem(), parts })
  const profile = raw?.profile && typeof raw.profile === 'object' ? raw.profile : raw
  return normalizeResume(profile, file.name)
}
