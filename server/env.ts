import dotenv from 'dotenv';
dotenv.config();

export interface Env {
  PORT: number;
  DATABASE_URL: string;
  CLIENT_URL: string;
  NODE_ENV: 'development' | 'production';
  APK_DOWNLOAD_URL: string;
}

export function validateEnv(): Env {
  const required = ['DATABASE_URL'] as const;
  const missing = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    DATABASE_URL: process.env.DATABASE_URL!,
    CLIENT_URL: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'),
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production') || 'development',
    APK_DOWNLOAD_URL: process.env.APK_DOWNLOAD_URL || '',
  };
}
