import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase.js'

/**
 * Per-user job positions in Firestore. Each doc holds the role details, its
 * pipeline status, and (once tailored) the tailored résumé + saved feedback.
 * Owner-scoped by uid; firestore.rules enforce that a user only sees their own.
 *
 * Shape: {
 *   uid, company, jobDescription, interviewDate, status,
 *   baseResumeId?, tailored?: { profile, changeLog, corrections, model, tailoredAtMs },
 *   feedback?: { score, jdCoverage, weaknesses, requirements, company },
 *   createdAt, updatedAt
 * }
 */
const COLLECTION = 'jobPositions'

export function subscribeMyPositions(uid, onChange, onError) {
  if (!uid) return () => {}
  const q = query(collection(db, COLLECTION), where('uid', '==', uid))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => toRecord(d.id, d.data()))
      rows.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      onChange(rows)
    },
    (err) => onError?.(err)
  )
}

export async function getPosition(id) {
  const s = await getDoc(doc(db, COLLECTION, id))
  return s.exists() ? toRecord(s.id, s.data()) : null
}

export async function createPosition(uid, { company, jobDescription, interviewDate }) {
  const ref = await addDoc(collection(db, COLLECTION), {
    uid,
    company: (company || '').trim(),
    jobDescription: (jobDescription || '').trim(),
    interviewDate: interviewDate || '',
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export function updatePosition(id, patch) {
  return updateDoc(doc(db, COLLECTION, id), { ...patch, updatedAt: serverTimestamp() })
}

export const setStatus = (id, status) => updatePosition(id, { status })

/** Save a tailoring run (résumé + feedback incl. fit score) onto the position. */
export function saveTailoring(id, { baseResumeId, tailored, feedback, additionalContext = '' }) {
  return updatePosition(id, {
    baseResumeId,
    additionalContext,
    tailored: { ...tailored, tailoredAtMs: Date.now() },
    feedback,
  })
}

/** Update just the saved fit score (from the standalone /api/score re-check). */
export function saveScore(id, feedback) {
  return updatePosition(id, { feedback })
}

/** Save one agent's result under `agents.<agentId>` without touching siblings. */
export function saveAgentResult(id, agentId, result) {
  return updateDoc(doc(db, COLLECTION, id), { [`agents.${agentId}`]: result, updatedAt: serverTimestamp() })
}

export const deletePosition = (id) => deleteDoc(doc(db, COLLECTION, id))

function toRecord(id, d) {
  return {
    id,
    ...d,
    createdAtMs: d.createdAt?.toMillis?.() ?? 0,
    updatedAtMs: d.updatedAt?.toMillis?.() ?? 0,
  }
}
