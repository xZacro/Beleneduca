// Un solo cliente para toda la app: aqui se resuelven URL, credenciales y errores.
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const DEV_API_FALLBACK_ORIGIN = import.meta.env.VITE_DEV_API_FALLBACK_ORIGIN?.trim();

function getDevFallbackBase() {
  if (!import.meta.env.DEV) return null;
  if (!API_BASE.startsWith("/")) return null;

  if (DEV_API_FALLBACK_ORIGIN) {
    return DEV_API_FALLBACK_ORIGIN;
  }

  if (typeof window === "undefined") {
    return "http://localhost:4100";
  }

  return `http://${window.location.hostname}:4100`;
}

function buildRequestUrl(base: string, path: string) {
  return `${base}${path}`;
}

function buildConnectionError(path: string) {
  if (import.meta.env.DEV) {
    return new Error(
      `No se pudo conectar con la API local para ${path}. Verifica que \`npm run api\` este levantado en http://localhost:4100.`
    );
  }

  return new Error(`No se pudo conectar con la API para ${path}.`);
}

// Normaliza errores HTTP para que la UI pueda distinguir estado y ruta afectada.
export class ApiError extends Error {
  status: number;
  path: string;

  constructor(path: string, status: number, message?: string) {
    super(message ?? `Request failed for ${path} with status ${status}`);
    this.name = "ApiError";
    this.path = path;
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function parseResponse<T>(path: string, response: Response): Promise<T> {
  if (!response.ok) {
    let message: string | undefined;

    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message;
    } catch {
      message = undefined;
    }

    throw new ApiError(path, response.status, message);
  }

  // 204 no trae body; devolvemos undefined para evitar castings repetidos.
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiRequest<TResponse, TBody = unknown>(
  path: string,
  options: RequestOptions & { body?: TBody } = {}
): Promise<TResponse> {
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;

  // Serializamos JSON solo cuando el payload no es un tipo binario o de formulario.
  if (options.body !== undefined) {
    const requestBody = options.body;

    if (
      requestBody instanceof FormData ||
      requestBody instanceof URLSearchParams ||
      requestBody instanceof Blob ||
      typeof requestBody === "string" ||
      requestBody instanceof ArrayBuffer
    ) {
      body = requestBody as BodyInit;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(requestBody);
    }
  }

  const requestInit: RequestInit = {
    ...options,
    body,
    headers,
    credentials: "include",
  };
  const fallbackBase = getDevFallbackBase();

  let response: Response;

  try {
    response = await fetch(buildRequestUrl(API_BASE, path), requestInit);
  } catch {
    if (!fallbackBase) {
      throw buildConnectionError(path);
    }

    try {
      response = await fetch(buildRequestUrl(fallbackBase, path), requestInit);
    } catch {
      throw buildConnectionError(path);
    }
  }

  if (!response.ok && response.status >= 500 && fallbackBase) {
    // En desarrollo, si el proxy falla, reintentamos directo contra la API local.
    try {
      const fallbackResponse = await fetch(buildRequestUrl(fallbackBase, path), requestInit);
      if (fallbackResponse.ok) {
        response = fallbackResponse;
      }
    } catch {
      // Si tambien falla el fallback, devolvemos el error original del proxy.
    }
  }

  return parseResponse<TResponse>(path, response);
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" });
}

export async function apiPost<TResponse, TBody = unknown>(
  path: string,
  body?: TBody
): Promise<TResponse> {
  return apiRequest<TResponse, TBody>(path, { method: "POST", body });
}

export async function apiPut<TResponse, TBody = unknown>(
  path: string,
  body?: TBody
): Promise<TResponse> {
  return apiRequest<TResponse, TBody>(path, { method: "PUT", body });
}

export async function apiDelete<TResponse, TBody = unknown>(
  path: string,
  body?: TBody
): Promise<TResponse> {
  return apiRequest<TResponse, TBody>(path, { method: "DELETE", body });
}
