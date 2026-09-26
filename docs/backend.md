# Prototype backend contract

The browser remains responsible for interactive editing, playback, project files, and local autosave. The Railway web service protects the Gemini key, validates AI plans, and brokers optimization jobs. It stores no project state in this prototype.

## Plan a shot

`POST /api/plan` accepts:

```json
{
  "projectId": "demo",
  "revision": "rev-7",
  "prompt": "Slow push toward the chair with a natural perspective",
  "sceneDescription": "Daylit pavilion interior",
  "subject": {
    "subjectId": "chair-1",
    "subjectName": "Barcelona chair",
    "min": [-1, 0, -1],
    "max": [1, 1, 1],
    "cameraPosition": [4, 2, 6]
  }
}
```

The result contains the same project reference, a validated `ShotSettings` object, and a short rationale. The browser passes the settings into the existing deterministic `generateShot` function; Gemini never supplies raw camera marks.

## GPU worker contract

The configured worker must implement:

- `POST /v1/jobs` — accepts `{ projectId, revision, shot, sceneSnapshot }` and returns a job.
- `GET /v1/jobs/:id` — returns current job state.
- `DELETE /v1/jobs/:id` — cancels and returns the job.

A job has this shape:

```json
{
  "id": "job-123",
  "projectId": "demo",
  "revision": "rev-7",
  "status": "running",
  "progress": 0.45,
  "result": null
}
```

Valid states are `queued`, `running`, `succeeded`, `failed`, and `cancelled`; progress is normalized to 0–1. The worker must echo the original project ID and revision with every response. Results from a revision other than the browser's current revision are proposals and must not overwrite current edits.

The API limits JSON request bodies to 2 MiB. Large meshes or scans should later move to object storage and be referenced by URL rather than embedded in `sceneSnapshot`.
