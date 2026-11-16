# Habits

A tiny, front-end-only habit tracker. No server, no account, no build step: three static files.

- Add habits, each with its own colour and a goal: every day, or a number of times a week
- The home page shows the last 7 days for each habit; tap a day to check it off or undo it
- Tap a habit's name to see its full history grid (tap any square to fix a past day), and to rename, recolour, change the goal or delete it
- Streaks: days in a row for daily habits, weeks in a row that hit the target for weekly habits
- Export / import a JSON backup (••• menu)
- Light and dark mode follow your system; the half-circle button cycles System → Light → Dark

Handwritten look uses the Permanent Marker and Patrick Hand fonts from Google Fonts.

Data lives in your browser's `localStorage`, so it's per device and per browser. Export a backup to move it.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Host it free on GitHub Pages

1. Create a new **public** repository on GitHub (e.g. `habits`) and push these files to its `main` branch:
   ```sh
   git init -b main
   git add .
   git commit -m "Habit tracker"
   git remote add origin https://github.com/<you>/habits.git
   git push -u origin main
   ```
2. In the repo go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) deploys on every push to `main`. Your site appears at `https://<you>.github.io/habits/`.

Netlify, Cloudflare Pages or Vercel also work: point them at this folder with no build command.

Tip: on iPhone, open the site in Safari and use **Share → Add to Home Screen** for an app-like icon.

## Backup format

```json
{
  "app": "habits",
  "version": 2,
  "habits": [
    { "id": "abc123", "name": "Read", "color": "#30a2ff", "created": "2026-11-01", "goal": { "per": "week", "times": 3 }, "done": ["2026-11-01", "2026-11-02"] }
  ]
}
```

`goal` is `{ "per": "day" }` or `{ "per": "week", "times": 1-6 }`. Older backups without `goal` import as daily.
