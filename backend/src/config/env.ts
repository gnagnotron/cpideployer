import dotenv from 'dotenv';

dotenv.config();

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getFirstDefined(names: string[], fallback?: string): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  if (fallback) return fallback;
  throw new Error(`Missing required environment variable. Expected one of: ${names.join(', ')}`);
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: getEnv('SUPABASE_URL'),
  supabaseAnonKey: getFirstDefined(['SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY']),
  supabaseServiceRoleKey: getFirstDefined(['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']),
  encryptionKey: getEnv('APP_ENCRYPTION_KEY'),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
