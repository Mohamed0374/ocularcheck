import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { databaseConfig, type DatabaseConfig } from '../../config/database.config.js';
import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * NestJS wrapper for the generated Prisma Client (official Prisma 7 NestJS
 * guide pattern, adapted to this project: the connection string comes from
 * the validated config layer via this constructor injection, never from
 * process.env here).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(databaseConfig.KEY)
    databaseCfg: DatabaseConfig,
  ) {
    super({ adapter: new PrismaPg({ connectionString: databaseCfg.url }) });
  }

  /** Eager connection at boot — fail-fast if the database is unreachable. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
