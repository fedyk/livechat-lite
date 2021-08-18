import { createInjector, IDisposable, IListener, mergeMessages, shallowEqual } from "./helpers"
import { CannedResponse, Chat, License, Message, MyProfile, RoutingStatus, SneakPeek, Thread, User } from "./types"

export interface State {
  chatIds: string[]
  chatsByIds: {
    [chatId: string]: Chat
  }
  routingStatuses: {
    [agentId: string]: RoutingStatus
  }
  selectedChatId: string | null
  myProfile: MyProfile | null
  license: License | null
  cannedResponses: {
    [groupId: number]: CannedResponse[]
  }
}

interface setChatsAction {
  type: "SET_CHATS"
  payload: State["chatsByIds"]
}

interface setChatAction {
  type: "SET_CHAT"
  payload: Chat
}

interface updateChatAction {
  type: "UPDATE_CHAT"
  payload: {
    chatId: string
    chat: Partial<Chat>
  }
}

interface updateChatThreadAction {
  type: "UPDATE_CHAT_THREAD"
  payload: {
    chatId: string
    threadId: string
    thread: Partial<Thread>
  }
}

interface updateChatUserAction {
  type: "UPDATE_CHAT_USER"
  payload: {
    chatId: string
    userId: string
    user: Partial<User>
  }
}

interface setSneakPeekAction {
  type: "SET_SNEAK_PEEK"
  payload: {
    chatId: string
    sneakPeek: SneakPeek | null
  }
}

interface setChatIdsAction {
  type: "SET_CHAT_IDS"
  payload: string[]
}

interface setSelectedChatAction {
  type: "SET_SELECTED_CHAT"
  payload: string
}

interface setMyProfileAction {
  type: "SET_MY_PROFILE"
  payload: MyProfile
}

interface setLicenseAction {
  type: "SET_LICENCE"
  payload: License
}

interface setRoutingStatus {
  type: "SET_ROUTING_STATUS"
  payload: {
    agentId: string
    routingStatus: RoutingStatus
  }
}

interface addMessageAction {
  type: "ADD_MESSAGE"
  payload: {
    chatId: string
    threadId: string
    message: Message
  }
}

interface updateMessageAction {
  type: "UPDATE_MESSAGE"
  payload: {
    chatId: string
    threadId: string
    messageId: string
    message: Partial<Message>
  }
}

interface setCannedResponsesAction {
  type: "SET_CANNED_RESPONSES"
  payload: {
    cannedResponses: CannedResponse[]
    groupId: number
  }
}

interface addCannedResponseAction {
  type: "ADD_CANNED_RESPONSE"
  payload: {
    cannedResponse: CannedResponse
    groupId: number
  }
}

interface updateCannedResponseAction {
  type: "UPDATE_CANNED_RESPONSE"
  payload: {
    cannedResponse: CannedResponse
    groupId: number
  }
}

interface removeCannedResponseAction {
  type: "REMOVE_CANNED_RESPONSE"
  payload: {
    id: number
    groupId: number
  }
}

type Actions = setChatsAction |
  setChatAction |
  updateChatAction |
  updateChatThreadAction |
  updateChatUserAction |
  setSneakPeekAction |
  setChatIdsAction |
  setSelectedChatAction |
  setMyProfileAction |
  setLicenseAction |
  setRoutingStatus |
  addMessageAction |
  updateMessageAction |
  setCannedResponsesAction |
  addCannedResponseAction |
  updateCannedResponseAction |
  removeCannedResponseAction

export const $Store = createInjector<Store>()

export class Store implements IDisposable {
  protected state: State
  protected listeners: Array<Function>
  protected isDispatching: boolean

  constructor(initialState: State = {
    chatIds: [],
    myProfile: null,
    license: null,
    selectedChatId: null,
    chatsByIds: {},
    routingStatuses: {},
    cannedResponses: {},
  }) {
    this.state = initialState
    this.listeners = []
    this.isDispatching = false
  }

  dispose() {
    this.state = null!
    this.listeners = []
  }

  setChats(chats: State["chatsByIds"]) {
    return this.dispatch({
      type: "SET_CHATS",
      payload: chats
    })
  }

  setChat(chat: Chat) {
    return this.dispatch({
      type: "SET_CHAT",
      payload: chat
    })
  }

  updateChat(chatId: string, chat: Partial<Chat>) {
    return this.dispatch({
      type: "UPDATE_CHAT",
      payload: { chatId, chat }
    })
  }

  updateChatThread(chatId: string, threadId: string, thread: Partial<Thread>) {
    return this.dispatch({
      type: "UPDATE_CHAT_THREAD",
      payload: { chatId, threadId, thread }
    })
  }

  updateChatUser(chatId: string, userId: string, user: Partial<User>) {
    return this.dispatch({
      type: "UPDATE_CHAT_USER",
      payload: { chatId, userId, user }
    })
  }

  setSneakPeek(chatId: string, sneakPeek: SneakPeek | null) {
    return this.dispatch({
      type: "SET_SNEAK_PEEK",
      payload: { chatId, sneakPeek }
    })
  }

  setChatIds(chatIds: string[]) {
    return this.dispatch({
      type: "SET_CHAT_IDS",
      payload: chatIds
    })
  }

  setSelectedChatId(chatId: string) {
    return this.dispatch({
      type: "SET_SELECTED_CHAT",
      payload: chatId
    })
  }

  setMyProfile(myProfile: MyProfile) {
    return this.dispatch({
      type: "SET_MY_PROFILE",
      payload: myProfile
    })
  }

  setLicense(license: License) {
    return this.dispatch({
      type: "SET_LICENCE",
      payload: license
    })
  }

  setRoutingStatus(agentId: string, routingStatus: RoutingStatus) {
    return this.dispatch({
      type: "SET_ROUTING_STATUS",
      payload: { agentId, routingStatus }
    })
  }

  addMessage(chatId: string, threadId: string, message: Message) {
    this.dispatch({
      type: "ADD_MESSAGE",
      payload: {
        chatId, threadId, message
      }
    })
  }

  updateMessage(chatId: string, threadId: string, messageId: string, message: Partial<Message>) {
    this.dispatch({
      type: "UPDATE_MESSAGE",
      payload: {
        chatId, threadId, messageId, message
      }
    })
  }

  setCannedResponses(cannedResponses: CannedResponse[], groupId: number) {
    this.dispatch({
      type: "SET_CANNED_RESPONSES",
      payload: { cannedResponses, groupId }
    })
  }

  addCannedResponse(cannedResponse: CannedResponse, groupId: number) {
    this.dispatch({
      type: "ADD_CANNED_RESPONSE",
      payload: { cannedResponse, groupId }
    })
  }

  updateCannedResponse(cannedResponse: CannedResponse, groupId: number) {
    this.dispatch({
      type: "UPDATE_CANNED_RESPONSE",
      payload: { cannedResponse, groupId }
    })
  }

  removeCannedResponse(id: number, groupId: number) {
    this.dispatch({
      type: "REMOVE_CANNED_RESPONSE",
      payload: { id, groupId }
    })
  }

  getState() {
    return this.state
  }

  subscribe(listener: Function): IListener {
    if (typeof listener !== "function") {
      throw new Error("listener should be executable")
    }

    this.listeners.push(listener)

    return {
      unbind: () => this.unsubscribe(listener)
    }
  }

  unsubscribe(listener: Function) {
    const index = this.listeners.indexOf(listener)

    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * @example
   * const connect = store.connect(
   *   state => ({
   *     user: state.users[userId]
   *   }),
   *   data => this.userName = data.user.name
   * )
   * 
   * connect.unbind()
   */
  connect<T = {}>(mapStateToProps: (state: State) => T, connectListener: (data: T) => void) {
    let lastMappedData = mapStateToProps(this.state)

    connectListener(lastMappedData)

    return this.subscribe(() => {
      const nextMappedData = mapStateToProps(this.state)

      if (!shallowEqual(lastMappedData, nextMappedData)) {
        setTimeout(function () {
          connectListener(nextMappedData)
        }, 0)
      }

      lastMappedData = nextMappedData
    })
  }

  dispatch(action: Actions) {
    if (this.isDispatching) {
      throw new Error(`What? Store dispatch in dispatch. Please be more careful: ${action.type}`)
    }

    this.isDispatching = true

    try {
      const prevState = this.state
      const nextState = this.reducer(prevState, action)

      // no changes
      if (prevState === nextState) {
        return
      }

      // update state with new value
      this.state = nextState

      const listeners = this.listeners

      for (let i = 0; i < listeners.length; i++) {
        listeners[i]()
      }

    }
    catch (err) {
      throw err
    }
    finally {
      this.isDispatching = false
    }
  }

  protected reducer(state: State, action: Actions): State {
    switch (action.type) {
      case "SET_CHATS":
        return { ...state, chatsByIds: action.payload }

      case "SET_CHAT":
        return {
          ...state,
          chatsByIds: {
            ...state.chatsByIds,
            [action.payload.id]: action.payload
          }
        }

      case "UPDATE_CHAT":
        return {
          ...state,
          chatsByIds: {
            ...state.chatsByIds,
            [action.payload.chatId]: {
              ...state.chatsByIds[action.payload.chatId],
              ...action.payload.chat
            }
          }
        }

      case "UPDATE_CHAT_THREAD":
        return updateChatThread(state, action)

      case "UPDATE_CHAT_USER":
        return updateChatUser(state, action)

      case "SET_SNEAK_PEEK":
        return setSneakPeek(state, action)

      case "SET_CHAT_IDS":
        return { ...state, chatIds: action.payload }

      case "SET_SELECTED_CHAT":
        return { ...state, selectedChatId: action.payload }

      case "SET_LICENCE":
        return { ...state, license: action.payload }

      case "SET_MY_PROFILE":
        return { ...state, myProfile: action.payload }

      case "SET_ROUTING_STATUS":
        return {
          ...state, routingStatuses: {
            ...state.routingStatuses,
            [action.payload.agentId]: action.payload.routingStatus
          }
        }

      case "ADD_MESSAGE":
        return addMessageReducer(state, action);

      case "UPDATE_MESSAGE":
        return updateMessageReducer(state, action);

      case "SET_CANNED_RESPONSES":
        return {
          ...state,
          cannedResponses: {
            ...state.cannedResponses,
            [action.payload.groupId]: action.payload.cannedResponses
          }
        }

      case "ADD_CANNED_RESPONSE": {
        const cannedResponses = state.cannedResponses[action.payload.groupId]

        if (!cannedResponses) {
          return state
        }

        return {
          ...state,
          cannedResponses: {
            ...state.cannedResponses,
            [action.payload.groupId]: [action.payload.cannedResponse].concat(cannedResponses)
          }
        }
      }

      case "UPDATE_CANNED_RESPONSE": {
        const cannedResponses = state.cannedResponses[action.payload.groupId]

        if (!cannedResponses) {
          return state
        }

        return {
          ...state,
          cannedResponses: {
            ...state.cannedResponses,
            [action.payload.groupId]: cannedResponses.map(function (v) {
              if (v.id === action.payload.cannedResponse.id) {
                return {
                  ...v,
                  ...action.payload.cannedResponse
                }
              }
              else {
                return v
              }
            })
          }
        }
      }

      case "REMOVE_CANNED_RESPONSE": {
        const cannedResponses = state.cannedResponses[action.payload.groupId]

        if (!cannedResponses) {
          return state
        }

        return {
          ...state,
          cannedResponses: {
            ...state.cannedResponses,
            [action.payload.groupId]: cannedResponses.filter(v => v.id !== action.payload.id)
          }
        }
      }

      default:
        return console.warn("Action", action, "is unhandled"), state
    }
  }
}

function addMessageReducer(state: State, action: addMessageAction): State {
  const chat = state.chatsByIds[action.payload.chatId]
  const thread = chat ? chat.threads[action.payload.threadId] : void 0

  if (!thread) {
    return state
  }

  const nextThread: Thread = {
    ...thread,
    messages: mergeMessages(thread.messages, [action.payload.message])
  }

  const nextChat: Chat = {
    ...chat,
    threads: {
      ...chat.threads,
      [nextThread.id]: nextThread
    }
  }

  return {
    ...state,
    chatsByIds: {
      ...state.chatsByIds,
      [nextChat.id]: nextChat
    }
  }
}

function updateMessageReducer(state: State, action: updateMessageAction): State {
  const chatId = action.payload.chatId
  const threadId = action.payload.threadId
  const messageId = action.payload.messageId
  const chat = state.chatsByIds[chatId]
  const thread = chat ? chat.threads[threadId] : void 0

  if (!thread) {
    return state
  }

  const nextMessages = thread.messages.map(message => {
    if (message.id === messageId) {
      return {
        ...message,
        ...action.payload.message
      } as Message
    }
    else {
      return message
    }
  })

  const nextThread: Thread = {
    ...thread,
    messages: nextMessages,
  }

  const nextChat: Chat = {
    ...chat,
    threads: {
      ...chat.threads,
      [nextThread.id]: nextThread
    }
  }

  return {
    ...state,
    chatsByIds: {
      ...state.chatsByIds,
      [nextChat.id]: nextChat
    }
  }
}

function updateChatThread(state: State, action: updateChatThreadAction): State {
  const chat = state.chatsByIds[action.payload.chatId]
  const thread = chat ? chat.threads[action.payload.threadId] : void 0

  if (!thread) {
    return state
  }

  const nextThread: Thread = { ...thread, ...action.payload.thread }
  const nextChat: Chat = {
    ...chat,
    threads: {
      ...chat.threads,
      [nextThread.id]: nextThread
    }
  }

  return {
    ...state,
    chatsByIds: {
      ...state.chatsByIds,
      [action.payload.chatId]: nextChat
    }
  }
}

function updateChatUser(state: State, action: updateChatUserAction): State {
  const chat = state.chatsByIds[action.payload.chatId]
  const users = chat?.users

  if (!users || !users[action.payload.userId]) {
    return state
  }

  const nextUsers: Chat["users"] = Object.assign({}, users, {
    [action.payload.userId]: {
      ...users[action.payload.userId],
      ...action.payload.user
    }
  })

  const nextChat: Chat = {
    ...chat,
    users: nextUsers
  }

  return {
    ...state,
    chatsByIds: {
      ...state.chatsByIds,
      [action.payload.chatId]: nextChat
    }
  }
}

function setSneakPeek(state: State, action: setSneakPeekAction): State {
  const chat = state.chatsByIds[action.payload.chatId]

  if (!chat) {
    return state
  }

  const nextChat: Chat = {
    ...chat,
    sneakPeek: action.payload.sneakPeek,
  }

  return {
    ...state,
    chatsByIds: {
      ...state.chatsByIds,
      [action.payload.chatId]: nextChat
    }
  }
}
