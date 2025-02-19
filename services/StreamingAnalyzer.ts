import { CallAnalysisType } from '../types';

export class StreamingAnalyzer {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private analysisHistory: Array<Partial<CallAnalysisType>> = [];
  private chunkCount = 0;

  constructor(
    private onAnalysisUpdate: (analysis: Partial<CallAnalysisType>) => void,
    private onError: (error: string) => void
  ) {
    // Bind all methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.sendAudio = this.sendAudio.bind(this);
    this.clearTimeouts = this.clearTimeouts.bind(this);
    this.handleConnectionError = this.handleConnectionError.bind(this);
  }

  private clearTimeouts(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  connect(): void {
    if (!this.shouldReconnect) return;
    
    this.clearTimeouts();
    if (this.ws) this.disconnect();

    try {
      const wsUrl = process.env.EXPO_PUBLIC_WS_URL || 'ws://192.168.244.71:3000';
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      this.ws = new WebSocket(`${wsUrl}/ws`);
      this.shouldReconnect = true;

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📥 Received analysis:', data);
          
          if (data.error) {
            console.error('❌ Server error:', data.error);
            this.onError(data.error);
          } else {
            this.onAnalysisUpdate(data);
          }
        } catch (err) {
          console.error('❌ Error parsing WebSocket message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.handleConnectionError();
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        this.isConnected = false;
        if (this.shouldReconnect) {
          this.handleConnectionError();
        }
      };
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      this.handleConnectionError();
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    this.shouldReconnect = false;
    this.clearTimeouts();
    
    if (this.ws) {
      try {
        this.ws.close();
        this.ws = null;
        this.isConnected = false;
        console.log('✅ WebSocket disconnected cleanly');
      } catch (error) {
        console.error('❌ Error closing WebSocket:', error);
      }
    }
  }

  private handleConnectionError(): void {
    this.clearTimeouts();
    
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.shouldReconnect) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.reconnectTimeout = setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.onError('Failed to establish WebSocket connection');
    }
  }

  sendAudio(base64Audio: string): void {
    if (this.ws && this.isConnected) {
      try {
        this.chunkCount++;
        console.log(`📤 Sending chunk #${this.chunkCount}`);
        this.ws.send(base64Audio);
      } catch (error) {
        console.error(`❌ Error sending chunk:`, error);
        this.onError('Failed to send audio data');
      }
    }
  }
}