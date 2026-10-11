# An Island for You

An explorable 3D birthday island (React 19 / React Three Fiber 9 / three 0.180 / Vite / TypeScript / zustand).
This is the public, de-identified edition: pictures are generated white-background mouse doodles and the letter is a sample.
On 2026-10-11 the user explicitly requested keeping the private edition's five songs here. The track mapping in
src/content.ts is intentional; do not replace it with synthesized arrangements. Recordings are separate from the code license.
Private photographs may be used locally as generation references, as requested, but reference images, filenames,
EXIF, names, places, private letters and videos must not be committed. Generation references and source outputs stay in ignored output/.

- Text: `node scripts/copy-deck.mjs export` writes every Chinese line to `文案清单.md`; `apply` writes edits back.
  Names live in `site` in `src/content.ts`; shop signs in `src/world/anchors.json`. Regenerate the font subsets after
  copy changes (`scripts/prepare_fonts.py`).
- Photos: `python3 scripts/photos.py artworks <folder> | placeholders | import <folder>` writes `public/photos` and `assets-manifest.json`
  (EXIF stripped). Music: `node scripts/render_music.mjs`. Models: `npm run models` (Blender 4.5; edit the script,
  then export).
- Performance: keep the scene's light count fixed (adding or removing a light recompiles every material). Things that
  appear later are built hidden from the start and compiled in `Warmup` (`src/world/World.tsx`).
- Commit messages in English.

Validation: `npm run build` · `npm test` · the browser checks in `docs/QA.md`.
