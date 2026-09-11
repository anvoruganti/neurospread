"""Browser-ready cortex exports derived from source estimates.

The mesh and activity come from the inverse solution on fsaverage. Astra never
draws these files.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from pipeline.render import movie_time_points


def sample_activity_at_times(
    times: np.ndarray,
    data: np.ndarray,
    sample_times: list[float],
) -> np.ndarray:
    """Nearest-neighbor sample of (n_sources, n_times) onto sample_times.

    Returns float32 array shaped (n_sources, n_samples).
    """
    times = np.asarray(times, dtype=np.float64)
    data = np.asarray(data)
    if data.ndim != 2:
        raise ValueError("data must be shaped (n_sources, n_times)")
    if len(times) != data.shape[1]:
        raise ValueError("times length must match data time axis")
    if not sample_times:
        raise ValueError("sample_times must not be empty")
    indices = [int(np.argmin(np.abs(times - t))) for t in sample_times]
    return np.ascontiguousarray(np.abs(data[:, indices]), dtype=np.float32)


def build_parcels(
    labels: list[str],
    times: list[float],
    method_activity: dict[str, np.ndarray],
    *,
    drop_vertex_fallbacks: bool = True,
) -> dict:
    """Aggregate per-vertex activity into aparc parcels.

    method_activity values are shaped (n_sources, n_times), absolute amplitudes.
    """
    if not labels:
        raise ValueError("labels must not be empty")
    n_sources = len(labels)
    for method, activity in method_activity.items():
        arr = np.asarray(activity)
        if arr.shape != (n_sources, len(times)):
            raise ValueError(
                f"{method} activity shape {arr.shape} != ({n_sources}, {len(times)})"
            )

    parcel_names = sorted(set(labels))
    if drop_vertex_fallbacks:
        parcel_names = [name for name in parcel_names if "-vertex-" not in name]
    parcels: dict[str, Any] = {}
    for name in parcel_names:
        indices = [i for i, label in enumerate(labels) if label == name]
        if name.endswith("-lh") or name.startswith("lh-"):
            hemi = "lh"
        elif name.endswith("-rh") or name.startswith("rh-"):
            hemi = "rh"
        else:
            hemi = "lh"
        methods: dict[str, Any] = {}
        for method, activity in method_activity.items():
            mean = np.mean(np.asarray(activity)[indices], axis=0)
            peak_index = int(np.argmax(mean))
            methods[method] = {
                "mean": [round(float(v), 6) for v in mean],
                "peak_time": float(times[peak_index]),
                "peak_value": round(float(mean[peak_index]), 6),
            }
        parcels[name] = {"hemisphere": hemi, "n_vertices": len(indices), "methods": methods}

    return {
        "times": [float(t) for t in times],
        "methods": list(method_activity.keys()),
        "parcels": parcels,
    }


def activity_layout(
    methods: list[str],
    n_times: int,
    n_vertices: int,
) -> dict:
    return {
        "methods": methods,
        "n_times": n_times,
        "n_vertices": n_vertices,
        "dtype": "float32",
        "layout": "method_time_vertex",
        "file": "activity.bin",
    }


def pack_activity_bin(method_arrays: list[np.ndarray]) -> np.ndarray:
    """Pack per-method (n_vertices, n_times) arrays into method_time_vertex order."""
    if not method_arrays:
        raise ValueError("need at least one method")
    packed = []
    expected = method_arrays[0].shape
    for arr in method_arrays:
        arr = np.asarray(arr, dtype=np.float32)
        if arr.ndim != 2:
            raise ValueError("each method array must be (n_vertices, n_times)")
        if arr.shape != expected:
            raise ValueError("all method arrays must share shape")
        # Transpose to (n_times, n_vertices) then flatten time-major.
        packed.append(np.ascontiguousarray(arr.T).reshape(-1))
    return np.concatenate(packed).astype(np.float32, copy=False)


def write_activity_bin(path: Path, method_arrays: list[np.ndarray]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    pack_activity_bin(method_arrays).tofile(path)
    return path


def write_mesh_json(path: Path, mesh: dict) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(mesh, indent=2) + "\n", encoding="utf-8")
    return path


def write_parcels_json(path: Path, parcels: dict) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(parcels, indent=2) + "\n", encoding="utf-8")
    return path


def mesh_from_surfaces(
    *,
    lh_vertices: np.ndarray,
    lh_faces: np.ndarray,
    rh_vertices: np.ndarray,
    rh_faces: np.ndarray,
    labels: list[str],
    times: list[float],
    methods: list[str],
) -> dict:
    n_lh = len(lh_vertices)
    n_rh = len(rh_vertices)
    if len(labels) != n_lh + n_rh:
        raise ValueError("labels length must equal lh+rh vertex counts")
    return {
        "subject": "fsaverage",
        "surface": "inflated",
        "hemispheres": {
            "lh": {
                "vertices": np.round(np.asarray(lh_vertices, dtype=np.float32), 2).tolist(),
                "faces": np.asarray(lh_faces, dtype=np.int32).tolist(),
                "labels": labels[:n_lh],
            },
            "rh": {
                "vertices": np.round(np.asarray(rh_vertices, dtype=np.float32), 2).tolist(),
                "faces": np.asarray(rh_faces, dtype=np.int32).tolist(),
                "labels": labels[n_lh:],
            },
        },
        "activity": {
            **activity_layout(methods, len(times), n_lh + n_rh),
            "times": [float(t) for t in times],
        },
    }


def export_browser_cortex(
    estimates: dict[str, Any],
    out_dir: Path,
    *,
    time_step_s: float = 1.0,
    load_surfaces: Any | None = None,
) -> dict:
    """Write brain/mesh.json, brain/activity.bin, and brain/parcels.json.

    estimates maps method name -> object with .times, .data, .vertex_labels,
    and .vertices (lh, rh index arrays into the full inflated surface).
    load_surfaces(hemi) -> (vertices, faces) for the full inflated surface.
    """
    if load_surfaces is None:
        raise ValueError("load_surfaces is required to export mesh geometry")
    methods = [m for m in ("dspm", "sloreta") if m in estimates]
    if not methods:
        raise ValueError("estimates must include dspm or sloreta")
    first = estimates[methods[0]]
    for attr in ("times", "data", "vertex_labels", "vertices"):
        if not hasattr(first, attr):
            raise ValueError(f"source estimate is missing {attr}")

    tmin = float(first.times[0])
    tmax = float(first.times[-1])
    sample_times = movie_time_points(tmin, tmax, time_step_s)
    labels = list(first.vertex_labels)

    sampled: dict[str, np.ndarray] = {}
    for method in methods:
        stc = estimates[method]
        sampled[method] = sample_activity_at_times(stc.times, stc.data, sample_times)

    lh_verts_full, lh_faces_full = load_surfaces("lh")
    rh_verts_full, rh_faces_full = load_surfaces("rh")
    lh_idx = np.asarray(first.vertices[0], dtype=np.int64)
    rh_idx = np.asarray(first.vertices[1], dtype=np.int64)

    lh_vertices = np.asarray(lh_verts_full, dtype=np.float32)[lh_idx]
    rh_vertices = np.asarray(rh_verts_full, dtype=np.float32)[rh_idx]
    # load_surfaces may return either dense-surface faces or ico-5 use_tris.
    # Prefer faces that already index the STC vertex order (0..n-1).
    lh_faces = _faces_for_source_vertices(np.asarray(lh_faces_full), lh_idx)
    rh_faces = _faces_for_source_vertices(np.asarray(rh_faces_full), rh_idx)

    brain_dir = out_dir / "brain"
    mesh = mesh_from_surfaces(
        lh_vertices=lh_vertices,
        lh_faces=lh_faces,
        rh_vertices=rh_vertices,
        rh_faces=rh_faces,
        labels=labels,
        times=sample_times,
        methods=methods,
    )
    write_mesh_json(brain_dir / "mesh.json", mesh)
    write_activity_bin(brain_dir / "activity.bin", [sampled[m] for m in methods])
    parcels = build_parcels(labels, sample_times, sampled)
    write_parcels_json(brain_dir / "parcels.json", parcels)
    from pipeline.disagreement import analyze_disagreement

    disagreement = analyze_disagreement(parcels)
    write_parcels_json(brain_dir / "disagreement.json", disagreement)
    return {
        "mesh": mesh,
        "parcels": parcels,
        "disagreement": disagreement,
        "methods": methods,
        "times": sample_times,
    }


def _faces_for_source_vertices(faces: np.ndarray, keep_indices: np.ndarray) -> np.ndarray:
    """Return faces in STC vertex order.

    If faces already index 0..n_sources-1 (ico-5 use_tris), keep them.
    Otherwise remap dense-surface faces onto keep_indices.
    """
    n_sources = len(keep_indices)
    faces = np.asarray(faces)
    if faces.size == 0:
        return faces.reshape(0, 3).astype(np.int32)
    if int(np.max(faces)) < n_sources:
        return np.asarray(faces, dtype=np.int32)
    return _remap_faces(faces, keep_indices)


def _remap_faces(faces: np.ndarray, keep_indices: np.ndarray) -> np.ndarray:
    """Keep only faces whose three vertices are in keep_indices; remap to 0..n-1."""
    max_index = 0
    if len(keep_indices):
        max_index = max(max_index, int(np.max(keep_indices)))
    if faces.size:
        max_index = max(max_index, int(np.max(faces)))
    lookup = -np.ones(max_index + 1, dtype=np.int32)
    lookup[keep_indices] = np.arange(len(keep_indices), dtype=np.int32)
    remapped = lookup[faces]
    keep = np.all(remapped >= 0, axis=1)
    return remapped[keep]
