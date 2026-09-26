"""Run CinemaTraj's pinned DirectPoseOptimizer on FlyThru Y-up camera samples."""

import json
import os
from pathlib import Path
import subprocess
import sys

PINNED_COMMIT = "e0ac10e1e74514b4139a89393dbacbd98d0eee8e"


def main():
    root_value = os.environ.get("CINEMATRAJ_ROOT")
    root = Path(root_value).expanduser() if root_value else None
    if root is None or not root.is_dir():
        raise RuntimeError("Set CINEMATRAJ_ROOT to a CinemaTraj checkout at the pinned commit.")
    commit = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
    if commit != PINNED_COMMIT:
        raise RuntimeError(f"CinemaTraj checkout must be at {PINNED_COMMIT}; found {commit}.")
    import numpy as np
    import torch
    sys.path.insert(0, str(root.resolve()))
    from src.trajectory_optimizer.direct_pose_optimizer import DirectPoseOptimizer
    from src.trajectory_optimizer.trajectory_optimizer import ParametricOptimizationConfig

    data = json.load(sys.stdin)
    initial = np.asarray(data["positions"], dtype=np.float32)
    boxes = np.asarray(data["obstacles"], dtype=np.float32)
    margin = 0.25
    low = torch.as_tensor(boxes[:, 0], dtype=torch.float32)
    high = torch.as_tensor(boxes[:, 1], dtype=torch.float32)

    class BoxField:
        scene_min = np.minimum(initial.min(axis=0), boxes[:, 0].min(axis=0)) - 2
        scene_max = np.maximum(initial.max(axis=0), boxes[:, 1].max(axis=0)) + 2

        def __init__(self):
            self.diff_mesh_sdf = self

        def query_sdf(self, points):
            center = (low + high) / 2
            half = (high - low) / 2
            q = torch.abs(points[:, None, :] - center[None, :, :]) - half[None, :, :]
            outside = torch.linalg.vector_norm(torch.clamp(q, min=0), dim=-1)
            inside = torch.clamp(q.max(dim=-1).values, max=0)
            return (outside + inside).min(dim=1).values

        def query_mesh_sdf(self, points):
            return self.query_sdf(points)

        def query_mesh_collision_count(self, points, margin=0.1):
            return int((self.query_sdf(points) < margin).sum().item())

    field = BoxField()
    torch.manual_seed(4)
    torch.set_num_threads(1)
    config = ParametricOptimizationConfig(
        n_iterations=400, n_samples=len(initial), learning_rate=1.0,
        safety_margin=margin, mesh_sdf_weight=20.0, smoothness_weight=0.2,
        boundary_weight=1.0, parameter_regularization=0.001,
    )
    result = DirectPoseOptimizer(field, config, device="cpu").optimize_positions(initial, verbose=False, pin_endpoints=False)
    if not np.isfinite(result).all():
        raise RuntimeError("CinemaTraj returned an invalid path.")
    # Playback linearly interpolates samples. Check its actual segments too.
    dense = np.stack([np.interp(np.linspace(0, len(result) - 1, 2401), np.arange(len(result)), result[:, axis]) for axis in range(3)], axis=1).astype(np.float32)
    clearance = field.query_sdf(torch.from_numpy(dense)).detach().numpy()
    if np.min(clearance) < margin - 1e-3:
        raise RuntimeError("No clear camera path was found; try a different viewing angle or actor position.")
    print("CINEMATRAJ_RESULT=" + json.dumps({"positions": result.tolist(), "minClearance": float(np.min(clearance))}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
