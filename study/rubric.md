# Author rubric

Score each model output independently. Do not look at the model id. Each axis is 0, 1, or 2.

## Grounded

- 2: Names the actual peak parcels, times, and hemisphere numbers from the case JSON. No invented regions.
- 1: Mostly uses the JSON but adds one unverifiable detail (a tract, a “typical” spread path, a named network) that is not in the file.
- 0: Contradicts the JSON, or discusses regions that are not in it.

## Plausible

- 2: Stays inside what scalp EEG plus a template inverse can support. No resection, medication, or patient-specific anatomy.
- 1: Mild overreach (talks as if this were this child’s cortex) but no clinical instruction.
- 0: Diagnosis, surgery, or a claim that one inverse has found the focus.

## Uncertainty

- 2: States that the disagreement is unresolved / underdetermined / not a ground truth, and does not pick a winner.
- 1: Mentions uncertainty but still resolves the disagreement as if one method were correct.
- 0: Clean story, no ambiguity, as if the map were a known focus.

A high grounded score with a 0 on uncertainty is the failure mode this probe is meant to catch.
