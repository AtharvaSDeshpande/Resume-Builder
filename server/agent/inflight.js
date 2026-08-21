/**
 * Per-user single-flight guard for AI work. While a user has one AI request
 * running (tailor / score / any agent), further AI triggers are rejected with
 * 409 AI_BUSY — so a single account can't fan out concurrent, expensive calls
 * on their key. In-memory (per server instance), which is sufficient here since
 * a user's requests are serialised through the same process.
 */
const running = new Set()

export const isBusy = (uid) => running.has(uid)

/** Reserve the AI slot for a user; throws 409 AI_BUSY if one is already active. */
export function acquire(uid) {
  if (running.has(uid)) {
    throw Object.assign(new Error('Another AI task is already running. Let it finish, then try again.'), {
      status: 409,
      code: 'AI_BUSY',
    })
  }
  running.add(uid)
}

export function release(uid) {
  running.delete(uid)
}
