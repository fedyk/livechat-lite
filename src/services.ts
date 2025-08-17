import { Subscriber, Unsubscriber } from "./types.js"
import { AbortError, createInjector, createUnsubscribers, ErrorWithType, randomStr, TypedEventEmitter } from "./helpers.js"
import type { ChatRoute, ColorScheme } from "./types.js"

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
    listeners: ReturnType<typeof createUnsubscribers>
  }
}

/** @deprecated */
export class RTM extends TypedEventEmitter<RTMEvents> {
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
      const error = err instanceof Error ? err : new Error(String(err))

      return this.emit("error", error)
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

      asyncRequest.listeners.removeAll()
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
      const listeners = createUnsubscribers()

      // listen for abort signal
      if (abort) {
        const handleAbort = () => {
          this.rejectAsync(requestId, new AbortError("Request has aborted"))
        }

        abort.addEventListener("abort", handleAbort)

        listeners.add(() => abort.removeEventListener("abort", handleAbort))
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
    asyncRequest.listeners.removeAll()
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
 * LiveChat platform does not have terms like my or queued chat.
 * We have to gather information from few pushes and based on them determine 
 * if chat is my or queued
 */
export interface ChatTransition {
  chatId: string
  finalChatRoute: ChatRoute
  initialChatRoute: ChatRoute | void
  counter: number
  requesterId: string | void
  lastUpdatedAt: number
}

export interface ChatRouterEvents {
  routeChange(t: ChatTransition): void
}

export const $ChatRouter = createInjector<ChatRouter>()

export class ChatRouter {
  counter = 0
  timerId?: number
  transitions = new Map<string, ChatTransition>()
  subscribers = new Set<Subscriber<ChatTransition>>()

  constructor() {
    this.digest()
  }

  dispose() {
    this.transitions.clear()
    this.subscribers.clear()
    clearTimeout(this.timerId)
  }

  onChatRouteChange(subscriber: Subscriber<ChatTransition>): Unsubscriber {
    this.subscribers.add(subscriber)

    return () => this.subscribers.delete(subscriber)
  }

  setChatRoute(chatId: string, prevChatRoute: ChatRoute | void, nextChatRoute: ChatRoute, requesterId: string | void) {
    let transition = this.transitions.get(chatId)

    if (!transition) {
      this.transitions.set(chatId, transition = {
        counter: this.counter,
        chatId: chatId,
        requesterId: requesterId,
        finalChatRoute: nextChatRoute,
        initialChatRoute: prevChatRoute,
        lastUpdatedAt: Date.now()
      })
    }
    else {
      transition.finalChatRoute = nextChatRoute
      transition.requesterId = requesterId || transition.requesterId
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
      this.subscribers.forEach(function (subscriber) {
        subscriber(transition)
      })
    }
  }

  cancelTransition(chatId: string) {
    const transition = this.transitions.get(chatId)

    if (!transition) {
      return
    }

    this.transitions.delete(chatId)
  }

  reset() {
    this.transitions.forEach((transition, chatId) => this.cancelTransition(chatId))
    this.transitions.clear()
    this.counter = 0
  }
}

/**
 * Textare autoresize based on content
 */
export interface AutoResize {
  dispose(): void
  resize(): void
}

export function createAutoResize(input: HTMLTextAreaElement): AutoResize {
  input.addEventListener("input", resize, false)

  return {
    dispose,
    resize
  }

  function dispose() {
    input.removeEventListener("input", resize)
  }

  function resize() {
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
  }
}

export type Notifications = ReturnType<typeof initNotifications>

export function initNotifications() {
  let audio: HTMLAudioElement | null = null
  let interacted = false

  document.addEventListener("mousedown", onMouseDown)
  document.addEventListener("touchstart", onTouchStart)

  return {
    show,
    dispose
  }

  function dispose() {
    document.removeEventListener("mousedown", onMouseDown)
    document.removeEventListener("touchstart", onTouchStart)
  }

  async function show(title: string, options: {
    body: string
    onclick(event: Event): void
  }) {
    const audio = getAudio()

    if (audio.paused && interacted) {
      audio.play().catch(function (err) {
        console.error(err)
      })
    }

    if (Notification.permission === "denied") {
      return
    }

    if (Notification.permission === "default") {
      await Notification.requestPermission()
    }

    const notification = new Notification(title, options)

    notification.onclick = onClick
    notification.onclose = onClose

    if (audio.paused && interacted) {
      audio.play().catch(function (err) {
        console.error(err)
      })
    }

    function onClick(event: Event) {
      options.onclick(event)
      window.focus()
      notification.close()
    }

    function onClose() {
      notification.onclick = null
      notification.onclose = null
    }
  }

  function getAudio() {
    if (audio) {
      return audio
    }

    return audio = new Audio("/audio/message.mp3")
  }

  function onMouseDown() {
    interacted = true
    document.removeEventListener("mousedown", onMouseDown)
  }

  function onTouchStart() {
    interacted = true
    document.removeEventListener("touchstart", onTouchStart)
  }
}

/**
 * Reserse scroll for chat feeds
 */

export namespace ReverseScroll {
  export interface ReverseScroll {
    isStickyToBottom: boolean
    isStickyToCurrent: boolean
    dispose(): void
    stickToCurrent(): void
    scrollToBottom(): void
    scrollToCurrent(): void
  }

  const scrolls = new Map<Element, ReverseScroll>()
  const resizeObserver = new ResizeObserver(onResize)

  export function create(scrollEl: HTMLElement, contentEl: HTMLElement): ReverseScroll {
    let isStickyToBottom = true
    let isStickyToCurrent = false
    let previousScrollTop = 0
    let previousScrollHeight = 0
    let timerId = 0

    scrollEl.addEventListener("scroll", onScroll, {
      passive: true
    })

    const self: ReverseScroll = {
      get isStickyToBottom() {
        return isStickyToBottom
      },
      get isStickyToCurrent() {
        return isStickyToCurrent
      },
      dispose,
      stickToCurrent,
      scrollToBottom,
      scrollToCurrent,
    }

    scrolls.set(contentEl, self)

    resizeObserver.observe(contentEl)

    return self

    function dispose() {
      scrollEl.removeEventListener("scroll", onScroll)
      scrolls.delete(contentEl)
      resizeObserver.unobserve(contentEl)
      clearTimeout(timerId)
    }

    function onScroll() {
      clearTimeout(timerId)
      timerId = window.setTimeout(checkScrollPosition, 50)
    }

    function checkScrollPosition() {
      const scrollTop = Math.floor(scrollEl.scrollTop)

      isStickyToBottom = scrollTop >= scrollEl.scrollHeight - scrollEl.clientHeight
    }

    function scrollToBottom() {
      scrollEl.scrollTop = scrollEl.scrollHeight - scrollEl.clientHeight
    }

    function stickToCurrent() {
      isStickyToCurrent = true
      previousScrollTop = scrollEl.scrollTop
      previousScrollHeight = scrollEl.scrollHeight
    }

    function scrollToCurrent() {
      const scrollHeightDiff = previousScrollHeight - scrollEl.scrollHeight

      scrollEl.scrollTop = previousScrollTop - scrollHeightDiff
      isStickyToCurrent = false
    }
  }

  function onResize(entries: ResizeObserverEntry[]) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const reverseScroll = scrolls.get(entry.target)

      if (!reverseScroll) {
        return
      }

      if (reverseScroll.isStickyToBottom) {
        reverseScroll.scrollToBottom()
      }
      else if (reverseScroll.isStickyToCurrent) {
        reverseScroll.scrollToCurrent()
      }
    }
  }
}

export function createColorSchemaWatcher() {
  type Subscriber = (colorScheme: ColorScheme) => void

  const matchMedia = window.matchMedia('(prefers-color-scheme: dark)')
  const subscribers = new Set<Subscriber>()
  let colorScheme: ColorScheme = matchMedia.matches ? "dark" : "light"

  matchMedia.onchange = onChange

  return {
    dispose,
    current,
    subscribe
  }

  function dispose() {
    matchMedia.onchange = null
  }

  function current() {
    return colorScheme
  }

  function onChange(event: MediaQueryListEvent) {
    colorScheme = event.matches ? "dark" : "light"

    subscribers.forEach(function (subscriber) {
      subscriber(colorScheme)
    })
  }

  function subscribe(subscriber: Subscriber) {
    subscriber(colorScheme)
    subscribers.add(subscriber)

    return function () {
      subscribers.delete(subscriber)
    }
  }
}

export class ProgressSignal {
  onprogress: null | ((this: ProgressSignal, event: ProgressEvent) => void)

  constructor() {
    this.onprogress = null
  }

  progress(event: ProgressEvent) {
    console.info("progress", typeof this.onprogress, event.loaded / event.total)
    if (typeof this.onprogress === "function") {
      this.onprogress(event)
    }
  }
}

export async function createLock(lockName: string, timeout: number) {
  const value = randomStr(8)
  const started_at = Date.now()
  const expired_at = started_at + timeout
  const item = JSON.stringify({ value, expired_at })
  const key = `$lock_${lockName}`
  let acquired = false

  while (Date.now() < expired_at) {
    const result = setItemIfNotExist(key, item)

    if (result) {
      acquired = true
      break
    }
    else {
      await setTimeoutAsync(200)
    }
  }

  if (!acquired) {
    throw new RangeError(`fail to acquire the lock ${lockName}`)
  }

  return {
    release
  }

  function release() {
    const item = localStorage.getItem(key)

    if (item) {
      const data = JSON.parse(item)

      if (data && "value" in data && data.value === value) {
        localStorage.removeItem(key)
      }
    }
  }

  function setItemIfNotExist(key: string, value: string): boolean {
    const item = localStorage.getItem(key)

    if (item) {
      const data = JSON.parse(item)

      if (data && "expired_at" in data && typeof data.expired_at === "number" && data.expired_at > Date.now()) {
        return false
      }
    }

    localStorage.setItem(key, value)

    return true
  }

  function setTimeoutAsync(timeout: number) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, timeout)
    })
  }
}
