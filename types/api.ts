export interface AnalysisResponse {
  suspicious: boolean;
  confidence: number;
  reasons: string[];
  timestamps: {
    start: number;
    end: number;
    text: string;
    type: 'otp' | 'remote_access' | 'social_engineering';
  }[];
}

export interface StreamAnalysisResponse {
  suspicious: boolean;
  confidence: number;
  reasons: string[];
  currentTimestamp?: number;
  detectedKeywords?: string[];
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: any;
}