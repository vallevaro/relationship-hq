# Relationship Management System™

A private little relationship dashboard for logging dates, ratings, photos and thoughts.

## Stack

- React + Vite
- Supabase Auth + Postgres + Storage
- GitHub Pages / GitHub Actions deployment

## 1. Create the Supabase backend

Create a Supabase project, then open **SQL Editor** and run `supabase/schema.sql`.

The schema creates:
- `dates`
- `date_photos`
- Row Level Security policies
- a `date-photos` storage bucket

For the simplest private setup, create two users in **Authentication → Users** and put their UUIDs into the `relationship_members` table as described in the SQL comments.

## 2. Configure locally

```bash
cp .env.example .env
npm install
npm run dev
```

Put your Supabase URL and anon key into `.env`.

## 3. Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In repository Settings → Pages, choose **GitHub Actions**.
3. The included workflow `.github/workflows/deploy.yml` builds and deploys the Vite app.
4. Add repository Actions secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

For a private relationship archive, keep the Supabase project protected with authentication and RLS. GitHub Pages itself serves the frontend publicly; the data and photos remain protected by Supabase.

## Exit Relationship GIF

The app intentionally uses a configurable GIF URL rather than bundling copyrighted media.

Set `VITE_EXIT_GIF_URL` in your environment if you want a specific GIF. If it is absent, the app shows a deliberately absurd CSS "GIF loading" fallback.

Example:

```text
VITE_EXIT_GIF_URL=https://media.giphy.com/media/YOUR_GIF_ID/giphy.gif
```

## Data model

A date contains:
- date
- title
- location
- category
- overall rating
- food rating
- activity rating
- romance rating
- thoughts
- funny moment
- created by

Photos belong to a date and store their Supabase Storage path and optional caption.

## Suggested next additions

- shared date ideas / wishlist
- monthly relationship reports
- "relationship bingo"
- quotes archive
- anniversary countdown
- export all memories as a PDF

