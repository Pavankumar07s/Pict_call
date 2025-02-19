import { CallAnalysisType } from '@/types';

export class StreamingAnalyzer {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    private onAnalysisUpdate: (analysis: Partial<CallAnalysisType>) => void,
    private onError: (error: string) => void
  ) {}

  connect() {
    this.clearTimeouts();
    this.disconnect();

    try {
      const wsUrl = process.env.EXPO_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://192.168.244.85:3000';
      this.ws = new WebSocket(`${wsUrl}/ws`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket data:', data);
          
          if (data.error) {
            this.onError(data.error);
          } else {
            this.onAnalysisUpdate(data);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handleConnectionError();
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.isConnected = false;
        this.handleConnectionError();
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleConnectionError();
    }
  }

  private clearTimeouts() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private handleConnectionError() {
    this.clearTimeouts();
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      this.reconnectTimeout = setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    } else {
      this.onError('Failed to establish WebSocket connection');
    }
  }

  sendAudio(base64Audio: string) {
    if (this.ws && this.isConnected) {
      try {
        this.ws.send(base64Audio);
      } catch (error) {
        console.error('Error sending audio:', error);
        this.onError('Failed to send audio data');
      }
    }
  }

  disconnect() {
    this.clearTimeouts();
    
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      this.isConnected = false;

      try {
        ws.close();
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
    }
  }
}