import React, { useEffect, useRef, useState } from 'react'

// A4 at 96dpi in CSS px (210mm × 297mm).
const SHEET_W = 793.7
const SHEET_H = 1122.5

/**
 * Scales the A4 sheet down to fit narrow viewports (never up past 1:1), keeping
 * the résumé pixel-identical — just zoomed. Print CSS neutralises the transform
 * so paper output stays true size.
 */
export default function ResumeStage({ children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setScale(Math.min(1, el.clientWidth / SHEET_W))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className="resume-stage">
      <div style={{ width: SHEET_W * scale, height: SHEET_H * scale, margin: '0 auto' }}>
        <div
          style={{
            width: SHEET_W,
            height: SHEET_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
