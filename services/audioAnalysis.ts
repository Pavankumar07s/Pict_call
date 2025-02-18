import { CallAnalysisType } from '@/types';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http:/192.168.244.227:3000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function retryOperation(operation: () => Promise<any>, retries = MAX_RETRIES): Promise<any> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Operation failed (${MAX_RETRIES - retries + 1}/${MAX_RETRIES}):`, error);
    
    if (retries > 0) {
      console.log(`Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryOperation(operation, retries - 1);
    }
    
    throw error;
  }
}

export async function analyzeAudio(audioUri: string): Promise<CallAnalysisType> {
  try {
    console.log('Analyzing audio at URI:', audioUri);
    
    // Read the file as base64
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64
    });

    // Create form data
    const formData = new FormData();
    
    // Append with original file info but force WAV mime type
    formData.append('file', {
      uri: audioUri,
      type: 'audio/wav',
      name: 'recording.wav',
      data: base64Audio
    } as any);

    console.log('Sending request to:', `${API_URL}/analyze`);

    const response = await retryOperation(() =>
      fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Analysis result:', result);
    return result;
  } catch (error) {
    console.error('Error analyzing audio:', error);
    throw error;
  }
}

export async function analyzeStreamingAudio(
  audioData: string,
  onAnalysisUpdate: (analysis: Partial<CallAnalysisType>) => void
): Promise<void> {
  try {
    console.log('Sending streaming chunk');
    const formData = new FormData();

    formData.append('audio_chunk', {
      uri: `data:audio/wav;base64,${audioData}`,
      type: 'audio/wav',
      name: 'chunk.wav',
    } as any);

    const response = await retryOperation(() =>
      fetch(`${API_URL}/analyze-stream`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stream error response:', errorText);
      throw new Error(`Streaming failed with status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Streaming analysis result:', result);
    
    if (isValidPartialAnalysisResponse(result)) {
      onAnalysisUpdate(result);
    } else {
      console.error('Invalid response format:', result);
    }
  } catch (error) {
    console.error('Error analyzing audio stream:', error);
    onAnalysisUpdate({
      suspicious: false,
      confidence: 0,
      reasons: [`Stream analysis failed: ${(error as Error).message}`]
    });
  }
}

// Type guards
function isValidAnalysisResponse(response: any): response is CallAnalysisType {
  return (
    typeof response === 'object' &&
    typeof response.suspicious === 'boolean' &&
    typeof response.confidence === 'number' &&
    Array.isArray(response.reasons) &&
    Array.isArray(response.timestamps)
  );
}

function isValidPartialAnalysisResponse(response: any): response is Partial<CallAnalysisType> {
  return (
    typeof response === 'object' &&
    (response.suspicious === undefined || typeof response.suspicious === 'boolean') &&
    (response.confidence === undefined || typeof response.confidence === 'number') &&
    (response.reasons === undefined || Array.isArray(response.reasons))
  );
}