/**
 * ============================================================================
 *  AGENT PROMPTS — a "career war-room" of specialists
 * ============================================================================
 *
 * Each builder returns { system, prompt } and locks the model to a strict JSON
 * schema. Shared design principles (senior prompt-engineering):
 *   • One clear role + objective; the north-star is ALWAYS "maximise the
 *     candidate's chance of getting hired for THIS role at THIS company".
 *   • Ground every claim: use provided context (JD, résumé) and, where enabled,
 *     live web search. Never fabricate facts, dates, or metrics.
 *   • Output ONLY the JSON object described — no prose, no markdown fences.
 *   • Be specific and actionable over generic; prioritise by impact.
 */

const JSON_ONLY = 'Respond with a SINGLE JSON object and nothing else — no prose, no markdown, no code fences.'

/** Compact résumé so prompts stay small but personalised. */
function resumeDigest(profile) {
  if (!profile || typeof profile !== 'object') return {}
  return {
    summary: profile.profileSummary?.summary,
    skills: profile.keySkills,
    experience: (profile.professionalExperience || []).map((e) => e.heading),
    projects: (profile.academicProjects || []).map((p) => p.title),
    education: (profile.qualifications || []).map((q) => `${q.degree} — ${q.institute}`),
  }
}

function contextBlock({ company, jobDescription, requirements, profile }) {
  return [
    '===== TARGET COMPANY =====',
    company || '(not specified)',
    '',
    '===== JOB DESCRIPTION =====',
    (jobDescription || '').trim(),
    '',
    '===== PARSED JD REQUIREMENTS =====',
    JSON.stringify(requirements || {}, null, 2),
    '',
    '===== CANDIDATE RÉSUMÉ (digest) =====',
    JSON.stringify(resumeDigest(profile), null, 2),
  ].join('\n')
}

/* ------------------------------------------------ 1. Company Intel (grounded) */
export function buildCompanyIntelPrompt(input) {
  const system = [
    'You are an elite company-research analyst who prepares candidates to walk into an interview sounding genuinely informed.',
    'Use web search to gather CURRENT, factual information about the specific target company — its site, products, news, and market position — filtered to what matters for the candidate’s target role.',
    'Accuracy over completeness: if something is unknown or unverifiable, omit it rather than guess. Never invent facts, figures, or dates.',
    'Every field must help the candidate impress this employer for THIS role.',
    JSON_ONLY,
    'Schema:',
    JSON.stringify(
      {
        company: 'string',
        oneLiner: 'what the company does, in one crisp line',
        overview: '2–3 sentence overview',
        products: [{ name: 'string', description: 'what it is / who it serves' }],
        businessModel: 'how they make money',
        differentiators: ['what sets them apart from competitors'],
        recentDevelopments: ['notable recent news/launches/funding, most recent first'],
        roleRelevance: ['how the company’s work connects to the candidate’s target role'],
        cultureAndValues: ['stated values / what they look for in people'],
        talkingPoints: ['specific, researched points to raise that show homework'],
        questionsToAsk: ['thoughtful questions the candidate can ask the interviewer'],
      },
      null,
      2
    ),
  ].join('\n')
  return { system, prompt: contextBlock(input) + '\n\nProduce the JSON now.' }
}

/* ------------------------------------------ 2. Placement Buddy (personalised) */
export function buildPlacementBuddyPrompt(input) {
  const system = [
    'You are a seasoned placement mentor and industry insider who has hired for this exact kind of role for years.',
    'Give the candidate honest, personalised, high-leverage guidance to maximise their chance of getting hired — grounded in THEIR résumé (real strengths and gaps) and THIS job description.',
    'Be a candid buddy: name the real gap, then give a concrete plan to close it. Prefer specific topics, projects, and phrasing over generic advice.',
    'Résumé advice must be truthful — suggest reframing/adding only what the candidate can legitimately support; never fabricate experience.',
    JSON_ONLY,
    'Schema:',
    JSON.stringify(
      {
        roleFraming: 'the role + industry, framed for this candidate',
        verdict: 'honest read of current fit and the single biggest gap to close',
        mustKnow: ['core concepts/skills the candidate must be solid on'],
        roadmap: [
          { phase: 'e.g. Foundations / Core / Advanced', goal: 'string', topics: ['string'], resources: ['concrete resources'] },
        ],
        projectIdeas: [
          { title: 'string', description: 'string', skills: ['skills it proves'], resumeBullet: 'a ready-to-use résumé bullet (action + task + metric)' },
        ],
        resumeAdvice: [{ section: 'résumé section', change: 'specific change', why: 'why it helps for this role' }],
        interview: { focusAreas: ['string'], likelyQuestions: ['likely interview questions'], tips: ['actionable tips'] },
        next7Days: ['prioritised concrete actions for the next 7 days'],
      },
      null,
      2
    ),
  ].join('\n')
  return { system, prompt: contextBlock(input) + '\n\nProduce the JSON now.' }
}

/** Infer a compact news-search query from the company + role/JD. */
export function inferIndustryQuery({ company, jobDescription, requirements } = {}) {
  const role = requirements?.role || requirements?.title || ''
  const industry = requirements?.industry || ''
  const parts = [company, industry || role].filter(Boolean)
  if (parts.length) return parts.join(' ')
  // Last resort: first strong noun-ish words from the JD.
  const jd = (jobDescription || '').replace(/\s+/g, ' ').trim()
  return jd.split(' ').slice(0, 6).join(' ') || 'technology industry'
}

/* -------------------------- 3a. Industry News — summarise REAL fetched items */
export function buildIndustryNewsSummaryPrompt({ input, query, items }) {
  const today = new Date().toISOString().slice(0, 10)
  const feed = items
    .map((it, i) => `${i + 1}. [${it.date}] ${it.title} (${it.source || 'source'}) — ${it.url}`)
    .join('\n')
  const system = [
    `You are a business-news analyst preparing a candidate for an interview. Today is ${today}.`,
    'You are given REAL, recent news headlines (already fetched from a news feed) for the target industry/company.',
    'Summarise ONLY these items — do NOT invent stories, headlines, dates, or outlets. Use each item’s given date.',
    'For each, write a short plain-English abstract a non-expert can grasp, and explain the impact + why it matters for someone interviewing for this role.',
    JSON_ONLY,
    'Schema:',
    JSON.stringify(
      {
        industry: 'the industry inferred from the role/company',
        asOf: today,
        articles: [{ headline: 'string (match the source headline)', date: 'YYYY-MM-DD', summary: 'simple 1–3 sentence abstract', impact: 'why it matters / likely impact' }],
        themes: ['cross-cutting themes across the stories'],
        interviewAngles: ['how the candidate can reference these to impress'],
      },
      null,
      2
    ),
  ].join('\n')
  const prompt = [
    contextBlock(input),
    '',
    `===== REAL RECENT HEADLINES (search: "${query}") =====`,
    feed,
    '',
    'Summarise these into the JSON schema now.',
  ].join('\n')
  return { system, prompt }
}

/* -------------------------------------------- 3. Industry News (grounded, 7d) */
export function buildIndustryNewsPrompt(input) {
  const today = new Date().toISOString().slice(0, 10)
  const system = [
    `You are a business-news analyst. Today is ${today}.`,
    'Use web search to find the most significant developments from the LAST 7 DAYS in the industry relevant to this role/company. Strongly prefer items dated within the last 7 days; if genuinely nothing qualifies, include the most recent notable items and say so via their dates.',
    'Summarise each into a short, plain-English abstract a non-expert can grasp, and explain its impact and why it matters for someone interviewing for this role.',
    'Only include real, verifiable stories. Never fabricate headlines, dates, or outlets.',
    JSON_ONLY,
    'Schema:',
    JSON.stringify(
      {
        industry: 'the industry inferred from the role/company',
        asOf: today,
        articles: [
          { headline: 'string', date: 'YYYY-MM-DD', summary: 'simple 1–3 sentence abstract', impact: 'why it matters / likely impact' },
        ],
        themes: ['cross-cutting themes across the stories'],
        interviewAngles: ['how the candidate can reference these to impress'],
      },
      null,
      2
    ),
  ].join('\n')
  return { system, prompt: contextBlock(input) + '\n\nProduce the JSON now.' }
}
