#!/bin/bash

# Generate test file
sox -n test.wav synth 3 sine 440

# Test with the frontend URL from .env
curl -X POST \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@test.wav" \
  http://192.168.244.23:3000/analyze

# Clean up
rm test.wav