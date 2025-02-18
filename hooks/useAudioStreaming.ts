import { useState, useEffect, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { analyzeStreamingAudio } from '@/services/audioAnalysis';
import { CallAnalysisType } from '@/types';

const CHUNK_DURATION = 3000; // 3 seconds chunks

export function useAudioStreaming(onAnalysisUpdate: (analysis: Partial<CallAnalysisType>) => void) {
  const [isStreaming, setIsStreaming] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [processingChunk, setProcessingChunk] = useState(false);
  const lastProcessedTime = useRef(0);

  const startNewRecording = async () => {
    try {
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
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
      
      await newRecording.startAsync();
      recordingRef.current = newRecording;
      return newRecording;
    } catch (err) {
      console.error('Failed to start new recording:', err);
      throw err;
    }
  };

  const processRecording = async () => {
    if (!recordingRef.current || !isStreaming || processingChunk) return;
    
    setProcessingChunk(true);
    const currentRecording = recordingRef.current;
    
    try {
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      
      if (uri) {
        console.log('Processing chunk from URI:', uri);
        const base64Content = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64
        });
        await analyzeStreamingAudio(base64Content, onAnalysisUpdate);
      }

      // Start a new recording cycle
      if (isStreaming) {
        await startNewRecording();
      }
    } catch (err) {
      console.error('Error processing recording:', err);
    } finally {
      setProcessingChunk(false);
    }
  };

  // Set up interval for chunk processing
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      processRecording();
    }, CHUNK_DURATION);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const startStreaming = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      setIsStreaming(true);
      await startNewRecording();
      console.log('Started streaming');
    } catch (err) {
      console.error('Failed to start streaming:', err);
      setIsStreaming(false);
    }
  }, []);

  const stopStreaming = useCallback(async () => {
    try {
      setIsStreaming(false);
      if (recordingRef.current) {
        const recording = recordingRef.current;
        recordingRef.current = null;
        try {
          await recording.stopAndUnloadAsync();
        } catch (err) {
          console.log('Recording already stopped:', err);
        }
      }
      console.log('Stopped streaming');
    } catch (err) {
      console.error('Failed to stop streaming:', err);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    };
  }, []);

  return {
    isStreaming,
    startStreaming,
    stopStreaming,
  };
}