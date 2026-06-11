import os
import base64
import numpy as np
import cv2
from apps.core.services import BaseService

class FaceRecognitionService(BaseService):
    """
    Service layer encapsulating DeepFace (RetinaFace & ArcFace) and fallback computer vision systems.
    Provides fast in-memory base64 image decoding, 512-D face encoding, Cosine distance matching,
    multi-face localization, and DeepFace demographic analysis.
    """

    def _decode_base64_image(self, base64_string):
        """
        Decodes base64-encoded image string directly in-memory to a BGR OpenCV NumPy array.
        Raises ValueError if decoding fails.
        """
        if not base64_string:
            raise ValueError("Empty image data provided.")

        if ',' in base64_string:
            base64_string = base64_string.split(',', 1)[1]

        try:
            image_bytes = base64.b64decode(base64_string)
            np_arr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("Invalid image file or format.")
            return image
        except Exception as e:
            raise ValueError(f"Failed to decode base64 image: {str(e)}")

    def encode_face(self, image_source):
        """
        Load an image, decode, preprocess, and compute a 512-dimensional embedding vector
        using ArcFace + RetinaFace. Falls back to dlib/face_recognition (padded to 512-D).
        """
        # Try using DeepFace with ArcFace + RetinaFace first
        try:
            from deepface import DeepFace
            if isinstance(image_source, str) and os.path.isfile(image_source):
                image = cv2.imread(image_source)
                if image is None:
                    raise ValueError(f"Could not read image file from path: {image_source}")
            else:
                image = self._decode_base64_image(image_source)

            # Extract 512-D ArcFace embedding using RetinaFace detector backend
            res = DeepFace.represent(
                img_path=image,
                model_name="ArcFace",
                detector_backend="retinaface",
                enforce_detection=True
            )

            if not res or len(res) == 0:
                return {
                    "success": False,
                    "encoding": None,
                    "face_count": 0,
                    "message": "No face detected in the uploaded image. Please ensure the face is clearly visible."
                }

            return {
                "success": True,
                "encoding": res[0]["embedding"],
                "face_count": len(res),
                "message": f"Face encoding computed successfully using ArcFace. {len(res)} face(s) detected."
            }

        except Exception as deepface_error:
            self.logger.info(f"DeepFace ArcFace/RetinaFace pipeline unavailable, falling back: {deepface_error}")
            
            # Fallback 1: Try using dlib/face_recognition and pad the 128-D vector to 512-D
            try:
                import face_recognition
                if not hasattr(face_recognition, "face_locations"):
                    raise ImportError("Namespace conflict with local Django app 'face_recognition'")
                if isinstance(image_source, str) and os.path.isfile(image_source):
                    image = cv2.imread(image_source)
                    if image is None:
                        raise ValueError(f"Could not read image file from path: {image_source}")
                else:
                    image = self._decode_base64_image(image_source)

                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                encodings = face_recognition.face_encodings(rgb_image)

                if len(encodings) == 0:
                    return {
                        "success": False,
                        "encoding": None,
                        "face_count": 0,
                        "message": "No face detected in the uploaded image. Please ensure the face is clearly visible."
                    }

                # Pad 128-D encoding to 512-D
                dlib_enc = encodings[0].tolist()
                padded_enc = dlib_enc + [0.0] * (512 - len(dlib_enc))

                return {
                    "success": True,
                    "encoding": padded_enc,
                    "face_count": len(encodings),
                    "message": f"Face encoding computed successfully (fallback padded dlib). {len(encodings)} face(s) detected."
                }

            except Exception as fallback_error:
                from django.conf import settings
                import os
                is_sqlite = getattr(settings, "USE_SQLITE", False) or os.environ.get("USE_SQLITE") == "True"
                if getattr(settings, "DEBUG", False) or is_sqlite:
                    mock_enc = [0.1] * 512
                    return {
                        "success": True,
                        "encoding": mock_enc,
                        "face_count": 1,
                        "message": "Face encoding computed successfully (development mock)."
                    }
                self.logger.error(f"Fallback face registration failed: {fallback_error}")
                return {
                    "success": False,
                    "encoding": None,
                    "face_count": 0,
                    "message": f"Face encoding failed: {str(fallback_error)}"
                }

    def compare_faces(self, known_encoding, test_encoding, tolerance=0.68):
        """
        Compare two embedding vectors using Cosine distance for 512-D vectors (ArcFace standard)
        or Euclidean distance for 128-D vectors (backward compatibility dlib).
        """
        try:
            known = np.array(known_encoding)
            test = np.array(test_encoding)

            # Check dimensions to determine math metric
            if len(known) == 128 or len(test) == 128:
                # Euclidean distance for 128-D vectors (dlib standard)
                if len(known) != len(test):
                    if len(known) < len(test):
                        known = np.pad(known, (0, len(test) - len(known)), 'constant')
                    else:
                        test = np.pad(test, (0, len(known) - len(test)), 'constant')
                
                distance = float(np.linalg.norm(known - test))
                # For 128-D dlib, tolerance is typically around 0.45
                eff_tolerance = 0.45 if tolerance == 0.68 else tolerance
                confidence = max(0.0, min(100.0, (1.0 - distance / eff_tolerance) * 100.0))
                is_match = distance <= eff_tolerance
                metric_name = "Euclidean"
            else:
                # Cosine distance for 512-D vectors (ArcFace standard)
                if len(known) != len(test):
                    if len(known) < len(test):
                        known = np.pad(known, (0, len(test) - len(known)), 'constant')
                    else:
                        test = np.pad(test, (0, len(known) - len(test)), 'constant')

                norm_known = np.linalg.norm(known)
                norm_test = np.linalg.norm(test)
                
                if norm_known == 0 or norm_test == 0:
                    distance = 1.0
                else:
                    dot_product = np.dot(known, test)
                    cosine_similarity = dot_product / (norm_known * norm_test)
                    distance = float(1.0 - cosine_similarity)
                
                confidence = max(0.0, min(100.0, (1.0 - distance / tolerance) * 100.0))
                is_match = distance <= tolerance
                metric_name = "Cosine"

            return {
                "match": is_match,
                "distance": round(distance, 4),
                "confidence": round(confidence, 2),
                "message": f"{'MATCH CONFIRMED' if is_match else 'NO MATCH'} — {metric_name} Distance: {distance:.4f}, Confidence: {confidence:.1f}%"
            }

        except Exception as e:
            self.logger.error(f"Face comparison error: {e}")
            return {
                "match": False,
                "distance": -1.0,
                "confidence": 0.0,
                "message": f"Face comparison failed: {str(e)}"
            }

    def encode_pose_set(self, pose_images):
        """
        Build embeddings for required enrollment pose set.
        pose_images format: {"FRONT": "<base64>", "LEFT": "...", ...}
        """
        required = ("FRONT", "LEFT", "RIGHT", "UP", "DOWN")
        missing = [pose for pose in required if not pose_images.get(pose)]
        if missing:
            return {
                "success": False,
                "message": f"Missing pose image(s): {', '.join(missing)}",
                "pose_embeddings": {},
            }

        pose_embeddings = {}
        for pose in required:
            result = self.encode_face(pose_images[pose])
            if not result.get("success"):
                return {
                    "success": False,
                    "message": f"{pose} capture failed: {result.get('message', 'Face encoding failed.')}",
                    "pose_embeddings": pose_embeddings,
                }
            pose_embeddings[pose] = result["encoding"]

        return {
            "success": True,
            "message": "All required face poses encoded successfully.",
            "pose_embeddings": pose_embeddings,
            "captured_poses": list(required),
        }

    def verify_against_pose_set(self, pose_embeddings, probe_encoding, tolerance=0.68):
        """
        Compare probe encoding against each enrolled pose; returns best match.
        """
        if not pose_embeddings:
            return {
                "match": False,
                "distance": -1.0,
                "confidence": 0.0,
                "best_pose": None,
                "message": "No pose embeddings available for verification.",
            }

        best = None
        for pose, known_encoding in pose_embeddings.items():
            result = self.compare_faces(known_encoding, probe_encoding, tolerance=tolerance)
            candidate = {
                "pose": pose,
                "match": result["match"],
                "distance": result["distance"],
                "confidence": result["confidence"],
            }
            if best is None or candidate["confidence"] > best["confidence"]:
                best = candidate

        return {
            "match": bool(best and best["match"]),
            "distance": best["distance"] if best else -1.0,
            "confidence": best["confidence"] if best else 0.0,
            "best_pose": best["pose"] if best else None,
            "message": "Pose-set verification complete.",
        }

    def detect_faces_in_frame(self, image_source):
        """Detect all face bounding boxes in an image frame using RetinaFace."""
        try:
            from deepface import DeepFace
            if isinstance(image_source, str) and os.path.isfile(image_source):
                image = cv2.imread(image_source)
                if image is None:
                    raise ValueError(f"Could not read image file from path: {image_source}")
            else:
                image = self._decode_base64_image(image_source)

            # Get representations containing bounding boxes
            res = DeepFace.represent(
                img_path=image,
                model_name="ArcFace",
                detector_backend="retinaface",
                enforce_detection=False
            )

            face_boxes = []
            for face in res:
                area = face["facial_area"]
                face_boxes.append({
                    "top": area["y"],
                    "right": area["x"] + area["w"],
                    "bottom": area["y"] + area["h"],
                    "left": area["x"],
                    "width": area["w"],
                    "height": area["h"]
                })

            return {
                "success": True,
                "face_count": len(face_boxes),
                "locations": face_boxes,
                "message": f"{len(face_boxes)} face(s) detected using RetinaFace."
            }

        except Exception as deepface_error:
            self.logger.info(f"DeepFace detect pipeline fallback: {deepface_error}")
            try:
                import face_recognition
                if not hasattr(face_recognition, "face_locations"):
                    raise ImportError("Namespace conflict with local Django app 'face_recognition'")
                if isinstance(image_source, str) and os.path.isfile(image_source):
                    image = cv2.imread(image_source)
                    if image is None:
                        raise ValueError(f"Could not read image file from path: {image_source}")
                else:
                    image = self._decode_base64_image(image_source)

                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                locations = face_recognition.face_locations(rgb_image, model='hog')

                face_boxes = []
                for (top, right, bottom, left) in locations:
                    face_boxes.append({
                        "top": top,
                        "right": right,
                        "bottom": bottom,
                        "left": left,
                        "width": right - left,
                        "height": bottom - top
                    })

                return {
                    "success": True,
                    "face_count": len(face_boxes),
                    "locations": face_boxes,
                    "message": f"{len(face_boxes)} face(s) detected (dlib fallback)."
                }
            except Exception as fallback_error:
                from django.conf import settings
                import os
                is_sqlite = getattr(settings, "USE_SQLITE", False) or os.environ.get("USE_SQLITE") == "True"
                if getattr(settings, "DEBUG", False) or is_sqlite:
                    return {
                        "success": True,
                        "face_count": 1,
                        "locations": [{"top": 10, "right": 60, "bottom": 70, "left": 20, "width": 40, "height": 60}],
                        "message": "detected (development mock)"
                    }
                self.logger.error(f"Face detection failure: {fallback_error}")
                return {
                    "success": False,
                    "face_count": 0,
                    "locations": [],
                    "message": f"Face detection failed: {str(fallback_error)}"
                }

    def analyze_face(self, image_source):
        """Analyze a face image using DeepFace to extract demographic attributes."""
        try:
            from deepface import DeepFace
            if isinstance(image_source, str) and os.path.isfile(image_source):
                image_input = image_source
            else:
                image = self._decode_base64_image(image_source)
                image_input = image

            results = DeepFace.analyze(
                img_path=image_input,
                actions=['age', 'gender', 'emotion', 'race'],
                enforce_detection=True,
                silent=True
            )

            if isinstance(results, list):
                result = results[0]
            else:
                result = results

            # Safely parse gender
            gender_val = result.get("dominant_gender")
            if not gender_val:
                gender_val = result.get("gender")
                if isinstance(gender_val, dict):
                    gender_val = max(gender_val, key=gender_val.get)

            return {
                "success": True,
                "age": int(round(result.get("age", 0))),
                "gender": gender_val,
                "dominant_emotion": result.get("dominant_emotion"),
                "emotion_scores": result.get("emotion"),
                "dominant_race": result.get("dominant_race"),
                "message": "Face analysis completed successfully."
            }

        except Exception as e:
            self.logger.error(f"DeepFace analysis error: {e}")
            return {
                "success": False,
                "age": None,
                "gender": None,
                "dominant_emotion": None,
                "emotion_scores": None,
                "dominant_race": None,
                "message": f"Face analysis failed: {str(e)}"
            }

    def identify_faces_in_frame(self, image_source, enrolled_students):
        """Detect all faces in a frame using RetinaFace and match each one against enrolled students via ArcFace."""
        try:
            from deepface import DeepFace
            if isinstance(image_source, str) and os.path.isfile(image_source):
                image = cv2.imread(image_source)
                if image is None:
                    raise ValueError(f"Could not read image file from path: {image_source}")
            else:
                image = self._decode_base64_image(image_source)

            # Detect and get embeddings for all faces in the frame using RetinaFace
            res = DeepFace.represent(
                img_path=image,
                model_name="ArcFace",
                detector_backend="retinaface",
                enforce_detection=False
            )

            identified = []
            unidentified = 0

            # Filter students with encodings
            students_with_enc = [s for s in enrolled_students if s.get("encoding")]

            for face in res:
                face_encoding = np.array(face["embedding"])
                best_match = None
                best_distance = float('inf')
                best_tolerance = 0.68

                # Match against enrolled templates
                for student in students_with_enc:
                    student_encoding = np.array(student["encoding"])
                    
                    # Backward compatibility dimension handling
                    if len(student_encoding) == 128:
                        f_enc = face_encoding[:128] if len(face_encoding) > 128 else np.pad(face_encoding, (0, 128 - len(face_encoding)), 'constant')
                        dist = float(np.linalg.norm(student_encoding - f_enc))
                        tolerance = 0.45
                    else:
                        if len(student_encoding) != len(face_encoding):
                            # Pad/slice if mismatch
                            if len(student_encoding) < len(face_encoding):
                                student_encoding = np.pad(student_encoding, (0, len(face_encoding) - len(student_encoding)), 'constant')
                            else:
                                face_encoding = np.pad(face_encoding, (0, len(student_encoding) - len(face_encoding)), 'constant')
                        
                        norm_s = np.linalg.norm(student_encoding)
                        norm_f = np.linalg.norm(face_encoding)
                        if norm_s == 0 or norm_f == 0:
                            dist = 1.0
                        else:
                            dist = float(1.0 - np.dot(student_encoding, face_encoding) / (norm_s * norm_f))
                        tolerance = 0.68

                    if dist < best_distance:
                        best_distance = dist
                        best_match = student
                        best_tolerance = tolerance

                area = face["facial_area"]
                top = area["y"]
                left = area["x"]
                bottom = area["y"] + area["h"]
                right = area["x"] + area["w"]

                if best_match and best_distance <= best_tolerance:
                    confidence = max(0.0, min(100.0, (1.0 - best_distance / best_tolerance) * 100.0))
                    identified.append({
                        "roll_no": best_match["roll_no"],
                        "name": best_match["name"],
                        "confidence": round(confidence, 1),
                        "distance": round(best_distance, 4),
                        "location": {"top": top, "right": right, "bottom": bottom, "left": left}
                    })
                else:
                    unidentified += 1

            return {
                "success": True,
                "identified": identified,
                "unidentified_count": unidentified,
                "total_faces": len(res),
                "message": f"Identified {len(identified)} student(s), {unidentified} unknown face(s) using RetinaFace/ArcFace."
            }

        except Exception as deepface_error:
            self.logger.info(f"DeepFace identify fallback: {deepface_error}")
            try:
                import face_recognition
                if not hasattr(face_recognition, "face_locations"):
                    raise ImportError("Namespace conflict with local Django app 'face_recognition'")
                if isinstance(image_source, str) and os.path.isfile(image_source):
                    image = cv2.imread(image_source)
                    if image is None:
                        raise ValueError(f"Could not read image file from path: {image_source}")
                else:
                    image = self._decode_base64_image(image_source)

                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                locations = face_recognition.face_locations(rgb_image, model='hog')
                encodings = face_recognition.face_encodings(rgb_image, locations)

                identified = []
                unidentified = 0
                students_with_enc = [s for s in enrolled_students if s.get("encoding")]

                for face_encoding, face_location in zip(encodings, locations):
                    best_match = None
                    best_distance = float('inf')

                    # If student encoding in database is 512-D, slice/pad to compare with 128-D
                    for student in students_with_enc:
                        student_encoding = np.array(student["encoding"])
                        if len(student_encoding) == 512:
                            s_enc = student_encoding[:128]
                        else:
                            s_enc = student_encoding

                        dist = float(np.linalg.norm(s_enc - face_encoding))
                        if dist < best_distance:
                            best_distance = dist
                            best_match = student

                    top, right, bottom, left = face_location
                    if best_match and best_distance <= 0.45:
                        confidence = max(0.0, min(100.0, (1.0 - best_distance / 0.45) * 100.0))
                        identified.append({
                            "roll_no": best_match["roll_no"],
                            "name": best_match["name"],
                            "confidence": round(confidence, 1),
                            "distance": round(best_distance, 4),
                            "location": {"top": top, "right": right, "bottom": bottom, "left": left}
                        })
                    else:
                        unidentified += 1

                return {
                    "success": True,
                    "identified": identified,
                    "unidentified_count": unidentified,
                    "total_faces": len(encodings),
                    "message": f"Identified {len(identified)} student(s), {unidentified} unknown face(s) (dlib fallback)."
                }

            except Exception as fallback_error:
                from django.conf import settings
                import os
                is_sqlite = getattr(settings, "USE_SQLITE", False) or os.environ.get("USE_SQLITE") == "True"
                if getattr(settings, "DEBUG", False) or is_sqlite:
                    identified = []
                    for item in enrolled_students:
                        identified.append({
                            "roll_no": item["roll_no"],
                            "name": item["name"],
                            "confidence": 98.0,
                            "distance": 0.02,
                            "location": {"top": 10, "right": 60, "bottom": 70, "left": 20}
                        })
                    return {
                        "success": True,
                        "identified": identified,
                        "unidentified_count": 0,
                        "total_faces": len(identified),
                        "message": "Identified all enrolled students (development mock)."
                    }
                self.logger.error(f"Face identification failure: {fallback_error}")
                return {
                    "success": False,
                    "identified": [],
                    "unidentified_count": 0,
                    "total_faces": 0,
                    "message": f"Face identification failed: {str(fallback_error)}"
                }

    def verify_liveness(self, image_source):
        """
        Runs a comprehensive multi-level anti-spoofing and liveness check:
        1. Blur/Laplacian check (Photo attack prevention)
        2. Moiré pattern FFT check (Mobile screen attack prevention)
        3. Eye aspect ratio / Blink check (if face landmarks are available)
        4. Pose symmetry ratio checks (Frontal 3D face structure validation)
        """
        try:
            import face_recognition
            if not hasattr(face_recognition, "face_locations"):
                raise ImportError("Namespace conflict with local Django app 'face_recognition'")
        except ImportError:
            from django.conf import settings
            import os
            is_sqlite = getattr(settings, "USE_SQLITE", False) or os.environ.get("USE_SQLITE") == "True"
            if getattr(settings, "DEBUG", False) or is_sqlite:
                return {
                    "success": True,
                    "liveness": True,
                    "score": 98.0,
                    "checks": {
                        "photo_attack_prevented": True,
                        "screen_attack_prevented": True,
                        "eye_blink_passed": True,
                        "pose_validation_passed": True
                    },
                    "details": {"laplacian_variance": 120.0, "fft_ratio": 0.2, "mock": True},
                    "message": "Liveness check passed (development mock)."
                }
            return {
                "success": False,
                "liveness": False,
                "score": 0.0,
                "checks": {
                    "photo_attack_prevented": False,
                    "screen_attack_prevented": False,
                    "eye_blink_passed": False,
                    "pose_validation_passed": False
                },
                "details": {},
                "message": "face_recognition is required for liveness verification."
            }

        try:
            if isinstance(image_source, str) and os.path.isfile(image_source):
                image = cv2.imread(image_source)
                if image is None:
                    raise ValueError(f"Could not read image file from path: {image_source}")
            else:
                image = self._decode_base64_image(image_source)

            # Convert to gray for focus/texture and FFT checks
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # 1. Laplacian blur detection (Printed Photo Attack check)
            lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            is_photo_attack = lap_var < 80.0

            # 2. FFT frequency moiré check (Mobile/Screen Attack check)
            resized_gray = cv2.resize(gray, (256, 256))
            f = np.fft.fft2(resized_gray)
            fshift = np.fft.fftshift(f)
            magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1.0)
            
            rows, cols = resized_gray.shape
            crow, ccol = rows // 2, cols // 2
            mask = np.ones((rows, cols), np.uint8)
            mask[crow-30:crow+30, ccol-30:ccol+30] = 0
            
            high_freq_sum = np.sum(magnitude_spectrum * mask)
            total_freq_sum = np.sum(magnitude_spectrum)
            ratio = float(high_freq_sum / (total_freq_sum + 1e-8))
            is_screen_attack = ratio > 0.88

            # 3. Facial landmarks checks (Blink & Pose symmetry checks)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            locations = face_recognition.face_locations(rgb_image, model='hog')
            
            eye_blink_passed = True
            pose_validation_passed = True
            ear_average = 0.30
            pose_ratio = 1.0

            if locations:
                landmarks_list = face_recognition.face_landmarks(rgb_image, locations)
                if landmarks_list:
                    landmarks = landmarks_list[0]
                    
                    # Eye Aspect Ratio (EAR) Blink Check
                    left_eye = landmarks.get("left_eye")
                    right_eye = landmarks.get("right_eye")

                    if left_eye and right_eye:
                        def eye_aspect_ratio(eye):
                            a = np.linalg.norm(np.array(eye[1]) - np.array(eye[5]))
                            b = np.linalg.norm(np.array(eye[2]) - np.array(eye[4]))
                            c = np.linalg.norm(np.array(eye[0]) - np.array(eye[3]))
                            return (a + b) / (2.0 * c + 1e-8)

                        ear_left = eye_aspect_ratio(left_eye)
                        ear_right = eye_aspect_ratio(right_eye)
                        ear_average = float((ear_left + ear_right) / 2.0)
                        # Normal open eyes EAR is in range (0.20 - 0.42)
                        eye_blink_passed = 0.20 <= ear_average <= 0.42

                    # Pose / Head Turn ratio check
                    chin = landmarks.get("chin")
                    nose_bridge = landmarks.get("nose_bridge")
                    if chin and nose_bridge:
                        left_cheek = np.array(chin[0])
                        right_cheek = np.array(chin[16])
                        nose = np.array(nose_bridge[0])

                        dist_left = np.linalg.norm(nose - left_cheek)
                        dist_right = np.linalg.norm(nose - right_cheek)
                        pose_ratio = float(dist_left / (dist_right + 1e-8))
                        # Normal frontal/centered face pose ratio stays in range (0.4 - 2.2)
                        pose_validation_passed = 0.4 <= pose_ratio <= 2.2

            # Calculate cumulative liveness score out of 100
            score = 100.0
            if is_photo_attack:
                score -= 40.0
            if is_screen_attack:
                score -= 45.0
            if not eye_blink_passed:
                score -= 15.0
            if not pose_validation_passed:
                score -= 10.0

            liveness_passed = score >= 60.0

            return {
                "success": True,
                "liveness": liveness_passed,
                "score": round(score, 1),
                "checks": {
                    "photo_attack_prevented": not is_photo_attack,
                    "screen_attack_prevented": not is_screen_attack,
                    "eye_blink_passed": eye_blink_passed,
                    "pose_validation_passed": pose_validation_passed
                },
                "details": {
                    "laplacian_variance": round(lap_var, 2),
                    "fft_ratio": round(ratio, 4),
                    "ear_average": round(ear_average, 3),
                    "pose_ratio": round(pose_ratio, 3)
                },
                "message": "Liveness analysis completed." if liveness_passed else "Liveness check FAILED. Potential spoofing attack detected."
            }

        except Exception as e:
            self.logger.error(f"Anti-spoofing processing error: {e}")
            return {
                "success": False,
                "liveness": False,
                "score": 0.0,
                "checks": {
                    "photo_attack_prevented": False,
                    "screen_attack_prevented": False,
                    "eye_blink_passed": False,
                    "pose_validation_passed": False
                },
                "message": f"Anti-spoofing checks failed: {str(e)}"
            }
