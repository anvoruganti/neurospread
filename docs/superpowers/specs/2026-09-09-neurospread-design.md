# NeuroSpread Design

**Date:** 2026-09-09  
**Status:** Draft for review  
**Repo:** https://github.com/anvoruganti/neurospread

A public-data proof of concept: compute seizure-spread movies from one CHB-MIT scalp EEG recording, show them on a dark clinical website, and use GPT-6 Astra only as a grounded guide beside those movies. This is not a clinical tool.

## Problem

Neurologists usually see a seizure as a static scan or a page of traces. Source-localized EEG can show activity moving on the cortex over time. This project demonstrates that idea on one de-identified public recording, with template MRI rather than the patient’s own scan.

The visualization must come from the inverse solution on the real recording. A generated brain picture would look plausible and would be misleading. That path is forbidden.

## Hard constraints

- Compute dSPM and sLORETA on `chb01_03.edf` for the annotated seizure window 2996–3036 seconds.
- Render cortical heatmaps with MNE/PyVista (or MNE’s standard brain renderer) from those source estimates. Export `.mp4` and `.png`.
- Do not call any image-generation model (OpenAI images, DALL-E, or similar) for a brain, a heatmap, a still, or a movie. If a step cannot be traced to the inverse solution, it does not ship.
- GPT-6 Astra may write helper text from computed stats (and later answer questions from that same context). Astra must never produce the map.
- Copy on the site and in `/pipeline/README.md` must say: public de-identified data, template MRI, proof of concept, not diagnostic, not patient-specific, not clinically validated.
- Website writing: short plain sentences, no em dashes, first person where the author is speaking. Do not oversell.
- Never hardcode, print, or commit `OPENAI_API_KEY`. Never commit `.env`. If the key is missing when an Astra call is required, stop and ask the human rather than skipping silently on the first pipeline Astra step in a live session.
- Do not deploy to Vercel in this project cycle. Stop when pipeline and site work locally. The human connects Vercel.

## Non-goals (this cycle)

- Patient MRI, SEEG, or any clinical decision support.
- Chatbot personality, multi-recording explorer, or user accounts.
- Extra Astra features (literature search, teaching modes, report export). The stats JSON is the extension point for later.
- Live 3D in the browser. The site plays computed video.

## Dataset

- **Database:** CHB-MIT Scalp EEG Database (PhysioNet).
- **File:** `chb01_03.edf` (subject chb01, file 03).
- **Seizure:** one annotated event, 2996–3036 seconds (40 seconds). Inverse and render use this window only, plus a short pad if MNE filter warmup requires it. The published animation covers the annotated seizure, not the full hour.
- **Line noise:** 60 Hz notch (recording is from Boston Children’s Hospital).
- **Band-pass:** 1–40 Hz.
- **Storage:** do not commit the `.edf`. The pipeline downloads it from PhysioNet into a gitignored `pipeline/data/` directory. Derived `.mp4`, `.png`, and stats JSON are committed under `web/public/` so the site does not need Python at deploy time.

## Architecture

Two directories, one data path.

```
pipeline/          Python package + CLI + tests + README
web/               Next.js 14 App Router site
docs/superpowers/  spec and later the implementation plan
```

**Pipeline CLI:** `python -m pipeline` from the repo root (package lives in `/pipeline`).

1. Download `chb01_03.edf` if missing.
2. Load with MNE. CHB-MIT channels are bipolar (e.g. `FP1-F7`). Map each bipolar pair to the 10–20 position of the first electrode when that name is unique; drop ECG and other non-EEG channels. Document this as an approximation in the README. Do not invent a patient-specific montage.
3. Filter (1–40 Hz, 60 Hz notch).
4. Crop to the seizure window.
5. fsaverage template MRI forward model (no patient MRI).
6. Inverse: dSPM and sLORETA on that window.
7. Render each method to `dspm.mp4` and `sloreta.mp4` plus a few stills per method.
8. Write `seizure-stats.json` (peak time, peak label or vertex, hemisphere scores, method names, window, filters).
9. Call GPT-6 Astra with that JSON only. Write `astra-walkthrough.json` (timestamped captions). If the key is missing, ask the human. If the call fails after the key is present, still ship movies and a static fallback string on the site.

Copy derived media into `web/public/`:

- `seizure-dspm.mp4` (hero)
- `seizure-sloreta.mp4` (comparison)
- stills, e.g. `stills/dspm-*.png`, `stills/sloreta-*.png`
- `seizure-stats.json`
- `astra-walkthrough.json`

**Website** reads those static files. Ask-about-this-recording uses a Next.js Route Handler that sends the question plus the committed JSON context to `gpt-6-astra`.

## Inverse and render

- Forward: MNE template-MRI workflow, `fsaverage`.
- Inverse methods: **dSPM** and **sLORETA**, both required.
- Same filters, same window, same head model, same colormap and camera so comparison is fair.
- Hero video: dSPM, autoplay, muted, looped.
- Comparison: sLORETA as a second clip plus stills, labeled as inverse methods, not as “AI models.”
- Renderer must consume the source estimate object (or equivalent STC). Screenshot-of-a-generated-image is invalid.

## GPT-6 Astra

Model id: `gpt-6-astra`. Read `OPENAI_API_KEY` from the environment.

**Job A — walkthrough (pipeline, offline).**  
Input: `seizure-stats.json` only. No video bytes, no request to generate an image.  
Output: short timestamped lines a viewer can read while the movie plays (e.g. when dSPM peaks, left vs right, how sLORETA differs).  
Label on the site: written by GPT-6 Astra from computed stats, not from the video, not a diagnosis.

**Job B — Q&A (website, optional at runtime).**  
Route: `POST /api/ask`.  
Context: stats JSON, walkthrough JSON, and the limitations paragraph.  
Allowed: questions about this recording, filters, window, methods, what the numbers say.  
Refused: diagnosis, surgery, medication, “where should we resect,” anything about a real patient.  
If the key is unset on the server, the UI shows the walkthrough only and explains that live Q&A is off.

**Forbidden:** image generation; describing a focus as clinical truth; using Astra output as a substitute for missing movies.

**Later:** more Astra features can consume the same stats file. Do not build them in this cycle.

## Website

**Stack:** Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui (`npx shadcn@latest init`). Use shadcn components (Button, Card, Badge, Input, etc.) rather than unstyled layout divs for controls and sections.

**Look:** dark clinical. Near-black background, one accent, lots of space. The videos are the object. Not a SaaS landing page.

**Sections:**

1. **Hero.** dSPM mp4 in a Card (or the cleanest quiet container). Autoplay, muted, looped, plays-inline. Caption: public CHB-MIT seizure, template brain, not a patient-specific map.
2. **How it works.** Pipeline stages in plain language: record, filter, template MRI, dSPM and sLORETA, render from the source estimate. Include the sLORETA clip and a few stills.
3. **Astra guide.** Timestamped walkthrough plus an ask box for this recording.
4. **Who this is for.** Two or three short paragraphs, not bullets:
   - Neurologists and epileptologists usually see a static view. Source-localized EEG can show spread over time. Useful as a way to talk about surgical planning in principle. This build is public data, not that workflow.
   - Engineers see a real scientific pipeline, not another chatbot demo.
   - State plainly that this does not replace clinical care.
5. **Limitations.** Explicit callout, same honesty as the pipeline README (scalp EEG spatial resolution, template MRI, one recording, not diagnostic).
6. **Links.** GitHub `https://github.com/anvoruganti/neurospread`. Placeholder for the full write-up (human will add the gobigai.org URL later). Label the placeholder as coming soon. Do not invent a URL.

## Pipeline README

Must explain:

- What the pipeline does, step by step.
- Why template MRI + dSPM/sLORETA rather than patient MRI or invasive SEEG.
- Limitations: scalp EEG resolution, public-data PoC, not diagnostic.
- How to run tests and the CLI, including PhysioNet download and fsaverage setup.
- That movies are computed, not generated.
- How Astra is used (stats in, text out) and how to set `OPENAI_API_KEY`.

## Testing

TDD for data-processing functions. Tests must fail before implementation.

Cover at least:

- Seizure window extraction (2996–3036 s) from recording metadata or a fixture.
- Filter configuration: band-pass 1–40 Hz, notch 60 Hz.
- Inverse job config: both `dspm` and `sloreta`, window-only, fsaverage.
- Stats JSON: required keys; peaks derived from a small synthetic source-estimate-like array, not from a mocked story.
- Astra walkthrough client: sends stats only; rejects if the model response includes an image payload or a request to generate an image; degrades when the API errors.
- Website Q&A route: refuses diagnosis-like prompts; answers from provided context.

The full MNE render to mp4 is an integration run on a developer machine. Do not mark the project done until that run has produced files we have opened. CI may skip the heavy render if data/fsaverage are absent, but must run the unit tests.

## Tech pins

Pin current stable at install time, then freeze versions in lockfiles:

- Python 3.11, pip, `pipeline/requirements.txt` (and a lock file if pip-tools or equivalent is used).
- MNE-Python current stable, NumPy, SciPy, matplotlib, PyVista. Render with MNE’s brain viewer in offscreen mode, write frames, encode `.mp4` with imageio-ffmpeg (or matplotlib’s ffmpeg wrapper).
- Node current LTS compatible with Next.js 14. Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui.

Record the exact versions in the READMEs after install.

## Error handling

- Missing EDF and failed download: CLI exits non-zero with a PhysioNet URL and the expected local path.
- Missing fsaverage: CLI tells the user the MNE fetch command and exits non-zero.
- Inverse or render failure: no placeholder brain image. Exit non-zero.
- Missing `OPENAI_API_KEY` on first intended Astra walkthrough in an interactive session: ask the human. In non-interactive CI, skip walkthrough, write a stub JSON with `"status": "skipped"`, still require movies from MNE.
- Q&A without a key: HTTP 503 with a clear JSON error; UI hides or disables the ask box.

## Security and secrets

- `.gitignore` includes `.env`, `pipeline/data/`, MNE cache if stored in-repo, `node_modules/`, `__pycache__/`, `.next/`.
- No secrets in git. Do not echo the API key in logs.

## Success criteria

1. Running the pipeline on `chb01_03.edf` produces dSPM and sLORETA movies whose frames match the source estimate for that seizure window.
2. The site plays the dSPM hero, shows sLORETA for comparison, and states limitations in plain language.
3. Astra walkthrough text is visibly tied to stats and labeled as such.
4. Q&A refuses diagnostic requests.
5. Unit tests for processing functions pass.
6. No image-generation API is used anywhere in the repo.

## Open follow-ups (out of scope)

- Additional Astra tools for doctors and scientists.
- gobigai.org write-up URL.
- Vercel production env for `OPENAI_API_KEY`.
