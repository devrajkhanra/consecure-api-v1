import { registerAs } from '@nestjs/config';

/**
 * Named configuration namespace 'database'.
 *
 * Consumed via ConfigService.get('database.host') etc. in the rare cases
 * where a module outside AppModule needs direct database config access
 * (e.g. a health-check module that tests connectivity independently).
 *
 * `synchronize` has been permanently removed from this file.
 * It is hardcoded to `false` in AppModule's TypeOrmModule.forRootAsync
 * factory and must NEVER be re-introduced here or read from the
 * environment — see the detailed comment in AppModule.
 */
export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? process.env.PGPASSWORD ?? 'root',
  database: process.env.DB_DATABASE ?? 'consecure_dev',
  ssl: process.env.DB_SSL === 'true',
}));