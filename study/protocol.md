# chb01 disagreement probe

**Title:** How current LLMs handle dSPM vs sLORETA disagreement on seven seizures from one CHB-MIT subject — a scored probe.

This is not a benchmark of seizure propagation. It is one subject, seven annotated seizures, author-scored, with no surgical outcome and no patient MRI. There is no ground truth for which inverse is correct.

## Question

When dSPM and sLORETA disagree on a public scalp-EEG source estimate, can current LLMs stay grounded in the numbers and admit the ambiguity, or do they invent a confident anatomical story?

## What is not being graded

Which method is “right.” Where to resect. Anything about a patient.

## Cases

All seven annotated seizures from CHB-MIT `chb01`, same filters (1–40 Hz, 60 Hz notch), same fsaverage inverse, both dSPM and sLORETA. See `pipeline/cases.py`.

Agreement cases are kept as controls. They are not dropped to force a mix of disagreement types.

## Unit of analysis

One seizure window. Input to a model is the compact case JSON only (stats, disagreement type, the two peak-parcel series). No video. No request to generate an image.

## Models

The frozen prompt is identical for every model. Runtime overlays on the site do not use these models.

This week: a cheap Chat Completions model (`OPENAI_MODEL`, default `gpt-4o-mini`). After OpenAI billing includes Astra, add `gpt-6-astra` (or `ASTRA_MODEL`) as a second row. Do not score until both rows that you intend to compare have been collected.

## Scoring

Author-only for this probe. Cases shuffled, model ids hidden. Rubric: `study/rubric.md`. Expert rating is later work and must not be implied by the title.

## Hypotheses (written before scoring)

1. Models will offer a confident resolution more often than they acknowledge ambiguity.
2. Groundedness and uncertainty-acknowledgment will diverge: fluent answers can still overclaim.
3. Overlay-style structured output is not the test. The test is disagreement reasoning.

## Frozen prompt

`study/prompt.json`. Do not edit it between model runs of the same comparison.
