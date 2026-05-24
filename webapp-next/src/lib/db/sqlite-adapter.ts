/**
 * SQLite-backed Supabase-compatible query client.
 *
 * Mirrors the fluent Supabase PostgREST builder API so that every
 * existing API route works without changes when LOCAL_MODE=true.
 * The adapter is intentionally scoped to the exact query patterns
 * used by this codebase — it is not a general Supabase emulator.
 *
 * Supported patterns:
 *   .from(t).select(cols[, opts]).eq().lt().in().order().range()
 *   .from(t).select(cols[, opts]).eq()...single() / maybeSingle()
 *   .from(t).insert(data).select(cols).single()
 *   .from(t).update(data).eq().select(cols).single() / maybeSingle()
 *   .from(t).update(data).eq()            (awaitable, no return)
 *   .from(t).delete().eq() / .in()        (awaitable)
 *   COUNT: .from(t).select('col', { count:'exact', head:true }).eq()
 *
 * SQLite-to-Supabase error code translation:
 *   UNIQUE constraint failed  → code '23505'
 *   FOREIGN KEY constraint    → code '23503'
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

// ────────────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────────────
interface DbError { message: string; code?: string }
interface QueryResult<T = unknown> {
  data:  T | null;
  error: DbError | null;
  count?: number;
}

// ────────────────────────────────────────────────────────────────
//  Per-table metadata
// ────────────────────────────────────────────────────────────────
const JSON_COLS: Record<string, Set<string>> = {
  coffee_orders: new Set(['customization']),
};

const BOOL_COLS: Record<string, Set<string>> = {
  coffee_machines:  new Set(['is_free']),
  coffee_admins:    new Set(['is_active']),
  coffee_customers: new Set(['is_active']),
};

// Tables that need an idempotency_key auto-generated on insert
const IDEMPOTENCY_KEY_TABLES = new Set(['coffee_orders']);

// ────────────────────────────────────────────────────────────────
//  Row coercion helpers
// ────────────────────────────────────────────────────────────────
function coerceRow(table: string, row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null;
  const out: Record<string, unknown> = { ...row };
  const jsonCols = JSON_COLS[table];
  const boolCols = BOOL_COLS[table];
  for (const [k, v] of Object.entries(out)) {
    if (jsonCols?.has(k) && typeof v === 'string') {
      try { out[k] = JSON.parse(v); } catch { /* keep as-is */ }
    }
    if (boolCols?.has(k)) {
      out[k] = v === 1 || v === true || v === '1';
    }
  }
  return out;
}

function coerceRows(table: string, rows: unknown[]): unknown[] {
  return rows.map(r => coerceRow(table, r as Record<string, unknown>));
}

function prepareInsertData(table: string, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  if (!out.id) out.id = randomUUID();
  if (!out.created_at) out.created_at = new Date().toISOString();
  if (IDEMPOTENCY_KEY_TABLES.has(table) && !out.idempotency_key) {
    out.idempotency_key = randomUUID();
  }
  // Serialize JSON columns
  const jsonCols = JSON_COLS[table];
  for (const k of Object.keys(out)) {
    if (jsonCols?.has(k) && typeof out[k] === 'object') {
      out[k] = JSON.stringify(out[k]);
    }
    // Coerce booleans to SQLite integers
    if (BOOL_COLS[table]?.has(k)) {
      out[k] = out[k] ? 1 : 0;
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
//  Parse Supabase relational select syntax
//  e.g.  "id, coffee_machines!inner(name, location), coffee_payments(method)"
//  Returns { plainCols, joins }
// ────────────────────────────────────────────────────────────────
interface JoinSpec {
  table:    string;
  alias:    string;
  cols:     string[];
  required: boolean; // true = INNER JOIN, false = LEFT JOIN
}

function parseRelationalSelect(cols: string): {
  plainCols: string[];
  joins:     JoinSpec[];
} {
  const plainCols: string[] = [];
  const joins:     JoinSpec[] = [];

  // Match "table_name!inner(col1, col2)" or "table_name(col1, col2)"
  const re = /(\w+)(!inner)?\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(cols)) !== null) {
    // Gather plain columns before this match
    const before = cols.slice(lastIndex, match.index)
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
    plainCols.push(...before);

    joins.push({
      table:    match[1]!,
      alias:    match[1]!,
      cols:     match[3]!.split(',').map(c => c.trim()),
      required: !!match[2], // !inner present → INNER JOIN
    });
    lastIndex = match.index + match[0].length;
    // Skip trailing comma after the join spec
    if (cols[lastIndex] === ',') lastIndex++;
  }

  // Remaining plain columns after last join
  const rest = cols.slice(lastIndex).split(',').map(c => c.trim()).filter(Boolean);
  plainCols.push(...rest);

  return { plainCols, joins };
}

// ────────────────────────────────────────────────────────────────
//  FK relationship map: tableName → { parentTable, fkCol, pkCol }
// ────────────────────────────────────────────────────────────────
const FK_MAP: Record<string, { parentTable: string; fkCol: string; pkCol: string }> = {
  coffee_machines:     { parentTable: 'coffee_orders',   fkCol: 'machine_id', pkCol: 'id' },
  coffee_payments:     { parentTable: 'coffee_orders',   fkCol: 'order_id',   pkCol: 'id' },
  coffee_dispense_log: { parentTable: 'coffee_orders',   fkCol: 'order_id',   pkCol: 'id' },
  coffee_customers:    { parentTable: 'coffee_machines', fkCol: 'customer_id', pkCol: 'id' },
};

// ────────────────────────────────────────────────────────────────
//  Query builder
// ────────────────────────────────────────────────────────────────
class SQLiteBuilder {
  private _table      = '';
  private _operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private _selectCols = '*';
  private _returnCols = '';
  private _countExact = false;
  private _headOnly   = false;
  private _where:   [string, string, unknown][] = [];
  private _inWhere: [string, unknown[]][] = [];
  private _orderCol?: string;
  private _orderAsc  = true;
  private _limitN?:  number;
  private _rangeFrom?: number;
  private _rangeTo?:   number;
  private _insertData?: Record<string, unknown>;
  private _updateData?: Record<string, unknown>;
  private _wantSingle      = false;
  private _wantMaybeSingle = false;

  constructor(private db: Database.Database) {}

  from(table: string): this {
    this._table = table;
    return this;
  }

  select(cols = '*', opts?: { count?: string; head?: boolean }): this {
    if (this._operation === 'insert' || this._operation === 'update') {
      this._returnCols = cols;
    } else {
      this._operation  = 'select';
      this._selectCols = cols;
    }
    if (opts?.count === 'exact') this._countExact = true;
    if (opts?.head)              this._headOnly   = true;
    return this;
  }

  insert(data: Record<string, unknown>): this {
    this._operation  = 'insert';
    this._insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this._operation  = 'update';
    this._updateData = data;
    return this;
  }

  delete(): this {
    this._operation = 'delete';
    return this;
  }

  eq(col: string, val: unknown): this {
    this._where.push([col, '=', val]);
    return this;
  }

  lt(col: string, val: unknown): this {
    this._where.push([col, '<', val]);
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this._inWhere.push([col, vals]);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this._orderCol = col;
    this._orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(n: number): this {
    this._limitN = n;
    return this;
  }

  range(from: number, to: number): this {
    this._rangeFrom = from;
    this._rangeTo   = to;
    return this;
  }

  single(): Promise<QueryResult> {
    this._wantSingle = true;
    return this._execute();
  }

  maybeSingle(): Promise<QueryResult> {
    this._wantMaybeSingle = true;
    return this._execute();
  }

  // Makes the builder directly awaitable (no .single() needed)
  then<T>(
    onfulfilled: (v: QueryResult) => T,
    onrejected?: (e: unknown) => T,
  ): Promise<T> {
    return this._execute().then(onfulfilled, onrejected);
  }

  // ──────────────────────────────────────────────────────────────
  //  Execution
  // ──────────────────────────────────────────────────────────────
  private async _execute(): Promise<QueryResult> {
    try {
      switch (this._operation) {
        case 'select': return this._doSelect();
        case 'insert': return this._doInsert();
        case 'update': return this._doUpdate();
        case 'delete': return this._doDelete();
      }
    } catch (e: unknown) {
      return { data: null, error: translateError(e) };
    }
  }

  // ── SELECT ────────────────────────────────────────────────────
  private _doSelect(): QueryResult {
    const table = this._table;

    // Check for Supabase relational joins
    const { plainCols, joins } = parseRelationalSelect(this._selectCols);
    const hasJoins = joins.length > 0;

    const [whereClause, params] = buildWhere(
      this._where, this._inWhere, hasJoins ? table : undefined,
    );

    if (this._headOnly || (this._countExact && !this._wantSingle && !this._wantMaybeSingle)) {
      // COUNT only
      const countSql = `SELECT COUNT(*) AS cnt FROM ${table}${whereClause ? ' WHERE ' + whereClause : ''}`;
      const countRow = this.db.prepare(countSql).get(...params) as { cnt: number };
      return { data: null, count: countRow?.cnt ?? 0, error: null };
    }

    if (hasJoins) {
      return this._doJoinSelect(table, plainCols, joins, whereClause, params);
    }

    const cols   = this._selectCols === '*' ? '*' : plainCols.join(', ');
    const order  = this._orderCol
      ? ` ORDER BY ${this._orderCol} ${this._orderAsc ? 'ASC' : 'DESC'}`
      : '';

    let limit = '';
    let offset = 0;
    if (this._rangeFrom !== undefined && this._rangeTo !== undefined) {
      limit  = ` LIMIT ${this._rangeTo - this._rangeFrom + 1}`;
      offset = this._rangeFrom;
    } else if (this._limitN !== undefined) {
      limit = ` LIMIT ${this._limitN}`;
    }

    const offsetClause = offset > 0 ? ` OFFSET ${offset}` : '';
    const baseSql = `SELECT ${cols} FROM ${table}${whereClause ? ' WHERE ' + whereClause : ''}${order}${limit}${offsetClause}`;

    let countResult: number | undefined;
    if (this._countExact) {
      const countSql = `SELECT COUNT(*) AS cnt FROM ${table}${whereClause ? ' WHERE ' + whereClause : ''}`;
      const countRow = this.db.prepare(countSql).get(...params) as { cnt: number };
      countResult = countRow?.cnt ?? 0;
    }

    if (this._wantSingle || this._wantMaybeSingle) {
      const row = this.db.prepare(baseSql).get(...params) as Record<string, unknown> | undefined;
      if (!row) {
        if (this._wantSingle) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
        }
        return { data: null, error: null };
      }
      return { data: coerceRow(table, row), error: null };
    }

    const rows = this.db.prepare(baseSql).all(...params);
    return { data: coerceRows(table, rows as unknown[]) as unknown, error: null, count: countResult };
  }

  // JOIN select for the admin transactions page
  private _doJoinSelect(
    baseTable: string,
    plainCols: string[],
    joins: JoinSpec[],
    whereClause: string,
    params: unknown[],
  ): QueryResult {
    const alias = (t: string) => t.replace('coffee_', '');
    const base  = alias(baseTable);

    // Build SELECT list
    const selectParts: string[] = plainCols.map(c => `${base}.${c}`);
    for (const j of joins) {
      const ja = alias(j.table);
      for (const c of j.cols) selectParts.push(`${ja}.${c} AS __${ja}_${c}`);
    }

    // Build JOIN clauses
    const joinClauses: string[] = [];
    for (const j of joins) {
      const ja  = alias(j.table);
      const rel = FK_MAP[j.table];
      let on: string;
      if (rel?.parentTable === baseTable) {
        on = `${ja}.${rel.fkCol} = ${base}.id`;
      } else {
        on = `${ja}.id = ${base}.${alias(j.table)}_id`;
      }
      joinClauses.push(`${j.required ? 'INNER' : 'LEFT'} JOIN ${j.table} ${ja} ON ${on}`);
    }

    const order  = this._orderCol ? ` ORDER BY ${base}.${this._orderCol} ${this._orderAsc ? 'ASC' : 'DESC'}` : '';
    let limit    = '';
    let offset   = 0;
    if (this._rangeFrom !== undefined && this._rangeTo !== undefined) {
      limit  = ` LIMIT ${this._rangeTo - this._rangeFrom + 1}`;
      offset = this._rangeFrom;
    }
    const offsetClause = offset > 0 ? ` OFFSET ${offset}` : '';

    const sql = `SELECT ${selectParts.join(', ')} FROM ${baseTable} ${base} ${joinClauses.join(' ')}${whereClause ? ' WHERE ' + whereClause : ''}${order}${limit}${offsetClause}`;

    let countResult: number | undefined;
    if (this._countExact) {
      const cSql = `SELECT COUNT(*) AS cnt FROM ${baseTable} ${base} ${joinClauses.join(' ')}${whereClause ? ' WHERE ' + whereClause : ''}`;
      const crow = this.db.prepare(cSql).get(...params) as { cnt: number };
      countResult = crow?.cnt ?? 0;
    }

    const rawRows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    // Re-nest prefixed columns into sub-objects matching Supabase relational format
    const rows = rawRows.map(row => {
      const out: Record<string, unknown> = {};
      for (const k of plainCols) out[k] = row[`${alias(baseTable)}.${k}`] ?? row[k];
      // Coerce base table JSON/bool columns
      coerceRow(baseTable, out);
      for (const j of joins) {
        const ja = alias(j.table);
        const nested: Record<string, unknown> = {};
        let hasAny = false;
        for (const c of j.cols) {
          const v = row[`__${ja}_${c}`];
          if (v !== null && v !== undefined) hasAny = true;
          nested[c] = v ?? null;
        }
        out[j.table] = hasAny ? (j.required ? nested : [nested]) : (j.required ? null : []);
      }
      return out;
    });

    return { data: rows as unknown, error: null, count: countResult };
  }

  // ── INSERT ────────────────────────────────────────────────────
  private _doInsert(): QueryResult {
    const table = this._table;
    const data  = prepareInsertData(table, this._insertData!);
    const keys  = Object.keys(data);
    const sql   = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})${this._returnCols ? ' RETURNING ' + this._returnCols : ''}`;

    if (this._returnCols) {
      const row = this.db.prepare(sql).get(...Object.values(data)) as Record<string, unknown> | undefined;
      if (!row && this._wantSingle) {
        return { data: null, error: { message: 'Insert failed', code: 'INSERT_FAILED' } };
      }
      return { data: row ? coerceRow(table, row) : null, error: null };
    }

    this.db.prepare(sql).run(...Object.values(data));
    return { data: null, error: null };
  }

  // ── UPDATE ────────────────────────────────────────────────────
  private _doUpdate(): QueryResult {
    const table = this._table;
    const raw   = this._updateData!;

    // Auto-set updated_at for tables that have it
    const data: Record<string, unknown> = {
      ...raw,
      ...(tableHasUpdatedAt(table) && !raw.updated_at
        ? { updated_at: new Date().toISOString() }
        : {}),
    };

    // Serialize JSON/bool columns
    const jsonCols = JSON_COLS[table];
    const boolCols = BOOL_COLS[table];
    for (const k of Object.keys(data)) {
      if (jsonCols?.has(k) && typeof data[k] === 'object') {
        data[k] = JSON.stringify(data[k]);
      }
      if (boolCols?.has(k)) {
        data[k] = data[k] ? 1 : 0;
      }
    }

    const setCols = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const [whereClause, whereParams] = buildWhere(this._where, this._inWhere);
    const sql = `UPDATE ${table} SET ${setCols}${whereClause ? ' WHERE ' + whereClause : ''}${this._returnCols ? ' RETURNING ' + this._returnCols : ''}`;

    const allParams = [...Object.values(data), ...whereParams];

    if (this._returnCols) {
      if (this._wantSingle || this._wantMaybeSingle) {
        const row = this.db.prepare(sql).get(...allParams) as Record<string, unknown> | undefined;
        if (!row) {
          if (this._wantSingle) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
          }
          return { data: null, error: null };
        }
        return { data: coerceRow(table, row), error: null };
      }
      const rows = this.db.prepare(sql).all(...allParams);
      return { data: coerceRows(table, rows as unknown[]) as unknown, error: null };
    }

    this.db.prepare(sql).run(...allParams);
    return { data: null, error: null };
  }

  // ── DELETE ────────────────────────────────────────────────────
  private _doDelete(): QueryResult {
    if (this._inWhere.length > 0 && this._inWhere[0]![1].length === 0) {
      return { data: null, error: null }; // empty IN list — skip
    }
    const [whereClause, params] = buildWhere(this._where, this._inWhere);
    const sql = `DELETE FROM ${this._table}${whereClause ? ' WHERE ' + whereClause : ''}`;
    this.db.prepare(sql).run(...params);
    return { data: null, error: null };
  }
}

// ────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────
function buildWhere(
  where:   [string, string, unknown][],
  inWhere: [string, unknown[]][],
  tableAlias?: string,
): [string, unknown[]] {
  const parts:  string[]  = [];
  const params: unknown[] = [];
  const prefix = tableAlias ? tableAlias.replace('coffee_', '') + '.' : '';

  for (const [col, op, val] of where) {
    parts.push(`${prefix}${col} ${op} ?`);
    params.push(val);
  }
  for (const [col, vals] of inWhere) {
    if (vals.length === 0) {
      parts.push('0=1'); // empty IN → always false
    } else {
      parts.push(`${prefix}${col} IN (${vals.map(() => '?').join(', ')})`);
      params.push(...vals);
    }
  }

  return [parts.join(' AND '), params];
}

function tableHasUpdatedAt(table: string): boolean {
  return ['coffee_machines', 'coffee_orders'].includes(table);
}

function translateError(e: unknown): DbError {
  const msg = (e as Error).message ?? String(e);
  if (msg.includes('UNIQUE constraint failed'))   return { message: msg, code: '23505' };
  if (msg.includes('FOREIGN KEY constraint'))     return { message: msg, code: '23503' };
  return { message: msg };
}

// ────────────────────────────────────────────────────────────────
//  Client factory
// ────────────────────────────────────────────────────────────────
let _db: Database.Database | null = null;

function getDb(dbPath: string): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');

  // Initialize schema
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  _db.exec(schema);

  return _db;
}

export function createLocalClient(dbPath: string) {
  const db = getDb(dbPath);
  return {
    from: (table: string) => {
      const builder = new SQLiteBuilder(db);
      builder.from(table);
      return builder;
    },
  };
}
