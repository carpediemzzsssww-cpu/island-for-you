# Browser checks

Three scripts drive the island in the installed Chrome (Playwright, `channel: 'chrome'`). Start a dev server on a
separate port first, so the checks never touch the storage of a preview you are using yourself:

```sh
npx vite --port 5174
node scripts/verify-browser.mjs      # the whole story on desktop, then phone emulation (390×844, touch)
node scripts/verify-details.mjs      # phone messages, the record player, the gallery, reduced motion, reset, blocked storage
node scripts/verify-refinement.mjs   # tapping buildings in the 3D scene itself, journal map travel, rotation, phone touch
ISLAND_PUBLIC=1 node scripts/verify-polish.mjs # library, green ray, global rainbow, custom celebration, mobile overlays
```

`ISLAND_QA_URL` points them at another address. Screenshots land in `output/` (not in git); look at them, not only
at the exit code.

What the full story covers: the photo wall and journal, a bouquet with three flowers, ordering at the diner, a sunset
postcard, writing in the sand, the camera, the sunrise walk, the invitation, lamps, candles, a wish, blowing them
out, a reload that keeps the bouquet, photos and celebration, the rain and the glow afterwards, and the
park (swing, carousel, red panda). It also checks that no page error was logged and that the phone layout never
scrolls sideways.

Measured on an M2 MacBook Air in Chrome (production build, 1440×900 window, `?perf`): 60 fps on the island in the
afternoon, while the lamps come on, and at the evening table; the longest frame was 17 ms. Real phones are not
tested yet. This measurement belongs to the earlier edition; it is not a new performance claim for the October 18 changes.

## 2026-10-18 · Open exploration and general celebrations

- Celebration is available without completing the five memories; the optional invitation still appears after all five.
- `verify-polish.mjs` checks library entry/drag/book/exit, sunset pause while reading, actual shorter scene timers, catching moments, carrying the rainbow into the island, PNG capture from the overview, absent private letter/video, 7 person-free public pictures, custom occasion persistence, and 390 × 844 / 844 × 390 layouts.
- Private content audit checks the filtered public asset manifest, model labels, pictures, and recordings. The original private letter is unchanged in its own checkout; it is absent here.
- Public and private browser storage/database keys remain separate. Tests use independent browser contexts and ports.
- Physical iPhone/Android gestures, native share sheets and audio unlock remain device checks; browser emulation does not establish those results.


## 2026-10-11 · New artwork and restored tracks

On the M2 MacBook Air, installed desktop Chrome / Playwright, dev server on port 5174:

- Production build and all 13 state tests passed.
- The full desktop story, reload recovery, optional interactions, and phone emulation (390×844 portrait / 844×390 landscape) passed; no page errors or horizontal overflow. This is browser emulation, not a real-device measurement.
- All 24 generated display pictures and all 24 thumbnails decoded and contain no EXIF. Stable IDs are unchanged; private reference filenames and paths are not in the published manifest.
- The original five recordings actually played through the record player; arrival starts at the original 12.5-second offset. Track files match the source edition. Birthday tune remains synthesized.
- Inspected screenshots of the physical Home wall, open gallery, sunset postcard, birthday table and mobile gallery.

Generation direction and prompts: [ARTWORK.md](ARTWORK.md). Local screenshot/results files remain in ignored output/. No real-phone FPS claim is made for this revision.


## 2026-10-18 · Final font, navigation and publication checks

- Final production build passed. State tests: private 14 / public 15, including early manual-time persistence and removed-portrait save migration respectively.
- Full story and polish scripts passed on installed Chrome, desktop plus portrait/landscape touch emulation. Private outdoor walking replay was inspected visually.
- Final font subsets use GenWanMin / Compagnon; modal layering was corrected so toolbar controls cannot intercept a paper's close button.
- Physical iPhone / Android interaction remains unverified. The public mini-tool has separate container validation requirements in docs/MINITOOL.md.
