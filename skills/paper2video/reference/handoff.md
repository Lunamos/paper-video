# Working with the user's materials and editing software

## Bringing materials in
Ask the user what they already have and would like to see: logos, author photos, lab/venue branding they are allowed to use, screen recordings of a demo, photos of a setup, their own narration, a music track, figure source files. Put them under `public/assets/` (or `recordings/<lang>/` for narration) and record provenance and usage rights in `notes/assets.md`.
- Screen recordings / clips: `<OffthreadVideo>` or `@remotion/media` `<Video>` inside a scene, trimmed with `trimBefore`/`trimAfter`, framed in a card with a source/label line; keep the voice-over as the timeline driver.
- Images: `<Img src={staticFile(...)} />`; vectors preferred for figures (re-draw from data when possible, as images of plots blur and cannot be animated).
- Own narration: `backend: "recorded"` (see `voice.md`).
- Music: any royalty-free/licensed file at `public/audio/bgm_<cut>.mp3`, normalised to about −17 LUFS; ducking and chapter dropouts still apply.

## Handing off to an editor (Premiere, Final Cut, DaVinci Resolve, 剪映/CapCut)
`scripts/export_handoff.*` produces, per cut:
- a clean picture render without captions (and optionally without audio) plus the normal master;
- audio stems as separate WAVs: voice, music, SFX (rendered with the video component's `mute` prop);
- per-scene clips if requested;
- captions `.srt`;
- scene/chapter boundaries as CSV and a CMX3600 EDL for markers.
Tell the user that the stems line up sample-accurately from 0:00, captions can be restyled in the editor from the SRT, and chapters come from the CSV/EDL. If they re-cut the timing in the editor, the SRT/chapters must be regenerated there.

Also offer the Remotion project itself: `npx remotion studio` lets them scrub, tweak text or colours and re-render; `scenes.json` holds all words.
