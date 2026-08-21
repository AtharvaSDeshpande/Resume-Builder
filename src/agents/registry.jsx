import React from 'react'
import CompanyIntelView from '../components/agents/CompanyIntelView.jsx'
import PlacementBuddyView from '../components/agents/PlacementBuddyView.jsx'
import IndustryNewsView from '../components/agents/IndustryNewsView.jsx'

/**
 * Front-end agent registry — the single place that declares the career-prep
 * agents. Adding a new agent = one entry here (id must match the backend
 * registry) + a View component. It drives the position tabs, routes, run CTAs,
 * and how each agent's JSON is rendered.
 */
export const AGENT_TABS = [
  {
    id: 'companyIntel',
    label: 'Company Intel',
    path: 'company',
    tagline: 'Deep, role-relevant research on the company so you walk in informed.',
    running: 'Researching the company…',
    cta: 'Research the company',
    View: CompanyIntelView,
    icon: BuildingIcon,
  },
  {
    id: 'placementBuddy',
    label: 'Placement Buddy',
    path: 'buddy',
    tagline: 'A seasoned mentor’s personalised prep roadmap, projects, and interview advice.',
    running: 'Building your personalised prep plan…',
    cta: 'Get my prep plan',
    View: PlacementBuddyView,
    icon: CompassIcon,
  },
  {
    id: 'industryNews',
    label: 'Industry News',
    path: 'news',
    tagline: 'Recent developments in the industry, summarised — with why they matter.',
    running: 'Scanning recent industry news…',
    cta: 'Fetch recent news',
    View: IndustryNewsView,
    icon: NewsIcon,
  },
]

export const agentByPath = (p) => AGENT_TABS.find((a) => a.path === p)

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M6 21V5a1 1 0 011-1h6a1 1 0 011 1v16M14 21V9h4a1 1 0 011 1v11M9 8h2M9 12h2M9 16h2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function CompassIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" strokeLinejoin="round" />
    </svg>
  )
}
function NewsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h13a1 1 0 011 1v12a2 2 0 002 2H6a2 2 0 01-2-2V5z" strokeLinejoin="round" />
      <path d="M8 9h6M8 13h6M8 17h3M18 8h1a1 1 0 011 1v9" strokeLinecap="round" />
    </svg>
  )
}
