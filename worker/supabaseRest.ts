/**
 * Lightweight Supabase PostgREST client built on standard fetch for Cloudflare Workers & Node tests.
 */

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  fetchFn?: typeof fetch;
}

export class SupabaseRestClient {
  private readonly baseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: SupabaseConfig) {
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.serviceRoleKey = config.serviceRoleKey.trim();
    this.fetchFn = config.fetchFn ?? fetch;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    pathWithQuery: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const res = await this.fetchFn(`${this.baseUrl}/rest/v1/${pathWithQuery}`, {
      method,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase REST ${method} ${pathWithQuery} failed (${res.status}): ${text.slice(0, 200)}`);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const text = await res.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  async select<T>(table: string, query: string): Promise<T[]> {
    const data = await this.request<T[]>('GET', query ? `${table}?${query}` : table);
    return Array.isArray(data) ? data : [];
  }

  async insert<T>(table: string, rows: unknown): Promise<T[]> {
    const data = await this.request<T[]>('POST', table, rows, {
      Prefer: 'return=representation',
    });
    return Array.isArray(data) ? data : [];
  }

  async upsert<T>(table: string, rows: unknown, onConflict?: string): Promise<T[]> {
    const query = onConflict
      ? `?on_conflict=${onConflict.split(',').map((c) => encodeURIComponent(c.trim())).join(',')}`
      : '';
    const data = await this.request<T[]>('POST', `${table}${query}`, rows, {
      Prefer: 'return=representation,resolution=merge-duplicates',
    });
    return Array.isArray(data) ? data : [];
  }

  async patch<T>(table: string, filterQuery: string, patchBody: unknown): Promise<T[]> {
    const data = await this.request<T[]>('PATCH', `${table}?${filterQuery}`, patchBody, {
      Prefer: 'return=representation',
    });
    return Array.isArray(data) ? data : [];
  }

  async deleteRows(table: string, filterQuery: string): Promise<void> {
    await this.request<void>('DELETE', `${table}?${filterQuery}`, undefined, {
      Prefer: 'return=minimal',
    });
  }
}
