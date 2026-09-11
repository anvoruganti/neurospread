from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

from pipeline.cortex import (
    build_parcels,
    export_browser_cortex,
    mesh_from_surfaces,
    pack_activity_bin,
    sample_activity_at_times,
    write_activity_bin,
)


def test_sample_activity_picks_nearest_times():
    times = np.array([2996.0, 2997.0, 2998.0, 2999.0])
    data = np.array(
        [
            [1.0, 2.0, 3.0, 4.0],
            [-5.0, 0.0, 1.0, 0.5],
        ]
    )
    sampled = sample_activity_at_times(times, data, [2996.4, 2998.0])
    assert sampled.shape == (2, 2)
    assert sampled.dtype == np.float32
    np.testing.assert_allclose(sampled[:, 0], [1.0, 5.0])
    np.testing.assert_allclose(sampled[:, 1], [3.0, 1.0])


def test_build_parcels_aggregates_mean_and_peak():
    labels = ["a-lh", "a-lh", "b-rh"]
    times = [2996.0, 2997.0, 2998.0]
    activity = {
        "dspm": np.array(
            [
                [1.0, 2.0, 1.0],
                [3.0, 4.0, 1.0],
                [0.5, 0.5, 9.0],
            ],
            dtype=np.float32,
        )
    }
    parcels = build_parcels(labels, times, activity)
    assert parcels["times"] == times
    assert parcels["methods"] == ["dspm"]
    assert parcels["parcels"]["a-lh"]["hemisphere"] == "lh"
    assert parcels["parcels"]["a-lh"]["n_vertices"] == 2
    np.testing.assert_allclose(
        parcels["parcels"]["a-lh"]["methods"]["dspm"]["mean"],
        [2.0, 3.0, 1.0],
    )
    assert parcels["parcels"]["a-lh"]["methods"]["dspm"]["peak_time"] == 2997.0
    assert parcels["parcels"]["b-rh"]["methods"]["dspm"]["peak_value"] == 9.0


def test_pack_activity_bin_is_method_time_vertex(tmp_path: Path):
    dspm = np.array([[1.0, 2.0], [3.0, 4.0]], dtype=np.float32)
    sloreta = np.array([[5.0, 6.0], [7.0, 8.0]], dtype=np.float32)
    packed = pack_activity_bin([dspm, sloreta])
    # method0 t0: 1,3 ; t1: 2,4 ; method1 t0: 5,7 ; t1: 6,8
    np.testing.assert_array_equal(packed, np.array([1, 3, 2, 4, 5, 7, 6, 8], dtype=np.float32))
    path = write_activity_bin(tmp_path / "brain" / "activity.bin", [dspm, sloreta])
    loaded = np.fromfile(path, dtype=np.float32)
    np.testing.assert_array_equal(loaded, packed)


def test_mesh_from_surfaces_splits_labels():
    mesh = mesh_from_surfaces(
        lh_vertices=np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float32),
        lh_faces=np.array([[0, 1, 2]], dtype=np.int32),
        rh_vertices=np.array([[2, 0, 0], [3, 0, 0], [2, 1, 0]], dtype=np.float32),
        rh_faces=np.array([[0, 1, 2]], dtype=np.int32),
        labels=["a-lh", "a-lh", "b-lh", "c-rh", "c-rh", "d-rh"],
        times=[2996.0, 2997.0],
        methods=["dspm", "sloreta"],
    )
    assert mesh["subject"] == "fsaverage"
    assert mesh["hemispheres"]["lh"]["labels"] == ["a-lh", "a-lh", "b-lh"]
    assert mesh["hemispheres"]["rh"]["labels"] == ["c-rh", "c-rh", "d-rh"]
    assert mesh["activity"]["layout"] == "method_time_vertex"
    assert mesh["activity"]["n_vertices"] == 6
    assert mesh["activity"]["n_times"] == 2


def test_build_parcels_drops_vertex_fallback_labels():
    labels = ["a-lh", "lh-vertex-9", "b-rh"]
    times = [2996.0, 2997.0]
    activity = {
        "dspm": np.array([[1.0, 2.0], [9.0, 9.0], [0.5, 0.5]], dtype=np.float32)
    }
    parcels = build_parcels(labels, times, activity)
    assert "a-lh" in parcels["parcels"]
    assert "b-rh" in parcels["parcels"]
    assert "lh-vertex-9" not in parcels["parcels"]


def test_export_browser_cortex_writes_files(tmp_path: Path):
    labels = ["a-lh", "b-lh", "c-rh", "d-rh"]
    times = np.array([2996.0, 2997.0, 2998.0])
    data = np.array(
        [
            [1.0, 2.0, 1.0],
            [0.5, 0.5, 0.5],
            [3.0, 1.0, 1.0],
            [0.1, 0.2, 4.0],
        ],
        dtype=np.float64,
    )
    stc = SimpleNamespace(
        times=times,
        data=data,
        vertex_labels=labels,
        vertices=(np.array([0, 1]), np.array([0, 1])),
    )

    def load_surfaces(hemi: str):
        # Full inflated-like vertices; faces already in ico source order 0..n-1.
        if hemi == "lh":
            verts = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]], dtype=np.float32)
            faces = np.array([[0, 1, 0]], dtype=np.int32)  # degenerate ok for schema
            # STC uses vertices [0,1] so provide ico faces over those two + pad
            faces = np.array([[0, 1, 0]], dtype=np.int32)
            return verts, faces
        verts = np.array([[2, 0, 0], [3, 0, 0], [2, 1, 0]], dtype=np.float32)
        faces = np.array([[0, 1, 0]], dtype=np.int32)
        return verts, faces

    result = export_browser_cortex(
        {"dspm": stc, "sloreta": stc},
        tmp_path,
        time_step_s=1.0,
        load_surfaces=load_surfaces,
    )
    brain = tmp_path / "brain"
    assert (brain / "mesh.json").exists()
    assert (brain / "activity.bin").exists()
    assert (brain / "parcels.json").exists()
    assert (brain / "disagreement.json").exists()
    assert result["methods"] == ["dspm", "sloreta"]
    mesh = result["mesh"]
    assert len(mesh["hemispheres"]["lh"]["faces"]) == 1
    assert result["parcels"]["parcels"]["c-rh"]["methods"]["dspm"]["peak_time"] == 2996.0


def test_sample_activity_rejects_empty_times():
    with pytest.raises(ValueError, match="sample_times"):
        sample_activity_at_times(np.array([1.0]), np.array([[1.0]]), [])
