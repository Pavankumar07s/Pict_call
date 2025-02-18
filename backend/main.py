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

# Audio processing functions
async def process_audio_chunk(audio_chunk: bytes) -> StreamAnalysisResponse:
    try:
        # Convert bytes to numpy array using librosa instead of soundfile
        audio_array, sr = librosa.load(io.BytesIO(audio_chunk), sr=None)
        logger.info(f"Audio chunk loaded. Sample rate: {sr}, Shape: {audio_array.shape}")

        # Extract features
        try:
            mfccs = librosa.feature.mfcc(y=audio_array, sr=sr, n_mfcc=13)
            logger.info(f"MFCC extraction complete for chunk. Shape: {mfccs.shape}")
        except Exception as feature_error:
            logger.error(f"Feature extraction error: {str(feature_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract features: {str(feature_error)}"
            )

        # Placeholder for speech-to-text and keyword detection
        suspicious_keywords = ["otp", "anydesk", "teamviewer", "remote"]
        detected_words = []  # Replace with actual speech-to-text implementation
        
        is_suspicious = any(word in detected_words for word in suspicious_keywords)
        
        logger.info("Chunk analysis complete")
        return StreamAnalysisResponse(
            suspicious=is_suspicious,
            confidence=0.85 if is_suspicious else 0.15,
            reasons=["Detected suspicious keywords"] if is_suspicious else [],
            current_timestamp=datetime.now().timestamp(),
            detected_keywords=detected_words
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
            # Try to load audio with librosa which can handle multiple formats
            audio_array, sr = librosa.load(io.BytesIO(audio_data), sr=None)
            logger.info(f"Audio loaded successfully. Sample rate: {sr}, Shape: {audio_array.shape}")
        except Exception as load_error:
            logger.error(f"Audio load error: {str(load_error)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to read audio file: {str(load_error)}"
            )

        try:
            # Process with librosa
            mfccs = librosa.feature.mfcc(y=audio_array, sr=sr, n_mfcc=13)
            logger.info(f"MFCC extraction complete. Shape: {mfccs.shape}")
        except Exception as librosa_error:
            logger.error(f"Librosa processing error: {str(librosa_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process audio features: {str(librosa_error)}"
            )

        # Dummy analysis for testing
        suspicious_segments = [
            {
                "start": 10.5,
                "end": 15.2,
                "text": "Please provide your OTP",
                "type": "otp"
            }
        ]
        
        logger.info("Analysis complete")
        return AnalysisResponse(
            suspicious=len(suspicious_segments) > 0,
            confidence=0.92,
            reasons=["Detected OTP request"],
            timestamps=suspicious_segments
        )

    except Exception as e:
        logger.error(f"Error processing complete audio: {str(e)}")
        logger.exception("Full traceback:")  # This will log the full stack trace
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