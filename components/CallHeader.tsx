import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

export function CallHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <MaterialIcons name="security" size={24} color={Colors.primary} />
        <ThemedText type="title">ScamShield</ThemedText>
      </View>
      <ThemedText type="subtitle">AI-Powered Call Protection</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  }
});