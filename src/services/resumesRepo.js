import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase.js'

/**
 * Per-user resume storage in Firestore.
 *
 * Every document carries the owner's `uid`; all reads are filtered by the
 * signed-in user's uid, and Firestore Security Rules (firestore.rules) enforce
 * that a user can only ever read/write their own documents — so a user only
 * ever sees their own resumes.
 *
 * Document shape (collection "resumes"):
 *   { uid, name, role, source, profile: <full resume JSON>, createdAt }
 */
const COLLECTION = 'resumes'

/** Subscribe to the current user's resumes. Returns an unsubscribe function. */
export function subscribeMyResumes(uid, onChange, onError) {
  if (!uid) return () => {}
  // Filter by uid only (no composite index needed); sort client-side.
  const q = query(collection(db, COLLECTION), where('uid', '==', uid))
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map((d) => toRecord(d.id, d.data()))
      records.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      onChange(records)
    },
    (err) => onError?.(err)
  )
}

/**
 * Persist a resume for a user.
 * @param source 'uploaded' | 'tailored'
 * @param meta   optional { company } — set for tailored resumes so the saved
 *               record (and its sidebar label) carries the target company.
 */
export async function saveResume(uid, profile, source = 'tailored', meta = {}) {
  const company = (meta.company || '').trim()
  const base = profile.profileName || 'Untitled'
  // Tailored resumes are labelled with the target company (falling back to a
  // "(tailored)" tag); uploads keep their own name.
  const name =
    source === 'tailored' ? (company ? `${base} — ${company}` : `${base} (tailored)`) : base
  const ref = await addDoc(collection(db, COLLECTION), {
    uid,
    name,
    role: profile.profileRole || '',
    company,
    source,
    profile,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Persist an in-place edit to a resume's content (from the manual editor). */
export function updateResumeProfile(docId, profile) {
  return updateDoc(doc(db, COLLECTION, docId), { profile, updatedAt: serverTimestamp() })
}

/** Delete one of the user's resumes by document id. */
export function deleteResume(docId) {
  return deleteDoc(doc(db, COLLECTION, docId))
}

function toRecord(id, data) {
  return {
    id,
    uid: data.uid,
    name: data.name,
    role: data.role,
    company: data.company || '',
    source: data.source,
    profile: data.profile,
    createdAtMs: data.createdAt?.toMillis?.() ?? 0,
  }
}
