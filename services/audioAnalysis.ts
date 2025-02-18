import { CallAnalysisType } from '@/types';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.126.64:3000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function retryOperation(operation: () => Promise<any>, retries = MAX_RETRIES): Promise<any> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryOperation(operation, retries - 1);
    }
    throw error;
  }
}

export async function analyzeAudio(audioUri: string): Promise<CallAnalysisType> {
  try {
    console.log('Analyzing audio at URI:', audioUri);
    const formData = new FormData();
    
    // Get the file extension from the URI
    const fileName = audioUri.split('/').pop() || 'recording.wav';
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    console.log('File format:', extension);

    // Create a blob with the correct MIME type
    const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/m4a';
    
    // Read the file as base64
    const fileContent = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64
    });

    // Create a Blob with the correct mime type
    const blob = await fetch(`data:${mimeType};base64,${fileContent}`).then(r => r.blob());
    
    // Append with .wav extension for backend compatibility
    formData.append('file', blob, 'recording.wav');

    console.log('Sending request to:', `${API_URL}/analyze`);
    const response = await retryOperation(() =>
      fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      })
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Analysis result:', result);
    return result;
  } catch (error) {
    console.error('Error analyzing audio:', error);
    return {
      suspicious: false,
      confidence: 0,
      reasons: [`Analysis failed: ${(error as Error).message}`],
      timestamps: []
    };
  }
}

export async function analyzeStreamingAudio(
  audioChunk: ArrayBuffer,
  onAnalysisUpdate: (analysis: Partial<CallAnalysisType>) => void
): Promise<void> {
  try {
    console.log('Sending streaming chunk');
    const formData = new FormData();
    const blob = new Blob([audioChunk], { type: 'audio/wav' });
    formData.append('audio_chunk', blob, 'chunk.wav');

    const response = await retryOperation(() =>
      fetch(`${API_URL}/analyze-stream`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      })
    );

    if (!response.ok) {
      throw new Error(`Streaming analysis failed with status: ${response.status}`);
    }

    const result = await response.json();
    onAnalysisUpdate(result);
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