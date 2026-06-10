# Face Enrollment System (5-Pose)

## Required Poses

Each enrollment must capture 5 images:

- `FRONT`
- `LEFT`
- `RIGHT`
- `UP`
- `DOWN`

## Database Structure

Face enrollment data is stored in `face_recognition_faceenrollment` with encrypted embedding support:

- `encrypted_embedding` (`EncryptedJSONField`): primary embedding (front pose)
- `pose_embeddings` (`EncryptedJSONField`): encrypted map of all pose embeddings
- `captured_poses` (`JSONField`): list of captured pose labels
- `model_provider` (`ArcFace`)
- `detector_backend` (`retinaface`)
- `confidence_threshold`
- `liveness_score`
- `liveness_checks`
- subject ownership fields (`user`, `student`, `faculty`, `subject_type`)

## Enrollment APIs

### Multi-pose enrollment

`POST /api/v1/face-recognition/enroll-multi/`

Body:

```json
{
  "pose_images": {
    "FRONT": "data:image/jpeg;base64,...",
    "LEFT": "data:image/jpeg;base64,...",
    "RIGHT": "data:image/jpeg;base64,...",
    "UP": "data:image/jpeg;base64,...",
    "DOWN": "data:image/jpeg;base64,..."
  }
}
```

Notes:

- Uses OpenCV + DeepFace (`ArcFace` + `RetinaFace`) in the service layer
- Liveness check is enforced before embeddings are persisted
- Embeddings are stored encrypted via `EncryptedJSONField`

### Backward-compatible single capture

`POST /api/v1/face-recognition/register/`

Supports either:

- single `image` payload, or
- `pose_images` payload (same as multi endpoint)

## Verification Service

### Multi-pose verification alias

`POST /api/v1/face-recognition/verify-multi/`

Body:

```json
{
  "image": "data:image/jpeg;base64,..."
}
```

Behavior:

- Probe image is encoded with ArcFace/RetinaFace
- Compared against all stored pose embeddings
- Best-scoring pose match is returned with confidence and distance

