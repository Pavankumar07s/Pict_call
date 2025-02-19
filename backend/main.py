from fastapi import FastAPI, File, UploadFile, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging
import numpy as np
import librosa
import soundfile as sf
from datetime import datetime
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import io
from fastapi.responses import JSONResponse
import whisper
from pathlib import Path
import tempfile
import subprocess
import os
import base64
import json
import websockets
import asyncio  

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Configure logging
logging.basicConfig(
    filename='app.log',
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Response models
class AnalysisResponse(BaseModel):
    suspicious: bool
    confidence: float
    reasons: List[str]
    timestamps: List[dict]

class StreamAnalysisResponse(BaseModel):
    suspicious: bool
    confidence: float
    reasons: List[str]
    current_timestamp: Optional[float]
    detected_keywords: Optional[List[str]]

# Initialize Whisper model (do this at startup)
model = whisper.load_model("base")

async def transcribe_audio(audio_array: np.ndarray, sr: int) -> str:
    try:
        # Ensure audio data is valid
        if audio_array.size == 0:
            raise ValueError("Empty audio data")
            
        # Create a temporary WAV file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            try:
                sf.write(temp_file.name, audio_array, sr, format='WAV')
                
                # Transcribe using Whisper
                result = model.transcribe(temp_file.name)
                transcription = result["text"]
                
                logger.info(f"Transcription complete: {transcription}")
                return transcription
            finally:
                try:
                    os.unlink(temp_file.name)
                except:
                    pass
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise

# Audio processing functions
async def process_audio_chunk(audio_chunk: bytes) -> StreamAnalysisResponse:
    temp_wav_path = None
    converted_path = None
    
    try:
        logger.info("Processing audio chunk")
        
        # Create temporary file with explicit path
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_wav:
            temp_wav_path = temp_wav.name
            temp_wav.write(audio_chunk)
            temp_wav.flush()
            os.fsync(temp_wav.fileno())
            
            # Convert using ffmpeg with more explicit format settings
            converted_path = temp_wav_path + '_converted.wav'
            result = subprocess.run([
                'ffmpeg', 
                '-y',
                '-f', 'wav',
                '-i', temp_wav_path,
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                '-bits_per_raw_sample', '16',
                converted_path
            ], capture_output=True, text=True, check=False)
            
            if result.returncode != 0:
                logger.error(f"FFmpeg conversion failed: {result.stderr}")
                raise ValueError("Audio conversion failed")

            # Try to load audio with soundfile first, then fallback to librosa
            try:
                with sf.SoundFile(converted_path) as audio_file:
                    audio_data = audio_file.read()
                    sr = audio_file.samplerate
                    audio_array = np.array(audio_data)
            except Exception as sf_error:
                logger.warning(f"SoundFile load failed: {sf_error}, trying librosa...")
                try:
                    audio_array, sr = librosa.load(
                        converted_path,
                        sr=16000,
                        mono=True,
                        dtype=np.float32
                    )
                except Exception as librosa_error:
                    logger.error(f"Librosa load failed: {librosa_error}")
                    raise

            if audio_array is None or sr is None:
                raise ValueError("Failed to load audio data")

            # Normalize audio data
            audio_array = librosa.util.normalize(audio_array)
            
            # Process the audio...
            transcription = await transcribe_audio(audio_array, sr)
            logger.info(f"Transcription: {transcription}")

            # Rest of your code remains the same...
            suspicious_keywords = [
                "otp", 
                "anydesk", 
                "teamviewer", 
                "remote", 
                "access", 
                "install",
                "verification code",
                "security code",
                "one-time",
                "password",
                "authenticate",
                "urgent",
                "emergency",
                "support team",
                "technical support"
            ]

            detected_words = []
            transcription_lower = transcription.lower()
            
            for keyword in suspicious_keywords:
                if keyword in transcription_lower:
                    detected_words.append(keyword)
            
            is_suspicious = len(detected_words) > 0
            confidence = 0.85 if is_suspicious else 0.15
            
            # Generate meaningful reasons
            reasons = []
            if is_suspicious:
                if any(word in ["otp", "code", "number", "password"] for word in detected_words):
                    reasons.append("Potential OTP/password request detected")
                if any(word in ["anydesk", "teamviewer", "remote", "access"] for word in detected_words):
                    reasons.append("Remote access software mentioned")
                if "install" in detected_words:
                    reasons.append("Installation request detected")
                if any(word in ["urgent", "emergency"] for word in detected_words):
                    reasons.append("Urgency indicators detected")
            
            response = StreamAnalysisResponse(
                suspicious=is_suspicious,
                confidence=confidence,
                reasons=reasons,
                current_timestamp=datetime.now().timestamp(),
                detected_keywords=detected_words
            )
            
            logger.info(f"Stream analysis response: {response}")
            return response

    except Exception as e:
        logger.error(f"Error processing audio chunk: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing audio chunk: {str(e)}"
        )
    finally:
        # Clean up temporary files
        for path in [temp_wav_path, converted_path]:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary file {path}: {e}")

async def process_complete_audio(file: UploadFile) -> AnalysisResponse:
    try:
        logger.info(f"Starting to process file: {file.filename}")
        audio_data = await file.read()
        
        try:
            # Try loading with different formats
            audio_array = None
            sr = None
            
            try:
                # Try WAV first
                audio_array, sr = librosa.load(io.BytesIO(audio_data), sr=None)
            except:
                logger.info("Failed to load as WAV, trying M4A...")
                try:
                    # Try M4A/AAC
                    with tempfile.NamedTemporaryFile(suffix='.m4a', delete=False) as temp_m4a:
                        temp_m4a.write(audio_data)
                        temp_m4a.flush()
                        
                        # Convert to WAV using ffmpeg with -y flag to force overwrite
                        temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                        subprocess.run([
                            'ffmpeg', 
                            '-y',  # Force overwrite
                            '-i', temp_m4a.name, 
                            '-acodec', 'pcm_s16le', 
                            '-ar', '44100', 
                            temp_wav.name
                        ], 
                        # Redirect ffmpeg output to suppress console spam
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE)
                        
                        # Load the converted WAV
                        audio_array, sr = librosa.load(temp_wav.name, sr=None)
                        
                        # Cleanup
                        os.unlink(temp_m4a.name)
                        os.unlink(temp_wav.name)
                except Exception as conv_error:
                    logger.error(f"Conversion error: {str(conv_error)}")
                    raise
            
            if audio_array is None:
                raise Exception("Failed to load audio in any format")
                
            logger.info(f"Audio loaded successfully. Sample rate: {sr}, Shape: {audio_array.shape}")
            
            # Continue with transcription and analysis...
            transcription = await transcribe_audio(audio_array, sr)
            
            # Rest of your analysis code...
            suspicious_keywords = ["otp", "anydesk", "teamviewer", "remote"]
            timestamps = []
            
            # Simple timestamp generation (you might want to improve this)
            words = transcription.split()
            current_time = 0
            for word in words:
                if any(keyword in word.lower() for keyword in suspicious_keywords):
                    timestamps.append({
                        "start": current_time,
                        "end": current_time + 2,  # Assuming each word takes ~2 seconds
                        "text": word,
                        "type": "otp" if "otp" in word.lower() else "remote_access"
                    })
                current_time += 2
            
            logger.info("Analysis complete")
            return AnalysisResponse(
                suspicious=len(timestamps) > 0,
                confidence=0.92 if len(timestamps) > 0 else 0.15,
                reasons=[f"Detected suspicious content in transcription: '{transcription}'"] if timestamps else [],
                timestamps=timestamps
            )
            
        except Exception as load_error:
            logger.error(f"Audio load error: {str(load_error)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to read audio file: {str(load_error)}"
            )

    except Exception as e:
        logger.error(f"Error processing complete audio: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing audio file: {str(e)}"
        )

# Endpoints
@app.post("/analyze", response_model=AnalysisResponse)
@limiter.limit("10/minute")
async def analyze_audio(
    request: Request,
    file: UploadFile = File(...)
):
    logger.info(f"Received audio file: {file.filename}")
    
    if not file.filename.endswith(('.wav', '.mp3')):
        raise HTTPException(status_code=400, detail="Unsupported audio format")
    
    return await process_complete_audio(file)

@app.post("/analyze-stream", response_model=StreamAnalysisResponse)
@limiter.limit("30/minute")
async def analyze_stream(
    request: Request,
    audio_chunk: UploadFile = File(...)  
):
    try:
        logger.info(f"Received streaming chunk: {audio_chunk.filename}")
        
        # Validate content type
        content_type = audio_chunk.content_type
        if not content_type or not content_type.startswith(('audio/', 'application/octet-stream')):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid content type: {content_type}"
            )
        
        # Read chunk data
        chunk_data = await audio_chunk.read()
        if not chunk_data:
            raise HTTPException(
                status_code=400,
                detail="Empty audio chunk received"
            )
        
        return await process_audio_chunk(chunk_data)
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Stream endpoint error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=500,
            detail=f"Stream processing failed: {str(e)}"
        )

# Add WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

manager = ConnectionManager()

# Add WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    logger.info("New WebSocket connection established")
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                logger.info("Received audio chunk")
                
                try:
                    audio_bytes = base64.b64decode(data)
                    
                    # Create temporary WAV file with proper header
                    with tempfile.NamedTemporaryFile(suffix='.raw', delete=False) as temp_raw:
                        temp_raw_path = temp_raw.name
                        temp_raw.write(audio_bytes)
                        temp_raw.flush()
                        os.fsync(temp_raw.fileno())

                        # Convert raw audio to WAV
                        converted_path = temp_raw_path + '_converted.wav'
                        result = subprocess.run([
                            'ffmpeg', 
                            '-y',
                            '-f', 's16le',  # Input format is raw 16-bit PCM
                            '-ar', '24000',  # Match input sample rate
                            '-ac', '1',      # Mono input
                            '-i', temp_raw_path,
                            '-acodec', 'pcm_s16le',
                            '-ar', '16000',  # Convert to 16kHz
                            '-ac', '1',
                            converted_path
                        ], capture_output=True, text=True, check=False)

                        if result.returncode != 0:
                            logger.error(f"FFmpeg error: {result.stderr}")
                            # Try direct loading if conversion fails
                            try:
                                audio_array, sr = librosa.load(
                                    io.BytesIO(audio_bytes),
                                    sr=16000,
                                    mono=True
                                )
                            except Exception as load_error:
                                logger.error(f"Direct load failed: {load_error}")
                                raise ValueError(f"Audio processing failed: {result.stderr}")
                        else:
                            # Load the converted audio
                            try:
                                audio_array, sr = librosa.load(
                                    converted_path,
                                    sr=16000,
                                    mono=True
                                )
                            except Exception as load_error:
                                logger.error(f"Failed to load converted audio: {load_error}")
                                raise

                        # Process the audio
                        transcription = await transcribe_audio(audio_array, sr)
                        logger.info(f"Transcription: {transcription}")

                        # Check for suspicious content
                        suspicious_keywords = [
                            "otp", "anydesk", "teamviewer", "remote", 
                            "access", "install", "verification code", 
                            "security code", "one-time", "password",
                            "authenticate", "urgent", "emergency", 
                            "support team", "technical support"
                        ]

                        detected_words = []
                        transcription_lower = transcription.lower()
                        
                        for keyword in suspicious_keywords:
                            if keyword in transcription_lower:
                                detected_words.append(keyword)
                        
                        is_suspicious = len(detected_words) > 0
                        confidence = 0.85 if is_suspicious else 0.15
                        
                        # Generate reasons
                        reasons = []
                        if is_suspicious:
                            if any(word in ["otp", "code", "number", "password"] for word in detected_words):
                                reasons.append("Potential OTP/password request detected")
                            if any(word in ["anydesk", "teamviewer", "remote", "access"] for word in detected_words):
                                reasons.append("Remote access software mentioned")
                            if "install" in detected_words:
                                reasons.append("Installation request detected")
                            if any(word in ["urgent", "emergency"] for word in detected_words):
                                reasons.append("Urgency indicators detected")

                        # Send analysis
                        await websocket.send_json({
                            "suspicious": is_suspicious,
                            "confidence": confidence,
                            "reasons": reasons,
                            "current_timestamp": datetime.now().timestamp(),
                            "detected_keywords": detected_words
                        })

                except Exception as e:
                    logger.error(f"Processing error: {str(e)}")
                    await websocket.send_json({
                        "suspicious": False,
                        "confidence": 0,
                        "reasons": [f"Error: {str(e)}"],
                        "detected_keywords": [],
                        "current_timestamp": datetime.now().timestamp()
                    })
                finally:
                    # Cleanup temporary files
                    for path in [temp_raw_path, converted_path]:
                        if path and os.path.exists(path):
                            try:
                                os.unlink(path)
                            except Exception as e:
                                logger.warning(f"Failed to delete {path}: {e}")
                    
            except WebSocketDisconnect:
                logger.info("Client disconnected")
                break
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                break
                
    finally:
        manager.disconnect(websocket)
        logger.info("WebSocket connection cleaned up")

# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global error: {str(exc)}")
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )