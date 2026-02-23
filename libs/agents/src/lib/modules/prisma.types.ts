import type { Pool } from 'pg';
import type { PrismaClient } from '@prisma/client';

/**
 * Interface for PrismaService used by agent services.
 * The actual implementation should be provided by the consuming application.
 */
export interface PrismaService extends PrismaClient {
  getPool(): Pool;
}
