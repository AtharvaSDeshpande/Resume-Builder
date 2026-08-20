import React from 'react'
import { stripMarkdown } from '../../utils/validation.js'

/** Character count against a cap (markdown stripped, matching validation). */
export function Counter({ text, max }) {
  if (!max) return null
  const len = stripMarkdown(text || '').trim().length
  const over = len > max
  return (
    <span className={`text-[11px] tabular-nums ${over ? 'font-semibold text-flag' : 'text-slate-400'}`}>
      {len}/{max}
    </span>
  )
}

const inputBase =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/20'

export function TextInput({ label, value, onChange, max, placeholder, hint }) {
  const over = max && stripMarkdown(value || '').trim().length > max
  return (
    <label className="block">
      {label && (
        <span className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">{label}</span>
          <Counter text={value} max={max} />
        </span>
      )}
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputBase} ${over ? 'border-flag/60' : 'border-slate-300'}`}
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

export function TextArea({ label, value, onChange, max, rows = 4, placeholder, hint }) {
  const over = max && stripMarkdown(value || '').trim().length > max
  return (
    <label className="block">
      {label && (
        <span className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">{label}</span>
          <Counter text={value} max={max} />
        </span>
      )}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`${inputBase} resize-y ${over ? 'border-flag/60' : 'border-slate-300'}`}
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

/**
 * Editable list of single-line strings with add / remove / reorder.
 * Used for skills, certificates, bullet points, meta lines, etc.
 */
export function ListField({
  label,
  items,
  onChange,
  maxItems,
  minItems,
  maxCharsPerItem,
  placeholder = 'Add an item…',
  addLabel = 'Add item',
  hint,
}) {
  const list = items || []
  const atMax = maxItems != null && list.length >= maxItems

  const update = (i, v) => onChange(list.map((it, idx) => (idx === i ? v : it)))
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i))
  const add = () => onChange([...list, ''])
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">{label}</span>
          <span className="text-[11px] text-slate-400">
            {list.length}
            {maxItems != null ? `/${maxItems}` : ''} items
          </span>
        </div>
      )}

      <div className="space-y-2">
        {list.map((item, i) => {
          const over = maxCharsPerItem && stripMarkdown(item || '').trim().length > maxCharsPerItem
          return (
            <div key={i} className="flex items-start gap-1.5">
              <div className="flex flex-col pt-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <Chevron up />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === list.length - 1}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <Chevron />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={item ?? ''}
                  onChange={(e) => update(i, e.target.value)}
                  placeholder={placeholder}
                  className={`${inputBase} ${over ? 'border-flag/60' : 'border-slate-300'}`}
                />
                {maxCharsPerItem && (
                  <div className="mt-0.5 pr-1 text-right">
                    <Counter text={item} max={maxCharsPerItem} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={minItems != null && list.length <= minItems}
                className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-flag/10 hover:text-flag disabled:opacity-30"
                aria-label="Remove"
                title={minItems != null && list.length <= minItems ? `Minimum ${minItems}` : 'Remove'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={add}
        disabled={atMax}
        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        + {addLabel}
      </button>
      {hint && <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

function Chevron({ up }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ transform: up ? 'rotate(180deg)' : 'none' }}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
