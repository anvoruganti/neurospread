# NeuroSpread site

Dark clinical Next.js 14 app that plays the computed seizure movies and an
interactive fsaverage cortex from `public/`.

```bash
cd web
npm install
npm test
npm run dev
```

Open http://localhost:3000. Rotate the cortex with the mouse. Click a parcel to
open a region chat card. Gold and teal overlays mark the dSPM and sLORETA peak
parcels. Live Q&A needs `OPENAI_API_KEY` in the environment. Without it, the 3D
viewer still works and `/api/ask` returns 503.

Captions and overlays come from computed disagreement JSON. Live Q&A uses a
cheap Chat Completions model (`OPENAI_MODEL`, default `gpt-4o-mini`) and can
seek or highlight parcels. It does not color the cortex. Astra is a study
subject, not this runtime.

This is a public-data proof of concept. It is not diagnostic.
