# Docket demo proxy — setup

This hides your Groq API key from anyone using the public demo link.

## 1. Deploy with functions (Drop alone doesn't support this)

You need a "real" Netlify site (not just drag-and-drop), because Functions require
Netlify to build/deploy them. Easiest path — Netlify CLI, no GitHub needed:

```bash
npm install -g netlify-cli
cd this-folder          # the folder containing netlify/functions/chat.js and your docket.html
netlify login
netlify deploy --prod
```

Put your `docket.html` (renamed to `index.html`) in this same folder before deploying,
so the site and the function ship together.

## 2. Add your Groq key as a server-side secret

In the Netlify dashboard for the new site:
**Site configuration → Environment variables → Add a variable**
- Key: `GROQ_API_KEY`
- Value: your real Groq key

Then trigger a redeploy (`netlify deploy --prod` again) so the function picks it up.
The key now lives only on Netlify's server — it is never sent to any visitor's browser.

## 3. In Docket, pick "Demo (shared)" as the provider

No key needed from the visitor. The app calls `/.netlify/functions/chat` on
whatever domain it's hosted on, and the function adds the real key before
forwarding to Groq.

## Notes on safety

- The function forces a fixed, cheap model and trims/limits message size, so a
  demo visitor can't run up your bill by accident.
- Leave the "Google Apps Script Web App URL" field **empty** in the demo build.
  Without it, tasks a visitor adds stay only in *their own browser* (localStorage) —
  they never touch your real Google Sheet, and no writable Sheet URL is exposed at all.
- For extra peace of mind during a live demo, you can rotate/delete the Groq key
  in Groq's console right after the session.
