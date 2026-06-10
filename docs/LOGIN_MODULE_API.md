# HexaAttender Login Module API

## Authentication Flow
1. `POST /api/v1/auth/initiate-login/` with `email` + `password`
2. `POST /api/v1/auth/verify-face/` with `challenge_id` + `image` (base64)
3. `POST /api/v1/auth/complete-login/` with `challenge_id`
4. Dashboard redirect by role

## Endpoints

### Initiate login
- **URL**: `/api/v1/auth/initiate-login/`
- **Body**:
```json
{ "mode": "password", "email": "user@org.com", "password": "secret" }
```
- **Response**:
```json
{ "challenge_id": "...", "face_required": true, "attempts": 0, "attempts_remaining": 5 }
```

### Verify face
- **URL**: `/api/v1/auth/verify-face/`
- **Body**:
```json
{ "challenge_id": "...", "image": "data:image/jpeg;base64,..." }
```
- **Success**:
```json
{ "verified": true, "confidence": 98.1, "attempts": 0, "attempts_remaining": 5 }
```
- **Failure**:
```json
{ "detail": "Face verification failed.", "attempts": 3, "attempts_remaining": 2, "lock_seconds": 0 }
```
- **Lockout** (after 5 failures):
```json
{ "detail": "Too many failed face attempts. Try again in 1 hour.", "attempts": 5, "attempts_remaining": 0, "lock_seconds": 3600 }
```

### Complete login
- **URL**: `/api/v1/auth/complete-login/`
- **Body**:
```json
{ "challenge_id": "..." }
```
- **Result**: sets JWT access/refresh cookies (`HttpOnly`) and returns user profile.

### Forgot password
- **URL**: `/api/v1/auth/forgot-password/`
- **Body**:
```json
{ "email": "user@org.com" }
```
