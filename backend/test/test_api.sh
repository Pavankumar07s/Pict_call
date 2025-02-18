#!/bin/bash

# Install sox if not present
if ! command -v sox &> /dev/null; then
    sudo apt-get install sox
fi

# Generate a test WAV file
sox -n test.wav synth 3 sine 440

# Test the endpoint
curl -X POST \
     -H "Content-Type: multipart/form-data" \
     -F "file=@test.wav;type=audio/wav" \
     http://192.168.126.97:3000/analyze

# Clean up
rm test.wav