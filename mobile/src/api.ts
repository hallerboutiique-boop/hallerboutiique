import Constants from "expo-constants";
import type { MobileOrder, MobileSession, OrderStatus, OrdersDashboard, OrdersFilter } from "./types";

const configuredBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  "https://www.hallerboutiique.com";

export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, "");

type ApiEnvelope = { ok: boolean; message?: string };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T extends ApiEnvelope>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Connessione al server non disponibile.", 0);
  }

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    throw new ApiError("Risposta del server non valida.", response.status);
  }
  if (!response.ok || !data.ok) throw new ApiError(data.message || "Operazione non riuscita.", response.status);
  return data;
}

export async function login(password: string): Promise<MobileSession> {
  const data = await request<ApiEnvelope & MobileSession>("/api/mobile/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return { token: data.token, expiresAt: data.expiresAt };
}

export async function fetchOrders(token: string, filter: OrdersFilter = "all"): Promise<MobileOrder[]> {
  const query = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
  const data = await request<ApiEnvelope & { orders: MobileOrder[] }>(`/api/mobile/admin/orders${query}`, {}, token);
  return data.orders;
}

export async function fetchOrder(token: string, orderId: string): Promise<MobileOrder> {
  const data = await request<ApiEnvelope & { order: MobileOrder }>(
    `/api/mobile/admin/orders/${encodeURIComponent(orderId)}`,
    {},
    token,
  );
  return data.order;
}

export async function updateOrderStatus(token: string, orderId: string, status: OrderStatus): Promise<MobileOrder> {
  const data = await request<ApiEnvelope & { order: MobileOrder }>(
    `/api/mobile/admin/orders/${encodeURIComponent(orderId)}`,
    { method: "PATCH", body: JSON.stringify({ status }) },
    token,
  );
  return data.order;
}

export async function fetchDashboard(token: string): Promise<OrdersDashboard> {
  const data = await request<ApiEnvelope & { dashboard: OrdersDashboard }>("/api/mobile/admin/dashboard", {}, token);
  return data.dashboard;
}

export async function registerPushToken(
  token: string,
  pushToken: string,
  platform: string,
  deviceName: string,
  appVersion: string,
): Promise<void> {
  await request("/api/mobile/admin/push-token", {
    method: "POST",
    body: JSON.stringify({ token: pushToken, platform, deviceName, appVersion }),
  }, token);
}

export async function unregisterPushToken(token: string, pushToken: string): Promise<void> {
  await request("/api/mobile/admin/push-token", {
    method: "DELETE",
    body: JSON.stringify({ token: pushToken }),
  }, token);
}
