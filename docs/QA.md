# Browser checks

Three scripts drive the island in the installed Chrome (Playwright, `channel: 'chrome'`). Start a dev server on a
separate port first, so the checks never touch the storage of a preview you are using yourself:

```sh
npx vite --port 5174
node scripts/verify-browser.mjs      # the whole story on desktop, then phone emulation (390×844, touch)
node scripts/verify-details.mjs      # phone messages, the record player, the gallery, reduced motion, reset, blocked storage
node scripts/verify-refinement.mjs   # tapping buildings in the 3D scene itself, journal map travel, rotation, phone touch
```

`ISLAND_QA_URL` points them at another address. Screenshots land in `output/` (not in git); look at them, not only
at the exit code.

What the full story covers: the photo wall and journal, a bouquet with three flowers, ordering at the diner, a sunset
postcard, writing in the sand, the camera, the sunrise walk, the invitation, lamps, candles, a held wish, blowing them
out, the letter, a reload that keeps the bouquet, the photo and the letter, the rain and the glow afterwards, and the
park (swing, carousel, red panda). It also checks that no page error was logged and that the phone layout never
scrolls sideways.

Measured on an M2 MacBook Air in Chrome (production build, 1440×900 window, `?perf`): 60 fps on the island in the
afternoon, while the lamps come on, and at the evening table; the longest frame was 17 ms. Real phones are not
tested yet.
