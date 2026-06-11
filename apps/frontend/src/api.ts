/**
 * Tiny fetch helper for the plugin API exposed by Matterbridge core.
 *
 * Matterbridge serves this frontend under `import.meta.env.BASE_URL`
 * (`/plugins/matterbridge-mqtt/`) and routes `<base>api/:path` to the plugin
 * platform's `onFetch(method, path, query, body)`.
 */

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A retained MQTT payload for a device subTopic (config, state or subscribe). */
export interface DeviceEntry {
  time: number;
  endpointName: string;
  payload: unknown;
}

/** A device row returned by the GET devices endpoint. */
export interface ApiDevice {
  deviceId: string;
  name: string;
  config: DeviceEntry | null;
  state: DeviceEntry | null;
  subscribe: DeviceEntry | null;
}

/** An incoming MQTT message returned by the GET messages endpoint. */
export interface ApiMessage {
  time: number;
  topic: string;
  deviceId: string;
  subTopic: string;
  endpointName: string;
  payload: string;
}

/**
 * Builds the absolute URL for a plugin API resource.
 *
 * @param path - The single resource path segment (e.g. `devices`).
 * @param query - Optional query string parameters.
 * @returns The absolute URL including the plugin base path.
 */
export function apiUrl(path: string, query?: Record<string, string>): string {
  const url = `${import.meta.env.BASE_URL}api/${path}`;
  if (!query || Object.keys(query).length === 0) return url;
  return `${url}?${new URLSearchParams(query).toString()}`;
}

/**
 * Calls the plugin API and parses the JSON response.
 *
 * @param method - The HTTP method.
 * @param path - The single resource path segment (e.g. `devices`).
 * @param query - Optional query string parameters.
 * @param body - Optional JSON request body (for POST/PUT/PATCH).
 * @returns The parsed JSON response, or `undefined` for a 204 No Content.
 * @throws {Error} When the response status is not ok.
 */
export async function apiFetch<T = unknown>(method: ApiMethod, path: string, query?: Record<string, string>, body?: unknown): Promise<T | undefined> {
  const response = await fetch(apiUrl(path, query), {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Plugin API ${method} ${path} failed with status ${response.status}`);
  }
  if (response.status === 204) return undefined;
  return (await response.json()) as T;
}

/**
 * Fetches the device table from the plugin.
 *
 * @returns The list of devices with their retained config/state/subscribe payloads.
 */
export async function getDevices(): Promise<ApiDevice[]> {
  return (await apiFetch<ApiDevice[]>('GET', 'devices')) ?? [];
}

/**
 * Fetches the recent incoming MQTT messages from the plugin (newest first).
 *
 * @returns The list of recent incoming MQTT messages.
 */
export async function getMessages(): Promise<ApiMessage[]> {
  return (await apiFetch<ApiMessage[]>('GET', 'messages')) ?? [];
}

/**
 * Fetches the recent outgoing MQTT messages (write path) from the plugin (newest first).
 *
 * @returns The list of recent outgoing MQTT messages.
 */
export async function getOutgoing(): Promise<ApiMessage[]> {
  return (await apiFetch<ApiMessage[]>('GET', 'outgoing')) ?? [];
}
