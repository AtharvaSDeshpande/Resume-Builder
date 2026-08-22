import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// One config for both suites. jsdom gives frontend tests a DOM while still
// exposing full Node.js, so backend logic tests (crypto, quota, news) run fine
// under it too. Tests live under test/ mirroring client/ and server/.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.{js,jsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      // One combined report for the whole repo (frontend + backend), and `all`
      // lists every source file — even untested ones show up at 0%, like jest's
      // collectCoverageFrom. Open coverage/index.html for the HTML report; the
      // lcov file feeds CI dashboards.
      all: true,
      clean: true,
      reportsDirectory: './coverage',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.{js,jsx}', 'server/**/*.js'],
      exclude: [
        '**/*.test.*',
        'src/main.jsx', // app entry (bootstrap only)
        'src/firebase.js', // client Firebase config (no logic)
        'server/index.js', // Express wiring; exercised via integration, not units
      ],
    },
  },
})
