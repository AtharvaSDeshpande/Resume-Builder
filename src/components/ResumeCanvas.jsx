import React from 'react'

/**
 * Edit-trigger handlers for an editable section. Desktop uses double-click;
 * touch devices get a manual double-tap detector (mobile browsers don't fire a
 * reliable `dblclick`). A fresh closure per render keeps each section's tap
 * timer independent.
 */
function editHandlers(onEdit) {
  let lastTap = 0
  return {
    className: 'resume-editable',
    onDoubleClick: onEdit,
    onTouchEnd: (e) => {
      const now = Date.now()
      if (now - lastTap < 320) {
        e.preventDefault()
        onEdit()
      }
      lastTap = now
    },
  }
}

/* ---------------------------------------------------------------------------
 * Metrics reverse-engineered from the source PDF (measured at 96dpi, where
 * 1 PDF-point = 1.3333 CSS px). Kept here as named constants so the render
 * tree reads cleanly; the JSON design tokens mirror these values.
 * ------------------------------------------------------------------------- */
const M = {
  bodyPx: 13.3,
  bodyLh: 16,
  metaPx: 13.3,
  namePx: 26.5,
  headerPx: 20,
  subHeaderPx: 14,
  tablePx: 12,
  footerPx: 12,
  bulletGap: 9, // margin-bottom between list items
  sectionGap: 18, // margin-bottom between sections
  headerToBody: 5, // section header -> its content
}

/* ---------------------------------------------------------------------------
 * Inline markdown: only **bold** is supported (matches the template's style of
 * bolding the lead word of each bullet).
 * ------------------------------------------------------------------------- */
function RichText({ text }) {
  if (!text) return null
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  )
}

/* Diff context — lets any Flaggable highlight AI changes without prop drilling. */
const DiffContext = React.createContext({ diffMode: false, diffMarks: {} })

/* Renders a word-level diff: added words tinted, removed words struck through. */
function WordDiff({ tokens }) {
  return (
    <>
      {tokens.map((t, i) =>
        t.type === 'del' ? (
          <span key={i} className="wd-del">
            {t.text}{' '}
          </span>
        ) : (
          <span key={i} className={t.type === 'add' ? 'wd-add' : undefined}>
            {t.text}{' '}
          </span>
        )
      )}
    </>
  )
}

/* Preview-only validation indicator + optional AI-diff highlight. Both are
 * stripped in print by index.css. */
function Flaggable({ path, flags, previewMode, className = '', style, children, as: Tag = 'div' }) {
  const { diffMode, diffMarks } = React.useContext(DiffContext)
  const message = flags[path]
  const flagged = previewMode && Boolean(message)
  const mark = diffMode ? diffMarks[path] : null
  const diffClass = mark ? (mark.status === 'added' ? 'diff-added' : 'diff-changed') : ''
  const content = mark?.tokens ? <WordDiff tokens={mark.tokens} /> : children

  return (
    <Tag
      className={`${className} ${flagged ? 'flag-box' : ''} ${diffClass}`.trim()}
      style={style}
      title={flagged ? message : mark ? 'Changed by AI' : undefined}
      data-flag={flagged ? 'true' : undefined}
    >
      {content}
    </Tag>
  )
}

/* Render ordinal suffixes (12th, 10th) with a superscript, matching the PDF. */
function Ordinal({ text }) {
  const parts = String(text ?? '').split(/(\d+)(st|nd|rd|th)\b/g)
  const nodes = []
  for (let i = 0; i < parts.length; i++) {
    if (/^(st|nd|rd|th)$/.test(parts[i]) && /\d$/.test(parts[i - 1] || '')) {
      nodes.push(
        <sup key={i} style={{ fontSize: '0.7em' }}>
          {parts[i]}
        </sup>
      )
    } else if (parts[i]) {
      nodes.push(<React.Fragment key={i}>{parts[i]}</React.Fragment>)
    }
  }
  return <>{nodes}</>
}

/* Round bullet glyph matching the template. */
function Bullet({ accent }) {
  return (
    <span
      className={`shrink-0 rounded-full ${accent ? 'bg-accent' : 'bg-ink'}`}
      style={{ height: 3, width: 3, marginTop: 6.5, marginRight: 12 }}
      aria-hidden
    />
  )
}

/* The black bold uppercase section rule used across the template.
 * `inlineRule` renders the PROFILE SUMMARY variant: heading + a blue rule that
 * fills the remaining width on the SAME line, vertically centered. */
function SectionHeader({ label, gap = M.headerToBody, inlineRule = false }) {
  const heading = (
    <h2
      className={`font-heading font-bold uppercase text-ink ${inlineRule ? 'whitespace-nowrap' : ''}`}
      style={{ fontSize: M.headerPx, lineHeight: '22px', letterSpacing: '-0.2px' }}
    >
      {label}
    </h2>
  )

  if (!inlineRule) return <div style={{ marginBottom: gap }}>{heading}</div>

  return (
    <div className="flex flex-col" style={{ marginBottom: gap, gap: 12 }}>
      <div className="flex-1">
        <Divider />
      </div>
      {heading}
    </div>
  )
}

/* A single bullet row shared by every list-style section. */
function BulletRow({ children, accent }) {
  return (
    <li className="flex items-start" style={{ marginBottom: M.bulletGap, paddingLeft: 10 }}>
      <Bullet accent={accent} />
      {children}
    </li>
  )
}

/* ---------------------------------------------------------------------------
 * Section renderers keyed by `type` in restrictions.json.
 * ------------------------------------------------------------------------- */

function HeadlineSection({ data, ctx }) {
  return (
    <Flaggable
      as="p"
      path="profileSummary.summary"
      flags={ctx.flags}
      previewMode={ctx.previewMode}
      className="text-justify text-ink"
      style={{ fontSize: M.bodyPx, lineHeight: `${M.bodyLh}px` }}
    >
      <RichText text={data.summary} />
    </Flaggable>
  )
}

function ExperienceSection({ data, ctx, headingKey }) {
  const key = ctx.sectionKey
  return (
    <div>
      {(data || []).map((entry, ei) => (
        <div key={ei} style={{ marginTop: ei > 0 ? 22 : 0 }}>
          <Flaggable
            as="p"
            path={`${key}.${ei}.${headingKey === 'heading' ? 'heading' : 'title'}`}
            flags={ctx.flags}
            previewMode={ctx.previewMode}
            className={
              headingKey === 'heading'
                ? 'font-bold italic text-accent'
                : 'font-bold text-ink'
            }
            style={{
              fontSize: headingKey === 'heading' ? M.subHeaderPx : M.bodyPx,
              lineHeight: `${M.bodyLh}px`,
              marginBottom: 7,
            }}
          >
            <RichText text={entry[headingKey]} />
          </Flaggable>
          <ul>
            {(entry.bullets || []).map((b, bi) => (
              <BulletRow key={bi}>
                <Flaggable
                  as="span"
                  path={`${key}.${ei}.bullets.${bi}`}
                  flags={ctx.flags}
                  previewMode={ctx.previewMode}
                  className="text-ink"
                  style={{ fontSize: M.bodyPx, lineHeight: `${M.bodyLh}px` }}
                >
                  <RichText text={b} />
                </Flaggable>
              </BulletRow>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function TableSection({ data, cfg, ctx }) {
  return (
    <table className="w-full border-collapse text-ink" style={{ fontSize: M.tablePx, lineHeight: '15px' }}>
      <thead>
        <tr>
          {cfg.columns.map((col, i) => (
            <th key={i} className="border border-ink px-[4px] py-[3px] text-center font-bold">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(data || []).map((row, ri) => (
          <tr key={ri}>
            {['degree', 'institute', 'score', 'year'].map((cellKey) => (
              <Flaggable
                key={cellKey}
                as="td"
                path={`qualifications.${ri}.${cellKey}`}
                flags={ctx.flags}
                previewMode={ctx.previewMode}
                className="border border-ink px-[4px] py-[5px] text-center align-middle"
              >
                {cellKey === 'degree' ? <Ordinal text={row[cellKey]} /> : row[cellKey]}
              </Flaggable>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BulletsSection({ data, cfg, ctx }) {
  const accent = cfg.variant === 'accent'
  return (
    <ul>
      {(data || []).map((item, i) => (
        <BulletRow key={i} accent={accent}>
          <Flaggable
            as="span"
            path={`${ctx.sectionKey}.${i}`}
            flags={ctx.flags}
            previewMode={ctx.previewMode}
            className={accent ? 'font-bold uppercase text-accent' : 'text-ink'}
            style={{ fontSize: M.bodyPx, lineHeight: `${M.bodyLh}px` }}
          >
            <RichText text={item} />
          </Flaggable>
        </BulletRow>
      ))}
    </ul>
  )
}

/* Dispatch a single section by its restriction `type`. */
function Section({ sectionKey, restrictions, profile, ctx }) {
  const cfg = restrictions.sections[sectionKey]
  if (!cfg) return null
  const data = profile[sectionKey]
  const localCtx = { ...ctx, sectionKey }

  let body = null
  switch (cfg.type) {
    case 'headline':
      body = <HeadlineSection data={data} ctx={localCtx} />
      break
    case 'experience':
      body = <ExperienceSection data={data} ctx={localCtx} headingKey="heading" />
      break
    case 'projects':
      body = <ExperienceSection data={data} ctx={localCtx} headingKey="title" />
      break
    case 'table':
      body = <TableSection data={data} cfg={cfg} ctx={localCtx} />
      break
    case 'bullets':
      body = <BulletsSection data={data} cfg={cfg} ctx={localCtx} />
      break
    default:
      body = null
  }

  // Left-column sections (experience/projects/table) sit lower under their
  // header than the tight right-column bullet lists, mirroring the PDF.
  const headerGap = cfg.type === 'headline' ? 6 : cfg.type === 'bullets' ? M.headerToBody : 11

  const edit = ctx.editable
    ? { title: `Double-click or double-tap to edit ${cfg.label || sectionKey}`, ...editHandlers(() => ctx.onEditSection(sectionKey)) }
    : {}

  return (
    <section style={{ marginBottom: M.sectionGap }} {...edit}>
      {cfg.label && (
        <SectionHeader label={cfg.label} gap={headerGap} inlineRule={cfg.type === 'headline'} />
      )}
      {body}
    </section>
  )
}

/* Blue gradient divider used under the header and above the footer. */
function Divider() {
  return (
    <div
      className="w-full bg-gradient-to-r from-accent-light via-accent to-accent-dark"
      style={{ height: 2.5 }}
    />
  )
}

/* ---------------------------------------------------------------------------
 * The full A4 sheet.
 * ------------------------------------------------------------------------- */
export default function ResumeCanvas({
  profile,
  restrictions,
  flags,
  previewMode,
  editable = false,
  onEditSection,
  diffMode = false,
  diffMarks = {},
}) {
  const ctx = { flags, previewMode, editable, onEditSection }
  const { left, right } = restrictions.layout.columns
  const { columnWidthMm } = restrictions.layout

  const editProps = (sectionKey, label) =>
    editable ? { title: `Double-click or double-tap to edit ${label}`, ...editHandlers(() => onEditSection(sectionKey)) } : {}

  return (
    <DiffContext.Provider value={{ diffMode, diffMarks }}>
    <div className="a4-sheet shadow-xl font-body">
      {/* ---------------- HEADER ---------------- */}
      <header style={{ marginBottom: 9 }} {...editProps('header', 'header & name')}>
        <div className="flex items-start justify-between">
          {/* meta */}
          <Flaggable
            as="div"
            path="header.meta"
            flags={flags}
            previewMode={previewMode}
            className="italic text-ink"
            style={{ width: 252, fontSize: 13, lineHeight: '17px' }}
          >
            {(profile.header.meta || []).map((line, i) => (
              <Flaggable
                key={i}
                as="div"
                path={`header.meta.${i}`}
                flags={flags}
                previewMode={previewMode}
              >
                {line.startsWith('Portfolio Link:') ? (
                  <span>
                    Portfolio Link:{' '}
                    <span className="text-accent underline">
                      {line.replace('Portfolio Link:', '').trim()}
                    </span>
                  </span>
                ) : (
                  line
                )}
              </Flaggable>
            ))}
          </Flaggable>

          {/* name */}
          <Flaggable
            as="h1"
            path="header.name"
            flags={flags}
            previewMode={previewMode}
            className="flex-1 whitespace-nowrap text-center font-bold text-ink"
            style={{ fontSize: M.namePx, lineHeight: '28px', paddingTop: 2 }}
          >
            {profile.header.name}
          </Flaggable>

          {/* logo */}
          <div className="flex justify-end" style={{ width: 110 }}>
            <img
              src="/glim.webp"
              alt="Great Lakes Chennai"
              style={{ height: 54, width: 'auto', objectFit: 'contain' }}
            />
          </div>
        </div>
      </header>

      {/* ---------------- FULL-WIDTH TOP SECTIONS ---------------- */}
      <Section sectionKey="profileSummary" restrictions={restrictions} profile={profile} ctx={ctx} />

      {/* ---------------- TWO-COLUMN BODY ---------------- */}
      <div className="flex justify-between">
        <div style={{ width: `${columnWidthMm.left}mm` }}>
          {left.map((key) => (
            <Section key={key} sectionKey={key} restrictions={restrictions} profile={profile} ctx={ctx} />
          ))}
        </div>
        <div style={{ width: `${columnWidthMm.right}mm` }}>
          {right.map((key) => (
            <Section key={key} sectionKey={key} restrictions={restrictions} profile={profile} ctx={ctx} />
          ))}
        </div>
      </div>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="absolute" style={{ left: '7.5mm', right: '9.7mm', bottom: '5mm' }} {...editProps('footer', 'footer')}>
        <Divider />
        <div
          className="flex items-center justify-between text-ink"
          style={{ marginTop: 3, fontSize: M.footerPx }}
        >
          <span>{profile.footer?.left}</span>
          <span className="italic">{profile.footer?.right}</span>
        </div>
      </footer>
    </div>
    </DiffContext.Provider>
  )
}
