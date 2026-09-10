# NeuroSpread pipeline

This package computes seizure-spread movies from one public scalp EEG recording.
It loads `chb01_03.edf` from the CHB-MIT Scalp EEG Database, solves the EEG
inverse problem on a template brain, and renders the resulting cortical activity
to video.

This is a proof of concept on public de-identified data. It is not diagnostic,
not patient-specific, and not clinically validated.

## The movies are computed, not generated

Every frame is a screenshot of an MNE source estimate drawn on the fsaverage
cortical surface. `mne_render` calls `stc.plot(...)`, steps the resulting
`mne.viz.Brain` through the seizure window with `brain.set_time(...)`, and
captures `brain.screenshot()` into an mp4.

No image-generation model is used anywhere in this repo. There is no DALL-E
call, no diffusion model, and no stock brain picture. A generated brain would
look plausible and would be misleading, so that path is closed on purpose:
`assert_no_image_api` rejects image modules, and the renderer raises if the
offscreen buffer hands back blank frames instead of quietly shipping a
placeholder.

## What the pipeline does, step by step

1. **Download.** Fetch `chb01_03.edf` from PhysioNet into the gitignored
   `pipeline/data/` directory. If the file is already there, reuse it.
2. **Load and map channels.** CHB-MIT channels are bipolar pairs such as
   `FP1-F7`. Each pair is mapped to the 10-20 position of its first electrode
   when that position is not already taken, and ECG and other non-EEG channels
   are dropped. For `chb01_03.edf` that leaves 16 unique positions out of 23
   channels. This is an approximation. A bipolar pair measures a difference
   between two sites, so treating it as a single electrode is a simplification I
   accept in order to use a standard montage. There is no patient-specific
   montage here.
3. **Set the montage.** Apply the `standard_1020` template positions.
4. **Filter.** 60 Hz notch for line noise (the recording is from Boston
   Children's Hospital), then a 1-40 Hz band-pass. Filtering happens on the full
   recording so MNE has filter warmup room, and the crop comes afterwards.
5. **Resample and reference.** Resample to 100 Hz, which is enough for 1-40 Hz
   content, and apply an average reference projection.
6. **Estimate noise.** Compute a noise covariance from a 90 second pre-ictal
   stretch that ends 10 seconds before the annotated onset.
7. **Crop.** Keep the annotated seizure window, 2996 to 3036 seconds.
8. **Forward model.** Fetch the fsaverage template MRI and build a forward
   solution from its `ico-5` source space and 3-layer BEM.
9. **Inverse.** Build one inverse operator and apply it twice, as dSPM and as
   sLORETA, with the same `lambda2`, loose orientation, and depth weighting so
   the two maps are comparable.
10. **Render.** For each method, sample the window every second, screenshot the
    brain, and write `seizure-{method}.mp4` plus four stills into
    `stills/{method}-{i}.png`.
11. **Stats.** Write `seizure-stats.json` with the peak time, the aparc parcel
    label at the peak, left and right hemisphere power, the window, and the
    filters.
12. **Astra walkthrough.** Send that stats JSON to `gpt-6-astra` and write the
    returned captions to `astra-walkthrough.json`.
13. **Publish.** Copy the movies, stills, and JSON into `web/public/` so the
    site does not need Python at deploy time.

## Why template MRI, dSPM, and sLORETA

**Template MRI.** CHB-MIT is de-identified scalp EEG. There is no patient MRI in
the dataset, so there is no way to build a subject-specific head model. The
fsaverage template gives a consistent, publicly available anatomy to project
onto. The cost is that the anatomy is not this patient's anatomy, so the maps
show a plausible spread pattern on an average brain rather than a location in a
real head.

**dSPM and sLORETA.** Both are linear minimum-norm inverse methods, which is the
appropriate family when you have 20-odd scalp electrodes and no patient
anatomy. They normalize differently: dSPM scales by estimated noise sensitivity,
sLORETA by estimated resolution. Because they weight depth and noise
differently, showing both is more honest than picking one. Where they agree, the
result is less likely to be an artifact of the normalization choice. Where they
disagree, the disagreement is the useful information.

**Not invasive SEEG.** SEEG would give far better spatial precision, but it
requires implanted electrodes and a real clinical workflow. That is not what
this dataset is, and it is not something a public-data demo can stand in for.

## Limitations

- **Scalp EEG spatial resolution is poor.** The 23 bipolar channels collapse to
  16 unique 10-20 positions here, and volume conduction blurs what those 16 see.
  That means centimeters of uncertainty, not millimeters. The hot spot in these
  movies is a broad region, not a surgical target.
- **The head model is a template.** No patient MRI, no patient-specific skull or
  conductivity. Source positions are approximate by construction.
- **The bipolar-to-monopolar channel mapping is an approximation.** See step 2.
- **One recording, one seizure.** This is a single 40 second annotated window
  from a single subject. Nothing here generalizes.
- **Not diagnostic.** This does not replace clinical care, does not identify a
  seizure focus for treatment, and must not be used for any clinical decision.
- **Public de-identified data.** CHB-MIT is an open research dataset. No private
  patient data is involved, and no result here describes an identifiable person.

## How to run

Set up an environment and install the pinned dependencies from the repo root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r pipeline/requirements.txt
```

### Tests

The unit tests cover the data-processing functions and do not need MNE, the EDF,
or fsaverage. They run in under a second:

```bash
python3 -m pytest pipeline/tests -v
```

The full MNE render is an integration run, not a unit test. It is verified by
running the CLI and opening the resulting mp4 files.

### The CLI

```bash
python -m pipeline
```

Run it from the repo root. It writes into `pipeline/output/` and then copies the
published files into `web/public/`. Expect it to take a while: the forward
solution, two inverse solutions, and about 40 3D frames per method are all
computed locally.

### PhysioNet download

The CLI downloads the recording automatically from
`https://physionet.org/files/chbmit/1.0.0/chb01/chb01_03.edf` into
`pipeline/data/`. That directory and all `.edf` files are gitignored, so the
recording is never committed. If the download fails, the CLI exits non-zero and
prints the URL and the expected local path so you can place the file by hand.

### fsaverage setup

The template MRI is fetched through MNE into its own data directory, outside the
repo. It is a large download, so it is worth doing once up front:

```bash
python -c "import mne; mne.datasets.fetch_fsaverage(verbose=True)"
```

If fsaverage is missing or incomplete when the CLI runs, it exits non-zero and
prints that command rather than falling back to anything invented.

## How Astra is used

`gpt-6-astra` is the guide beside the movies, never the source of them. The
contract is stats in, text out:

- **Input:** the contents of `seizure-stats.json` and nothing else. No video
  bytes, no frames, no request to draw anything.
- **Output:** short timestamped captions, as
  `{"captions": [{"t": number, "method": "dspm" | "sloreta", "text": string}]}`.
- **Refused:** if the response contains an image payload, the pipeline raises
  rather than accepting it.

Astra never produces the map, and its text is not a diagnosis. On the site it is
labeled as written from computed stats.

### OPENAI_API_KEY

The pipeline reads `OPENAI_API_KEY` from the environment. Put it in a `.env`
file at the repo root and `main()` will load any variables that are not already
set:

```
OPENAI_API_KEY=sk-...
```

`.env` is gitignored. Do not commit it, and do not print the key.

If the key is missing, behavior depends on the session:

- **Interactive terminal:** the pipeline stops and asks you to set the key. The
  computed movies are still copied to `web/public/` first, so no work is lost.
- **Non-interactive (CI):** the walkthrough is skipped and
  `astra-walkthrough.json` is written with `"status": "skipped"`. Movies are
  still required from MNE.

If the Astra call fails while the key is present, the walkthrough JSON records
`"status": "error"` and the movies still ship. The site falls back to static
text.

## Versions

Verified on macOS with Python 3.12.9 and Node 20.19.1. Exact Python pins live in
`pipeline/requirements.txt`. Exact site pins live in `web/package.json` and
`web/package-lock.json`.

| Package | Version |
| --- | --- |
| mne | 1.12.1 |
| numpy | 2.5.3 |
| scipy | 1.18.1 |
| matplotlib | 3.11.1 |
| pyvista | 0.49.0 |
| pyvistaqt | 0.13.1 |
| vtk | 9.7.0 |
| PyQt6 | 6.11.0 |
| nibabel | 5.4.2 |
| pooch | 1.9.0 |
| imageio | 2.37.4 |
| imageio-ffmpeg | 0.6.0 |
| pytest | 9.1.1 |
| scikit-learn | 1.9.0 |

## Data credit

CHB-MIT Scalp EEG Database, PhysioNet:
<https://physionet.org/content/chbmit/1.0.0/>

Shoeb, A. (2009). *Application of Machine Learning to Epileptic Seizure Onset
Detection and Treatment*. PhD thesis, MIT.
