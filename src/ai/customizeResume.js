import { agentApi } from '../services/agentApi.js'

/**
 * Tailor a résumé to a job description via the backend agent.
 *
 * This used to run entirely client-side (Firebase AI Logic). It now calls the
 * Express agent, which runs a multi-stage pipeline (parse JD → tailor → guard →
 * critique → improve) for higher relevance, and enforces the daily quota
 * server-side. The return shape is a superset of the old one, adding
 * `requirements`, `jdCoverage`, `score`, and `quota`.
 */
export function customizeResume({ baseResume, jobDescription, onProgress }) {
  return agentApi.tailor({ baseResume, jobDescription }, onProgress)
}
