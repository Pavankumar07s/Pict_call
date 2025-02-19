import { StyleSheet, View, Switch, Alert } from 'react-native';
import { useAudioStreaming } from '@/hooks/useAudioStreaming';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { CallAnalysisType } from '@/types';
import { useCallback, useState, useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

interface Props {
  onAnalysisReceived: (analysis: Partial<CallAnalysisType>) => void;
}

export function StreamingRecorder({ onAnalysisReceived }: Props) {
  const [isEnabled, setIsEnabled] = useState(false);
  const { isStreaming, startStreaming, stopStreaming, error } = useAudioStreaming(
    useCallback((analysis) => {
      onAnalysisReceived(analysis);
      
      if (analysis.suspicious) {
        console.log('⚠️ Suspicious content detected:', {
          confidence: analysis.confidence,
          reasons: analysis.reasons,
          keywords: analysis.detected_keywords
        });
      }

      if (analysis.history?.length) {
        console.log('📜 Analysis history:', analysis.history);
      }
    }, [onAnalysisReceived])
  );

  const toggleSwitch = useCallback(async () => {
    try {
      if (!isEnabled) {
        console.log('🎙️ Starting streaming...');
        await startStreaming();
        setIsEnabled(true);
      } else {
        console.log('⏹️ Stopping streaming...');
        await stopStreaming();
        setIsEnabled(false);
      }
    } catch (err) {
      console.error('❌ Failed to toggle streaming:', err);
      Alert.alert('Error', 'Failed to toggle streaming');
      setIsEnabled(false);
    }
  }, [isEnabled, startStreaming, stopStreaming]);

  // Reset enabled state if streaming stops unexpectedly
  useEffect(() => {
    if (!isStreaming && isEnabled) {
      setIsEnabled(false);
    }
  }, [isStreaming]);

  return (
    <View style={styles.container}>
      <View style={styles.switchContainer}>
        <ThemedText>Real-time Analysis</ThemedText>
        <Switch
          trackColor={{ false: '#767577', true: Colors.primary }}
          thumbColor={isEnabled ? '#ffffff' : '#f4f3f4'}
          onValueChange={toggleSwitch}
          value={isEnabled}
        />
      </View>
      {isStreaming && (
        <View style={styles.streamingIndicator}>
          <PulsingDot />
          <ThemedText style={styles.streamingText}>
            Live Analysis Active
          </ThemedText>
        </View>
      )}
    </View>
  );
}
function PulsingDot() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 })
      ),
      -1
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  streamingText: {
    fontSize: 14,
    color: Colors.danger,
  },
});