# An Island for You

An explorable 3D birthday island (React 19 / React Three Fiber 9 / three 0.180 / Vite / TypeScript / zustand).
This is the public, de-identified edition: photos are painted placeholders, the letter is a sample, and the music is
synthesized from public-domain melodies. Only add pictures that are cleared for a public repository; the original
gift's photos, recordings, names, places and songs never come here, and neither do commercial recordings.

- Text: `node scripts/copy-deck.mjs export` writes every Chinese line to `文案清单.md`; `apply` writes edits back.
  Names live in `site` in `src/content.ts`; shop signs in `src/world/anchors.json`. Regenerate the font subsets after
  copy changes (`scripts/prepare_fonts.py`).
- Photos: `python3 scripts/photos.py placeholders | import <folder>` writes `public/photos` and `assets-manifest.json`
  (EXIF stripped). Music: `node scripts/render_music.mjs`. Models: `npm run models` (Blender 4.5; edit the script,
  then export).
- Performance: keep the scene's light count fixed (adding or removing a light recompiles every material). Things that
  appear later are built hidden from the start and compiled in `Warmup` (`src/world/World.tsx`).
- Commit messages in English.

Validation: `npm run build` · `npm test` · the browser checks in `docs/QA.md`.
