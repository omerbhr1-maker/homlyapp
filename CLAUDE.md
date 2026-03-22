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
│   │   ├── layout.tsx                # Root layout (RTL, Hebrew)
│   │   └── page.tsx                  # Main app page
│   ├── components/                   # Reusable UI components
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client
│   │   └── capacitor.ts             # Haptics, share, keyboard, push notifications
│   └── types/                        # TypeScript definitions
├── supabase/
│   ├── schema.sql                    # DB schema
│   └── functions/send-push/          # Edge Function: send push notifications (Deno)
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

# Build & open in Xcode
npm run build:ios && npm run ios:sync && npm run ios:open
```

## Architecture Notes

- **Two-project structure**: `home-management` is the source of truth. `home-management-appstore` is derived via sync script — do not edit it directly.
- **Auth**: Supabase Auth with session stored in `localStorage` (web) or Capacitor Preferences (iOS).
- **Local mode**: App works without Supabase configured (local-only).
- **Real-time sync**: Supabase Realtime for multi-user house syncing.
- **AI routes are server-side only** — never import OpenAI on the client.

## Database Schema (Supabase)

- `app_users` — username, display_name, avatar, auth_user_id
- `houses` — name, sections (JSONB), owner_user_id, invite_phone, house_image
- `house_members` — (house_id, user_id, role) — membership table with RLS
- `house_invites` — token-based invite links per house
- `push_tokens` — APNs device tokens per user (iOS push notifications)

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
