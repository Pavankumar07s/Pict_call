import { StyleSheet } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CallRecorder } from '@/components/CallRecorder';
import { LiveAnalysis } from '@/components/LiveAnalysis';
import { AlertDisplay } from '@/components/AlertDisplay';
import { ThemedView } from '@/components/ThemedView';
import { CallHeader } from '@/components/CallHeader';
import { CallAnalysisType } from '@/types';
import { StreamingRecorder } from '@/components/StreamingRecorder';

export default function HomeScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [analysis, setAnalysis] = useState<CallAnalysisType | null>(null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <CallHeader />
        
        <StreamingRecorder 
          onAnalysisReceived={analysis => {
            // Handle streaming analysis updates
            if (analysis.suspicious) {
              // Show real-time alert
              console.log("ye kuch to update diya")
            }
          }}
        />
        
        <CallRecorder 
          isRecording={isRecording}
          onRecordingStart={() => setIsRecording(true)}
          onRecordingStop={() => setIsRecording(false)}
          onAnalysisReceived={setAnalysis}
        />

        {isRecording && (
          <LiveAnalysis 
            isActive={isRecording}
          />
        )}

        {analysis && (
          <AlertDisplay 
            analysis={analysis}
            onDismiss={() => setAnalysis(null)}
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white', 
    
  },
  container: {
    flex: 5,
    padding: 16,
    paddingVertical: 64,
  }
});