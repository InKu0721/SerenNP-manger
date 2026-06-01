export interface POCTemplate {
  id: string;
  name: string;
  author: string;
  severity: string;
  description: string;
  reference: string[];
  tags: string[];
  category: string;
  content: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScanRequest {
  targets: string[];
  templateIds: string[];
  options: ScanOptions;
}

export interface ScanOptions {
  concurrency: number;
  timeout: number;
  rateLimit: number;
  bulkSize: number;
  headless: boolean;
}

export interface ScanStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  progress: number;
  total: number;
  completed: number;
  found: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  targets: string[];
  templateIds: string[];
}

export interface ScanResult {
  id: string;
  scanId: string;
  templateId: string;
  templateName: string;
  severity: string;
  host: string;
  matched: string;
  extractedData?: Record<string, string>;
  timestamp: string;
  request?: string;
  response?: string;
}

export interface Stats {
  totalPocs: number;
  totalScans: number;
  totalFindings: number;
  securityScore: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  severityCounts: Record<string, number>;
  recentScans: ScanStatus[];
}

export interface Settings {
  concurrency: number;
  timeout: number;
  rateLimit: number;
  bulkSize: number;
  templatesDir: string;
  proxyUrl?: string;
  headless: boolean;
}

export type ViewType = 'dashboard' | 'templates' | 'scanner' | 'results' | 'tools' | 'settings';

