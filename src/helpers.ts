import type { ColorMode, Unsubscriber } from "./types.js";
import { v35 } from "./livechat-api.js";
import { PersistentState, State } from "./store.js";
import { ChatEntity, ChatRoute, SearchResult, SneakPeekAsEvent } from "./types.js"

export function createUnsubscribers(...unsubscribers: Unsubscriber[]) {
  return { add, removeAll }

  function add(...listener: Unsubscriber[]) {
    unsubscribers.push(...listener)
  }

  function removeAll() {
    unsubscribers.forEach(function (unsubscribe) {
      unsubscribe()
    })

    unsubscribers = []
  }
}

/**
 * Typed Event Emitter
 * @deprecated the API is too dificult, there should be easier way to add typed emmiter
 */
export type TypedArguments<T> = [T] extends [(...args: infer U) => any]
  ? U
  : [T] extends [void] ? [] : [T]

export class TypedEventEmitter<T> {
  listeners: Map<any, Function[]>

  constructor() {
    this.listeners = new Map()
  }

  addListener<K extends keyof T>(event: K, listener: (...args: TypedArguments<T[K]>) => void): Unsubscriber {
    let listeners = this.listeners.get(event)

    if (typeof listener !== "function") {
      throw new Error("listener is not executable")
    }

    if (!listeners) {
      this.listeners.set(event, [listener])
    }
    else {
      listeners.push(listener)
    }

    return () => this.removeListener(event, listener)
  }

  removeListener<K extends keyof T>(event: K, listener: (...args: TypedArguments<T[K]>) => void) {
    let listeners = this.listeners.get(event)

    if (listeners) {
      const index = listeners.indexOf(listener)

      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  emit<K extends keyof T>(event: K, ...args: TypedArguments<T[K]>) {
    const listeners = this.listeners.get(event)

    if (!listeners) {
      return
    }

    for (let i = 0; i < listeners.length; i++) {
      listeners[i](...args)
    }
  }
}

/** Abort Error */
export class AbortError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AbortError"
  }
}

/** Error with type */
export class ErrorWithType extends Error {
  type: string
  status?: number
  cause?: unknown

  constructor(message: string, type: string, status?: number, cause?: unknown) {
    super(message);
    this.type = type
    this.status = status
    this.cause = cause
  }
}


/**
 * Simple injector for services. Can be useful to tests
 * @example
 * const AuthService { ... }
 * const $AuthService = createInjector<AuthService>()
 * $AuthService.setInstance(new AuthService)
 * 
 * const MyClass {
 *   constructor(private auth = $AuthService())
 * }
 */
export function createInjector<T>() {
  let instance: T | null = null

  function injector(): T {
    if (instance == null) {
      throw new Error("Instance hasn't been set. Please call $InjectorName.setInstance(serviceInstance)")
    }

    return instance;
  }

  injector.setInstance = function setInstance(_: T) {
    instance = _
  }

  return injector
}

interface LRUCacheEvents<T> {
  removed(item: T): void
}

export class LRUCache<T> extends TypedEventEmitter<LRUCacheEvents<T>> {
  max: number
  cache: Map<string, T>

  constructor(max: number) {
    super()
    this.max = max;
    this.cache = new Map();
  }

  dispose() {
    for (let [key, item] of this.cache) {
      this.emit("removed", item)
      this.cache.delete(key)
    }
  }

  get(key: string) {
    let item = this.cache.get(key);

    // move top
    if (item) {
      this.cache.delete(key);
      this.cache.set(key, item);
    }

    return item;
  }

  set(key: string, val: T) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // kill the oldest

    else if (this.cache.size == this.max) {
      const key = this.first()

      if (key) {
        const item = this.cache.get(key)

        if (item) {
          this.emit("removed", item)
        }

        this.cache.delete(key);
      }
    }

    this.cache.set(key, val);
  }

  first() {
    return this.cache.keys().next().value;
  }

  /** 
   * this method does not change order of values
   */
  forEach(callback: (value: T, key: string) => void) {
    this.cache.forEach(callback)
  }
}

/** @source https://github.com/facebook/react/blob/master/packages/shared/shallowEqual.js */
export function shallowEqual(objA: any, objB: any): boolean {
  if (objA === objB) {
    return true;
  }

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  for (let i = 0; i < keysA.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(objB, keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
      return false;
    }
  }

  return true;
}

export function indexBy<T>(items: T[], prop: keyof T) {
  const result: { [key: string]: T } = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = item[prop]

    if (key != null) {
      // @ts-ignore
      result[key] = item;
    }
  }

  return result;
}

export function mapBy<T>(items: T[], prop: keyof T) {
  const result = new Map<string, T>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = String(item[prop] || "")

    if (key) {
      result.set(key, item)
    }
  }

  return result;
}

export function setBy<T, K = keyof T>(items: T[], prop: K) {
  const result = new Set<K>()

  for (let i = 0; i < items.length; i++) {
    // @ts-ignore
    result.add(items[i][prop])
  }

  return result;
}

export function getChatRoute(chat: v35.agent.Chat, myProfileId: string): ChatRoute {
  const activeThread = getActiveThread(chat)

  if (!activeThread) {
    return chat.properties.routing.pinned ? "pinned" : "closed"
  }

  const currentAgent = chat.users.find(u => u.id === myProfileId)

  if (currentAgent && currentAgent.type === "agent" && currentAgent.present) {
    if (currentAgent.visibility === "all") {
      return "my"
    }

    if (currentAgent.visibility === "agents") {
      return "supervised"
    }

    throw new RangeError(`unknown agent visibility: ${JSON.stringify(
      currentAgent
    )}`)
  }

  const presentAgent = getPresentAgent(chat.users)

  if (!presentAgent) {
    if (chat.properties.routing.continuous && !activeThread.queue) {
      return "unassigned"
    }
    else {
      return "queued"
    }
  }

  return "other"
}

export function getActiveThread(chat: v35.agent.Chat) {
  let thread: v35.agent.Thread

  for (let i = chat.threads.length - 1; i >= 0; i--) {
    thread = chat.threads[i]

    if (thread && thread.active) {
      return thread
    }
  }
}

export function findThreadByThreadId(chat: v35.agent.Chat, threadId: string) {
  let thread: v35.agent.Thread

  for (let i = chat.threads.length - 1; i >= 0; i--) {
    thread = chat.threads[i]

    if (thread.id === threadId) {
      return thread
    }
  }
}

export function getRecentThread(chat: v35.agent.Chat) {
  let thread: v35.agent.Thread

  for (let i = chat.threads.length - 1; i >= 0; i--) {
    thread = chat.threads[i]

    if (thread) {
      return thread
    }
  }
}

export function getPresentAgent(users: v35.agent.User[]) {
  let user: v35.agent.User

  for (user of users) {
    if (user.type === "agent" && user.present) {
      return user
    }
  }
}

export function createChatUserFinder(size: number) {
  const cache = new LRUCache<number>(size)

  return {
    dispose,
    findUser
  }

  function dispose(): void {
    cache.dispose()
  }

  function findUser(chat: v35.agent.Chat, userId: string) {
    const cacheKey = createCacheKey(chat.id, userId)
    let index = cache.get(cacheKey)
    let user: v35.agent.User | undefined

    if (index != null) {
      user = chat.users[index]
    }

    if (user && user.id === userId) {
      return user
    }

    for (index = 0; index < chat.users.length; index++) {
      user = chat.users[index]

      if (user.id === userId) {
        return cache.set(cacheKey, index), user
      }
    }
  }

  function createCacheKey(chatId: string, userId: string) {
    return `${chatId}_${userId}`
  }
}

export function getChatLastMessage(chat: v35.agent.Chat): v35.agent.Event | void {
  let i: number
  let j: number

  for (i = chat.threads.length - 1; i >= 0; i--) {
    for (j = chat.threads[i].events.length - 1; j >= 0; j--) {
      return chat.threads[i].events[j]
    }
  }
}

export function getIncompleteThreadIds(chat: v35.agent.Chat) {
  const threadIds: string[] = []

  chat.threads.forEach(function (thread) {
    if (thread.incomplete) {
      threadIds.push(thread.id)
    }
  })

  return threadIds;
}

export function getChatRecipient(users: v35.agent.User[]) {
  let user: v35.agent.User

  // first customer
  for (user of users) {
    if (user.type === "customer") {
      return user
    }
  }

  // first any user
  for (user of users) {
    return user
  }
}

export function hasUnreadMessages(chat: v35.agent.Chat, myProfileId: string): boolean {
  const chatRoute = getChatRoute(chat, myProfileId)

  if (chatRoute === "queued") {
    return true
  }

  if (chatRoute === "unassigned") {
    return true
  }

  if (chatRoute === "pinned") {
    return true
  }

  if (chat.threads.length === 0) {
    return false
  }

  const thread = chat.threads[chat.threads.length - 1]
  const user = chat.users.find(u => u.id === myProfileId)

  if (!user) {
    return false
  }

  const eventsSeenUpTo = user.events_seen_up_to.getTime()
  let event: v35.agent.Event

  for (let i = thread.events.length - 1; i >= 0; i--) {
    event = thread.events[i]

    if (event.type === "system_message") {
      continue
    }

    if (event.type === "annotation") {
      continue
    }

    if (event.type === "custom") {
      continue
    }

    if (event.author_id === myProfileId) {
      continue
    }

    return event.created_at.getTime() > eventsSeenUpTo
  }

  return false
}

export function countUnseenMessages(chat: v35.agent.Chat, myProfileId: string): number {
  const chatRoute = getChatRoute(chat, myProfileId)

  if (chatRoute === "queued") {
    return 1
  }

  if (chatRoute === "unassigned") {
    return 1
  }

  if (chatRoute === "pinned") {
    return 1
  }

  const user = chat.users.find(u => u.id === myProfileId)

  if (!user) {
    return 0
  }

  if (chat.threads.length === 0) {
    return 0
  }

  const thread = chat.threads[chat.threads.length - 1]
  const eventsSeenUpTo = user.events_seen_up_to.getTime()
  let count = 0
  let event: v35.agent.Event
  let i: number

  for (i = thread.events.length - 1; i >= 0; i--) {
    event = thread.events[i]

    if (event.type === "system_message") {
      continue
    }

    if (event.type === "annotation") {
      continue
    }

    if (event.type === "custom") {
      continue
    }

    if (event.author_id === myProfileId) {
      continue
    }

    if (event.created_at.getTime() > eventsSeenUpTo) {
      count++
    }
    else {
      break
    }
  }

  return count
}

export function getChatEntities(chat: v35.agent.Chat, sneakPeek?: v35.agent.SneakPeek): ChatEntity[] {
  const threads = Array.from(chat.threads.values())
  const messages: ChatEntity[] = []
  let thread: v35.agent.Thread
  let previousThread: v35.agent.Thread
  let nextThread: v35.agent.Thread
  let i: number

  for (i = 0; i < threads.length; i++) {
    thread = threads[i]
    previousThread = threads[i - 1]
    nextThread = threads[i + 1]

    if (thread.previous_thread_id && (!previousThread || previousThread.id !== thread.previous_thread_id)) {
      messages.push({
        id: thread.previous_thread_id,
        type: "chat_gap",
        sort_order: "desc",
        limit: 5,
        filters_to: thread.created_at,
        filters_from: undefined,
      })
    }

    if (thread.next_thread_id && (!nextThread || nextThread.id !== thread.next_thread_id)) {
      messages.push({
        id: thread.next_thread_id,
        type: "chat_gap",
        sort_order: "asc",
        limit: 5,
        filters_to: undefined,
        filters_from: thread.created_at,
      })
    }

    // thread with restricted access
    if (thread.restricted_access) {
      messages.push({
        id: thread.id,
        type: "restricted_thread",
        text: `🔓 ${thread.restricted_access}`,
      })
      continue
    }

    for (let j = 0; j < thread.events.length; j++) {
      const event = thread.events[j]

      if (event.type === "form") {
        continue
      }

      if (event) {
        messages.push(event)
      }
    }

    // if (!thread.active && thread.tags.length > 0) {
    //   messages.push({
    //     id: `${thread.id}_tags`,
    //     custom_id: "",
    //     type: "system_message",
    //     text: "Chat has been tagged. TODO: show the tags",
    //     created_at: thread.created_at,
    //     system_message_type: "",
    //     visibility: "agents",
    //     text_vars: {},

    //   })
    // }
  }

  if (sneakPeek && sneakPeek.text.length > 0) {
    messages.push(sneakPeekToMessage(sneakPeek))
  }

  return messages;
}

export function sneakPeekToMessage(sneakPeek: v35.agent.SneakPeek): SneakPeekAsEvent {
  return {
    id: "sneak_peek",
    type: "sneak_peek",
    author_id: sneakPeek.author_id,
    text: sneakPeek.text,
    created_at: new Date(sneakPeek.timestamp),
    recipients: sneakPeek.recipients,
  }
}

export function cx(...args: (string | { [key: string]: boolean })[]) {
  let className = ""

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (typeof arg === "string") {
      className += arg + " ";
    }

    if (typeof arg === "object") {
      Object.keys(arg).forEach(function (key) {
        if (arg[key]) {
          className += key + " ";
        }
      })
    }
  }

  return className.trim()
}

export function getInitials(name: string, defaultInitials = "?") {
  return String(name)
    .replace(/[^a-z\s]/gi, "")
    .trim()
    .split(" ")
    .filter(function (a) {
      return a.trim().length > 0
    })
    .map(function (str) {
      return str.charAt(0).toUpperCase()
    })
    .join("")
    .substring(0, 2) || defaultInitials
}

export function extractAutocompleteQuery(text: string, currPos: number) {
  let query = ""
  let key = ""

  for (let i = currPos - 1; i >= 0; i--) {
    const char = text[i]

    // skip ufo cases
    if (typeof char !== "string") {
      break
    }

    if (isWhitespaceCharacter(char)) {
      break
    }

    if (char === "#") {
      const prevChar = text[i - 1]

      // here we can have a "text#text" (hash in the middle of word)
      if (typeof prevChar === "string" && !isWhitespaceCharacter(prevChar)) {
        break
      }

      key = char
      break
    }

    query = char + query
  }

  if (key.length > 0) {
    for (let i = currPos, count = text.length; i < count; i++) {
      const char = text[i]

      if (typeof char !== "string") {
        break
      }

      if (isWhitespaceCharacter(char)) {
        break
      }

      query += char
    }
  }

  return {
    key,
    query
  }

  function isWhitespaceCharacter(char: string) {
    return /\s/.test(char)
  }
}

export function unique<T>(...args: T[][]): T[] {
  const result: T[] = []
  const seen = new Set<T>();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    for (let j = 0; j < arg.length; j++) {
      const value = arg[j];

      if (seen.has(value)) {
        continue
      }

      seen.add(value);
      result.push(value);
    }
  }

  // free memory
  seen.clear()

  return result;
}

export function formatTime(time: number | Date) {
  const now = new Date()
  let date: Date

  if (time instanceof Date) {
    date = time
  }
  else {
    date = new Date(time)
  }

  // the same day
  if (date.toDateString() === now.toDateString()) {
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")

    return `${hours}:${minutes}`
  }

  return new Intl.DateTimeFormat().format(date)
}

export function formatSize(bytes: number, si: boolean = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  let units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

  if (si) {
    units = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  }

  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

  return bytes.toFixed(dp) + units[u];
}

export function stringifyChatEntity(message: ChatEntity) {
  if (message.type === "sneak_peek") {
    return `${message.text}...`
  }

  if (message.type === "message" || message.type === "system_message") {
    return message.text
  }

  if (message.type === "filled_form") {
    return "📝 Survey"
  }

  if (message.type === "rich_message") {
    return "🖼 Rich message"
  }

  if (message.type === "file") {
    return "File"
  }

  return "..."
}

export function stringifyGeolocation(geolocation: v35.agent.Geolocation) {
  const parts: string[] = []

  if (geolocation.city) {
    parts.push(geolocation.city)
  }

  if (geolocation.region) {
    parts.push(geolocation.region)
  }

  if (geolocation.country) {
    parts.push(geolocation.country);
  }

  return parts.join(', ');
}

export function stringifyFilledFormAnswer(answer: v35.agent.FilledFormAnswer | v35.agent.FilledFormAnswer[]): string {
  if (typeof answer === "string" && answer) {
    return answer
  }

  if (Array.isArray(answer) && answer.length > 0) {
    return answer.map(function (field) {
      if (typeof field === "string" && field) {
        return field
      }

      if (typeof field === "object" && field.label) {
        return field.label
      }

      return "(no answer)"
    }).join(", ")
  }

  if (typeof answer === "object" && !Array.isArray(answer) && answer.label) {
    return answer.label
  }

  return "(no answer)"
}

export function stringifyFormType(formType: v35.agent.FormType): string {
  if (formType === "prechat") {
    return "Pre-chat form"
  }

  if (formType === "postchat") {
    return "Post-chat form"
  }

  if (formType === "ask_for_email") {
    return "Email form"
  }

  return JSON.stringify(formType)
}

export function formatUserAgent(userAgent: any) {
  const parts: string[] = []

  if (userAgent.browser_name || userAgent.browser_version) {
    parts.push(`${userAgent.browser_name || ""} ${userAgent.browser_version || ""}`.trim())
  }

  if (userAgent.os_name || userAgent.os_version) {
    parts.push(`${userAgent.os_name || ""} ${userAgent.os_version || ""}`.trim())
  }

  return parts.join(", ")
}

export function isScrollReachedBottom(event: Event, threshold: number | void): boolean {
  const currentTarget = event.currentTarget

  if (!(currentTarget instanceof HTMLElement)) {
    return false
  }

  const scrollTop = currentTarget.scrollTop
  const clientHeight = currentTarget.clientHeight
  const scrollHeight = currentTarget.scrollHeight

  if (threshold === undefined) {
    threshold = clientHeight / 2
  }

  return scrollHeight - clientHeight - threshold < scrollTop
}


export function toISOString(date: Date) {
  return date.toISOString().replace("Z", "000Z")
}

export function throttle(callback: () => void, timeout: number) {
  let paused = false
  let timer: number

  function throttled() {
    if (paused) {
      return
    }

    paused = true

    timer = window.setTimeout(function () {
      try {
        callback()
      }
      finally {
        paused = false
      }
    }, timeout)
  }


  throttled.cancel = function () {
    clearTimeout(timer)
    paused = false
  }

  return throttled
}

export function randomStr(length: number) {
  let id = ""

  while (id.length < length) {
    id += Math.random().toString(36).substring(4)
  }

  return id
}

export function updateUser(chat: v35.agent.Chat, userId: string, cb: (user: v35.agent.User) => v35.agent.User): v35.agent.Chat {
  const users = chat.users.concat()

  for (let i = users.length - 1; i >= 0; i--) {
    if (users[i].id === userId) {
      users[i] = cb(users[i])
      break
    }
  }

  return {
    ...chat,
    users,
  }
}

export function updateThread(chat: v35.agent.Chat, threadId: string, cb: (thread: v35.agent.Thread) => v35.agent.Thread): v35.agent.Chat {
  const threads = chat.threads.concat()

  for (let i = threads.length - 1; i >= 0; i--) {
    if (threads[i].id === threadId) {
      threads[i] = cb(threads[i])
      break
    }
  }

  return {
    ...chat,
    threads,
  }
}

export function updateEventById(chat: v35.agent.Chat, threadId: string, eventId: string, cb: (thread?: v35.agent.Event) => v35.agent.Event) {
  return updateThread(chat, threadId, function (thread) {
    const events = thread.events

    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].id === eventId) {
        events[i] = cb(events[i])
        break
      }
    }

    return {
      ...thread,
      events
    }
  })
}

export function updateEventByCustomId(chat: v35.agent.Chat, threadId: string, customId: string, cb: (thread?: v35.agent.Event) => v35.agent.Event) {
  return updateThread(chat, threadId, function (thread) {
    const events = thread.events.concat()

    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].custom_id === customId) {
        events[i] = cb(events[i])
        break
      }
    }

    return {
      ...thread,
      events
    }
  })
}

export function deleteEventByCustomId(chat: v35.agent.Chat, threadId: string, customId: string) {
  return updateThread(chat, threadId, function (thread) {
    return {
      ...thread,
      events: thread.events.filter(function (event) {
        return !event.custom_id || event.custom_id !== customId
      })
    }
  })
}

export function mergeChats(currentChats: Map<string, v35.agent.Chat>, incomingChats: Map<string, v35.agent.Chat>) {
  const mergedChats = new Map<string, v35.agent.Chat>()
  let currentChat: v35.agent.Chat | undefined
  let incomingChat: v35.agent.Chat | undefined
  let chatId: string

  // update existing
  for ([chatId, currentChat] of currentChats) {
    incomingChat = incomingChats.get(chatId)

    if (incomingChat) {
      mergedChats.set(chatId, mergeChat(currentChat, incomingChat))
    }
    else {
      mergedChats.set(chatId, currentChat)
    }
  }

  // add new chats
  for ([chatId, incomingChat] of incomingChats) {
    currentChat = currentChats.get(chatId)

    if (currentChat) {
      mergedChats.set(chatId, mergeChat(currentChat, incomingChat))
    }
    else {
      mergedChats.set(chatId, incomingChat)
    }
  }

  return mergedChats
}

export function mergeChat(currentChat: v35.agent.Chat, incomingChat: v35.agent.Chat): v35.agent.Chat {
  if (currentChat.id !== incomingChat.id) {
    throw new RangeError("chat ids mismatch")
  }

  return {
    id: incomingChat.id,
    users: mergeUsers(currentChat.users, incomingChat.users),
    threads: mergeThreads(currentChat.threads, incomingChat.threads),
    access: incomingChat.access,
    is_followed: incomingChat.is_followed,
    properties: incomingChat.properties
  }
}

export function mergeUsers(currentUsers: v35.agent.User[], incomingUsers: v35.agent.User[]): v35.agent.User[] {
  const currentUsersById = mapBy(currentUsers, "id")
  const mergedUsers = new Array<v35.agent.User>()
  let currentUser: v35.agent.User | undefined
  let incomingUser: v35.agent.User

  for (incomingUser of incomingUsers) {
    currentUser = currentUsersById.get(incomingUser.id)

    if (currentUser) {
      mergedUsers.push(mergeUser(currentUser, incomingUser))
    }
    else {
      mergedUsers.push(incomingUser)
    }
  }

  return mergedUsers
}

export function mergeUser(currentUser: v35.agent.User, incomingUser: v35.agent.User): v35.agent.User {
  let events_seen_up_to = currentUser.events_seen_up_to

  if (incomingUser.events_seen_up_to.getTime() > events_seen_up_to.getTime()) {
    events_seen_up_to = incomingUser.events_seen_up_to
  }

  return {
    ...incomingUser,
    events_seen_up_to
  }
}

export function mergeThreads(currentThreads: v35.agent.Thread[], incomingThreads: v35.agent.Thread[]): v35.agent.Thread[] {
  const mergedThreads: v35.agent.Thread[] = []
  const currentThreadsByIds = new Map<string, v35.agent.Thread>()
  const incomingThreadsByIds = new Map<string, v35.agent.Thread>()
  let currentThread: v35.agent.Thread | undefined
  let incomingThread: v35.agent.Thread | undefined

  for (currentThread of currentThreads) {
    currentThreadsByIds.set(currentThread.id, currentThread)
  }

  for (incomingThread of incomingThreads) {
    incomingThreadsByIds.set(incomingThread?.id, incomingThread)
  }

  for (currentThread of currentThreads) {
    incomingThread = incomingThreadsByIds.get(currentThread.id)

    if (incomingThread) {
      mergedThreads.push(mergeThread(currentThread, incomingThread))
    }
    else {
      mergedThreads.push(currentThread)
    }
  }

  // add new threads
  for (incomingThread of incomingThreads) {
    currentThread = currentThreadsByIds.get(incomingThread.id)

    if (!currentThread) {
      mergedThreads.push(incomingThread)
    }
  }

  mergedThreads.sort(function (a, b) {
    return a.created_at.getTime() - b.created_at.getTime()
  })

  // only last thread can be active
  for (let i = mergedThreads.length - 2; i >= 0; i--) {
    currentThread = mergedThreads[i]

    if (currentThread.active) {
      mergedThreads[i] = {
        ...currentThread,
        active: false,
        incomplete: true,
      }
    }
  }

  return mergedThreads
}

export function mergeThread(currentThread: v35.agent.Thread, incomingThread: v35.agent.Thread): v35.agent.Thread {
  if (currentThread.id !== incomingThread.id) {
    throw new RangeError("threads ids mismatch")
  }

  return {
    id: incomingThread.id,
    active: incomingThread.active,
    incomplete: incomingThread.incomplete,
    events: mergeEvents(currentThread.events, incomingThread.events),
    access: incomingThread.access,
    highlight: incomingThread.highlight,
    properties: incomingThread.properties,
    restricted_access: incomingThread.restricted_access,
    queue: incomingThread.queue,
    tags: incomingThread.tags,
    created_at: incomingThread.created_at,
    next_thread_id: incomingThread.next_thread_id,
    previous_thread_id: incomingThread.previous_thread_id,
  }
}

export function mergeEvents(currentEvents: v35.agent.Event[], incomingEvents: v35.agent.Event[]) {
  const mergedEvents: v35.agent.Event[] = []
  const currentEventsById = mapBy(currentEvents, "id")
  const incomingEventsById = mapBy(incomingEvents, "id")

  // update
  for (let [eventId, currentEvent] of currentEventsById) {
    let incomingEvent = incomingEventsById.get(eventId)

    if (incomingEvent) {
      mergedEvents.push(mergeEvent(currentEvent, incomingEvent))
    }
    else {
      mergedEvents.push(currentEvent)
    }
  }

  // enter
  for (let [eventId, incomingEvent] of incomingEventsById) {
    let currentEvent = currentEventsById.get(eventId)

    if (!currentEvent) {
      mergedEvents.push(incomingEvent)
    }
  }

  mergedEvents.sort(function (a, b) {
    return a.created_at.getTime() - b.created_at.getTime()
  })

  return mergedEvents
}

function mergeEvent(currentEvent: v35.agent.Event, incomingEvent: v35.agent.Event): v35.agent.Event {
  return {
    ...currentEvent,
    ...incomingEvent
  }
}

export function mergeChatProperties(
  target: v35.agent.ChatProperties,
  incoming: v35.agent.PartialChatProperties
): v35.agent.ChatProperties {
  target = { ...target }

  if (incoming.routing) {
    target.routing = {
      ...target.routing,
      ...incoming.routing,
    }
  }

  if (incoming.source) {
    target.source = {
      ...target.source,
      ...incoming.source,
    }
  }

  return target
}

export function getTimezone() {
  if (window.Intl != null && window.Intl.DateTimeFormat != null) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  }

  return "UTC"
}

export function getSearchResults(chats: v35.agent.Chat[], highlightTag: string): SearchResult[] {
  const results: SearchResult[] = []

  for (const chat of chats) {
    const recipient = getChatRecipient(chat.users)
    const usersById = mapBy(chat.users, "id")

    for (const thread of chat.threads) {
      const eventsGroupedByMessage = new Map<string, v35.agent.MessageEvent[]>
      let lastEvent: v35.agent.Event | null = null
      let lastMessageEvent: v35.agent.MessageEvent | null = null

      for (const event of thread.events) {
        if (event.type === "message") {
          const groupedEvents = eventsGroupedByMessage.get(event.text)

          if (groupedEvents) {
            groupedEvents.push(event)
          }
          else {
            eventsGroupedByMessage.set(event.text, [event])
          }

          lastMessageEvent = event
        }

        lastEvent = event
      }

      if (thread.highlight.length === 0) {
        let body = new DocumentFragment()

        if (lastMessageEvent) {
          body.append(stringifyChatEntity(lastMessageEvent))
        }
        else if (lastEvent) {
          body.append(stringifyChatEntity(lastEvent))
        }
        else {
          body.append("...")
        }

        results.push({
          id: `${chat.id}_${thread.id}`,
          chatId: chat.id,
          threadId: thread.id,
          eventId: null,
          date: thread.created_at,
          body: body,
          userId: recipient?.id ?? "",
          userName: recipient?.name ?? "Unnamed customer",
          userAvatar: recipient?.avatar || null,
        })
      }

      for (const [i, h] of thread.highlight.entries()) {
        let plainMessage = h.highlight.replace(new RegExp(`<${highlightTag}\>`, "g"), "")
          .replace(new RegExp(`</${highlightTag}\>`, "g"), "")
        let userId = ""
        let userName = "Unnamed customer"
        let userAvatar = null
        let eventId: string | null = null

        if (recipient) {
          userId = recipient.id
          userName = recipient.name
          userAvatar = recipient.avatar
        }

        const events = eventsGroupedByMessage.get(plainMessage)

        if (events) {
          const originEvent = events.shift()

          if (originEvent) {
            const author = usersById.get(originEvent.author_id)

            eventId = originEvent.id

            if (author) {
              userId = author.id
              userName = author.name
              userAvatar = author.avatar
            }
          }
        }

        // parse highlight
        const body = new DocumentFragment()
        const startTag = `<${highlightTag}>`
        const endTag = `</${highlightTag}>`
        let highlight = h.highlight;
        let startPosition = highlight.indexOf(startTag);
        let endPosition = highlight.indexOf(endTag);

        // cut off some words at the begin
        if (startPosition > 50) {
          const words = highlight.split(" ")
          let counter = 0

          while (counter < 50) {
            const word = words.shift()

            if (!word) {
              break
            }

            counter += word.length
          }

          highlight = "..." + words.join(" ")
          startPosition = highlight.indexOf(startTag)
          endPosition = highlight.indexOf(endTag)
        }

        while (startPosition !== -1 && endPosition !== -1 && endPosition > startPosition) {
          const em = document.createElement("mark")

          // append text before start tag
          body.append(highlight.substring(0, startPosition))

          em.innerText = highlight.substring(startPosition + startTag.length, endPosition)

          body.append(em)

          // cut off the text before and in highlight tags
          highlight = highlight.substring(endPosition + endTag.length)

          startPosition = highlight.indexOf(startTag)
          endPosition = highlight.indexOf(endTag)
        }

        if (highlight.length > 0) {
          body.append(highlight)
        }

        results.push({
          id: `${chat.id}_${thread.id}_${i}`,
          chatId: chat.id,
          threadId: thread.id,
          eventId: eventId,
          date: thread.created_at,
          body: body,
          userId: userId,
          userName: userName,
          userAvatar: userAvatar,
        })
      }
    }
  }

  return results
}

export function getStateFromLocalStore(): PersistentState {
  const item = localStorage.getItem("state")
  const state: PersistentState = {
    myProfile: null,
    credentials: null,
    searchRecentQueries: [],
    colorMode: "auto",
    showDetailsSection: true,
  }

  if (!item) {
    return state
  }

  const data = JSON.parse(item)

  if ("searchRecentQueries" in data && Array.isArray(data.searchRecentQueries)) {
    state.searchRecentQueries = data.searchRecentQueries
  }

  if ("colorMode" in data && data.colorMode) {
    state.colorMode = data.colorMode
  }

  if ("myProfile" in data && data.myProfile) {
    state.myProfile = {
      id: String(data.myProfile.id),
      name: String(data.myProfile.name),
      email: String(data.myProfile.email),
      avatar: String(data.myProfile.avatar),
      permission: String(data.myProfile.permission),
      routing_status: String(data.myProfile.routing_status) as v35.agent.RoutingStatus,
    }
  }

  if ("credentials" in data && data.credentials) {
    state.credentials = {
      access_token: String(data.credentials.access_token),
      refresh_token: String(data.credentials.refresh_token),
      entity_id: String(data.credentials.entity_id),
      account_id: String(data.credentials.account_id),
      license_id: Number(data.credentials.license_id),
      organization_id: String(data.credentials.organization_id),
      expired_at: new Date(data.credentials.expired_at),
      scopes: new Set(data.credentials.scopes),
    }
  }

  if ("showDetailsSection" in data) {
    state.showDetailsSection = Boolean(data.showDetailsSection)
  }

  return state
}

export function setStateToLocalStore(state: PersistentState) {
  const result: Record<keyof PersistentState, any> = {
    myProfile: state.myProfile,
    credentials: null,
    searchRecentQueries: state.searchRecentQueries || [],
    colorMode: state.colorMode,
    showDetailsSection: state.showDetailsSection,
  }

  if (state.credentials) {
    result.credentials = {
      access_token: state.credentials.access_token,
      refresh_token: state.credentials.refresh_token,
      entity_id: state.credentials.entity_id,
      account_id: state.credentials.account_id,
      license_id: state.credentials.license_id,
      organization_id: state.credentials.organization_id,
      expired_at: state.credentials.expired_at.getTime(),
      scopes: Array.from(state.credentials.scopes),
    }
  }

  localStorage.setItem("state", JSON.stringify(result))
}

export function go<T>(promise: Promise<T>) {
  return Promise.resolve(promise)
    .then(function (res) {
      return [null, res] as const
    })
    .catch(function (err) {
      return [err, null] as const
    })
}

export function sortGroups(groups: v35.conf.Group[]) {
  return groups.concat().sort(function (a, b) {
    return a.id === 0 ? -1 : b.id === 0 ? 1 : (getRoutingStatusRang(b.routing_status) - getRoutingStatusRang(a.routing_status)) || a.name.localeCompare(b.name)
  })
}

export function sortAgents(agents: v35.conf.Agent[], routingStatuses: Map<string, v35.agent.RoutingStatus>) {
  return agents.concat().sort(function (a, b) {
    const aStatus = routingStatuses.get(a.id)
    const bStatus = routingStatuses.get(b.id)

    return (getRoutingStatusRang(bStatus) - getRoutingStatusRang(aStatus)) || a.name.localeCompare(b.name)
  })
}

export function getRoutingStatusRang(status: v35.agent.RoutingStatus | undefined) {
  switch (status) {
    case "accepting_chats":
      return 3;
    case "not_accepting_chats":
      return 2;
    case "offline":
      return 1;
    default:
      return 0;
  }
}

export function getColorModeName(colorMode: ColorMode) {
  switch (colorMode) {
    case "light": return "Light"
    case "dark": return "Dark"
    case "auto": return "Auto"
    default: return colorMode
  }
}

export function linkify(text: string) {
  if (typeof text !== "string") {
    return ""
  }

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/(?:(?:https?:\/\/)|(?:www\.))[\p{L}\p{N}.-]+\.[\p{L}]{2,}(?:[^\s<]*)/giu, function(raw) {    
    let url = raw;
    let trailing = "";

    while (/[),.!?:;]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }

    const href = url.startsWith("www.") ? `https://${url}` : url;
    const allowed = /^(https?:)\/\//i.test(href);

    if (!allowed) {
      return raw;
    }

    try {
      new URL(href);
    } catch {
      return raw + trailing;
    }

    const safeAttrs = 'target="_blank" rel="noopener noreferrer nofollow ugc"';
    const display = url

    return `<a href="${href}" ${safeAttrs}>${display}</a>${trailing}`;
  })
}
