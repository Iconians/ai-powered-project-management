import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local or .env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    try {
      const envPath = resolve(process.cwd(), envFile);
      const content = readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            // Remove quotes if present
            const cleanValue = value.replace(/^["']|["']$/g, '');
            if (!process.env[key.trim()]) {
              process.env[key.trim()] = cleanValue;
            }
          }
        }
      }
    } catch (error) {
      // File doesn't exist, continue to next
    }
  }
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Please set it in .env.local or .env file, or as an environment variable.\n' +
    'Example: DATABASE_URL=postgresql://user:password@localhost:5432/database'
  );
}

export default {
  datasource: {
    url: databaseUrl,
  },
};
