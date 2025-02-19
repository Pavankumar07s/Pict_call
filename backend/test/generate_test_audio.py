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
        "name": "otp_scam",
        "text": "Hello! I hope you're doing well. We noticed a login attempt from a new device in a different location. If this was you, no action is needed. However, if you did not initiate this request, please secure your account immediately. To verify your identity, enter the OTP sent to your registered mobile number. Do not share this OTP with anyone, including our support team."
    },
    {
        "name": "otp_phishing",
        "text": "Dear customer, we have detected an issue with your account security. As a precaution, we are temporarily restricting access. To restore access, please enter the one-time password (OTP) sent to your phone. If you do not act within 30 minutes, your account may be permanently locked."
    },
    {
        "name": "remote_access",
        "text": "Hi, thanks for reaching out! To help resolve your issue faster, we recommend installing AnyDesk on your computer. This will allow our technical support team to assist you remotely and troubleshoot the problem efficiently."
    },
    {
        "name": "remote_access_scam",
        "text": "Hello, we are from IT Support. Your device has been flagged for unusual activity. To prevent further issues, install TeamViewer immediately so our technician can remotely verify and fix the issue before it's too late."
    },
    {
        "name": "normal",
        "text": "Good morning! I wanted to confirm your recent purchase. Let me know if you need help tracking your order or if you have any concerns about the delivery."
    },
    {
        "name": "friendly_chat",
        "text": "Hey! Let's catch up for lunch tomorrow. Also, remind me to tell you about that new project I'm working on. It's going to be super exciting!"
    },
    {
        "name": "payment_info",
        "text": "Your invoice has been generated for your recent order. Please review it and let us know if you have any concerns. Also, for security reasons, your payment confirmation requires an OTP, which has been sent to your phone."
    },
    {
        "name": "neutral_message",
        "text": "Looking forward to our meeting at 5 PM. By the way, I received a message about an unexpected login attempt on my email. Should I be concerned?"
    },
    {
        "name": "otp_scam_with_support",
        "text": "Hello, we noticed unusual activity on your account. To prevent unauthorized access, enter the OTP sent to your mobile number. If you need assistance, our support team can help you verify it."
    },
    {
        "name": "customer_service_scam",
        "text": "Dear user, your account has been flagged for verification. Please provide the OTP sent to your phone to confirm your identity. Failure to do so may result in temporary account suspension."
    },
    {
        "name": "tech_support_scam",
        "text": "We have detected a serious issue with your system's security. To prevent data loss, install AnyDesk immediately, and our technician will fix the problem remotely. This is an urgent request."
    },
    {
        "name": "banking_scam",
        "text": "Your bank has detected suspicious activity on your account. To confirm that this was you, enter the OTP sent to your registered number. If you fail to do so, your account may be restricted."
    },
    {
        "name": "password_reset_phishing",
        "text": "Dear user, we received a request to reset your password. If this was you, enter the verification code sent to your mobile. If you did not request this, ignore the message or contact support immediately."
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