import asyncio
import websockets
import base64
import json
import os
from pathlib import Path
import wave
import numpy as np

async def test_websocket_connection(audio_path: str):
    uri = "ws://192.168.244.85:3000/ws"
    try:
        async with websockets.connect(uri) as websocket:
            print(f"Connected to {uri}")
            print(f"Testing with {audio_path}")

            # Read the entire WAV file
            with wave.open(audio_path, 'rb') as wav_file:
                # Get WAV file parameters
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                frame_rate = wav_file.getframerate()
                n_frames = wav_file.getnframes()
                
                # Calculate chunk size for 3 seconds of audio
                chunk_frames = int(frame_rate * 3)
                total_chunks = n_frames // chunk_frames + 1
                
                print(f"Audio parameters: {frame_rate}Hz, {channels} channels, {n_frames} frames")
                print(f"Processing in {total_chunks} chunks of ~3 seconds each")

                # Process in chunks
                for i in range(total_chunks):
                    # Read chunk of frames
                    chunk_data = wav_file.readframes(chunk_frames)
                    if not chunk_data:
                        break

                    # Convert chunk to base64
                    base64_chunk = base64.b64encode(chunk_data).decode('utf-8')
                    
                    print(f"\nSending chunk {i+1}/{total_chunks}")
                    await websocket.send(base64_chunk)

                    # Wait for response with timeout
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                        analysis = json.loads(response)
                        print("Received analysis:")
                        print(f"Suspicious: {analysis.get('suspicious', False)}")
                        print(f"Confidence: {analysis.get('confidence', 0):.2f}")
                        print(f"Keywords: {analysis.get('detected_keywords', [])}")
                        print(f"Reasons: {analysis.get('reasons', [])}")
                        
                        # If suspicious content detected, highlight it
                        if analysis.get('suspicious', False):
                            print("\n⚠️ SUSPICIOUS CONTENT DETECTED!")
                            print(f"Confidence: {analysis.get('confidence', 0):.2%}")
                            print("Reasons:")
                            for reason in analysis.get('reasons', []):
                                print(f"  • {reason}")
                        print("---")

                    except asyncio.TimeoutError:
                        print("❌ Timeout waiting for response")
                        continue

                    # Delay between chunks
                    await asyncio.sleep(1.0)

    except websockets.exceptions.ConnectionClosed:
        print("❌ Connection closed unexpectedly")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

async def main():
    test_files_dir = Path('test_files')
    if not test_files_dir.exists():
        print("📝 Generating test files first...")
        from generate_test_audio import generate_test_files
        generate_test_files()

    test_files = sorted(test_files_dir.glob('*.wav'))
    print(f"\n📊 Found {len(test_files)} test files")

    results = []
    for audio_file in test_files:
        print(f"\n🔊 Testing: {audio_file.name}")
        print("=" * 50)
        await test_websocket_connection(str(audio_file))
        print("=" * 50)
        await asyncio.sleep(2)

if __name__ == "__main__":
    print("🚀 Starting WebSocket tests...")
    asyncio.run(main())