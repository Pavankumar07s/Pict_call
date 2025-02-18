export interface CallAnalysisType {
  suspicious: boolean;
  confidence: number;
  reasons: string[];
  timestamps: TimestampType[];
}

export interface TimestampType {
  start: number;
  end: number;
  text: string;
  type: "otp" | "remote_access" | "social_engineering";
}

export interface AlertType {
  type: "warning" | "danger" | "info";
  message: string;
  timestamp: number;
}
