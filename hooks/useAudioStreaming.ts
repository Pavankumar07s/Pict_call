import { useState, useEffect, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { CallAnalysisType } from '../types';
import { StreamingAnalyzer } from '../services/StreamingAnalyzer';

const CHUNK_DURATION = 3000; // 3 seconds chunks

export function useAudioStreaming(onAnalysisUpdate: (analysis: Partial<CallAnalysisType>) => void) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const analyzerRef = useRef<StreamingAnalyzer | null>(null);
  const chunkCountRef = useRef(0);
  const analysisHistoryRef = useRef<Array<Partial<CallAnalysisType>>>([]);

  const cleanupRecording = async () => {
    console.log('🧹 Starting cleanup...');
    try {
      // First, disable audio system
      await Audio.setIsEnabledAsync(false);
      await new Promise(resolve => setTimeout(resolve, 500));

      if (recordingRef.current) {
        const recording = recordingRef.current;
        recordingRef.current = null;
        
        try {
          if (recording._isDoneRecording) {
            await recording.stopAndUnloadAsync();
          }
        } catch (err) {
          console.warn('Warning during recording cleanup:', err);
        }
      }

      // Re-enable audio system
      await Audio.setIsEnabledAsync(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('✨ Cleanup completed');
    } catch (err) {
      console.error('❌ Error during cleanup:', err);
      throw err; // Propagate error for handling
    }
  };

  const startRecording = async () => {
    if (isInitializing || !isStreaming) return;
    console.log('🎯 Starting new recording chunk...');

    try {
      const recording = new Audio.Recording();
      
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 16000,
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
          chunkCountRef.current++;
          console.log(`📊 Processing chunk #${chunkCountRef.current} (${status.durationMillis}ms)`);
          
          try {
            const currentRecording = recordingRef.current;
            recordingRef.current = null;
            
            await currentRecording.stopAndUnloadAsync();
            const uri = currentRecording.getURI();
            
            if (uri && analyzerRef.current && isStreaming) {
              console.log(`📦 Reading chunk #${chunkCountRef.current}`);
              const base64Content = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64
              });
              
              console.log(`📤 Sending chunk #${chunkCountRef.current} (${(base64Content.length / 1024).toFixed(2)} KB)`);
              await analyzerRef.current.sendAudio(base64Content);
              
              // Start next recording before cleanup
              startRecording().catch(console.error);
              
              // Clean up the file
              try {
                await FileSystem.deleteAsync(uri);
              } catch (err) {
                console.warn('Failed to delete temporary file:', err);
              }
            }
          } catch (err) {
            console.error(`❌ Error processing chunk #${chunkCountRef.current}:`, err);
            setError('Error processing recording chunk');
          }
        }
      });

      await recording.startAsync();
      console.log(`🎤 Chunk #${chunkCountRef.current + 1} recording started`);
    } catch (err) {
      console.error('❌ Failed to start recording chunk:', err);
      if (isStreaming) {
        // Try to restart recording after a delay
        setTimeout(() => startRecording(), 1000);
      }
    }
  };

  const stopStreaming = useCallback(async () => {
    console.log('🛑 Stopping streaming...');
    setIsStreaming(false);
    
    try {
      if (analyzerRef.current) {
        analyzerRef.current.disconnect();
        analyzerRef.current = null;
      }

      await cleanupRecording();
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
      });
      
      analysisHistoryRef.current = [];
      chunkCountRef.current = 0;
      
      console.log('✅ Streaming stopped and cleaned up');
    } catch (err) {
      console.error('❌ Error stopping streaming:', err);
    }
  }, []);

  const startStreaming = useCallback(async () => {
    if (isInitializing) {
      console.log('⏳ Already initializing...');
      return;
    }

    setIsInitializing(true);
    console.log('🎙️ Starting streaming...');

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        throw new Error('Microphone permission denied');
      }

      // Clean up any existing recordings
      await cleanupRecording();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // Initialize analyzer before starting recording
      analyzerRef.current = new StreamingAnalyzer(
        (analysis) => {
          if (analysis.suspicious) {
            analysisHistoryRef.current = [...analysisHistoryRef.current, analysis];
          }
          onAnalysisUpdate({
            ...analysis,
            history: analysisHistoryRef.current
          });
        },
        (error) => setError(error)
      );

      setIsStreaming(true);
      await analyzerRef.current.connect();
      
      // Start first recording after connection is established
      await startRecording();
    } catch (err) {
      console.error('❌ Failed to start streaming:', err);
      setError(err.message);
      setIsStreaming(false);
    } finally {
      setIsInitializing(false);
    }
  }, [onAnalysisUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    isStreaming,
    startStreaming,
    stopStreaming,
    error,
  };
}