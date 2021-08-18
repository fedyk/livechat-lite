import { AbortError, ErrorWithType, IDisposable, IListener, Listeners, TypedEventEmitter } from "./helpers"
import { ChatRoute, Credentials, MyProfile } from "./types"
import * as dom from "./dom"
import { parseScopes } from "./parsers"

export class Auth {
  credentials?: Credentials

  constructor(credentials?: Credentials) {
    this.credentials = credentials
  }

  setCredentials(credentials: Credentials) {
    this.credentials = credentials
  }

  getAccessToken() {
    if (!this.credentials || !this.credentials.accessToken) {
      throw new Error("Credential are missed. Please refresh page or report a problem")
    }

    return this.credentials.accessToken
  }

  getRegion() {
    return this.credentials?.accessToken?.split(":")[0] ?? "dal"
  }
}

interface RTMEvents {
  open(): void
  close(manual: boolean): void
  error(err: Error): void
  push(data: any): void
}

interface RTMAsyncRequests {
  [requestId: string]: {
    resolve(value: any): void
    reject(err: Error): void
    listeners: Listeners
  }
}

export class RTM extends TypedEventEmitter<RTMEvents> implements IDisposable {
  static PING_PONG_INTERVAL = 15 * 1000
  static PONG_WAITING_INTERVAL = 5 * 1000
  static MANUAL_CLOSE = 4000
  static REQUEST_COUNTER = 1

  ws: WebSocket
  pingTimerId?: number
  pongTimerId?: number
  asyncRequests: RTMAsyncRequests

  constructor(url: string) {
    super()
    this.ws = new WebSocket(url)
    this.asyncRequests = {}
    this.ws.addEventListener("open", this.handleOpen)
    this.ws.addEventListener("close", this.handleClose)
    this.ws.addEventListener("error", this.handleError)
    this.ws.addEventListener("message", this.handleMessage)
  }

  dispose() {
    this.ws.removeEventListener("open", this.handleOpen)
    this.ws.removeEventListener("close", this.handleClose)
    this.ws.removeEventListener("error", this.handleError)
    this.ws.removeEventListener("message", this.handleMessage)
  }

  close() {
    this.ws.close(RTM.MANUAL_CLOSE)
  }

  handleOpen = () => {
    this.emit("open")
    this.pong()
  }

  handleClose = (event: CloseEvent) => {
    this.emit("close", event.code === RTM.MANUAL_CLOSE)

    // reject all pending requests
    Object.keys(this.asyncRequests).forEach(requestId => {
      this.rejectAsync(requestId, new Error("Request timeout"))
    })
  }

  handleError = () => {
    this.emit("error", new Error("websocket connection error"))
  }

  handleMessage = (event: MessageEvent) => {
    let data: any

    try {
      data = JSON.parse(event.data)
    }
    catch (err) {
      return this.emit("error", err)
    }

    // just handle pong
    if (data && data.action === "ping") {
      return this.pong()
    }

    if (data && data.type === "response") {
      const requestId = data.request_id

      if (!requestId) {
        return this.emit("error", new Error(`RTM does not support responses with missed request_id: ${event.data}`))
      }

      const asyncRequest = this.asyncRequests[requestId]

      if (!asyncRequest) {
        return this.emit("error", new Error(`Handler for incoming rtm response is missed: ${event.data}`))
      }

      if (Boolean(data.success)) {
        asyncRequest.resolve(data.payload || {})
      }
      else {
        const message = data?.payload?.error?.message || "Failed to parse response"
        const type = data.payload.error.type ?? "response_parse_error"

        asyncRequest.reject(new ErrorWithType(message, type))
      }

      asyncRequest.listeners.unbindAll()
      delete this.asyncRequests[requestId]
    }

    if (data?.type === "push") {
      this.emit("push", data || {})
    }
  }

  perform(action: string, payload?: any) {
    const requestId = `request_${++RTM.REQUEST_COUNTER}`

    return this.ws.send(JSON.stringify({ request_id: requestId, action: action, payload: payload })), requestId
  }

  performAsync<T = any>(action: string, payload?: any, abort?: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {

      // request was already aborted
      if (abort?.aborted === true) {
        return reject(new AbortError("Request has aborted"))
      }

      // send the request to server
      const requestId = this.perform(action, payload)
      const listeners = new Listeners()

      // listen for abort signal
      if (abort) {
        const handleAbort = () => {
          this.rejectAsync(requestId, new AbortError("Request has aborted"))
        }

        abort.addEventListener("abort", handleAbort)

        listeners.register({
          unbind: () => abort.removeEventListener("abort", handleAbort)
        })
      }

      this.asyncRequests[requestId] = {
        resolve: resolve,
        reject: reject,
        listeners: listeners,
      }
    })
  }

  rejectAsync(requestId: string, err?: Error) {
    const asyncRequest = this.asyncRequests[requestId]

    if (!asyncRequest) {
      return
    }

    asyncRequest.reject(err ?? new Error("Request was rejected"))
    asyncRequest.listeners.unbindAll()
    delete this.asyncRequests[requestId]
  }

  ping() {
    this.perform("ping")

    clearTimeout(this.pingTimerId)
    clearTimeout(this.pongTimerId)

    // schedule next reconnect
    this.pongTimerId = window.setTimeout(() => this.ws.close, RTM.PONG_WAITING_INTERVAL)
  }

  pong() {
    clearTimeout(this.pingTimerId)
    clearTimeout(this.pongTimerId)
    this.pingTimerId = window.setTimeout(() => this.ping(), RTM.PING_PONG_INTERVAL);
  }
}

/**
 * Simple client to perform Web API calls to agent-api
 */
export class WebAPI {
  auth: Auth;

  constructor(auth: Auth) {
    this.auth = auth
  }

  performAsync<T = {}>(action: string, payload: object | null, options?: Partial<RequestInit>): Promise<T> {
    const url = `https://api.livechatinc.com/v3.3/agent/action/${action}`;
    const accessToken = this.auth.getAccessToken()
    const region = this.auth.getRegion()
    const init = {
      ...options,
      body: JSON.stringify(payload),
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Region": region
      },
    }

    return fetch(url, init).then((response) => this.parseResponse<T>(response))
  }

  protected parseResponse<T>(response: Response) {
    if (response.ok === false) {
      return response.json().then(function (json) {
        const error = json?.error?.message ?? `Server responded with ${response.status} code`
        const errorType = json?.error?.type

        throw new ErrorWithType(error, errorType)
      })
    }
    else {
      return response.json() as Promise<T>
    }
  }
}

export class ConfigurationAPI {
  auth: Auth;

  constructor(auth: Auth) {
    this.auth = auth
  }

  performAsync<T = {}>(action: string, payload: object | null, options?: Partial<RequestInit>): Promise<T> {
    const url = `https://api.livechatinc.com/v3.3/configuration/action/${encodeURIComponent(action)}`
    const accessToken = this.auth.getAccessToken()
    const region = this.auth.getRegion()
    const init = {
      ...options,
      body: JSON.stringify(payload),
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Region": region
      },
    }

    return fetch(url, init).then((response) => this.parseResponse<T>(response))
  }

  protected parseResponse<T>(response: Response) {
    if (response.ok === false) {
      return response.json().then(function (json) {
        const error = json?.error?.message ?? `Server responded with ${response.status} code`
        const errorType = json?.error?.type

        throw new ErrorWithType(error, errorType)
      })
    }
    else {
      return response.json() as Promise<T>
    }
  }
}

export class RestAPI {
  constructor(protected auth: Auth) { }

  performAsync<T = {}>(path: string, method: string, body: any = null, options?: Partial<RequestInit>) {
    return Promise.resolve(`https://us-central1-canned-response-usage.cloudfunctions.net/proxy/${path}`)
      .then((url) => {
        const region = this.auth.getRegion()
        const accessToken = this.auth.getAccessToken()
        const headers = {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-API-Version": "2",
          "X-Region": region
        }

        const init: RequestInit = {
          headers,
          method,
          body: body ? JSON.stringify(body) : null,
          ...options
        }

        return fetch(url, init)
      })
      .then(response => this.parseResponse<T>(response))
  }

  protected parseResponse<T>(response: Response) {
    if (response.ok === false) {
      return response.json().then(function (json) {
        const errorType = json?.error?.type
        let message = `Server responded with ${response.status} code`

        if (Array.isArray(json?.errors)) {
          message = json?.errors.join(", ")
        }

        throw new ErrorWithType(message, errorType)
      })
    }
    else {
      return response.json() as Promise<T>
    }
  }
}


/**
 * LiveChat platform does not have terms like my or queued chat.
 * We have to gather information from few pushes and based on them determine 
 * if chat is my or queued
 */
export interface ChatRouterTransition {
  chatId: string
  finalChatRoute: ChatRoute
  initialChatRoute: ChatRoute | void
  counter: number
  requesterId: string | void
  lastUpdatedAt: number
  history: any[] /** for debug */
}

export interface ChatRouterEvents {
  transitionStart(t: ChatRouterTransition): void
  transitionEnd(t: ChatRouterTransition): void
  routeChange(t: ChatRouterTransition): void
}

export class ChatRouter extends TypedEventEmitter<ChatRouterEvents> implements IDisposable {
  counter = 0
  timerId?: number
  transitions = new Map<string, ChatRouterTransition>()

  constructor() {
    super()
    this.digest()
  }

  dispose() {
    this.transitions.clear()
    clearTimeout(this.timerId)
  }

  setChatRoute(chatId: string, prevChatRoute: ChatRoute | void, nextChatRoute: ChatRoute, requesterId: string | void) {
    let transition = this.transitions.get(chatId)

    if (!transition) {
      this.transitions.set(chatId, transition = {
        counter: this.counter,
        chatId: chatId,
        history: [
          [prevChatRoute, nextChatRoute]
        ],
        requesterId: requesterId,
        finalChatRoute: nextChatRoute,
        initialChatRoute: prevChatRoute,
        lastUpdatedAt: Date.now()
      })

      this.emit("transitionStart", transition)
    }
    else {
      transition.finalChatRoute = nextChatRoute
      transition.requesterId = requesterId || transition.requesterId
      transition.history.push([prevChatRoute, nextChatRoute])
      transition.lastUpdatedAt = Date.now()
    }
  }

  digest() {
    this.check()
    this.timerId = window.setTimeout(() => this.digest(), 200)
  }

  tick() {
    this.counter++
    this.check()
  }

  check() {
    const now = Date.now()

    this.transitions.forEach((transition, chatId) => {
      if (this.counter - transition.counter > 10) {
        return this.finiteTransition(chatId)
      }

      if (now - transition.lastUpdatedAt >= 1000) {
        return this.finiteTransition(chatId)
      }
    })
  }

  finiteTransition(chatId: string) {
    const transition = this.transitions.get(chatId)

    if (!transition) {
      return
    }

    this.transitions.delete(chatId)

    if (transition.initialChatRoute !== transition.finalChatRoute) {
      this.emit("routeChange", transition)
    }

    this.emit("transitionEnd", transition)
  }

  cancelTransition(chatId: string) {
    const transition = this.transitions.get(chatId)

    if (!transition) {
      return
    }

    this.transitions.delete(chatId)
    this.emit("transitionEnd", transition)
  }

  reset() {
    this.transitions.forEach((transition, chatId) => this.cancelTransition(chatId))
    this.transitions.clear()
    this.counter = 0
  }
}

export namespace Storage {
  export function getItem(key: string) {
    const value = localStorage.getItem(key)

    if (value) {
      try {
        return JSON.parse(value)
      }
      catch (err) {
        return console.error(err)
      }
    }
  }

  export function setItem(key: string, value: any) {
    return localStorage.setItem(key, JSON.stringify(value))
  }

  export function getCredentials(): Credentials | void {
    const json = getItem("credentials")

    if (!json) {
      return
    }

    const accessToken = String(json.accessToken ?? "")
    const expiredAt = Number(json.expiredAt ?? "")
    const scopes = parseScopes(json.scopes)

    // invalid credentials
    if (Number.isNaN(expiredAt)) {
      return
    }

    // credentials are expired, do not use them
    if (expiredAt <= Date.now()) {
      return
    }

    return {
      accessToken,
      expiredAt,
      scopes,
    }
  }

  export function setCredentials(credentials: Credentials) {
    return setItem("credentials", credentials)
  }

  export function getMyProfile(): MyProfile | void {
    const data = getItem("my_profile")

    if (!data) {
      return
    }

    const id = String(data.id ?? "")
    const name = String(data.name ?? "")
    const email = String(data.email ?? "")
    const avatar = String(data.avatar ?? "")

    return {
      id, name, email, avatar
    }
  }

  export function setMyProfile(myProfile: MyProfile) {
    return setItem("my_profile", myProfile)
  }
}

export class TextAreaAutoResize implements IDisposable {
  listener: IListener;

  constructor(protected input: HTMLTextAreaElement) {
    this.listener = dom.addListener(input, "input", () => this.resize())
  }

  dispose() {
    this.listener.unbind()
  }

  resize() {
    this.input.style.height = "auto";
    this.input.style.height = this.input.scrollHeight + "px";
  }
}
