import { useState, useEffect, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { StreamingAnalyzer } from '@/services/StreamingAnalyzer';
import { CallAnalysisType } from '@/types';

const CHUNK_DURATION = 2000; // Reduce to 2 seconds for more frequent updates

export function useAudioStreaming(onAnalysisUpdate: (analysis: Partial<CallAnalysisType>) => void) {
  const [isStreaming, setIsStreaming] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const analyzerRef = useRef<StreamingAnalyzer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const cleanupRecording = async () => {
    if (recordingRef.current) {
      try {
        const recording = recordingRef.current;
        recordingRef.current = null;
        if (recording._isDoneRecording) {
          await recording.stopAndUnloadAsync();
        }
      } catch (err) {
        console.error('Error stopping recording:', err);
      }
    }
  };

  const startRecording = async () => {
    if (isInitializing) return;
    setIsInitializing(true);

    try {
      await cleanupRecording();

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      recordingRef.current = recording;

      recording.setOnRecordingStatusUpdate(async (status) => {
        if (!isStreaming || !recordingRef.current) return;

        if (status.isRecording && status.durationMillis >= CHUNK_DURATION) {
          try {
            const currentRecording = recordingRef.current;
            recordingRef.current = null;
            
            await currentRecording.stopAndUnloadAsync();
            const uri = currentRecording.getURI();
            
            if (uri && analyzerRef.current && isStreaming) {
              const base64Content = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64
              });
              analyzerRef.current.sendAudio(base64Content);
            }

            if (isStreaming) {
              await startRecording();
            }
          } catch (err) {
            console.error('Error processing recording chunk:', err);
            setError('Error processing recording chunk');
          }
        }
      });

      await recording.startAsync();
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording');
      setIsStreaming(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const startStreaming = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      analyzerRef.current = new StreamingAnalyzer(
        onAnalysisUpdate,
        (error) => setError(error)
      );
      analyzerRef.current.connect();

      setIsStreaming(true);
      await startRecording();
    } catch (err) {
      console.error('Failed to start streaming:', err);
      setError('Failed to start streaming');
      setIsStreaming(false);
    }
  }, [onAnalysisUpdate]);

  const stopStreaming = useCallback(async () => {
    setIsStreaming(false);
    
    if (analyzerRef.current) {
      analyzerRef.current.disconnect();
      analyzerRef.current = null;
    }

    await cleanupRecording();
  }, []);

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  return {
    isStreaming,
    startStreaming,
    stopStreaming,
    error,
  };
}