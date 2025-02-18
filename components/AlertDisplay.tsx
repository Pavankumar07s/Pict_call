import { StyleSheet, View, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { CallAnalysisType } from "@/types";

interface Props {
  analysis: CallAnalysisType;
  onDismiss: () => void;
}

export function AlertDisplay({ analysis, onDismiss }: Props) {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          analysis.suspicious ? styles.suspicious : styles.safe,
        ]}
      >
        <MaterialIcons
          name={analysis.suspicious ? "warning" : "verified-user"}
          size={24}
          color="white"
        />
        <ThemedText style={styles.headerText}>
          {analysis.suspicious
            ? "Suspicious Call Detected"
            : "Call Appears Safe"}
        </ThemedText>
        <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {analysis.suspicious && (
        <View style={styles.content}>
          {analysis.reasons.map((reason, index) => (
            <View key={index} style={styles.reasonItem}>
              <MaterialIcons
                name="error-outline"
                size={20}
                color={Colors.danger}
              />
              <ThemedText>{reason}</ThemedText>
            </View>
          ))}

          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${analysis.confidence * 100}%` },
              ]}
            />
            <ThemedText style={styles.confidenceText}>
              Confidence: {(analysis.confidence * 100).toFixed(1)}%
            </ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    borderRadius: 12,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  suspicious: {
    backgroundColor: Colors.danger,
  },
  safe: {
    backgroundColor: Colors.success,
  },
  headerText: {
    flex: 1,
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: "#E5E5EA",
    borderRadius: 2,
    marginTop: 16,
    overflow: "hidden",
  },
  confidenceFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
  },
  confidenceText: {
    marginTop: 8,
    textAlign: "center",
  },
});
