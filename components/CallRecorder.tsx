import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useRecordingTimer } from '@/hooks/useRecordingTimer';
import { analyzeAudio } from '@/services/audioAnalysis';
import { CallAnalysisType } from '@/types';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

interface Props {
  isRecording: boolean;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onAnalysisReceived: (analysis: CallAnalysisType) => void;
}

export function CallRecorder({ 
  isRecording, 
  onRecordingStart, 
  onRecordingStop,
  onAnalysisReceived 
}: Props) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const { elapsedTime, startTimer, stopTimer } = useRecordingTimer();

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone permission is required');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
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
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        }
      });
      
      setRecording(recording);
      onRecordingStart();
      startTimer();
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  }, [onRecordingStart, startTimer]);

  const stopRecording = useCallback(async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setLastRecordingUri(uri);
      onRecordingStop();
      stopTimer();

      if (uri) {
        const analysis = await analyzeAudio(uri);
        onAnalysisReceived(analysis);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }, [recording, onRecordingStop, stopTimer, onAnalysisReceived]);

  const playRecording = useCallback(async () => {
    if (!lastRecordingUri) return;

    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: lastRecordingUri },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate(status => {
          if (status.isLoaded && !status.isPlaying && !status.didJustFinish) {
            setIsPlaying(false);
          }
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      }
    } catch (err) {
      console.error('Failed to play recording', err);
    }
  }, [lastRecordingUri, sound, isPlaying]);

  const saveRecording = useCallback(async () => {
    if (!lastRecordingUri) return;

    try {
      // Use the downloads directory which is accessible via file manager
      const fileName = `ScamShield_${Date.now()}.wav`;
      const downloadDir = FileSystem.documentDirectory + 'downloads/';
      
      // Create downloads directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      }

      // Copy recording to downloads directory
      const newUri = downloadDir + fileName;
      await FileSystem.copyAsync({
        from: lastRecordingUri,
        to: newUri
      });

      // For Android: Make the file visible in file manager
      if (Platform.OS === 'android') {
        const publicDir = FileSystem.cacheDirectory + fileName;
        await FileSystem.copyAsync({
          from: newUri,
          to: publicDir
        });
        
        // Use MediaLibrary to make it visible in file manager
        const asset = await MediaLibrary.createAssetAsync(publicDir);
        Alert.alert(
          'Success', 
          'Recording saved successfully.\nYou can find it in your Downloads folder.'
        );
      } else {
        Alert.alert(
          'Success', 
          'Recording saved successfully'
        );
      }
    } catch (err) {
      console.error('Failed to save recording:', err);
      Alert.alert('Error', 'Failed to save recording');
    }
  }, [lastRecordingUri]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recording]}
        onPress={isRecording ? stopRecording : startRecording}>
        <MaterialIcons
          name={isRecording ? 'stop' : 'mic'}
          size={32}
          color="white"
        />
      </TouchableOpacity>
      
      <ThemedText style={styles.timerText}>
        {isRecording ? elapsedTime : 'Tap to Start Recording'}
      </ThemedText>

      {lastRecordingUri && !isRecording && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={playRecording}>
            <MaterialIcons
              name={isPlaying ? 'pause' : 'play-arrow'}
              size={24}
              color={Colors.primary}
            />
            <ThemedText style={styles.controlText}>
              {isPlaying ? 'Pause' : 'Play'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.controlButton}
            onPress={saveRecording}>
            <MaterialIcons
              name="save-alt"
              size={24}
              color={Colors.primary}
            />
            <ThemedText style={styles.controlText}>
              Save
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recording: {
    backgroundColor: Colors.danger,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '600',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  controlText: {
    fontSize: 12,
    marginTop: 4,
    color: Colors.primary,
  },
});