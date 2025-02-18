import { useState, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { analyzeStreamingAudio } from '@/services/audioAnalysis';
import { CallAnalysisType } from '@/types';

const CHUNK_DURATION = 3000; // 3 seconds chunks

export function useAudioStreaming(onAnalysisUpdate: (analysis: Partial<CallAnalysisType>) => void) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const startStreaming = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
          extension: '.wav',
          audioSource: 4, // VOICE_COMMUNICATION
        },
        progressUpdateIntervalMillis: CHUNK_DURATION,
      });

      newRecording.setOnRecordingStatusUpdate(async (status) => {
        if (status.isRecording && status.durationMillis >= CHUNK_DURATION) {
          const uri = newRecording.getURI();
          if (uri) {
            // Get the audio data as a blob
            const response = await fetch(uri);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            
            // Send for analysis
            await analyzeStreamingAudio(arrayBuffer, onAnalysisUpdate);
          }
        }
      });

      await newRecording.startAsync();
      setRecording(newRecording);
      setIsStreaming(true);
    } catch (err) {
      console.error('Failed to start streaming:', err);
    }
  }, [onAnalysisUpdate]);

  const stopStreaming = useCallback(async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      setIsStreaming(false);
    } catch (err) {
      console.error('Failed to stop streaming:', err);
    }
  }, [recording]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  return {
    isStreaming,
    startStreaming,
    stopStreaming,
  };
}