from fastapi import FastAPI, File, UploadFile, HTTPException, Request
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

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["GET", "POST"],
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
        # Create a temporary WAV file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            sf.write(temp_file.name, audio_array, sr)
            
            # Transcribe using Whisper
            result = model.transcribe(temp_file.name)
            transcription = result["text"]
            
            logger.info(f"Transcription complete: {transcription}")
            return transcription
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise
    finally:
        # Clean up temporary file
        try:
            Path(temp_file.name).unlink()
        except:
            pass

# Audio processing functions
async def process_audio_chunk(audio_chunk: bytes) -> StreamAnalysisResponse:
    try:
        # Convert bytes to numpy array using librosa
        audio_array, sr = librosa.load(io.BytesIO(audio_chunk), sr=None)
        logger.info(f"Audio chunk loaded. Sample rate: {sr}, Shape: {audio_array.shape}")

        # Transcribe audio
        transcription = await transcribe_audio(audio_array, sr)
        
        # Keyword detection
        suspicious_keywords = ["otp", "anydesk", "teamviewer", "remote"]
        detected_words = transcription.lower().split()
        
        is_suspicious = any(keyword in transcription.lower() for keyword in suspicious_keywords)
        
        logger.info("Chunk analysis complete")
        return StreamAnalysisResponse(
            suspicious=is_suspicious,
            confidence=0.85 if is_suspicious else 0.15,
            reasons=[f"Detected keywords in: '{transcription}'"] if is_suspicious else [],
            current_timestamp=datetime.now().timestamp(),
            detected_keywords=[word for word in detected_words if word in suspicious_keywords]
        )
    except Exception as e:
        logger.error(f"Error processing audio chunk: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing audio chunk: {str(e)}"
        )

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
                        
                        # Convert to WAV using ffmpeg
                        temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                        subprocess.run(['ffmpeg', '-i', temp_m4a.name, '-acodec', 'pcm_s16le', '-ar', '44100', temp_wav.name])
                        
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
        logger.info("Received streaming chunk")
        chunk_data = await audio_chunk.read()
        return await process_audio_chunk(chunk_data)
    except Exception as e:
        logger.error(f"Stream endpoint error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Stream processing failed: {str(e)}"
        )

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