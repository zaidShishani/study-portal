export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type ApiInit = Omit<RequestInit, 'body'> & { body?: unknown }

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { body, ...rest } = init
  const headers = new Headers(rest.headers)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    // FastAPI sends a string `detail` for HTTPException; 422s carry a list.
    const message = typeof data?.detail === 'string' ? data.detail : res.statusText
    throw new ApiError(res.status, `${res.status} ${message}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
