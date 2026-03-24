# CLAUDE.md — Homly App

## Project Overview

**Homly** is a Hebrew-language home management app for managing shopping lists, tasks, and recipes across multiple users and households.

- `home-management/` — Primary web app (Next.js). **Always edit this one first.**
- `home-management-appstore/` — App Store iOS variant, synced from the web app via script.

## Tech Stack

- **Framework**: Next.js 15 (App Router, `output: "export"` for static)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS — RTL layout throughout (Hebrew)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **AI**: OpenAI API — server-side only (`/api/ai/` routes)
- **Mobile**: Capacitor 8 wrapping the static Next.js build for iOS

## Key Directories

```
home-management/
├── src/
│   ├── app/
│   │   ├── api/ai/parse-recording/   # Voice → list items (OpenAI)
│   │   ├── api/ai/recipe/            # Recipe → ingredients (OpenAI)
│   │   ├── privacy/page.tsx          # Privacy policy page
│   │   ├── layout.tsx                # Root layout (RTL, Hebrew)
│   │   └── page.tsx                  # Main app page
│   ├── components/
│   │   ├── RecipeModal.tsx           # Recipe import modal
│   │   ├── InviteModal.tsx           # House invite modal
│   │   ├── SettingsModal.tsx         # Settings modal
│   │   ├── SortableListItem.tsx      # Drag-and-drop list item (dnd-kit)
│   │   ├── ErrorBoundary.tsx         # React error boundary
│   │   ├── SafeImage.tsx             # Image with fallback
│   │   ├── HomeLogo.tsx              # App logo
│   │   └── icons.tsx                 # SVG icon components
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client + appCacheStorage
│   │   ├── capacitor.ts              # Haptics, share, keyboard, push notifications
│   │   ├── item-parsing.ts           # Hebrew transcript → list items parsing
│   │   ├── openai.ts                 # OpenAI client helper (server-side)
│   │   ├── storage.ts                # Local storage utilities
│   │   ├── constants.ts              # App-wide constants
│   │   └── utils.ts                  # General utility functions
│   └── types/                        # TypeScript definitions
├── supabase/
│   ├── schema.sql                    # DB schema
│   └── functions/
│       ├── send-push/                # Edge Function: send push notifications (Deno)
│       ├── ai-recipe/                # Edge Function: recipe → ingredients (Deno)
│       └── ai-parse-recording/       # Edge Function: voice → list items (Deno)
└── ios/                              # Capacitor iOS project
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
OPENAI_API_KEY=       # server-side only, never expose to client
```

## Common Commands

```bash
# Development
cd home-management && npm run dev

# Build for web
npm run build

# Sync web → app store version
./scripts/sync-web-to-appstore.sh

# Build & sync to iOS (Capacitor CLI — run from home-management/)
npm run build && npx cap sync ios && npx cap open ios

# Testing (Playwright)
npm test                        # run all tests
npm run test:ui                 # interactive UI
npm run test:auth               # auth flow tests
npm run test:house              # house management tests
npm run test:items              # list item tests
npm run test:report             # show last test report
```

## Architecture Notes

- **Two-project structure**: `home-management` is the source of truth. `home-management-appstore` is derived via sync script — do not edit it directly.
- **Auth**: Supabase Auth with session stored in `localStorage` (web) or Capacitor Preferences (iOS).
- **Local mode**: App works without Supabase configured (local-only).
- **Real-time sync**: Supabase Realtime for multi-user house syncing.
- **AI routes are server-side only** — never import OpenAI on the client.

## Database Schema (Supabase)

- `app_users` — username, display_name, avatar_url, auth_user_id
- `houses` — name, pin, sections (JSONB), owner_user_id, invite_phone, house_image, updated_at
- `house_members` — (house_id, user_id, role) — membership table with RLS
- `house_invites` — token-based invite links per house, created_by_user_id
- `push_tokens` — APNs device tokens per user, platform (default: 'ios')

Storage bucket: `homly-images` — public read, auth-required write (avatars, house images)

## RTL / Hebrew

- All UI is Hebrew, direction is `rtl`.
- When adding UI components, ensure they work correctly in RTL layout.
- Use Tailwind's `rtl:` variant when needed.

## Code Style

- Prefer editing existing files over creating new ones.
- Keep components in `src/components/` if reusable across views.
- Server-only code (OpenAI, secrets) stays in `src/app/api/`.
- No `console.log` in production code.
