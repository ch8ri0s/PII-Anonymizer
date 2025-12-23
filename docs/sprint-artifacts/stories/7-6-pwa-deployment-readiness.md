# Story 7.6: PWA & Deployment Readiness

**Epic:** Epic 7 - Browser Migration
**Status:** drafted
**Created:** 2025-12-23
**Developer:** TBD

---

## User Story

As a **user wanting offline access**,
I want **the browser app to work as a Progressive Web App**,
So that **I can use it offline after initial model download**.

---

## Acceptance Criteria

**Given** the browser app is deployed
**When** user installs as PWA
**Then**:

1. **AC1:** App icon appears on home screen/desktop after install
2. **AC2:** App works offline (after model cached in IndexedDB)
3. **AC3:** Service worker caches static assets (HTML, CSS, JS, icons)
4. **AC4:** manifest.json enables install prompt on supported browsers
5. **AC5:** App passes Lighthouse PWA audit (score > 90)
6. **AC6:** Deployment works on GitHub Pages / Vercel / Netlify

---

## Prerequisites

- [x] Story 7.1 (document converters working) - Completed 2025-12-19
- [x] Story 7.2 (ML model loading with IndexedDB cache) - Completed 2025-12-19
- [x] Story 7.3 (PII detection pipeline) - Completed 2025-12-22
- [x] Story 7.4 (entity review UI) - Completed 2025-12-22
- [x] Story 7.5 (file download/batch processing) - Completed 2025-12-23

---

## Technical Tasks

### Task 1: PWA Manifest (AC: #1, #4)
- [ ] Create `browser-app/public/manifest.json` with app metadata
- [ ] Configure name, short_name, description
- [ ] Add icons (192x192, 512x512 PNG)
- [ ] Set theme_color and background_color
- [ ] Configure display: "standalone" for app-like experience
- [ ] Set start_url to "/"
- [ ] Add screenshots for install UI
- [ ] Link manifest in index.html: `<link rel="manifest" href="/manifest.json">`

### Task 2: Service Worker (AC: #2, #3)
- [ ] Create `browser-app/public/sw.js` or use Vite PWA plugin
- [ ] Implement cache-first strategy for static assets
- [ ] Configure precache list (HTML, CSS, JS bundles, icons)
- [ ] Handle cache versioning for updates
- [ ] Implement network-first strategy for API calls (if any)
- [ ] Add offline fallback page
- [ ] Register service worker in main.ts

### Task 3: Offline Support (AC: #2)
- [ ] Verify ML model cached in IndexedDB (from Story 7.2)
- [ ] Test app functionality without network
- [ ] Handle graceful degradation if model not cached
- [ ] Show "Offline Ready" indicator when fully cached
- [ ] Display file size of cached assets in settings

### Task 4: Install Experience (AC: #1, #4)
- [ ] Detect beforeinstallprompt event
- [ ] Show custom install banner/button when available
- [ ] Handle appinstalled event for confirmation
- [ ] Hide install prompt after successful installation
- [ ] Add "Add to Home Screen" instructions for iOS (manual)

### Task 5: Vite PWA Configuration (AC: #3, #5)
- [ ] Install vite-plugin-pwa
- [ ] Configure workbox options in vite.config.ts
- [ ] Set up asset caching strategy
- [ ] Configure manifest generation
- [ ] Enable PWA mode in build

### Task 6: Deployment Configuration (AC: #6)
- [ ] Create GitHub Pages workflow (.github/workflows/deploy.yml)
- [ ] Configure base URL for subdirectory deployment
- [ ] Add Vercel configuration (vercel.json)
- [ ] Add Netlify configuration (netlify.toml)
- [ ] Test deployment on at least one platform
- [ ] Document deployment process in README

### Task 7: Lighthouse Audit & Optimization (AC: #5)
- [ ] Run Lighthouse PWA audit
- [ ] Fix any PWA criteria failures
- [ ] Optimize performance score (>90)
- [ ] Ensure accessibility score (>90)
- [ ] Fix SEO issues if any
- [ ] Document final Lighthouse scores

### Task 8: Testing (AC: #1-6)
- [ ] Create `browser-app/test/pwa/manifest.test.ts`
- [ ] Create `browser-app/test/pwa/serviceWorker.test.ts`
- [ ] Test offline functionality manually
- [ ] Test install flow on Chrome, Edge, Firefox
- [ ] Test on mobile browsers (Chrome Android, Safari iOS)
- [ ] Target: 20+ new tests

---

## Dev Notes

### Learnings from Previous Story

**From Story 7-5-file-download-batch-processing (Status: done)**

- **Download Utilities Available**: `browser-app/src/download/FileDownloader.ts`, `ZipDownloader.ts` - reuse Blob API pattern
- **Test Pattern**: 120 tests using vitest + happy-dom - follow same patterns
- **State Management**: Module-level state with init/destroy pattern established
- **CSS Injection**: Components inject own CSS - follow for any PWA UI components
- **TypeScript**: Fixed type mismatches between ExtendedPIIMatch and PIIMatch

[Source: docs/sprint-artifacts/stories/7-5-file-download-batch-processing.md#Dev-Agent-Record]

### Existing Code to Reuse

| Source | Purpose |
|--------|---------|
| `browser-app/src/model/ModelManager.ts` | IndexedDB cache already implemented for ML model |
| `browser-app/vite.config.ts` | Base Vite configuration to extend |
| `browser-app/public/` | Static assets directory |

### PWA Manifest Structure

```json
{
  "name": "PII Anonymizer",
  "short_name": "PIIAnon",
  "description": "Privacy-preserving document anonymization",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4F46E5",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker Strategy

```typescript
// Cache-first for static assets
const CACHE_NAME = 'pii-anonymizer-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/main.js',
  '/assets/main.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install event - precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Fetch event - cache-first strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

### Vite PWA Plugin Configuration

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PII Anonymizer',
        short_name: 'PIIAnon',
        // ... rest of manifest
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
};
```

### Deployment Configurations

**GitHub Pages (.github/workflows/deploy.yml):**
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

**Vercel (vercel.json):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

**Netlify (netlify.toml):**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
```

### Lighthouse PWA Criteria

Required for PWA badge:
- [ ] Installable manifest with icons
- [ ] Service worker with fetch handler
- [ ] HTTPS (or localhost)
- [ ] Offline capability
- [ ] Fast first contentful paint (<2s)
- [ ] Responsive viewport meta tag

### References

- [Source: docs/epics.md#Story-7.6] - Story requirements
- [Source: browser-app/src/model/ModelManager.ts] - IndexedDB caching pattern
- [Source: browser-app/vite.config.ts] - Vite configuration to extend
- Vite PWA Plugin: https://vite-pwa-org.netlify.app/
- Workbox: https://developer.chrome.com/docs/workbox/

---

## Definition of Done

- [ ] manifest.json created with all required fields
- [ ] Service worker caches static assets
- [ ] App works offline (after model cached)
- [ ] Install prompt appears on supported browsers
- [ ] Lighthouse PWA score > 90
- [ ] Deployed successfully to at least one platform
- [ ] All tests passing (target: 20+ new)
- [ ] No console errors during PWA operations
- [ ] Documentation updated with deployment instructions

---

## Dev Agent Record

### Context Reference

- **Context File:** [7-6-pwa-deployment-readiness.context.xml](./7-6-pwa-deployment-readiness.context.xml)
- **Generated:** 2025-12-23
- **Elicitation Applied:** Journey Mapping, Risk Matrix

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-12-23 | 1.0.0 | Story drafted from epics.md |
