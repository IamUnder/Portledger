import { runCommand } from "../exec.js";
import type { Database } from "@prisma/client";

export interface QueryStat {
  query: string;
  execCount: number;
  avgTimeMs: number;
  totalTimeMs: number;
  rowsExamined: number;
}

export async function getQueryStats(db: Database): Promise<QueryStat[]> {
  if (db.engine === "MYSQL") {
    const sql = `
      SELECT JSON_ARRAYAGG(JSON_OBJECT(
        'query', DIGEST_TEXT,
        'execCount', COUNT_STAR,
        'avgTimeMs', ROUND(AVG_TIMER_WAIT/1000000000, 2),
        'totalTimeMs', ROUND(SUM_TIMER_WAIT/1000000000, 2),
        'rowsExamined', SUM_ROWS_EXAMINED
      )) FROM (
        SELECT * FROM performance_schema.events_statements_summary_by_digest
        WHERE SCHEMA_NAME = '${db.databaseName}' AND DIGEST_TEXT IS NOT NULL
        ORDER BY SUM_TIMER_WAIT DESC LIMIT 25
      ) t;
    `;
    const { code, output } = await runCommand("docker", [
      "exec",
      "-e",
      `MYSQL_PWD=${db.password}`,
      db.containerName,
      "mysql",
      `-u${db.username}`,
      "-N",
      "-B",
      "-e",
      sql,
    ]);
    if (code !== 0) throw new Error(`no se pudo consultar performance_schema: ${output}`);
    return JSON.parse(output.trim() || "[]") ?? [];
  }

  if (db.engine === "POSTGRES") {
    const sql = `
      SELECT COALESCE(json_agg(t), '[]') FROM (
        SELECT query, calls AS "execCount", round(mean_exec_time::numeric, 2) AS "avgTimeMs",
               round(total_exec_time::numeric, 2) AS "totalTimeMs", rows AS "rowsExamined"
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC LIMIT 25
      ) t;
    `;
    const { code, output } = await runCommand("docker", [
      "exec",
      "-e",
      `PGPASSWORD=${db.password}`,
      db.containerName,
      "psql",
      "-U",
      db.username,
      "-d",
      db.databaseName,
      "-t",
      "-A",
      "-c",
      sql,
    ]);
    if (code !== 0) {
      throw new Error(
        `no se pudo consultar pg_stat_statements (¿está la extensión activada?): ${output}`
      );
    }
    return JSON.parse(output.trim() || "[]");
  }

  throw new Error(`motor desconocido: ${db.engine}`);
}

export async function resetQueryStats(db: Database): Promise<void> {
  if (db.engine === "MYSQL") {
    await runCommand("docker", [
      "exec",
      "-e",
      `MYSQL_PWD=${db.password}`,
      db.containerName,
      "mysql",
      `-u${db.username}`,
      "-e",
      "TRUNCATE TABLE performance_schema.events_statements_summary_by_digest",
    ]);
  } else if (db.engine === "POSTGRES") {
    await runCommand("docker", [
      "exec",
      "-e",
      `PGPASSWORD=${db.password}`,
      db.containerName,
      "psql",
      "-U",
      db.username,
      "-d",
      db.databaseName,
      "-c",
      "SELECT pg_stat_statements_reset();",
    ]);
  }
}
