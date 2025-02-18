import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { AlertType } from '@/types';

const PulsingDot = ({ pulseAnim }: { pulseAnim: Animated.Value }) => (
  <Animated.View
    style={[
      styles.dot,
      {
        transform: [{ scale: pulseAnim }],
      },
    ]}
  />
);

interface Props {
  isActive: boolean;
  alerts: string[];
}

export function LiveAnalysis({ isActive, alerts }: Props) {
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isActive]);

  return (
    <View style={styles.container}>
      <View style={styles.indicator}>
        <PulsingDot pulseAnim={pulseAnim} />
        <ThemedText style={styles.alertText}>
          Live Analysis Active
        </ThemedText>
      </View>

      {alerts.length > 0 && (
        <View style={styles.alertsContainer}>
          {alerts.map((alert, index) => (
            <View key={index} style={styles.alertItem}>
              <MaterialIcons name="warning" size={20} color={Colors.warning} />
              <ThemedText style={styles.alertText}>{alert}</ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertsContainer: {
    marginTop: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  alertText: {
    color: Colors.warning,
    flex: 1,
  }
});