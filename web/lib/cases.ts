export type CaseManifestEntry = {
  id: string;
  file: string;
  subject: string;
  tmin: number;
  tmax: number;
  hero: boolean;
  title: string;
  summary: string;
  durationSec: number;
  ready: boolean;
  database: string;
  peaks?: { dspm?: string; sloreta?: string };
};

export type CasesManifest = {
  version: number;
  defaultCaseId: string;
  cases: CaseManifestEntry[];
};

export function caseBasePath(caseId: string): string {
  return `/cases/${caseId}`;
}

export function caseBrainPath(caseId: string, file: string): string {
  return `${caseBasePath(caseId)}/brain/${file}`;
}

export const FALLBACK_MANIFEST: CasesManifest = {
  version: 1,
  defaultCaseId: "chb01_03",
  cases: [
    {
      id: "chb01_03",
      file: "chb01_03.edf",
      subject: "chb01",
      tmin: 2996,
      tmax: 3036,
      hero: true,
      title: "Seizure 3 — temporal spread",
      summary: "Classic annotated window with clear dSPM vs sLORETA disagreement.",
      durationSec: 40,
      ready: true,
      database: "CHB-MIT Scalp EEG (PhysioNet)",
    },
    {
      id: "chb01_04",
      file: "chb01_04.edf",
      subject: "chb01",
      tmin: 1467,
      tmax: 1494,
      hero: false,
      title: "Seizure 4 — shorter burst",
      summary: "27-second window from the same subject.",
      durationSec: 27,
      ready: false,
      database: "CHB-MIT Scalp EEG (PhysioNet)",
    },
    {
      id: "chb01_15",
      file: "chb01_15.edf",
      subject: "chb01",
      tmin: 1732,
      tmax: 1772,
      hero: false,
      title: "Seizure 15 — frontal build-up",
      summary: "40-second segment from CHB-MIT.",
      durationSec: 40,
      ready: false,
      database: "CHB-MIT Scalp EEG (PhysioNet)",
    },
    {
      id: "chb01_16",
      file: "chb01_16.edf",
      subject: "chb01",
      tmin: 1015,
      tmax: 1066,
      hero: false,
      title: "Seizure 16 — early recording",
      summary: "51-second window with a different spread signature.",
      durationSec: 51,
      ready: false,
      database: "CHB-MIT Scalp EEG (PhysioNet)",
    },
    {
      id: "chb01_18",
      file: "chb01_18.edf",
      subject: "chb01",
      tmin: 1720,
      tmax: 1810,
      hero: false,
      title: "Seizure 18 — long evolution",
      summary: "90-second seizure from CHB-MIT.",
      durationSec: 90,
      ready: false,
      database: "CHB-MIT Scalp EEG (PhysioNet)",
    },
  ],
};
