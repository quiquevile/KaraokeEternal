export default class HttpApi {
  prefix: string
  options: RequestInit

  // set once at startup (store.ts): drop the local session when the server
  // rejects our token. Auth endpoints are excluded (their 401s are answers,
  // e.g. wrong password, not dead sessions).
  static onUnauthorized: (() => void) | null = null

  constructor (prefix = '') {
    this.prefix = prefix
    this.options = {
      credentials: 'same-origin',
    }
  }

  put = <T = Record<string, unknown>>(url: string, options = {}) => this.request<T>('PUT', url, options)
  post = <T = Record<string, unknown>>(url: string, options = {}) => this.request<T>('POST', url, options)
  get = <T = Record<string, unknown>>(url: string, options = {}) => this.request<T>('GET', url, options)
  delete = <T = Record<string, unknown>>(url: string, options = {}) => this.request<T>('DELETE', url, options)

  request = async <T = Record<string, unknown> | Response>(
    method: string,
    url: string,
    options = {},
  ): Promise<T> => {
    const opts = {
      ...this.options,
      ...options,
      method,
    }

    // assume we're sending JSON if not multipart form data
    if (typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.headers = new Headers({
        'Content-Type': 'application/json',
      })

      opts.body = JSON.stringify(opts.body)
    }

    const res = await fetch(`${document.baseURI}api/${this.prefix}${url}`, opts)

    // account endpoints answer 401s of their own (wrong password, ...),
    // so only sessions talking to the rest of the API reset here
    if (res.status === 401
      && !/^(login|logout|setup|user)/.test(url)
      && HttpApi.onUnauthorized
    ) {
      HttpApi.onUnauthorized()
    }

    if (res.ok) {
      const type = res.headers.get('Content-Type')
      return (type && type.includes('application/json'))
        ? res.json()
        : res as unknown as T
    }

    const txt = await res.text()
    throw new Error(txt)
  }
}
