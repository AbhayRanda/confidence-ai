import cv2
import whisper
from moviepy import VideoFileClip
import mediapipe as mp
from typing import Dict, List
from logger import logger
from config import get_settings

settings = get_settings()


class VideoAnalyzer:
    """Handles video analysis for confidence scoring"""
    
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(settings.face_cascade_path)
        self.smile_cascade = cv2.CascadeClassifier(settings.smile_cascade_path)
        self.whisper_model = whisper.load_model(settings.whisper_model)
        
        # Initialize MediaPipe Pose
        self.mp_pose = mp.solutions.pose
        
        logger.info(f"VideoAnalyzer initialized with Whisper model: {settings.whisper_model}")
    
    def analyze_video(self, file_path: str) -> Dict:
        """
        Analyze video file and extract confidence metrics
        
        Args:
            file_path: Path to the video file
            
        Returns:
            Dictionary containing analysis results
        """
        try:
            logger.info(f"Starting analysis for video: {file_path}")
            
            # Extract video metrics
            video_metrics = self._extract_video_metrics(file_path)
            
            # Extract speech metrics
            speech_metrics = self._extract_speech_metrics(file_path)
            
            # Analyze frame quality and detect wrong frames
            frame_analysis = self._analyze_frame_quality(file_path)
            
            # Calculate confidence score
            confidence_score = self._calculate_confidence_score(video_metrics, speech_metrics)
            
            # Generate suggestions
            suggestions = self._generate_suggestions(video_metrics, speech_metrics, confidence_score)
            
            # Determine confidence level
            confidence_level = self._determine_confidence_level(confidence_score)
            
            result = {
                **video_metrics,
                **speech_metrics,
                "confidence_score": confidence_score,
                "confidence_level": confidence_level,
                "suggestions": suggestions,
                "frame_analysis": frame_analysis
            }
            
            logger.info(f"Analysis complete. Confidence score: {confidence_score:.2f}")
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing video: {str(e)}", exc_info=True)
            raise
    
    def _extract_video_metrics(self, file_path: str) -> Dict:
        """Extract video-based metrics (face, smile, posture, eye contact, hand movement)"""
        try:
            import math
            
            cap = cv2.VideoCapture(file_path)
            pose = self.mp_pose.Pose()
            
            metrics = {
                "eye_contact_frames": 0,
                "total_frames": 0,
                "face_frames": 0,
                "smile_frames": 0,
                "good_posture_frames": 0,
                "hand_movement_frames": 0,
                "straight_face_frames": 0,
                "prev_left_wrist": None,
                "prev_right_wrist": None,
                "prev_head_center": None,
                "movement_stabilizer": []
            }
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                metrics["total_frames"] += 1
                
                # Face and smile detection
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = self.face_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.3,
                    minNeighbors=5
                )
                
                if len(faces) > 0:
                    metrics["face_frames"] += 1
                    
                    for (x, y, w, h) in faces:
                        roi_gray = gray[y:y+h, x:x+w]
                        smiles = self.smile_cascade.detectMultiScale(
                            roi_gray,
                            scaleFactor=1.8,
                            minNeighbors=20
                        )
                        
                        if len(smiles) > 0:
                            metrics["smile_frames"] += 1
                            break
                
                # Posture and eye contact analysis using MediaPipe
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = pose.process(rgb_frame)
                
                if results.pose_landmarks:
                    frame_height, frame_width, _ = frame.shape
                    
                    # Get landmarks
                    left_eye = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_EYE]
                    right_eye = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_EYE]
                    nose = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.NOSE]
                    left_ear = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_EAR]
                    right_ear = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_EAR]
                    
                    # IMPROVED: Eye contact detection with continuous scoring (not binary)
                    # Use nose as primary (more stable) + eye position as secondary
                    nose_x = nose.x
                    nose_y = nose.y
                    
                    # Also calculate eye center for secondary check
                    eye_center_x = (left_eye.x + right_eye.x) / 2
                    eye_center_y = (left_eye.y + right_eye.y) / 2
                    
                    frame_center_x = 0.5
                    frame_center_y = 0.5
                    
                    # Calculate distance from center
                    nose_h_dist = abs(nose_x - frame_center_x)
                    nose_v_dist = abs(nose_y - frame_center_y)
                    
                    # Gradual scoring: closer to center = higher score
                    # Perfect (within 0.08): 100% | Good (0.08-0.15): 70-100% | Fair (0.15-0.25): 40-70% | Poor: 0-40%
                    if nose_h_dist < 0.08 and nose_v_dist < 0.10:
                        # Excellent eye contact
                        metrics["eye_contact_frames"] += 1
                    elif nose_h_dist < 0.25 and nose_v_dist < 0.22:
                        # Acceptable eye contact (some deviation but still looking at camera)
                        metrics["eye_contact_frames"] += 0.6
                    else:
                        # Poor eye contact (looking away significantly)
                        metrics["eye_contact_frames"] += 0.15
                    
                    # NEW: Face straightness detection (head tilt check)
                    ear_y_diff = abs(left_ear.y - right_ear.y)
                    eye_x_diff = abs(left_eye.x - right_eye.x)
                    
                    # Face is straight: ears level + eyes properly separated
                    if ear_y_diff < 0.05 and eye_x_diff > 0.08:
                        metrics["straight_face_frames"] += 1
                    
                    # IMPROVED: Posture check using full shoulder-hip alignment
                    left_shoulder = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
                    right_shoulder = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
                    left_hip = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_HIP]
                    right_hip = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_HIP]
                    
                    shoulder_diff = abs(left_shoulder.y - right_shoulder.y)
                    hip_diff = abs(left_hip.y - right_hip.y)
                    
                    # Posture is good if shoulders and hips are level
                    if shoulder_diff < settings.posture_threshold and hip_diff < settings.posture_threshold:
                        metrics["good_posture_frames"] += 1
                    
                    # IMPROVED: Hand movement detection with body motion compensation
                    left_wrist = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_WRIST]
                    right_wrist = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_WRIST]
                    left_elbow = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_ELBOW]
                    right_elbow = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_ELBOW]
                    
                    # Calculate head center for motion compensation
                    head_center_x = (left_ear.x + right_ear.x) / 2
                    head_center_y = (left_ear.y + right_ear.y) / 2
                    
                    if metrics["prev_left_wrist"] is not None:
                        # Calculate body motion (head movement)
                        if metrics["prev_head_center"] is not None:
                            body_dx = head_center_x - metrics["prev_head_center"][0]
                            body_dy = head_center_y - metrics["prev_head_center"][1]
                            body_motion = math.sqrt(body_dx**2 + body_dy**2)
                        else:
                            body_dx = 0
                            body_dy = 0
                            body_motion = 0
                        
                        # Calculate hand movements relative to body motion
                        left_movement = math.sqrt(
                            (left_wrist.x - metrics["prev_left_wrist"].x - body_dx)**2 +
                            (left_wrist.y - metrics["prev_left_wrist"].y - body_dy)**2
                        )
                        
                        right_movement = math.sqrt(
                            (right_wrist.x - metrics["prev_right_wrist"].x - body_dx)**2 +
                            (right_wrist.y - metrics["prev_right_wrist"].y - body_dy)**2
                        )
                        
                        # Check if wrists are extended (arms away from body)
                        left_wrist_to_shoulder = math.sqrt(
                            (left_wrist.x - left_shoulder.x)**2 +
                            (left_wrist.y - left_shoulder.y)**2
                        )
                        
                        right_wrist_to_shoulder = math.sqrt(
                            (right_wrist.x - right_shoulder.x)**2 +
                            (right_wrist.y - right_shoulder.y)**2
                        )
                        
                        # Real gesture: significant movement + arms extended
                        if ((left_movement > 0.025 or right_movement > 0.025) and
                            (left_wrist_to_shoulder > 0.25 or right_wrist_to_shoulder > 0.25)):
                            metrics["hand_movement_frames"] += 1
                    
                    metrics["prev_left_wrist"] = left_wrist
                    metrics["prev_right_wrist"] = right_wrist
                    metrics["prev_head_center"] = (head_center_x, head_center_y)
            
            cap.release()
            pose.close()
            
            # Convert to percentages
            total = metrics["total_frames"] or 1
            face_frames = metrics["face_frames"] or 1
            
            return {
                "eye_contact_percentage": (metrics["eye_contact_frames"] / total) * 100,
                "face_visibility_percentage": (metrics["face_frames"] / total) * 100,
                "face_straightness_percentage": (metrics["straight_face_frames"] / total) * 100,
                "smile_percentage": (metrics["smile_frames"] / face_frames) * 100,
                "posture_percentage": (metrics["good_posture_frames"] / total) * 100,
                "hand_movement_percentage": (metrics["hand_movement_frames"] / total) * 100,
            }
            
        except Exception as e:
            logger.error(f"Error extracting video metrics: {str(e)}", exc_info=True)
            raise
    
    def _extract_speech_metrics(self, file_path: str) -> Dict:
        """Extract speech-based metrics (filler words, WPM, speech score)"""
        try:
            import os
            from pathlib import Path
            
            file_extension = Path(file_path).suffix
            audio_path = file_path.replace(file_extension, ".wav")
            
            video_clip = VideoFileClip(file_path)
            
            if video_clip.audio is None:
                logger.warning(f"No audio track found in {file_path}")
                return {
                    "speech_score": 0,
                    "filler_word_count": 0,
                    "words_per_minute": 0,
                    "speech_text": ""
                }
            
            # Extract audio from video (moviepy API has changed, use only essential params)
            video_clip.audio.write_audiofile(audio_path)
            result = self.whisper_model.transcribe(audio_path)
            transcript = result.get("text", "").lower()
            logger.info(f"Detected speech: {transcript}")
            
            words = transcript.split()
            total_words = len(words)
            
            if total_words == 0:
                return {
                    "speech_score": 0,
                    "filler_word_count": 0,
                    "words_per_minute": 0,
                    "speech_text": ""
                }
            
            # Count filler words
            filler_words_list = [w.strip() for w in settings.filler_words.split(',')]
            filler_count = sum(word in filler_words_list for word in words)
            
            # Calculate WPM - IMPROVED: Use actual audio duration
            segments = result.get("segments", [])
            if segments:
                duration_seconds = segments[-1]["end"]
            else:
                # Fallback: use video duration
                duration_seconds = video_clip.duration or 1
            
            words_per_minute = (
                (total_words / duration_seconds) * 60
                if duration_seconds > 0 else 0
            )
            
            # IMPROVED: Calculate speech score with better weighting
            speech_score = 100
            
            # Filler word penalty: proportional to total words (not fixed per word)
            filler_ratio = filler_count / total_words
            filler_penalty = filler_ratio * 30  # Max 30 points reduction
            speech_score -= filler_penalty
            
            # WPM penalty: applied if outside ideal range
            ideal_min = settings.ideal_words_per_minute_min
            ideal_max = settings.ideal_words_per_minute_max
            
            if words_per_minute < ideal_min:
                deviation = (ideal_min - words_per_minute) / ideal_min
                wpm_penalty = min(deviation * 20, 20)  # Max 20 points reduction
                speech_score -= wpm_penalty
            elif words_per_minute > ideal_max:
                deviation = (words_per_minute - ideal_max) / ideal_max
                wpm_penalty = min(deviation * 15, 15)  # Max 15 points reduction
                speech_score -= wpm_penalty
            
            speech_score = max(0, min(100, speech_score))  # Clamp between 0-100
            
            video_clip.close()
            
            # Clean up audio file
            try:
                os.remove(audio_path)
            except:
                pass
            
            return {
                "speech_score": round(speech_score, 2),
                "filler_word_count": filler_count,
                "words_per_minute": round(words_per_minute, 2),
                "speech_text": transcript
            }
            
        except Exception as e:
            logger.error(f"Error extracting speech metrics: {str(e)}", exc_info=True)
            return {
                "speech_score": 0,
                "filler_word_count": 0,
                "words_per_minute": 0,
                "speech_text": ""
            }
    
    def _calculate_confidence_score(self, video_metrics: Dict, speech_metrics: Dict) -> float:
        """Calculate overall confidence score using weighted metrics - STRICT REQUIREMENTS"""
        # Ensure all metrics are clamped between 0-100
        face_visibility = max(0, min(100, video_metrics.get("face_visibility_percentage", 0)))
        face_straightness = max(0, min(100, video_metrics.get("face_straightness_percentage", 0)))
        smile_percentage = max(0, min(100, video_metrics.get("smile_percentage", 0)))
        posture_percentage = max(0, min(100, video_metrics.get("posture_percentage", 0)))
        speech_score = max(0, min(100, speech_metrics.get("speech_score", 0)))
        eye_contact_percentage = max(0, min(100, video_metrics.get("eye_contact_percentage", 0)))
        hand_movement_percentage = max(0, min(100, video_metrics.get("hand_movement_percentage", 0)))
        
        # STRICT REQUIREMENTS: Penalties for poor presentation
        penalty = 0
        
        # Critical factors that significantly reduce confidence
        if face_visibility < 70:
            penalty += 15  # Must keep face visible
        if face_straightness < 60:
            penalty += 10  # Face must be relatively straight
        if eye_contact_percentage < 50:
            penalty += 12  # Must maintain eye contact
        if posture_percentage < 50:
            penalty += 10  # Must maintain good posture
        if speech_score < 60:
            penalty += 15  # Must have good speech quality
        
        # Hand movement: too little or too much
        if hand_movement_percentage < 15:
            penalty += 8  # Should have some natural gestures
        elif hand_movement_percentage > 65:
            penalty += 10  # But not excessive
        
        # Calculate weighted score
        score = (
            0.16 * face_visibility +
            0.12 * face_straightness +
            0.10 * smile_percentage +
            0.12 * posture_percentage +
            0.22 * speech_score +
            0.18 * eye_contact_percentage +
            0.10 * hand_movement_percentage
        )
        
        # Apply penalties
        score = max(0, score - penalty)
        
        return round(score, 2)
    
    def _determine_confidence_level(self, score: float) -> str:
        """Determine confidence level based on score - STRICT THRESHOLD"""
        if score >= 70:
            return "High Confidence"
        elif score >= 50:
            return "Moderate Confidence"
        return "Low Confidence"
    
    def _generate_suggestions(self, video_metrics: Dict, speech_metrics: Dict, confidence_score: float) -> List[str]:
        """Generate personalized improvement suggestions"""
        suggestions = []
        
        # STRICT: Face visibility must be >= 70%
        if video_metrics["face_visibility_percentage"] < 70:
            suggestions.append("Keep your face fully visible in the frame throughout the presentation.")
        
        # NEW: Face straightness
        if video_metrics.get("face_straightness_percentage", 0) < 60:
            suggestions.append("Keep your head straight and face the camera directly. Avoid tilting or turning your head excessively.")
        
        # STRICT: Eye contact must be >= 50%
        if video_metrics["eye_contact_percentage"] < 50:
            suggestions.append("Maintain consistent eye contact with the camera. Look directly at the lens, not away.")
        
        # STRICT: Posture must be >= 50%
        if video_metrics["posture_percentage"] < 50:
            suggestions.append("Maintain an upright posture. Sit or stand straight with shoulders level.")
        
        # STRICT: Smile percentage >= 40%
        if video_metrics["smile_percentage"] < 40:
            suggestions.append("Smile more frequently. A natural smile conveys confidence and positivity.")
        
        # STRICT: Speech score must be >= 60%
        if speech_metrics["speech_score"] < 60:
            suggestions.append("Reduce filler words (um, uh, like, etc.) and speak more clearly and fluently.")
        
        # Hand movement: 15-65% is ideal
        if video_metrics["hand_movement_percentage"] < 15:
            suggestions.append("Use natural hand gestures while speaking. This helps convey enthusiasm and confidence.")
        elif video_metrics["hand_movement_percentage"] > 65:
            suggestions.append("Reduce excessive hand movement. Keep gestures purposeful and controlled.")
        
        return suggestions
    
    def _analyze_frame_quality(self, file_path: str) -> Dict:
        """
        Analyze individual frames and detect problematic frames vs good frames
        
        Returns:
            Dictionary with frame-by-frame analysis, wrong frames, and right frames
        """
        try:
            import math
            import os
            from pathlib import Path
            
            cap = cv2.VideoCapture(file_path)
            pose = self.mp_pose.Pose()
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            wrong_frames = []  # Frames with poor presentation
            right_frames = []  # Frames with good presentation
            frame_issues = []  # Detailed frame issues
            
            frame_number = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame_number += 1
                frame_quality_score = 100  # Start with perfect score
                issues = []  # Issues found in this frame
                
                # Analyze frame
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = pose.process(rgb_frame)
                
                # Check 1: Face visibility
                if len(faces) == 0:
                    frame_quality_score -= 25
                    issues.append("No face detected - poor face visibility")
                else:
                    # Check 2: Face straightness
                    if results.pose_landmarks:
                        left_ear = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_EAR]
                        right_ear = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_EAR]
                        left_eye = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_EYE]
                        right_eye = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_EYE]
                        
                        ear_y_diff = abs(left_ear.y - right_ear.y)
                        if ear_y_diff > 0.08:
                            frame_quality_score -= 15
                            tilt_direction = "tilted left" if left_ear.y < right_ear.y else "tilted right"
                            issues.append(f"Head is {tilt_direction} - not straight")
                        
                        # Check 3: Eye contact (use nose as primary - more stable landmark)
                        nose = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.NOSE]
                        nose_h_dist = abs(nose.x - 0.5)
                        nose_v_dist = abs(nose.y - 0.5)
                        
                        # Gradual penalty based on how far from center
                        if nose_h_dist > 0.08 or nose_v_dist > 0.10:
                            # Slight penalty for minor deviation
                            penalty = min((nose_h_dist + nose_v_dist) * 30, 12)
                            frame_quality_score -= penalty
                            
                            # Only flag as major issue if very far from center
                            if nose_h_dist > 0.25 or nose_v_dist > 0.22:
                                direction = ""
                                if nose.x < 0.25:
                                    direction = "looking far left"
                                elif nose.x > 0.75:
                                    direction = "looking far right"
                                if nose.y < 0.28:
                                    direction += " up" if direction else "looking far up"
                                elif nose.y > 0.72:
                                    direction += " down" if direction else "looking far down"
                                if direction:
                                    issues.append(f"Poor eye contact - {direction}")
                        
                        # Check 4: Posture
                        left_shoulder = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
                        right_shoulder = results.pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
                        shoulder_diff = abs(left_shoulder.y - right_shoulder.y)
                        
                        if shoulder_diff > 0.08:
                            frame_quality_score -= 15
                            slant = "left" if left_shoulder.y < right_shoulder.y else "right"
                            issues.append(f"Posture issue - leaning to {slant}")
                        
                        # Check 5: Face size (too close or too far)
                        if len(faces) > 0:
                            (x, y, w, h) = faces[0]
                            frame_height, frame_width = frame.shape[:2]
                            face_ratio = (w * h) / (frame_width * frame_height)
                            
                            if face_ratio < 0.08:
                                frame_quality_score -= 10
                                issues.append("Face too small - move closer to camera")
                            elif face_ratio > 0.35:
                                frame_quality_score -= 10
                                issues.append("Face too large - move away from camera")
                
                # Categorize frame
                time_seconds = frame_number / fps
                frame_quality_score = max(0, frame_quality_score)
                
                if frame_quality_score >= 86:
                    # Right frame (excellent presentation - no major issues)
                    right_frames.append({
                        "frame_number": frame_number,
                        "time_seconds": round(time_seconds, 2),
                        "quality_score": frame_quality_score,
                        "description": "Excellent frame - good eye contact, straight posture, face visible"
                    })
                elif frame_quality_score < 68:
                    # Wrong frame (poor presentation - significant issues)
                    wrong_frames.append({
                        "frame_number": frame_number,
                        "time_seconds": round(time_seconds, 2),
                        "quality_score": frame_quality_score,
                        "issues": issues,
                        "description": f"Poor presentation - {', '.join(issues)}"
                    })
                
                # Log frame issues for detailed analysis
                if issues:
                    frame_issues.append({
                        "frame_number": frame_number,
                        "time_seconds": round(time_seconds, 2),
                        "quality_score": frame_quality_score,
                        "issues": issues
                    })
            
            cap.release()
            pose.close()
            
            # Prepare recommendations
            recommendations = []
            
            if wrong_frames:
                most_common_issue = {}
                for frame in wrong_frames:
                    for issue in frame.get("issues", []):
                        most_common_issue[issue] = most_common_issue.get(issue, 0) + 1
                
                # Get top issues
                if most_common_issue:
                    sorted_issues = sorted(most_common_issue.items(), key=lambda x: x[1], reverse=True)
                    for issue, count in sorted_issues[:3]:
                        recommendations.append(f"Common issue: {issue} ({count} frames)")
                
                # Sample frames to show what's wrong
                sample_wrong = wrong_frames[::max(1, len(wrong_frames)//3)][:3]
            else:
                sample_wrong = []
                recommendations.append("No presentation issues detected!")
            
            if right_frames:
                # Sample frames showing what's right
                sample_right = right_frames[::max(1, len(right_frames)//3)][:3]
            else:
                sample_right = []
            
            return {
                "total_frames_analyzed": frame_number,
                "wrong_frames_count": len(wrong_frames),
                "right_frames_count": len(right_frames),
                "wrong_frames_percentage": round((len(wrong_frames) / frame_number * 100) if frame_number > 0 else 0, 2),
                "right_frames_percentage": round((len(right_frames) / frame_number * 100) if frame_number > 0 else 0, 2),
                "wrong_frames_samples": sample_wrong,
                "right_frames_samples": sample_right,
                "detailed_issues": frame_issues[:10],  # First 10 problematic frames
                "recommendations": recommendations,
                "summary": self._generate_frame_summary(wrong_frames, right_frames, len(wrong_frames) + len(right_frames) > 0)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing frame quality: {str(e)}", exc_info=True)
            return {
                "total_frames_analyzed": 0,
                "wrong_frames_count": 0,
                "right_frames_count": 0,
                "error": str(e)
            }
    
    def _generate_frame_summary(self, wrong_frames: List, right_frames: List, has_frames: bool) -> str:
        """Generate a summary of frame analysis"""
        if not has_frames:
            return "Unable to analyze frames"
        
        total = len(wrong_frames) + len(right_frames)
        
        if total == 0:
            return "No analyzable frames found"
        
        ratio = len(right_frames) / total * 100 if total > 0 else 0
        
        if ratio >= 80:
            return f"Excellent! {ratio:.0f}% of frames show good presentation. Keep it up!"
        elif ratio >= 60:
            return f"Good job! {ratio:.0f}% of frames show proper presentation. Work on consistency."
        elif ratio >= 40:
            return f"Moderate. {ratio:.0f}% of frames are good. Focus on maintaining presentation standards."
        else:
            return f"Needs improvement. Only {ratio:.0f}% of frames show good presentation. Review suggestions above."
    