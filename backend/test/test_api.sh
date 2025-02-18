#!/bin/bash

# Check if required packages are installed
if ! python3 -c "import gtts" &> /dev/null; then
    echo "Installing gTTS..."
    pip install gtts
fi

if ! python3 -c "import pydub" &> /dev/null; then
    echo "Installing pydub..."
    pip install pydub
fi

# Create and run Python script for generating test audio
cat > generate_test.py << 'EOF'
from gtts import gTTS
from pydub import AudioSegment

# Test cases with different scenarios
test_cases = [
    {
        "name": "otp_scam",
        "text": "Please provide your OTP number that you received on your mobile"
    },
    {
        "name": "remote_access",
        "text": "You need to install AnyDesk on your computer so I can help you"
    },
    {
        "name": "normal",
        "text": "Hello, this is regarding your recent purchase. How can I help you?"
    }
]

for test in test_cases:
    # Generate speech
    tts = gTTS(text=test["text"], lang='en', slow=False)
    mp3_file = f"{test['name']}.mp3"
    wav_file = f"{test['name']}.wav"
    
    # Save as MP3
    tts.save(mp3_file)
    
    # Convert to WAV
    sound = AudioSegment.from_mp3(mp3_file)
    sound.export(wav_file, format="wav")
    
    # Clean up MP3
    import os
    os.remove(mp3_file)
    print(f"Generated {wav_file}")
EOF

python3 generate_test.py

# Test each scenario
for file in *.wav; do
    echo -e "\nTesting with ${file}..."
    curl -X POST \
         -H "Content-Type: multipart/form-data" \
         -F "file=@${file};type=audio/wav" \
         http://192.168.244.23:3000/analyze
    echo -e "\n"
done

# Clean up
rm -f *.wav generate_test.py

echo "Test complete!"