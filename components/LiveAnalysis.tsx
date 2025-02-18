import { useEffect, useState } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { AlertType } from '@/types';

interface Props {
  isActive: boolean;
}

export function LiveAnalysis({ isActive }: Props) {
  const [alerts, setAlerts] = useState<AlertType[]>([]);
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
      <Animated.View style={[styles.indicator, { transform: [{ scale: pulseAnim }] }]}>
        <MaterialIcons name="radio" size={24} color={Colors.primary} />
        <ThemedText>Live Analysis Active</ThemedText>
      </Animated.View>

      <View style={styles.alertsContainer}>
        {alerts.map((alert, index) => (
          <View key={index} style={[styles.alert, styles[alert.type]]}>
            <MaterialIcons 
              name={alert.type === 'danger' ? 'warning' : 'info'} 
              size={20} 
              color="white" 
            />
            <ThemedText style={styles.alertText}>{alert.message}</ThemedText>
          </View>
        ))}
      </View>
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
    gap: 8,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  warning: {
    backgroundColor: Colors.warning,
  },
  danger: {
    backgroundColor: Colors.danger,
  },
  info: {
    backgroundColor: Colors.info,
  },
  alertText: {
    color: 'white',
  }
});