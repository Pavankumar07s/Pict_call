from gtts import gTTS
from pydub import AudioSegment

# Define your suspicious text
text = "Warning: please do not share your OTP or install remote access applications. This call appears suspicious."

# Generate speech (gTTS produces an MP3 file)
tts = gTTS(text=text, lang='en')
tts.save("suspicious.mp3")

# Convert the MP3 to WAV using pydub
sound = AudioSegment.from_mp3("suspicious.mp3")
sound.export("suspicious.wav", format="wav")

print("Generated suspicious.wav")
