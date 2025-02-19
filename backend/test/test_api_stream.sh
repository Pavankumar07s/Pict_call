#!/bin/bash

# First generate the test audio files if they don't exist
python generate_test_audio.py

# Test the streaming endpoint with different scenarios
for file in test_files/*.wav; do
    echo "Testing streaming endpoint with $(basename "$file")..."
    curl -X POST \
         -H "Content-Type: multipart/form-data" \
         -F "audio_chunk=@$file;type=audio/wav" \
         http://192.168.244.71:3000/analyze-stream
    echo -e "\n"
done