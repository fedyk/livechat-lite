import { createInjector, getActiveThread, mapBy, mergeChat, mergeChats, mergeThreads, shallowEqual, updateThread } from "./helpers.js"
import type * as t from "./types.js"
import type { rest } from "./rest-api.js"
import type { v35 } from "./livechat-api.js"
import { ProgressSignal } from "./services.js"
import { Unsubscriber } from "./types.js"

export type Store = ReturnType<typeof createStore>

export const $Store = createInjector<Store>();

export interface State {
  credentials: t.Credentials | null
  chats: Map<string, v35.agent.Chat>
  myChatIds: string[]
  supervisedChatIds: string[]
  queuedChatIds: string[]
  unassignedChatIds: string[]
  otherChatIds: string[]
  archivedChatIds: string[]
  pinnedChatIds: string[]
  inactiveChatIds: string[]

  archivedChatsStatus: t.ArchivedChatsStatus
  archivedChatsSyncError: string
  archivedChatsNextPageId: string

  pinnedChatsStatus: t.PinnedChatsStatus
  pinnedChatsSyncError: string
  pinnedChatsNextPageId: string

  inactiveChatsStatus: t.InactiveChatsStatus
  inactiveChatsSyncError: string
  inactiveChatsNextPageId: string

  routingStatuses: Map<string, v35.agent.RoutingStatus>
  isUpdatingRoutingStatus: boolean

  selectedChatId: string | null
  myProfile: v35.agent.MyProfile | null
  license: v35.agent.License | null
  cannedResponses: Record<number, rest.CannedResponse[]>

  selectedChatFolder: t.ChatFolder

  chatGapStatuses: Map<string, t.ChatGapStatus>
  threadSyncStatuses: Map<string, t.ThreadSyncStatus>
  messageStatuses: Map<string, t.MessageStatus>
  filesUpload: Map<string, [ProgressSignal, AbortController]>
  sneakPeeks: Map<string, v35.agent.SneakPeek>

  networkStatus: t.NetworkStatus

  agents: v35.conf.Agent[]
  groups: v35.conf.Group[]

  searchMode: null | "focus" | "searching" | "results" | "error"
  searchQuery: string
  searchResults: t.SearchResult[]
  searchSelectedResult: string | null,
  searchNextPageId: string | null
  searchFoundChats: number | null
  searchErrorMessage: string
  searchRecentQueries: string[]

  parsedUserAgents: Record<string, t.ParsedUserAgent>

  colorMode: t.ColorMode
  openModal: t.Modal | null

  showDetailsSection: boolean
}

export type PersistentState = Pick<State, "myProfile" | "credentials" | "searchRecentQueries" | "colorMode" | "showDetailsSection">

export type ChatListsIds = Pick<State,
  | "myChatIds"
  | "supervisedChatIds"
  | "queuedChatIds"
  | "unassignedChatIds"
  | "otherChatIds"
  | "archivedChatIds"
  | "pinnedChatIds"
  | "inactiveChatIds"
>

export interface StoreSubscriber<T> {
  (state: T): void
}

export interface StoreConnectMapper<Props> {
  (state: State): Props
}

export function createStore(initialState: Pick<State, "credentials" | "searchRecentQueries">) {
  const subscribers = new Set<StoreSubscriber<State>>()
  const lazySubscribers = new Set<StoreSubscriber<State>>()
  let digestTimeout = 0
  let isDispatching = false
  let state: State = {
    chats: new Map(),
    license: null,
    myProfile: null,
    myChatIds: [],
    selectedChatId: null,
    selectedChatFolder: "my",
    supervisedChatIds: [],
    queuedChatIds: [],
    unassignedChatIds: [],
    otherChatIds: [],
    archivedChatIds: [],
    pinnedChatIds: [],
    inactiveChatIds: [],
    archivedChatsStatus: "unknown",
    archivedChatsSyncError: "",
    archivedChatsNextPageId: "",
    pinnedChatsStatus: "unknown",
    pinnedChatsSyncError: "",
    pinnedChatsNextPageId: "",
    inactiveChatsStatus: "unknown",
    inactiveChatsSyncError: "",
    inactiveChatsNextPageId: "",
    routingStatuses: new Map(),
    isUpdatingRoutingStatus: false,
    cannedResponses: {},
    chatGapStatuses: new Map(),
    threadSyncStatuses: new Map(),
    messageStatuses: new Map(),
    filesUpload: new Map(),
    sneakPeeks: new Map(),
    networkStatus: "offline",
    agents: [],
    groups: [],
    searchMode: null,
    searchQuery: "",
    searchResults: [],
    searchSelectedResult: null,
    searchNextPageId: null,
    searchFoundChats: null,
    searchErrorMessage: "",
    parsedUserAgents: {},
    colorMode: "auto",
    openModal: null,
    showDetailsSection: true,
    ...initialState
  }

  digest()

  return {
    dispose,
    getState,
    subscribe,
    connect,
    lazyConnect,
    dispatch,

    setInitialState,
    setIncomingChat,
    setChatThreads,
    deactivateChat,
    setChatTransferred,
  }

  function dispose() {
    subscribers.clear()
    window.clearTimeout(digestTimeout)
    state = null!
  }

  function getState(): Readonly<State> {
    return state
  }

  function subscribe(subscriber: StoreSubscriber<State>): Unsubscriber {
    if (typeof subscriber !== "function") {
      throw new RangeError("`subscriber` needs to be a function")
    }

    subscriber(state)
    subscribers.add(subscriber)

    return function () {
      subscribers.delete(subscriber)
    }
  }

  function connect<T>(map: StoreConnectMapper<T>, subscriber: StoreSubscriber<T>): Unsubscriber {
    let lastMap: T

    return subscribe(function (state) {
      const nextMap = map(state)

      if (!shallowEqual(lastMap, nextMap)) {
        subscriber(nextMap)
      }

      lastMap = nextMap
    })
  }

  function lazyConnect<P>(map: StoreConnectMapper<P>, subscriber: StoreSubscriber<P>): Unsubscriber {
    let lastMap: P

    lazySunscriber(state)
    lazySubscribers.add(lazySunscriber)

    return function () {
      return lazySubscribers.delete(lazySunscriber)
    }

    function lazySunscriber(state: State) {
      const nextMap = map(state)

      if (!shallowEqual(lastMap, nextMap)) {
        subscriber(nextMap)
      }

      lastMap = nextMap
    }
  }

  type NextState = Partial<State> | void

  function dispatch(nextState: NextState | null | ((state: State) => NextState | null)) {
    if (isDispatching) {
      throw new Error(`What? Store dispatch in dispatch. Please be more careful: ${JSON.stringify(nextState)}`)
    }

    if (typeof nextState === "function") {
      nextState = nextState(state)
    }

    if (nextState == null) {
      return
    }

    isDispatching = true

    try {
      state = Object.assign({}, state, nextState)
      subscribers.forEach(function (listener) {
        listener(state)
      })
    }
    catch (err) {
      throw err
    }
    finally {
      isDispatching = false
    }
  }

  function digest() {
    let prevState: State | null = null;

    if (prevState !== state) {
      for (const subscriber of lazySubscribers) {
        subscriber(state)
      }
    }

    prevState = state

    digestTimeout = window.setTimeout(digest, 16)
  }

  function setInitialState(chats: v35.agent.Chat[], license: v35.agent.License, myProfile: v35.agent.MyProfile) {
    const currentChats = new Map(state.chats)
    const routingStatuses = new Map(state.routingStatuses)
    const incomingChats = mapBy(chats, "id")
    const mergedChats = new Map<string, v35.agent.Chat>()
    const enterChatIds = new Set<string>()
    const updateChatIds = new Set<string>()
    const exitChatIds = new Set<string>()

    let currentChat: v35.agent.Chat | undefined
    let incomingChat: v35.agent.Chat | undefined
    let chatId: string

    // update + exit lookups
    for (currentChat of currentChats.values()) {
      if (incomingChats.has(currentChat.id)) {
        updateChatIds.add(currentChat.id)
      }
      else {
        exitChatIds.add(currentChat.id)
      }
    }

    // enter lookup
    for (incomingChat of incomingChats.values()) {
      if (!currentChats.has(incomingChat.id)) {
        enterChatIds.add(incomingChat.id)
      }
    }

    // enter apply
    for (chatId of enterChatIds) {
      incomingChat = incomingChats.get(chatId)

      if (incomingChat) {
        mergedChats.set(chatId, incomingChat)
      }
    }

    // update apply
    for (chatId of updateChatIds) {
      const currentChat = currentChats.get(chatId)
      const incomingChat = incomingChats.get(chatId)

      if (currentChat && incomingChat) {
        mergedChats.set(chatId, mergeChat(currentChat, incomingChat))
      }
    }

    // exit apply (deactivation)
    for (chatId of exitChatIds) {
      let exitChat = currentChats.get(chatId)

      if (!exitChat) {
        continue
      }

      const activeThread = getActiveThread(exitChat)

      if (activeThread) {
        mergedChats.set(chatId, updateThread(exitChat, activeThread.id, function (thread) {
          return {
            ...thread,
            active: false,
            incomplete: true,
          }
        }))
      }
      else {
        mergedChats.set(chatId, exitChat)
      }
    }

    // update routings
    routingStatuses.set(myProfile.id, myProfile.routing_status)

    dispatch({
      chats: mergedChats,
      license: license,
      myProfile: myProfile,
    })
  }

  function setIncomingChat(chat: v35.agent.Chat) {
    const myProfileId = state.myProfile?.id

    if (!myProfileId) {
      throw new RangeError("`myProfileId` can't be empty")
    }

    dispatch({
      chats: mergeChats(state.chats, mapBy([chat], "id"))
    })
  }

  function setChatThreads(chatId: string, threads: v35.agent.Thread[]) {
    const chats = new Map(state.chats)
    const chat = chats.get(chatId)

    if (!chat) return

    chats.set(chatId, {
      ...chat,
      threads: mergeThreads(chat.threads, threads)
    })

    dispatch({ chats })
  }

  function deactivateChat(chatId: string, threadId: string) {
    const chat = state.chats.get(chatId)

    if (!chat) {
      return
    }

    const chats = new Map(state.chats)

    chats.set(chatId, updateThread(chat, threadId, function (thread) {
      return {
        ...thread,
        active: false
      }
    }))

    dispatch({ chats })
  }

  function setChatTransferred(options: {
    chatId: string
    threadId: string
    groupIds: number[]
    agentsIds: string[]
    queue: v35.agent.Queue | null
  }) {
    const chats = new Map(state.chats)
    let chat = chats.get(options.chatId)

    if (!chat) {
      return
    }

    chat = updateThread(chat, options.threadId, function (thread) {
      thread = { ...thread }

      if (options.groupIds.length > 0) {
        thread.access.group_ids = options.groupIds
      }

      thread.queue = options.queue

      return thread
    })

    if (options.agentsIds.length > 0) {
      const users = mapBy(chat.users, "id")
      let agentId: string
      let user: v35.agent.User

      for (agentId of options.agentsIds) {
        user = users.get(agentId) || {
          id: agentId,
          type: "agent",
          name: "Agent",
          avatar: "",
          email: agentId,
          present: false,
          events_seen_up_to: new Date(0),
        }

        users.set(agentId, { ...user, present: true })
      }

      chat = { ...chat, users: Array.from(users.values()) }
    }

    dispatch({ chats: chats.set(options.chatId, chat) })
  }
}
