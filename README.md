# Deutsch in 2 Minuten

A tiny, offline-first web app (PWA) for 2-minute German practice sessions, aimed at Goethe B1 → C1 and the *Leben in Deutschland* / Einbürgerungstest.

## What's inside
- **2-Minuten-Mix**: one tap gives a balanced round (flashcards, one decode card, one civics question, one exam-style task).
- **Wortschatz**: flashcards with example sentences and word-formation breakdowns, spaced repetition (Nochmal / Gut / Leicht).
- **Quizlet import**: paste a Quizlet export (tab between term and definition, one card per line). `Wort – Satz` on the front and `Bedeutung / Wortbildung` on the back are split automatically.
- **Entschlüsseln**: guess a word's meaning from its parts.
- **Leben in Deutschland**: 417 official BAMF questions (general + your Bundesland, image questions left out for now).
- **Lesen, Hören (dictation), Schreiben, Sprechen** micro-tasks shaped like Goethe B1.

Progress lives in the browser's localStorage on your device. Use Settings → Export to back it up.

## Install on your phone
Open the GitHub Pages URL in Safari (iPhone) or Chrome (Android) → Share → **Add to Home Screen**.

## Develop
No build step. Serve the folder (`python3 -m http.server`) and open `http://localhost:8000`.
Content lives in `data/*.json`. The study-plan content pack goes in `data/content/`; run `python3 merge_content.py .` to merge it with `data/base/` into the files the app loads. After changing files, bump `CACHE` in `sw.js` so phones pick up the update.

Civics questions: BAMF Gesamtfragenkatalog, via the MIT-licensed [leben-in-deutschland-scrapper](https://github.com/leben-in-deutschland/leben-in-deutschland-scrapper) dataset.
