import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { subscribeMyResumes, saveResume, deleteResume } from '../services/resumesRepo.js'
import * as positionsRepo from '../services/positionsRepo.js'
import { parseResumeFile } from '../services/resumeImport.js'
import { extractResumeFromPdf } from '../ai/extractResume.js'

/**
 * Single source of live data for the whole app: the signed-in user's base
 * résumés and job positions, plus the actions that mutate them. One set of
 * Firestore listeners for the session (no per-page duplication), consumed by
 * pages via `useData()`.
 */
export const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.uid

  const [resumes, setResumes] = useState([])
  const [resumesLoading, setResumesLoading] = useState(true)
  const [positions, setPositions] = useState([])
  const [positionsLoading, setPositionsLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    setResumesLoading(true)
    return subscribeMyResumes(
      uid,
      (rows) => {
        setResumes(rows)
        setResumesLoading(false)
      },
      () => setResumesLoading(false)
    )
  }, [uid])

  useEffect(() => {
    if (!uid) return
    setPositionsLoading(true)
    return positionsRepo.subscribeMyPositions(
      uid,
      (rows) => {
        setPositions(rows)
        setPositionsLoading(false)
      },
      () => setPositionsLoading(false)
    )
  }, [uid])

  // Only user-uploaded résumés are "master résumés" (tailored ones live on the
  // job positions now, not in this list).
  const masterResumes = useMemo(() => resumes.filter((r) => r.source === 'uploaded'), [resumes])

  const value = useMemo(
    () => ({
      uid,
      resumes,
      masterResumes,
      resumesLoading,
      positions,
      positionsLoading,

      // résumés
      uploadResume: async (file) => {
        const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
        const profile = isPdf ? await extractResumeFromPdf(file) : await parseResumeFile(file)
        return saveResume(uid, profile, 'uploaded')
      },
      deleteResume,

      // positions
      createPosition: (data) => positionsRepo.createPosition(uid, data),
      updatePosition: positionsRepo.updatePosition,
      setStatus: positionsRepo.setStatus,
      saveTailoring: positionsRepo.saveTailoring,
      saveScore: positionsRepo.saveScore,
      saveAgentResult: positionsRepo.saveAgentResult,
      deletePosition: positionsRepo.deletePosition,
    }),
    [uid, resumes, masterResumes, resumesLoading, positions, positionsLoading]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within <DataProvider>')
  return ctx
}
