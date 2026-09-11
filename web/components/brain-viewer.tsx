"use client";

import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import { AskBox } from "@/components/ask-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegionChat } from "@/components/region-chat";
import {
  BrainMesh,
  MethodName,
  ParcelsFile,
  RegionSelection,
  activityAt,
  activityToColor,
  nearestTimeIndex,
  percentile,
} from "@/lib/brain";
import {
  DisagreementFile,
  SceneAction,
  activeCaptionIndex,
  liftCentroid,
  parcelCentroid,
  prettyParcel,
  propagationPath,
} from "@/lib/guide";
import { SeizureStats, downloadReport } from "@/lib/report";

type BrainViewerProps = {
  liveQa: boolean;
};

type LoadedBrain = {
  mesh: BrainMesh;
  activity: Float32Array;
  parcels: ParcelsFile;
  disagreement?: DisagreementFile;
};

function mixToward(
  out: Float32Array,
  offset: number,
  r: number,
  g: number,
  b: number,
  t: number
): void {
  out[offset] = out[offset] * (1 - t) + r * t;
  out[offset + 1] = out[offset + 1] * (1 - t) + g * t;
  out[offset + 2] = out[offset + 2] * (1 - t) + b * t;
}

function PathArrows({ points }: { points: [number, number, number][] }) {
  const arrows = useMemo(() => {
    const out: { dir: THREE.Vector3; origin: THREE.Vector3; length: number }[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const origin = new THREE.Vector3(...liftCentroid(points[i]));
      const dest = new THREE.Vector3(...liftCentroid(points[i + 1]));
      const dir = dest.clone().sub(origin);
      const length = dir.length();
      if (length < 2) continue;
      dir.normalize();
      out.push({ dir, origin, length });
    }
    return out;
  }, [points]);
  return (
    <>
      {arrows.map((arrow, index) => (
        <arrowHelper
          key={index}
          args={[
            arrow.dir,
            arrow.origin,
            arrow.length,
            0xf4d58d,
            Math.min(14, arrow.length * 0.22),
            Math.min(7, arrow.length * 0.1),
          ]}
        />
      ))}
    </>
  );
}

function PeakArrow({
  from,
  to,
}: {
  from: [number, number, number];
  to: [number, number, number];
}) {
  return <Line points={[from, to]} color="#f4d58d" lineWidth={2} />;
}

function Hemisphere({
  hemi,
  offsetX,
  vertexOffset,
  colorBuffer,
  labels,
  onHover,
  onPick,
}: {
  hemi: BrainMesh["hemispheres"]["lh"];
  offsetX: number;
  vertexOffset: number;
  colorBuffer: Float32Array;
  labels: string[];
  onHover: (label: string | null) => void;
  onPick: (label: string, event: ThreeEvent<MouseEvent>) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(hemi.vertices.length * 3);
    for (let i = 0; i < hemi.vertices.length; i += 1) {
      positions[i * 3] = hemi.vertices[i][0] + offsetX;
      positions[i * 3 + 1] = hemi.vertices[i][1];
      positions[i * 3 + 2] = hemi.vertices[i][2];
    }
    const indices = new Uint32Array(hemi.faces.length * 3);
    for (let i = 0; i < hemi.faces.length; i += 1) {
      indices[i * 3] = hemi.faces[i][0];
      indices[i * 3 + 1] = hemi.faces[i][1];
      indices[i * 3 + 2] = hemi.faces[i][2];
    }
    const colors = new Float32Array(hemi.vertices.length * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [hemi, offsetX]);

  useEffect(() => {
    const attr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const local = attr.array as Float32Array;
    local.set(
      colorBuffer.subarray(vertexOffset * 3, (vertexOffset + hemi.vertices.length) * 3)
    );
    attr.needsUpdate = true;
  }, [colorBuffer, geometry, hemi.vertices.length, vertexOffset]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerMove={(event) => {
        event.stopPropagation();
        const face = event.face;
        if (!face) {
          onHover(null);
          return;
        }
        onHover(labels[face.a] ?? null);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(event) => {
        event.stopPropagation();
        const face = event.face;
        if (!face) return;
        const label = labels[face.a];
        if (!label) return;
        onPick(label, event);
      }}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.85}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CortexScene({
  data,
  method,
  timeIndex,
  highlights,
  dspmParcel,
  sloretaParcel,
  showArrow,
  pathParcels,
  startParcel,
  endParcel,
  focusPath,
  pathPoints,
  onHover,
  onPick,
}: {
  data: LoadedBrain;
  method: MethodName;
  timeIndex: number;
  highlights: string[];
  dspmParcel?: string;
  sloretaParcel?: string;
  showArrow: boolean;
  pathParcels: string[];
  startParcel?: string;
  endParcel?: string;
  focusPath: boolean;
  pathPoints: [number, number, number][];
  onHover: (label: string | null) => void;
  onPick: (label: string, clientX: number, clientY: number) => void;
}) {
  const { gl } = useThree();
  const methodIndex = Math.max(0, data.mesh.activity.methods.indexOf(method));
  const nTimes = data.mesh.activity.n_times;
  const nVertices = data.mesh.activity.n_vertices;
  const slice = useMemo(
    () => activityAt(data.activity, methodIndex, timeIndex, nTimes, nVertices),
    [data.activity, methodIndex, timeIndex, nTimes, nVertices]
  );
  const vmax = useMemo(() => Math.max(percentile(slice, 99), 1e-6), [slice]);
  const colorBuffer = useMemo(() => {
    const out = new Float32Array(nVertices * 3);
    const labels = [
      ...data.mesh.hemispheres.lh.labels,
      ...data.mesh.hemispheres.rh.labels,
    ];
    const marked = new Set(highlights);
    const path = new Set(pathParcels);
    for (let i = 0; i < nVertices; i += 1) {
      activityToColor(slice[i], vmax, out, i * 3);
      const label = labels[i];
      if (focusPath && path.size > 0 && (!label || !path.has(label))) {
        out[i * 3] *= 0.1;
        out[i * 3 + 1] *= 0.1;
        out[i * 3 + 2] *= 0.1;
        continue;
      }
      if (!label) continue;
      if (label === startParcel) {
        mixToward(out, i * 3, 0.96, 0.84, 0.55, 0.62);
      } else if (label === endParcel) {
        mixToward(out, i * 3, 1, 0.92, 0.75, 0.55);
      } else if (path.has(label)) {
        mixToward(out, i * 3, 1, 1, 1, 0.28);
      } else if (marked.has(label) && label === dspmParcel) {
        mixToward(out, i * 3, 0.96, 0.84, 0.55, 0.55);
      } else if (marked.has(label) && label === sloretaParcel) {
        mixToward(out, i * 3, 0.45, 0.82, 0.88, 0.55);
      }
    }
    return out;
  }, [
    slice,
    vmax,
    nVertices,
    data.mesh,
    highlights,
    dspmParcel,
    sloretaParcel,
    pathParcels,
    startParcel,
    endParcel,
    focusPath,
  ]);

  const lhCount = data.mesh.hemispheres.lh.vertices.length;
  const gap = 45;

  const handlePick = useCallback(
    (label: string, event: ThreeEvent<MouseEvent>) => {
      const rect = gl.domElement.getBoundingClientRect();
      onPick(label, event.clientX - rect.left, event.clientY - rect.top);
    },
    [gl, onPick]
  );

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[80, 120, 60]} intensity={0.9} />
      <directionalLight position={[-60, -40, -80]} intensity={0.35} />
      <Hemisphere
        hemi={data.mesh.hemispheres.lh}
        offsetX={-gap}
        vertexOffset={0}
        colorBuffer={colorBuffer}
        labels={data.mesh.hemispheres.lh.labels}
        onHover={onHover}
        onPick={handlePick}
      />
      <Hemisphere
        hemi={data.mesh.hemispheres.rh}
        offsetX={gap}
        vertexOffset={lhCount}
        colorBuffer={colorBuffer}
        labels={data.mesh.hemispheres.rh.labels}
        onHover={onHover}
        onPick={handlePick}
      />
      {focusPath && pathPoints.length > 1 ? <PathArrows points={pathPoints} /> : null}
      {showArrow && !focusPath && dspmParcel && sloretaParcel && dspmParcel !== sloretaParcel ? (
        <PeakArrow
          from={parcelCentroid(data.mesh, dspmParcel, gap) ?? [0, 0, 0]}
          to={parcelCentroid(data.mesh, sloretaParcel, gap) ?? [0, 0, 0]}
        />
      ) : null}
      <OrbitControls enablePan enableZoom enableRotate makeDefault />
    </>
  );
}

export function BrainViewer({ liveQa }: BrainViewerProps) {
  const [data, setData] = useState<LoadedBrain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<MethodName>("dspm");
  const [timeIndex, setTimeIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [selection, setSelection] = useState<RegionSelection | null>(null);
  const [split, setSplit] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [focusPath, setFocusPath] = useState(true);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [stats, setStats] = useState<SeizureStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meshRes, parcelsRes, activityRes, disagreementRes, statsRes] = await Promise.all([
          fetch("/brain/mesh.json"),
          fetch("/brain/parcels.json"),
          fetch("/brain/activity.bin"),
          fetch("/brain/disagreement.json"),
          fetch("/seizure-stats.json"),
        ]);
        if (!meshRes.ok || !parcelsRes.ok || !activityRes.ok) {
          throw new Error("missing");
        }
        const mesh = (await meshRes.json()) as BrainMesh;
        const parcels = (await parcelsRes.json()) as ParcelsFile;
        const buffer = await activityRes.arrayBuffer();
        const activity = new Float32Array(buffer);
        const disagreement = disagreementRes.ok
          ? ((await disagreementRes.json()) as DisagreementFile)
          : undefined;
        if (cancelled) return;
        setData({ mesh, parcels, activity, disagreement });
        if (statsRes.ok) {
          setStats((await statsRes.json()) as SeizureStats);
        }
        setHighlights(disagreement?.highlight ?? []);
        setTimeIndex(0);
      } catch {
        if (!cancelled) {
          setError(
            "The interactive cortex is not here yet. From the repo root, run python -m pipeline.export_cortex (or python -m pipeline) so the mesh is written from the source estimate. I will not put a generated brain in its place."
          );
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!playing || !data) return;
    const id = window.setInterval(() => {
      setTimeIndex((current) => (current + 1) % data.mesh.activity.times.length);
    }, 200);
    return () => window.clearInterval(id);
  }, [playing, data]);

  const times = data?.mesh.activity.times ?? [];
  const currentTime = times[timeIndex] ?? 0;
  const parcel = selection ? data?.parcels.parcels[selection.label] : undefined;
  const disagreement = data?.disagreement;
  const captions = disagreement?.captions ?? [];
  const active = activeCaptionIndex(captions, currentTime);
  const dspmParcel = disagreement?.peaks?.dspm?.parcel;
  const sloretaParcel = disagreement?.peaks?.sloreta?.parcel;
  const pathMethod = split ? "dspm" : method;
  const path = useMemo(
    () =>
      propagationPath(
        disagreement?.spread_order?.[pathMethod],
        disagreement?.peaks?.[pathMethod]?.parcel,
        disagreement?.peaks?.[pathMethod]?.peak_time
      ),
    [disagreement, pathMethod]
  );
  const pathParcels = path.map((step) => step.parcel);
  const overlayHighlights = showOverlay && !focusPath ? highlights : pathParcels;

  function applyAction(action: SceneAction) {
    if (typeof action.seek_time === "number" && times.length) {
      setPlaying(false);
      setTimeIndex(nearestTimeIndex(times, action.seek_time));
    }
    if (action.method) setMethod(action.method);
    if (action.highlight && action.highlight.length) setHighlights(action.highlight);
    if (typeof action.split === "boolean") setSplit(action.split);
  }

  function renderCanvas(viewMethod: MethodName, pickable: boolean) {
    if (!data) return null;
    const viewPath = propagationPath(
      disagreement?.spread_order?.[viewMethod],
      disagreement?.peaks?.[viewMethod]?.parcel,
      disagreement?.peaks?.[viewMethod]?.peak_time
    );
    const viewStart = viewPath[0]?.parcel;
    const viewEnd = viewPath[viewPath.length - 1]?.parcel;
    const viewParcels = viewPath.map((step) => step.parcel);
    const viewPoints = viewPath
      .map((step) => parcelCentroid(data.mesh, step.parcel))
      .filter((point): point is [number, number, number] => point !== null);
    return (
      <Canvas camera={{ position: [0, 0, 220], fov: 35 }} gl={{ antialias: true }}>
        <color attach="background" args={["#07080a"]} />
        <Suspense fallback={null}>
          <CortexScene
            data={data}
            method={viewMethod}
            timeIndex={timeIndex}
            highlights={overlayHighlights}
            dspmParcel={dspmParcel}
            sloretaParcel={sloretaParcel}
            showArrow={showOverlay}
            pathParcels={focusPath ? viewParcels : []}
            startParcel={focusPath ? viewStart : undefined}
            endParcel={focusPath ? viewEnd : undefined}
            focusPath={focusPath}
            pathPoints={focusPath ? viewPoints : []}
            onHover={setHover}
            onPick={(label, x, y) => {
              if (!pickable) return;
              setSelection({
                label,
                method: viewMethod,
                time: currentTime,
                screenX: x,
                screenY: y,
              });
            }}
          />
        </Suspense>
      </Canvas>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interactive fsaverage cortex</CardTitle>
        <CardDescription>
          Colored by the computed source estimate. Path mode dims parcels off
          the start-to-peak spread and draws arrows along that order. That
          order is half-peak crossing in strong parcels, not electrographic
          onset. Click a caption to seek.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{error}</p>
        ) : null}
        {!error && !data ? (
          <p className="text-sm leading-relaxed text-muted-foreground">Loading cortex…</p>
        ) : null}
        {data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={method === "dspm" && !split ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSplit(false);
                  setMethod("dspm");
                }}
              >
                dSPM
              </Button>
              <Button
                type="button"
                variant={method === "sloreta" && !split ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSplit(false);
                  setMethod("sloreta");
                }}
              >
                sLORETA
              </Button>
              <Button
                type="button"
                variant={split ? "default" : "outline"}
                size="sm"
                onClick={() => setSplit((value) => !value)}
              >
                Split
              </Button>
              <Button
                type="button"
                variant={focusPath ? "default" : "outline"}
                size="sm"
                onClick={() => setFocusPath((value) => !value)}
              >
                Path
              </Button>
              <Button
                type="button"
                variant={showOverlay && !focusPath ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFocusPath(false);
                  setShowOverlay((value) => !value);
                }}
              >
                Overlay
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPlaying((value) => !value)}
              >
                {playing ? "Pause" : "Play"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!disagreement) return;
                  downloadReport(stats ?? {}, disagreement);
                }}
                disabled={!disagreement}
              >
                Download note
              </Button>
              {hover ? <Badge variant="outline">{hover}</Badge> : null}
              {disagreement?.type ? (
                <Badge variant="outline">
                  {disagreement.type}
                  {disagreement.time_lag ? " + time lag" : ""}
                </Badge>
              ) : null}
            </div>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              Time {currentTime.toFixed(0)} s
              <input
                type="range"
                min={0}
                max={Math.max(times.length - 1, 0)}
                value={timeIndex}
                onChange={(event) => {
                  setPlaying(false);
                  setTimeIndex(Number(event.target.value));
                }}
              />
            </label>
            <div
              className={`relative w-full overflow-hidden rounded-md bg-black ${
                split ? "grid h-[420px] grid-cols-2 gap-px" : "h-[420px]"
              }`}
            >
              {split ? (
                <>
                  {renderCanvas("dspm", true)}
                  {renderCanvas("sloreta", true)}
                </>
              ) : (
                renderCanvas(method, true)
              )}
              {selection ? (
                <RegionChat
                  liveQa={liveQa}
                  label={selection.label}
                  method={selection.method}
                  time={selection.time}
                  screenX={selection.screenX}
                  screenY={selection.screenY}
                  parcel={parcel}
                  onClose={() => setSelection(null)}
                  onAction={applyAction}
                />
              ) : null}
            </div>
            {path.length > 0 ? (
              <ol className="space-y-1">
                {path.map((step, index) => {
                  const role =
                    index === 0 ? "Start" : index === path.length - 1 ? "End" : `${index + 1}`;
                  const activeStep = Math.abs(step.time - currentTime) <= 0.51;
                  return (
                    <li key={`${step.parcel}-${step.time}`}>
                      <button
                        type="button"
                        className={`w-full rounded-md px-2 py-1 text-left text-sm leading-relaxed ${
                          activeStep ? "bg-accent/15 text-foreground" : "text-muted-foreground"
                        }`}
                        onClick={() => {
                          setPlaying(false);
                          setTimeIndex(nearestTimeIndex(times, step.time));
                          setFocusPath(true);
                        }}
                      >
                        <span className="text-accent">{role}</span>
                        {` · ${prettyParcel(step.parcel)} · ${step.time.toFixed(0)} s`}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : null}
            {captions.length > 0 ? (
              <ol className="space-y-2">
                {captions.map((caption, index) => (
                  <li key={`${caption.t}-${index}`}>
                    <button
                      type="button"
                      className={`w-full rounded-md px-2 py-1 text-left text-sm leading-relaxed ${
                        index === active
                          ? "bg-accent/15 text-foreground"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => {
                        if (typeof caption.t !== "number") return;
                        setPlaying(false);
                        setTimeIndex(nearestTimeIndex(times, caption.t));
                        if (caption.method === "dspm" || caption.method === "sloreta") {
                          setMethod(caption.method);
                          setSplit(false);
                        }
                      }}
                    >
                      <span className="text-accent">
                        {typeof caption.t === "number" ? `${caption.t.toFixed(0)}s` : "time unknown"}
                      </span>
                      {caption.method ? ` · ${caption.method}` : ""}
                      {caption.text ? ` · ${caption.text}` : ""}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Disagreement captions are missing. Run python -m pipeline.export_disagreement.
              </p>
            )}
            <AskBox liveQa={liveQa} onAction={applyAction} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
