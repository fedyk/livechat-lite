import {
  createInjector,
  ErrorWithType,
  getActiveThread,
  getIncompleteThreadIds
} from "./helpers.js"
import {
  ChatRouter,
  ChatTransition,
  createLock,
  Notifications,
  ProgressSignal
} from "./services.js"
import { Store } from "./store.js"
import type * as types from "./types.js"
import * as helpers from "./helpers.js"
import { accounts, v35 } from "./livechat-api.js"
import { createRef } from "./dom.js"
import { mergeChats } from "./helpers.js"
import { api } from "./api.js"

export const $Controller = createInjector<Controller>()

export type Controller = ReturnType<typeof createController>

export type ControllerOptions = {
  store: Store
  chatRouter: ChatRouter
  notifications: Notifications
  clientId: string
  redirectUrl: string
}

export function createController(options: ControllerOptions) {
  const { store, chatRouter, notifications } = options
  const chatRouteListener = chatRouter.onChatRouteChange(onChatRouteChange)
  const chatUserFinder = helpers.createChatUserFinder(50)
  const chatSearchInputRef = createRef<HTMLInputElement>()
  const visibleChatViewRef = createRef<{
    highlightEvent(eventId: string): void
  }>()
  let searchAbortController: AbortController | null = null
  let autoReconnect = true
  let reconnectAttempts = 0
  let reconnectTimerId: number
  let rtm: v35.agent.RTM

  document.addEventListener("paste", onPaste)

  return {
    chatSearchInputRef,
    visibleChatViewRef,
    assignChatToMe,
    cancelSearch,
    connect,
    deactivateChat,
    deleteRecentSearchQuery,
    dispose,
    getCurrentChatRoute,
    logout,
    maybeLoadMoreArchivedChats,
    maybeLoadMoreInactiveChats,
    maybeLoadMorePinnedChats,
    maybeMarkEventsAsSeen,
    maybeParseUserAgent,
    maybeSyncArchivedChats,
    maybeSyncChatGap,
    maybeSyncInactiveChats,
    maybeSyncPinnedChats,
    pickChatFromQueue,
    search,
    selectChat,
    selectedChatFolder,
    selectSearchResult,
    sendFileMessage,
    sendTextMessage,
    setRoutingStatus,
    startChat,
    startSuperviseChat,
    syncAgents,
    syncGroups,
    maybeSyncGroups,
    takeOverChat,
    toggleDetailsSection,
    toggleRoutingStatus,
    transferChat,
    unpinChat,
    updateAndFocusChatSearchInput,
  }

  function dispose() {
    document.removeEventListener("paste", onPaste)
    rtm?.close()
    chatUserFinder.dispose()
    chatRouteListener()
  }

  function logout() {
    // auth.removeCredentials()
    location.replace(accounts.getAccountsUrl({
      path: "signout",
      response_type: "code",
      client_id: options.clientId,
      redirect_uri: options.redirectUrl,
    }))
  }

  function connect() {
    if (rtm) {
      rtm.onPush = null!
      rtm.onClose = null!
      rtm.close()
    }

    clearTimeout(reconnectTimerId)

    reconnectAttempts++

    return openConnection()
      .then(function (result) {
        rtm = result
      })
      .catch(function (err) {
        if (err instanceof ErrorWithType && err.type === "authentication") {
          return window.location.replace(accounts.getAccountsUrl({
            response_type: "code",
            client_id: options.clientId,
            redirect_uri: options.redirectUrl,
          }))
        }

        console.error(err)

        return scheduleReconnect()
      })
  }

  async function openConnection() {
    let state = store.getState()
    const accessToken = await getAccessToken()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const organization_id = state.credentials?.organization_id ?? ""

    store.dispatch({ networkStatus: "connecting" })

    const rtm = await v35.agent.createRTM(organization_id)
    const initState = await rtm.login({
      token: `Bearer ${accessToken}`,
      timezone,
      customer_monitoring_level: "my",
      reconnect: true,
      application: {
        name: "LiveChat X",
        version: "0.0.1"
      },
    })

    state = store.getState()

    const chatIds = helpers.unique(
      Object.keys(state.chats),
      initState.chats_summary.map(c => c.id)
    )

    const transitions = startChatTransitions(chatIds)

    store.dispatch({
      networkStatus: "updating"
    })

    store.setInitialState(
      initState.chats_summary,
      initState.license,
      initState.my_profile
    )

    transitions.commit()

    const [syncPinnedChatsErr] = await helpers.go(maybeSyncPinnedChats())

    if (syncPinnedChatsErr) {
      console.error(syncPinnedChatsErr)
    }

    const [syncRoutingStatusesErr] = await helpers.go(syncRoutingStatuses())

    if (syncRoutingStatusesErr) {
      console.error(syncRoutingStatusesErr)
    }

    store.dispatch({ networkStatus: "online" })

    rtm.onPush = onPush
    rtm.onClose = onClose
    reconnectAttempts = 0

    return rtm

    function onClose() {
      chatRouter.reset()
      store.dispatch({ networkStatus: "offline" })

      rtm.onClose = null!
      rtm.onPush = null!

      if (autoReconnect) {
        scheduleReconnect()
      }
    }
  }

  function scheduleReconnect() {
    const minTimeout = 200
    const maxTimeout = 5000
    const timeout = Math.min(Math.pow(2, reconnectAttempts) * 100, maxTimeout);
    const wait = Math.random() * (timeout - minTimeout) + timeout

    reconnectTimerId = window.setTimeout(connect, wait)
  }

  function onPush(push: v35.agent.Pushes) {
    chatRouter.tick()

    switch (push.action) {
      // Chats
      case "incoming_chat":
        return onIncomingChat(push)
      case "chat_deactivated":
        return onChatDeactivated(push)

      // Chat access
      // case "chat_access_granted":
      //   return handleChatAccessGranted(push)
      // case "chat_access_revoked":
      //   return handleChatAccessRevoked(push)
      case "chat_transferred":
        return onChatTransferred(push)

      // Chat users
      case "user_added_to_chat":
        return onUserAddedToChat(push)
      case "user_removed_from_chat":
        return onUserRemovedFromChat(push)

      // Events
      case "incoming_event":
        return onIncomingEvent(push)
      // case "event_updated":
      //   return handleEventUpdated(push)
      // case "incoming_rich_message_postback":
      //   return handleIncoming_rich_message_postback(push)

      // Properties
      case "chat_properties_updated":
        return onChatPropertiesUpdated(push)
      // case "chat_properties_deleted":
      //   return handle_chat_properties_deleted(push)
      // case "thread_properties_updated":
      //   return handle_thread_properties_updated(push)
      // case "thread_properties_deleted":
      //   return handle_thread_properties_deleted(push)
      // case "event_properties_updated":
      //   return handle_event_properties_updated(push)
      // case "event_properties_deleted":
      //   return handle_event_properties_deleted(push)

      // Thread tags
      // case "thread_tagged":
      //   return handle_thread_tagged(push)
      // case "thread_untagged":
      //   return handle_thread_untagged(push)

      // Customers
      // case "customer_visit_started":
      //   return handle_customer_visit_started(push)
      // case "customer_created":
      //   return handle_customer_created(push)
      // case "customer_updated":
      //   return handle_customer_updated(push)
      // case "customer_page_updated":
      //   return handle_customer_page_updated(push)
      // case "customer_banned":
      //   return handle_customer_banned(push)
      // case "customer_visit_ended":
      //   return handle_customer_visit_ended(push)

      // Status
      case "routing_status_set":
        return onRoutingStatusSet(push)
      // case "agent_disconnected":
      //   return handle_agent_disconnected()

      // Other
      case "events_marked_as_seen":
        return onEventsMarkedAsSeen(push)
      case "incoming_sneak_peek":
        return handleIncomingSneakPeek(push)
      // case "incoming_typing_indicator":
      //   return handle_incoming_typing_indicator(push)
      case "incoming_multicast":
        return handleIncomingMulticast(push)
      // case "chat_unfollowed":
      //   return handle_chat_unfollowed(push)
      case "queue_positions_updated":
        return handleQueuePositionsUpdated(push)

    }

    console.log("unhandled push", push);
  }

  function onIncomingChat(push: v35.agent.IncomingChat) {
    const t = startChatTransition(push.payload.chat.id)

    store.setIncomingChat(push.payload.chat)

    t.commit(push.payload.requester_id)
  }

  function onChatTransferred(push: v35.agent.ChatTransferred) {
    const t = startChatTransition(push.payload.chat_id)

    store.setChatTransferred({
      chatId: push.payload.chat_id,
      threadId: push.payload.thread_id,
      groupIds: push.payload.transferred_to.group_ids,
      agentsIds: push.payload.transferred_to.agent_ids,
      queue: push.payload.queue
    })

    t.commit(push.payload.requester_id)
  }

  function onUserAddedToChat(push: v35.agent.UserAddedToChat) {
    const transition = startChatTransition(push.payload.chat_id)

    store.dispatch(function (state) {
      const chats = new Map(state.chats)
      const chat = chats.get(push.payload.chat_id)

      if (!chat) {
        return
      }

      const users = helpers.mapBy(chat.users, "id")

      users.set(push.payload.user.id, push.payload.user)
      chats.set(push.payload.chat_id, {
        ...chat,
        users: Array.from(users.values())
      })

      return { chats }
    })

    transition.commit(push.payload.requester_id)
  }

  function onUserRemovedFromChat(push: v35.agent.UserRemovedFromChat) {
    const transition = startChatTransition(push.payload.chat_id)

    store.dispatch(function (state) {
      const chats = new Map(state.chats)
      const chat = chats.get(push.payload.chat_id)

      if (!chat) {
        return
      }
      const users = helpers.mapBy(chat.users, "id")
      const user = users.get(push.payload.user_id)

      if (!user) {
        return
      }

      users.set(user.id, {
        ...user,
        present: false
      })

      chats.set(push.payload.chat_id, {
        ...chat,
        users: Array.from(users.values())
      })

      return { chats }
    })

    transition.commit(push.payload.requester_id)
  }

  function onChatDeactivated(push: v35.agent.ChatDeactivated) {
    const chatTransition = startChatTransition(push.payload.chat_id)

    store.deactivateChat(push.payload.chat_id, push.payload.thread_id)

    chatTransition.commit(push.payload.user_id)
  }

  function onIncomingEvent(push: v35.agent.IncomingEvent) {
    const { chat_id, thread_id, event } = push.payload

    store.dispatch(function (state) {
      const sneakPeeks = new Map(state.sneakPeeks)
      const chats = new Map(state.chats)
      let chat = chats.get(chat_id)

      if (chat) {
        if (event.custom_id && state.messageStatuses.has(event.custom_id)) {
          chat = helpers.updateEventByCustomId(chat, thread_id, event.custom_id, function () {
            return event
          })
        }
        else {
          chat = helpers.updateThread(chat, thread_id, function (thread) {
            return {
              ...thread,
              events: helpers.mergeEvents(thread.events, [event])
            }
          })
        }

        chats.set(chat_id, chat)
      }

      sneakPeeks.delete(chat_id)

      return {
        sneakPeeks,
        chats
      }
    })

    const state = store.getState()

    if (event.type !== "system_message" && event.author_id && event.author_id !== state.myProfile?.id) {
      const chatRoute = getChatRoute(chat_id)

      if (chatRoute === "my" || chatRoute === "supervised") {
        const chat = state.chats.get(chat_id)
        const user = chat ? helpers.getChatRecipient(chat.users) : null
        const title = user?.name ?? "Visitor"
        const body = helpers.stringifyChatEntity(event)

        notifications.show(title, {
          body,
          onclick() {
            selectChat(chat_id)
          }
        })
      }
    }
  }

  function onChatPropertiesUpdated(push: v35.agent.ChatPropertiesUpdated) {
    const { chat_id, properties } = push.payload
    const transition = startChatTransition(chat_id)

    store.dispatch(function (state) {
      const chats = new Map(state.chats)
      const chat = chats.get(chat_id)

      if (!chat) {
        return state
      }

      chats.set(chat_id, {
        ...chat,
        properties: helpers.mergeChatProperties(chat.properties, properties)
      })

      return { chats }
    })

    transition.commit()
  }

  function onRoutingStatusSet(push: v35.agent.RoutingStatusSet) {
    store.dispatch(function (state) {
      return {
        routingStatuses: new Map(state.routingStatuses).set(push.payload.agent_id, push.payload.status)
      }
    })
  }

  function onEventsMarkedAsSeen(push: v35.agent.EventsMarkedAsSeen) {
    store.dispatch(function (state) {
      const chats = new Map(state.chats)
      const chat = chats.get(push.payload.chat_id)

      if (!chat) {
        return
      }

      chats.set(push.payload.chat_id, helpers.updateUser(chat, push.payload.user_id, function (user) {
        return { ...user, events_seen_up_to: push.payload.seen_up_to }
      }))

      return { chats }
    })
  }

  function handleIncomingSneakPeek(push: v35.agent.IncomingSneakPeek) {
    const chatId = String(push?.payload?.chat_id)
    const sneakPeek = v35.agent.parseSneakPeek(push?.payload?.sneak_peek)

    store.dispatch(function (state) {
      return {
        sneakPeeks: new Map(state.sneakPeeks).set(chatId, sneakPeek)
      }
    })
  }

  function handleIncomingMulticast(push: v35.agent.IncomingMulticast) {
    const payload = push.payload

    if (payload.type === "lc2" && payload.content.name === "canned_response_add") {
      const groupId = payload.content.group
      const cannedResponse = payload.content.canned_response as types.CannedResponse

      store.dispatch(function (state) {
        const cannedResponses = Object.assign({}, state.cannedResponses)

        if (!cannedResponses[groupId]) {
          return
        }

        cannedResponses[groupId] = cannedResponses[groupId].concat(cannedResponse)

        return {
          cannedResponses
        }
      })
    }

    if (payload.type === "lc2" && payload.content.name === "canned_response_update") {
      const groupId = payload.content.group
      const cannedResponse = payload.content.canned_response as types.CannedResponse

      store.dispatch(function (state) {
        const cannedResponses = Object.assign({}, state.cannedResponses)

        if (!cannedResponses[groupId]) {
          return
        }

        cannedResponses[groupId] = cannedResponses[groupId].map(function (item) {
          if (item.id === cannedResponse.id) {
            return Object.assign({}, item, cannedResponse)
          }
          else {
            return item
          }
        })

        return { cannedResponses }
      })
    }

    if (payload.type === "lc2" && payload.content.name === "canned_response_remove") {
      const groupId = payload.content.group
      const id = payload.content.canned_response.id

      return store.dispatch(function (state) {
        const cannedResponses = Object.assign({}, state.cannedResponses)

        if (!cannedResponses[groupId]) {
          return
        }

        cannedResponses[groupId] = cannedResponses[groupId].filter(function (item) {
          return item.id !== id
        })

        return { cannedResponses }
      })
    }
  }

  function handleQueuePositionsUpdated(push: v35.agent.QueuePositionsUpdated) {
    const chatIds = push.payload.map(update => update.chat_id)
    const transitions = startChatTransitions(chatIds)

    store.dispatch(function (state) {
      const chats = new Map(state.chats)
      let chat: v35.agent.Chat | undefined
      let queuePosition: v35.agent.QueuePosition

      for (queuePosition of push.payload) {
        chat = chats.get(queuePosition.chat_id)

        if (!chat) {
          continue
        }

        chats.set(chat.id, helpers.updateThread(chat, queuePosition.thread_id, function (thread) {
          return {
            ...thread,
            queue: queuePosition.queue,
          }
        }))
      }

      return {
        chats
      }
    })

    transitions.commit()
  }

  function onChatRouteChange(t: ChatTransition) {
    const state = store.getState()
    const chatId = t.chatId
    const chatRoute = t.finalChatRoute
    const myChatIds = new Set(state.myChatIds)
    const supervisedChatIds = new Set(state.supervisedChatIds)
    const queuedChatIds = new Set(state.queuedChatIds)
    const unassignedChatIds = new Set(state.unassignedChatIds)
    const otherChatIds = new Set(state.otherChatIds)
    const archivedChatIds = new Set(state.archivedChatIds)
    const pinnedChatIds = new Set(state.pinnedChatIds)
    const inactiveChatIds = new Set(state.inactiveChatIds)

    myChatIds.delete(chatId)
    supervisedChatIds.delete(chatId)
    queuedChatIds.delete(chatId)
    unassignedChatIds.delete(chatId)
    otherChatIds.delete(chatId)
    archivedChatIds.delete(chatId)
    pinnedChatIds.delete(chatId)

    if (chatRoute === "my") {
      myChatIds.add(chatId)
    }
    else if (chatRoute === "supervised") {
      supervisedChatIds.add(chatId)
    }
    else if (chatRoute === "queued") {
      queuedChatIds.add(chatId)
    }
    else if (chatRoute === "unassigned") {
      unassignedChatIds.add(chatId)
    }
    else if (chatRoute === "other") {
      otherChatIds.add(chatId)
    }
    else if (chatRoute === "closed") {
      archivedChatIds.add(chatId)
      inactiveChatIds.add(chatId)
    }
    else if (chatRoute === "pinned") {
      pinnedChatIds.add(chatId)
      inactiveChatIds.add(chatId)
    }
    else {
      throw new RangeError("unknown chat route: " + chatRoute)
    }

    store.dispatch({
      myChatIds: Array.from(myChatIds),
      supervisedChatIds: Array.from(supervisedChatIds),
      queuedChatIds: Array.from(queuedChatIds),
      unassignedChatIds: Array.from(unassignedChatIds),
      otherChatIds: Array.from(otherChatIds),
      archivedChatIds: Array.from(archivedChatIds),
      pinnedChatIds: Array.from(pinnedChatIds),
      inactiveChatIds: Array.from(inactiveChatIds),
    })
  }

  function selectedChatFolder(selectedChatFolder: types.ChatFolder) {
    store.dispatch({
      selectedChatFolder
    })

    if (selectedChatFolder === "archived") {
      maybeSyncArchivedChats()
    }
  }

  function getCurrentChatRoute(chatId: string) {
    const transition = chatRouter.transitions.get(chatId)

    if (transition) {
      return transition.initialChatRoute
    }

    return getChatRoute(chatId)
  }

  function startChatTransition(chatId: string) {
    const prevChatRoute = getChatRoute(chatId)
    let nextChatRoute: types.ChatRoute | undefined

    return { commit }

    function commit(requesterId: string | void) {
      nextChatRoute = getChatRoute(chatId)

      if (nextChatRoute) {
        chatRouter.setChatRoute(chatId, prevChatRoute, nextChatRoute, requesterId)
      }
    }
  }

  function startChatTransitions(chatIds: string[]) {
    const transitions = chatIds.map(startChatTransition)

    return {
      commit() {
        transitions.forEach(function (transition) {
          transition.commit()
        })
      }
    }
  }

  function getChatRoute(chatId: string) {
    const state = store.getState()
    const myProfileId = state.myProfile?.id
    const chat = state.chats.get(chatId)

    if (!myProfileId || !chat) {
      return
    }

    return helpers.getChatRoute(chat, myProfileId)
  }

  function sendTextMessage(chatId: string, text: string) {
    const state = store.getState()
    const chat = state.chats.get(chatId)
    const authorId = state.myProfile?.id
    let visibility: v35.agent.Visibility = "all"

    if (!chat) {
      throw new Error("Chat does not present in memory")
    }

    if (!authorId) {
      throw new Error("sendMessage: `authorId` can't be empty")
    }

    const thread = getActiveThread(chat)

    if (!thread) {
      throw new Error("chat should be activated")
    }

    if (getChatRoute(chatId) === "supervised") {
      visibility = "agents"
    }

    const customId = helpers.randomStr(8)
    const event: v35.agent.MessageEvent = {
      id: customId,
      custom_id: customId,
      author_id: authorId,
      type: "message",
      text: text,
      visibility: visibility,
      properties: {},
      created_at: new Date(),
      postback: null,
    }

    store.dispatch(function (state) {
      const chats = new Map(state.chats)
      const messageStatuses = new Map(state.messageStatuses)
      let chat = chats.get(chatId)

      if (chat) {
        chat = helpers.updateThread(chat, thread.id, function (thread) {
          return {
            ...thread,
            events: helpers.mergeEvents(thread.events, [event])
          }
        })

        chats.set(chat.id, chat)
      }

      messageStatuses.set(customId, "sending")

      return {
        chats,
        messageStatuses,
      }
    })

    getAccessToken()
      .then(function (accessToken) {
        return v35.agent.sendEvent(accessToken, {
          chat_id: chatId,
          event: event,
          attach_to_last_thread: false,
        })
      })
      .then(function (response) {
        store.dispatch(function (state) {
          const chats = new Map(state.chats)
          const messageStatuses = new Map(state.messageStatuses)
          let chat = chats.get(chatId)

          messageStatuses.delete(customId)

          if (chat) {
            chat = helpers.updateEventByCustomId(chat, thread.id, event.custom_id, function () {
              return {
                ...event,
                id: response.event_id,
              }
            })

            chats.set(chat.id, chat)
          }

          return {
            chats,
            messageStatuses
          }
        })
      })
      .catch(function (err) {
        store.dispatch(function (state) {
          return {
            messageStatuses: new Map(state.messageStatuses).set(customId, "failed")
          }
        })

        console.error(err)
      })
  }

  async function sendFileMessage(chatId: string, file: File) {
    const state = store.getState();
    const chat = state.chats.get(chatId)
    const authorId = state.myProfile?.id

    if (!chat) {
      throw new Error("Chat not found in store")
    }

    if (!authorId) {
      throw new Error("Can't determine message' author")
    }

    const thread = getActiveThread(chat)

    if (!thread) {
      throw new Error("chat should be activated")
    }

    let visibility: v35.agent.Visibility = "all"

    if (getCurrentChatRoute(chatId) === "supervised") {
      visibility = "agents"
    }

    const customId = helpers.randomStr(8)
    const url = URL.createObjectURL(file)

    const event: v35.agent.FileEvent = {
      id: customId,
      custom_id: customId,
      author_id: authorId,
      type: "file",
      visibility,
      url,
      name: file.name,
      content_type: file.type,
      size: file.size,
      thumbnail_url: url,
      thumbnail2x_url: url,
      width: 0,
      height: 0,
      created_at: new Date(),
      properties: {},
    }

    const progressSignal = new ProgressSignal()
    const abortController = new AbortController()

    store.dispatch(function (state) {
      const chats = new Map(state.chats)
      const filesUpload = new Map(state.filesUpload)
      const messageStatuses = new Map(state.messageStatuses)
      let chat = chats.get(chatId)

      if (chat) {
        chat = helpers.updateThread(chat, thread.id, function (thread) {
          return {
            ...thread,
            events: helpers.mergeEvents(thread.events, [event])
          }
        })

        chats.set(chat.id, chat)
      }

      filesUpload.set(customId, [progressSignal, abortController])
      messageStatuses.set(customId, "sending")

      return {
        chats,
        filesUpload,
        messageStatuses,
      }
    })

    try {
      const accessToken = await getAccessToken()
      const { url } = await v35.agent.uploadFile(accessToken, file, abortController.signal, progressSignal)
      const { event_id } = await v35.agent.sendEvent(accessToken, {
        chat_id: chatId,
        event: {
          visibility: "all",
          custom_id: customId,
          type: "file",
          url,
        },
        attach_to_last_thread: true,
      })

      store.dispatch(function (state) {
        const chats = new Map(state.chats)
        const filesUpload = new Map(state.filesUpload)
        const messageStatuses = new Map(state.messageStatuses)
        let chat = chats.get(chatId)

        filesUpload.delete(customId)
        messageStatuses.delete(customId)

        if (chat) {
          chat = helpers.updateEventByCustomId(chat, thread.id, customId, function () {
            return {
              ...event,
              id: event_id,
            }
          })

          chats.set(chat.id, chat)
        }

        return {
          chats,
          filesUpload,
          messageStatuses
        }
      })
    }
    catch (err) {
      store.dispatch(function (state) {
        const chats = new Map(state.chats)
        const filesUpload = new Map(state.filesUpload)
        const messageStatuses = new Map(state.messageStatuses)
        const chat = chats.get(chatId)

        filesUpload.delete(customId)

        if (err instanceof Error && err.name === "AbortError") {
          messageStatuses.delete(customId)

          if (chat) {
            chats.set(chat.id, helpers.deleteEventByCustomId(chat, thread.id, customId))
          }
        }
        else {
          messageStatuses.set(customId, "failed")
        }

        return {
          chats,
          filesUpload,
          messageStatuses
        }
      })
    }
    finally {
      URL.revokeObjectURL(url)
    }
  }

  function syncIncompleteThreadsAsync(chatId: string, signal?: AbortSignal) {
    const state = store.getState();
    const chat = state.chats.get(chatId)

    if (!chat) {
      return
    }

    const threadIds = getIncompleteThreadIds(chat)

    for (const threadId of threadIds) {
      const status = state.threadSyncStatuses.get(threadId)

      if (status === "fetching") {
        continue
      }

      store.dispatch(function (state) {
        return {
          threadSyncStatuses: new Map(state.threadSyncStatuses).set(threadId, "fetching")
        }
      })

      getAccessToken()
        .then(function (accessToken) {
          return v35.agent.getChat(accessToken, { chat_id: chatId, thread_id: threadId })
        })
        .then(function (chat) {
          store.setIncomingChat(chat)
        })
        .catch(function (err) {
          console.warn("fail to fetch thread", err)
        })
        .finally(function () {
          store.dispatch(function (state) {
            return {
              threadSyncStatuses: new Map(state.threadSyncStatuses).set(threadId, "idle")
            }
          })
        })
    }
  }

  async function maybeSyncChatGap(chatId: string, gap: types.ChatGap, options?: {
    onLoad?(): void
  }) {
    const state = store.getState()

    if (state.chatGapStatuses.get(gap.id) === "fetching") {
      return
    }

    store.dispatch({
      chatGapStatuses: new Map(state.chatGapStatuses).set(gap.id, "fetching")
    })

    const from = gap.filters_from ? helpers.toISOString(new Date(gap.filters_from)) : undefined
    const to = gap.filters_to ? helpers.toISOString(new Date(gap.filters_to)) : undefined

    getAccessToken()
      .then(function (accessToken) {
        return v35.agent.listThreads(accessToken, {
          chat_id: chatId,
          sort_order: gap.sort_order,
          limit: gap.limit,
          filters: { from, to }
        })
      })
      .then(function (resp) {
        if (typeof options?.onLoad === "function") {
          options.onLoad()
        }

        store.setChatThreads(chatId, resp.threads)
      })
      .catch(function (err) {
        console.error(err)
      })
      .finally(function () {
        store.dispatch({
          chatGapStatuses: new Map(state.chatGapStatuses).set(gap.id, "idle")
        })
      })
  }

  function maybeMarkEventsAsSeen(chatId: string, event: v35.agent.Event) {
    const state = store.getState();
    const chat = state.chats.get(chatId)
    const myProfile = state.myProfile

    if (!chat || !myProfile) {
      return
    }

    const user = chatUserFinder.findUser(chat, myProfile.id)

    if (!user) {
      return
    }

    if (event.created_at.getTime() <= user.events_seen_up_to.getTime()) {
      return
    }

    store.dispatch(function (state) {
      const chats = new Map(state.chats)
      const chat = chats.get(chatId)

      if (!chat) {
        return
      }

      chats.set(chatId, helpers.updateUser(chat, user.id, function (user) {
        return {
          ...user,
          events_seen_up_to: event.created_at
        }
      }))

      return { chats }
    })

    getAccessToken()
      .then(function (accessToken) {
        return v35.agent.markEventsAsSeen(accessToken, {
          chat_id: chatId,
          seen_up_to: helpers.toISOString(event.created_at)
        })
      })
      .catch(function (err) {
        console.error("fail to mark events as seen", err)
      })
  }

  function toggleDetailsSection() {
    store.dispatch(function (state) {
      return {
        showDetailsSection: !state.showDetailsSection
      }
    })
  }

  function toggleRoutingStatus() {
    const state = store.getState()
    const myProfileId = state.myProfile?.id

    if (!myProfileId) {
      throw new ErrorWithType("`agent_id` can't be determined", "validation", 400)
    }

    if (state.isUpdatingRoutingStatus) {
      throw new ErrorWithType("Pending routing update", "validation", 400)
    }

    const currentStatus = state.routingStatuses.get(myProfileId)
    const nextStatus = currentStatus === "accepting_chats" ? "not_accepting_chats" : "accepting_chats"

    store.dispatch(function (state) {
      return {
        routingStatuses: new Map(state.routingStatuses).set(myProfileId, nextStatus),
        isUpdatingRoutingStatus: true,
      }
    })

    getAccessToken()
      .then(function (accessToken) {
        return v35.agent.setRoutingStatus(accessToken, {
          status: nextStatus,
          agent_id: myProfileId
        })
      })
      .catch(function (err) {
        console.warn("fail to update routing status", err)

        if (currentStatus) {
          store.dispatch(function (state) {
            return {
              routingStatuses: new Map(state.routingStatuses).set(myProfileId, currentStatus),
            }
          })
        }
      })
      .finally(function () {
        store.dispatch({
          isUpdatingRoutingStatus: false
        })
      })
  }

  function setRoutingStatus(status: v35.agent.RoutingStatus) {
    const state = store.getState()
    const agent_id = state.myProfile?.id

    if (!agent_id) {
      throw new ErrorWithType("`agent_id` can't be determined", "validation", 400)
    }

    store.dispatch(function (state) {
      return {
        routingStatuses: new Map(state.routingStatuses).set(agent_id, status),
      }
    })

    getAccessToken()
      .then(function (accessToken) {
        return v35.agent.setRoutingStatus(accessToken, { status, agent_id })
      })
      .catch(function (err) {
        console.error(err)
      })
  }

  function startChat(chatId: string) {
    const chatRoute = getCurrentChatRoute(chatId)
    const myProfileId = store.getState().myProfile?.id

    if (!myProfileId) {
      throw new Error(`myProfileId can't be empty.`)
    }

    if (chatRoute === "queued") {
      return getAccessToken()
        .then(function (accessToken) {
          return v35.agent.addUserToChat(accessToken, {
            chat_id: chatId,
            user_id: myProfileId,
            user_type: "agent",
            visibility: "all"
          })
        })
    }
  }

  function selectChat(chatId: string) {
    const state = store.getState();
    const chat = state.chats.get(chatId)
    let groupId = 0

    if (chat && chat.access.group_ids.length > 0) {
      groupId = chat.access.group_ids[0]
    }

    store.dispatch({
      selectedChatId: chatId
    })

    const promises = [
      syncIncompleteThreadsAsync(chatId),
      maybeSyncCannedResponses(groupId)
    ]

    Promise.all(promises).catch(function (err) {
      console.warn(err)
    })
  }

  async function assignChatToMe(chatId: string) {
    const accessToken = await getAccessToken()
    const state = store.getState()
    const myProfile = state.myProfile

    if (!myProfile) {
      return
    }


    return v35.agent.addUserToChat(accessToken, {
      chat_id: chatId,
      user_id: myProfile.id,
      user_type: "agent",
      visibility: "all",
      ignore_requester_presence: true
    })
      .catch(function (err) {
        if (err instanceof ErrorWithType && err.type === "chat_inactive") {
          let groupId = 0
          const state = store.getState();
          const chat = state.chats.get(chatId)

          if (chat?.access.group_ids && chat.access.group_ids.length > 0) {
            groupId = chat.access.group_ids[0]
          }

          return v35.agent.resumeChat(accessToken, {
            chat: {
              id: chatId,
              access: {
                group_ids: [groupId]
              },
              users: [{
                id: myProfile.id,
                type: "agent",
              }]
            }
          })
        }

        throw err
      })
      .catch(console.error)
  }

  async function unpinChat(chatId: string) {
    const accessToken = await getAccessToken()

    v35.agent.updateChatProperties(accessToken, {
      id: chatId,
      properties: {
        routing: {
          pinned: false
        }
      }
    })
      .catch(console.error)
  }

  async function pickChatFromQueue(chatId: string) {
    const accessToken = await getAccessToken()
    const myProfileId = store.getState().myProfile?.id

    if (!myProfileId) {
      return
    }

    v35.agent.addUserToChat(accessToken, {
      chat_id: chatId,
      user_id: myProfileId,
      user_type: "agent",
      visibility: "all",
      ignore_requester_presence: true
    }).catch(console.error)
  }

  async function startSuperviseChat(chatId: string) {
    const accessToken = await getAccessToken()
    const myProfileId = store.getState().myProfile?.id
    const state = store.getState();
    const chat = state.chats.get(chatId)

    if (!myProfileId || !chat) {
      return
    }

    return Promise.all([
      v35.agent.followChat(accessToken, {
        id: chatId
      }),
      v35.agent.addUserToChat(accessToken, {
        chat_id: chatId,
        user_id: myProfileId,
        visibility: "agents",
        user_type: "agent",
        ignore_requester_presence: true,
      })
    ]).catch(console.error)
  }

  async function takeOverChat(chatId: string) {
    const accessToken = await getAccessToken()
    const myProfileId = store.getState().myProfile?.id

    if (!myProfileId) {
      return
    }

    v35.agent.transferChat(accessToken, {
      id: chatId,
      target: {
        type: "agent",
        ids: [myProfileId]
      },
      ignore_agents_availability: true,
      ignore_requester_presence: true,
    }).catch(console.error)
  }

  async function deactivateChat(chatId: string) {
    const accessToken = await getAccessToken()

    v35.agent.deactivateChat(accessToken, { id: chatId }).catch(function (err) {
      console.error(err.message)
    })
  }

  async function transferChat(chatId: string, target: { type: "group" | "agent", ids: Array<string | number> }) {
    const accessToken = await getAccessToken()
    const state = store.getState()

    if (state.selectedChatId === chatId) {
      store.dispatch({ selectedChatId: "" })
    }

    v35.agent.transferChat(accessToken, {
      id: chatId,
      target: target,
      ignore_agents_availability: true,
      ignore_requester_presence: true,
    }).catch(function (err) {
      alert(err.message)
    })
  }

  async function maybeSyncPinnedChats() {
    const state = store.getState()
    const status = state.pinnedChatsStatus
    const accessToken = await getAccessToken()

    if (status !== "unknown") {
      return
    }

    store.dispatch({ pinnedChatsStatus: "fetching" })

    return v35.agent.listChats(accessToken, {
      filters: {
        include_active: false,
        include_chats_without_threads: false,
        properties: {
          routing: {
            pinned: {
              values: [true]
            }
          }
        },
      },
      limit: 25,
    })
      .then(function (resp) {
        store.dispatch(function (state) {
          const pinnedChatIds = resp.chats.map(c => c.id)
          const chats = mergeChats(state.chats, helpers.mapBy(resp.chats, "id"))
          return {
            chats,
            pinnedChatIds,
            pinnedChatsStatus: "up",
            pinnedChatsNextPageId: resp.next_page_id
          }
        })
      })
      .catch(function (err) {
        store.dispatch({
          pinnedChatsStatus: "fail",
          pinnedChatsSyncError: String(err.message)
        })
      })
  }

  async function maybeLoadMorePinnedChats() {
    const accessToken = await getAccessToken()
    const state = store.getState()

    if (state.pinnedChatsStatus !== "up") {
      return
    }

    if (!state.pinnedChatsNextPageId) {
      return
    }

    store.dispatch({
      pinnedChatsStatus: "fetching-more"
    })

    return v35.agent.listChats(accessToken, {
      page_id: state.pinnedChatsNextPageId
    })
      .then(function (resp) {
        store.dispatch(function (state) {
          const incomingChatIds = resp.chats.map(c => c.id)
          const archivedChatIds = helpers.unique(state.archivedChatIds, incomingChatIds)
          const chats = mergeChats(state.chats, helpers.mapBy(resp.chats, "id"))

          return {
            chats,
            archivedChatIds,
            archivedChatsStatus: "up",
            archivedChatsNextPageId: resp.next_page_id,
          }
        })
      })
      .catch(function (err) {
        store.dispatch({
          pinnedChatsStatus: "fail",
          pinnedChatsSyncError: String(err.message)
        })
      })
  }

  async function maybeSyncArchivedChats() {
    const accessToken = await getAccessToken()
    const state = store.getState()

    if (state.archivedChatsStatus !== "unknown") {
      return
    }

    store.dispatch({
      archivedChatsStatus: "fetching"
    })

    return v35.agent.listChats(accessToken, {
      filters: {
        include_active: false,
        include_chats_without_threads: false,
        properties: {
          routing: {
            pinned: {
              values: [false]
            }
          }
        },
      },
      limit: 25,
    })
      .then(function (resp) {
        store.dispatch(function (state) {
          return {
            chats: mergeChats(state.chats, helpers.mapBy(resp.chats, "id")),
            archivedChatIds: resp.chats.map(c => c.id),
            archivedChatsStatus: "up",
            archivedChatsNextPageId: resp.next_page_id
          }
        })
      })
      .catch(function (err) {
        console.error(err)
        store.dispatch({
          archivedChatsStatus: "fail",
          archivedChatsSyncError: String(err.message)
        })
      })
  }

  async function maybeLoadMoreArchivedChats() {
    const accessToken = await getAccessToken()
    const state = store.getState()

    if (state.archivedChatsStatus !== "up") {
      return
    }

    const page_id = state.archivedChatsNextPageId

    if (!page_id) {
      return
    }

    store.dispatch({
      archivedChatsStatus: "fetching-more"
    })

    return v35.agent.listChats(accessToken, { page_id })
      .then(function (resp) {
        store.dispatch(function (state) {
          const incomingChatIds = resp.chats.map(c => c.id)
          const archivedChatIds = helpers.unique(state.archivedChatIds, incomingChatIds)
          const chats = mergeChats(state.chats, helpers.mapBy(resp.chats, "id"))

          return {
            chats,
            archivedChatIds,
            archivedChatsStatus: "up",
            archivedChatsNextPageId: resp.next_page_id
          }
        })
      })
      .catch(function (err) {
        console.error(err)
        store.dispatch({
          archivedChatsStatus: "fail",
          archivedChatsSyncError: String(err.message),
        })
      })
  }

  async function maybeSyncInactiveChats() {
    const accessToken = await getAccessToken()
    const state = store.getState()

    if (state.inactiveChatsStatus !== "unknown") {
      return
    }

    store.dispatch({
      inactiveChatsStatus: "fetching"
    })

    return v35.agent.listChats(accessToken, {
      filters: {
        include_active: false,
        include_chats_without_threads: false,
      },
      limit: 25,
    })
      .then(function (resp) {
        store.dispatch(function (state) {
          const inactiveChatIds = resp.chats.map(c => c.id)
          const chats = mergeChats(state.chats, helpers.mapBy(resp.chats, "id"))

          return {
            chats,
            inactiveChatIds,
            inactiveChatsStatus: "up",
            inactiveChatsNextPageId: resp.next_page_id,
          }
        })
      })
      .catch(function (err) {
        store.dispatch({
          inactiveChatsStatus: "fail",
          inactiveChatsSyncError: String(err.message)
        })
      })
  }

  async function maybeLoadMoreInactiveChats() {
    const accessToken = await getAccessToken()
    const state = store.getState()

    if (state.inactiveChatsStatus !== "up") {
      return
    }

    const page_id = state.inactiveChatsNextPageId

    if (!page_id) {
      return
    }

    store.dispatch({
      inactiveChatsStatus: "fetching-more"
    })

    return v35.agent.listChats(accessToken, {
      page_id
    })
      .then(function (resp) {
        store.dispatch(function (state) {
          const incomingChatIds = resp.chats.map(c => c.id)
          const inactiveChatIds = helpers.unique(state.inactiveChatIds, incomingChatIds)
          const chats = mergeChats(state.chats, helpers.mapBy(resp.chats, "id"))

          return {
            chats,
            inactiveChatIds,
            inactiveChatsStatus: "up",
            inactiveChatsNextPageId: resp.next_page_id
          }
        })
      })
      .catch(function (err) {
        store.dispatch({
          inactiveChatsStatus: "fail",
          inactiveChatsSyncError: String(err.message)
        })
      })
  }

  function maybeSyncCannedResponses(groupId: number, signal?: AbortSignal) {
    const state = store.getState()

    if (state.cannedResponses[groupId]) {
      return
    }

    return syncCannedResponses(groupId, signal)
  }

  async function syncCannedResponses(groupId: number, signal?: AbortSignal) {
    const accessToken = await getAccessToken()

    return api.getCannedResponse(accessToken, groupId, signal).then(function (cannedResponses) {
      store.dispatch(function (state) {
        return {
          cannedResponses: Object.assign({}, state.cannedResponses, {
            [groupId]: cannedResponses
          })
        }
      })
    })
  }

  async function syncRoutingStatuses() {
    const accessToken = await getAccessToken()

    return v35.agent.listRoutingStatuses(accessToken).then(function (routingStatuses) {
      store.dispatch({ routingStatuses })
    })
  }

  async function syncAgents() {
    const accessToken = await getAccessToken()
    const signal = AbortSignal.timeout(30_000)
    const agents = await v35.conf.listAgents(accessToken, {}, signal)

    store.dispatch({ agents })
  }

  async function syncGroups() {
    const accessToken = await getAccessToken()
    const signal = AbortSignal.timeout(30_000)
    const groups = await v35.conf.listGroups(accessToken, {
      fields: ["routing_status"]
    }, signal)

    store.dispatch({ groups })
  }

  async function maybeSyncGroups() {
    const { groups } = store.getState()

    if (groups.length > 1) {
      return
    }

    return syncGroups()
  }

  async function search(query: string) {
    const accessToken = await getAccessToken()
    const highlightTag = `x_highlight`

    query = query.trim()

    if (searchAbortController) {
      searchAbortController.abort()
    }

    searchAbortController = new AbortController()

    if (query.length === 0) {
      return store.dispatch({
        searchMode: "focus",
        searchQuery: "",
        searchResults: [],
      })
    }

    store.dispatch(function (state) {
      return {
        searchQuery: query,
        searchMode: "searching",
        searchRecentQueries: helpers.unique([query], state.searchRecentQueries)
      }
    })

    v35.agent.listArchives(accessToken, {
      filters: {
        query
      },
      highlights: {
        pre_tag: `<${highlightTag}>`,
        post_tag: `</${highlightTag}>`,
      },
      limit: 25
    }, searchAbortController.signal)
      .then(function (response) {
        store.dispatch(function (state) {
          let chats = state.chats

          for (const chat of response.chats) {
            chats = mergeChats(chats, new Map([[chat.id, chat]]))
          }

          return {
            chats: chats,
            searchMode: "results",
            searchQuery: query,
            searchResults: helpers.getSearchResults(response.chats, highlightTag),
            searchRecentQueries: helpers.unique([query], state.searchRecentQueries),
            searchFoundChats: response.found_chats,
            searchNextPageId: response.next_page_id,
          }
        })

      })
      .catch(function (err) {
        console.error(err)
        store.dispatch({
          searchMode: "error",
          searchErrorMessage: err.message
        })
      })
  }

  function cancelSearch() {
    if (searchAbortController) {
      searchAbortController.abort()
    }
  }

  function updateAndFocusChatSearchInput(query: string) {
    if (chatSearchInputRef.current) {
      chatSearchInputRef.current.value = query
      chatSearchInputRef.current.focus()
      chatSearchInputRef.current.setSelectionRange(0, query.length)
    }
  }

  function selectSearchResult(result: types.SearchResult) {
    store.dispatch({
      selectedChatId: result.chatId,
      searchSelectedResult: result.id,
    })

    if (visibleChatViewRef.current) {
      if (result.threadId && result.eventId) {
        visibleChatViewRef.current.highlightEvent(result.eventId)
      }
    }
  }

  function deleteRecentSearchQuery(query: string) {
    store.dispatch(function (state) {
      const searchRecentQueries = state.searchRecentQueries.filter(function (v) {
        return v !== query
      })

      return {
        searchRecentQueries
      }
    })
  }

  async function maybeParseUserAgent(userAgent: string) {
    const state = store.getState()
    const parsedUserAgents = state.parsedUserAgents[userAgent]

    if (parsedUserAgents) {
      return
    }

    set({
      status: "pending"
    })

    api.parseUserAgent({ user_agent: userAgent })
      .then(function (parsedUserAgent) {
        set({
          status: "done",
          userAgent: parsedUserAgent
        })
      })
      .catch(function (err) {
        set({
          status: "failed",
          errorMessage: err.message
        })
      })

    function set(parsedUserAgent: types.ParsedUserAgent) {
      store.dispatch(function (state) {
        return {
          parsedUserAgents: Object.assign({}, state.parsedUserAgents, {
            [userAgent]: parsedUserAgent
          })
        }
      })
    }
  }

  async function getAccessToken(): Promise<string> {
    const threshold = 5 * 60 * 1000
    const state = store.getState()

    if (!state.credentials) {
      throw new Error("no access token")
    }

    let credentials = state.credentials

    if (credentials.expired_at.getTime() > (Date.now() + threshold)) {
      return credentials.access_token
    }

    const lock = await createLock("refresh_token", 10 * 1000)

    try {
      const nextState = helpers.getStateFromLocalStore()

      if (nextState.credentials && nextState.credentials.expired_at.getTime() > (Date.now() + threshold)) {
        store.dispatch(nextState)

        return nextState.credentials.access_token
      }

      credentials = await api.token({
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token
      })

      store.dispatch({ credentials })

      return credentials.access_token
    }
    finally {
      lock.release()
    }
  }

  async function onPaste(event: ClipboardEvent) {
    const state = store.getState()

    if (!state.selectedChatId) {
      return
    }

    if (!event.clipboardData?.files) {
      return
    }

    if (event.clipboardData.files.length === 0) {
      return
    }

    event.preventDefault()

    const files = Array.from(event.clipboardData.files)

    if (files.length === 0) {
      return
    }

    store.dispatch({
      openModal: {
        type: "file-upload-modal",
        chatId: state.selectedChatId,
        files
      }
    })
  }
}
