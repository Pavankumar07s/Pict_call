#!/bin/bash

# Create a short test audio file
sox -n test_stream.wav synth 1 sine 440

# Test the streaming endpoint
echo "Testing streaming endpoint..."
curl -X POST \
     -H "Content-Type: multipart/form-data" \
     -F "audio_chunk=@test_stream.wav;type=audio/wav" \
     http://192.168.126.64:3000/analyze-stream

# Clean up
rm test_stream.wav