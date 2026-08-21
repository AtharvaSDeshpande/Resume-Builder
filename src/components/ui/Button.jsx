import React from 'react'

/**
 * The single button primitive for the whole app — keeps every action visually
 * consistent and makes new features easy to build. Variants + sizes only; no
 * bespoke button classes elsewhere.
 */
const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-dark shadow-sm',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm',
  subtle: 'bg-accent/10 text-accent hover:bg-accent/15',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'text-red-600 hover:bg-red-50',
}
const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export default function Button({ variant = 'primary', size = 'md', icon, className = '', children, ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}
