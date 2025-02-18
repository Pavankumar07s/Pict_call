from gtts import gTTS
from pydub import AudioSegment
import os

def generate_test_files():
    # Create test directory if it doesn't exist
    if not os.path.exists('test_files'):
        os.makedirs('test_files')

    # Different test scenarios
    test_cases = [
        {
            "name": "otp_request",
            "text": "Please share your OTP number that you just received on your phone"
        },
        {
            "name": "remote_access",
            "text": "You need to install AnyDesk or TeamViewer for remote access to fix your computer"
        },
        {
            "name": "combined_scam",
            "text": "First share your OTP, then install AnyDesk so I can help you with your bank account"
        },
        {
            "name": "normal_conversation",
            "text": "Hello, I'm calling about your recent purchase. How was your experience?"
        }
    ]

    for test in test_cases:
        # Generate speech
        tts = gTTS(text=test["text"], lang='en', slow=False)
        mp3_path = f'test_files/{test["name"]}.mp3'
        wav_path = f'test_files/{test["name"]}.wav'
        
        # Save as MP3 first
        tts.save(mp3_path)
        
        # Convert to WAV
        sound = AudioSegment.from_mp3(mp3_path)
        sound.export(wav_path, format="wav")
        
        # Clean up MP3
        os.remove(mp3_path)
        
        print(f"Generated {wav_path}")

if __name__ == "__main__":
    generate_test_files()