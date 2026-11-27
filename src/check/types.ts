export interface CheckError {
  slide: number;
  path: string;
  rule: 'text-overflow' | 'element-overlap' | 'text-volume' | 'contrast' | 'schema' | 'custom-html' | 'animation';
  measured: number;
  limit: number;
  unit: string;
  hint: string;
}

export interface CheckResult {
  ok: boolean;
  errors: CheckError[];
  screenshots: string[];
}
