import { $Controller } from "./controller.js"
import * as dom from "./dom.js"
import * as helpers from "./helpers.js"
import { $ChatRouter, AutoResize, ProgressSignal, ReverseScroll, createAutoResize } from "./services.js"
import { $Store, State } from "./store.js"
import { ArchivedChatsStatus, ChatEntity, ChatGap, ChatRoute, FileUploadModal, InactiveChatsStatus, MessageStatus, Modal, RestrictedThread, SearchResult, SneakPeekAsEvent } from "./types.js"
import { rest } from "./rest-api.js"
import { v35 } from "./livechat-api.js"
import { $CommandsController, createCommandsView } from "./commands.js"
import type { Unsubscriber } from "./types.js"
import { BaseContext, ElementWithContext, list2 } from "./list.js"

const h = dom.createElement;
const f = dom.createFragment;

export function createAppView() {
  const el = dom.createElement("div", { className: "app" })
  const mainScreen = createMainScreen()
  const commands = createCommandsView()
  const commandsController = $CommandsController()
  const modalsView = createModalsView()

  el.append(mainScreen.el, commands.el, modalsView.el)

  commandsController.onshow = commands.show

  return {
    el,
    dispose
  }

  function dispose() {
    mainScreen.dispose()
    commands.dispose()
    commandsController.onshow = null!
    commandsController.dispose()
    modalsView.dispose()
    el.remove()
  }
}

function createMainScreen() {
  const store = $Store()
  const sidebarElRef = dom.createRef<HTMLDivElement>()
  const mainElRef = dom.createRef<HTMLDivElement>()
  const mainHeaderRef = dom.createRef<MainHeaderView>()
  const chatFoldersRef = dom.createRef<ChatFoldersView>()
  const chatListRef = dom.createRef<ChatListView>()
  const chatsViewRef = dom.createRef<ChatsView>()
  const chatSearchResultsRef = dom.createRef<ChatSearchResultsView>()
  const el = h("div", { className: "main" },
    h("div", { className: "sidebar", ref: sidebarElRef },
      createMainHeaderView({ ref: mainHeaderRef }).el,
      createChatFoldersView({ ref: chatFoldersRef }).el,
      createChatListView({ ref: chatListRef }).el,
      createChatSearchResultsView({ ref: chatSearchResultsRef }).el,
    ),
    h("div", { className: "content", ref: mainElRef },
      createChatsView({ ref: chatsViewRef }).el
    )
  )

  const disconnect = store.connect(function (state) {
    return {
      searchMode: state.searchMode
    }
  }, function (props) {
    if (chatFoldersRef.current) {
      chatFoldersRef.current.el.classList.toggle("d-none", props.searchMode !== null)
    }

    if (chatListRef.current) {
      chatListRef.current.el.classList.toggle("d-none", props.searchMode !== null)
    }

    if (chatSearchResultsRef.current) {
      chatSearchResultsRef.current.el.classList.toggle("d-none", props.searchMode === null)
    }
  })

  return {
    el,
    dispose
  }

  function dispose() {
    disconnect()

    if (mainHeaderRef.current) {
      mainHeaderRef.current.dispose()
      mainHeaderRef.current = null!
    }

    if (chatFoldersRef.current) {
      chatFoldersRef.current.dispose()
      chatFoldersRef.current = null!
    }

    if (chatListRef.current) {
      chatListRef.current.dispose()
      chatListRef.current = null!
    }

    if (chatSearchResultsRef.current) {
      chatSearchResultsRef.current.dispose()
      chatSearchResultsRef.current = null!
    }

    if (chatsViewRef.current) {
      chatsViewRef.current.dispose()
      chatsViewRef.current = null!
    }

    sidebarElRef.current = null!
    mainElRef.current = null!
    el.remove()
  }
}

interface MainHeaderView {
  el: HTMLDivElement
  dispose(): void
}

function createMainHeaderView(options: {
  ref: dom.Ref<MainHeaderView>
}): MainHeaderView {
  const store = $Store()
  const controller = $Controller()
  const dropdownMenuElRef = dom.createRef<HTMLDivElement>()
  const routingInputElRef = dom.createRef<HTMLInputElement>()
  const searchInputElRef = controller.chatSearchInputRef
  const searchButtonElRef = dom.createRef<HTMLButtonElement>()
  const myAvatarRef = dom.createRef<AvatarView>()
  const headerMenuElRef = dom.createRef<HTMLDivElement>()
  const menuButtonElRef = dom.createRef<HTMLButtonElement>()
  const backButtonElRef = dom.createRef<HTMLButtonElement>()
  const lightColorModeBtnRef = dom.createRef<HTMLButtonElement>()
  const darkColorModeBtnRef = dom.createRef<HTMLButtonElement>()
  const autoColorModeBtnRef = dom.createRef<HTMLButtonElement>()
  const myProfileNameRef = dom.createRef<HTMLDivElement>()
  const myProfileEmailRef = dom.createRef<HTMLDivElement>()
  const el = h("div", {
    className: "main-header"
  },
    h("div", { className: "header-menu", ref: headerMenuElRef },
      h("button", {
        ref: menuButtonElRef,
        className: "header-menu-button",
        onmousedown: onToggleMenu,
      },
        createAvatarView({
          ref: myAvatarRef,
          id: "",
          size: 32,
          alt: "",
          src: "",
        }).el,
      ),

      h("button", {
        ref: backButtonElRef,
        className: "header-menu-button",
        onmousedown: onCloseSearch,
      }, icons.createArrowBackIcon({ size: 24 })),

      h("div", { className: "dropdown-menu", ref: dropdownMenuElRef },
        h("div", { className: "px-3 py-2" },
          h("div", { className: "text-primary text-bold", ref: myProfileNameRef }),
          h("div", { className: "text-secondary", ref: myProfileEmailRef }),
        ),

        h("div", {
          className: "dropdown-item d-flex",
          onclick: onToggleRoutingStatus
        },
          h("div", { className: "flex-1 mr-3" }, "Accepting Chats"),
          h("span", { className: "switch switch-small" },
            h("input", {
              className: "switch-checkbox",
              type: "checkbox",
              id: "switch1",
              ref: routingInputElRef
            }),
            h("label", { className: "switch-label", htmlFor: "switch1" })
          )
        ),

        h("div", {
          className: "dropdown-item",
          onclick: onShowQuickActions
        }, "Quick actions"),

        h("div", { className: "px-3 py-2" },
          h("div", { className: "segment" },
            h("button", {
              className: "segment-button",
              ref: lightColorModeBtnRef,
              onclick: () => store.dispatch({ colorMode: "light" })
            }, "Light"),
            h("span", { className: "segment-separator" }),
            h("button", {
              className: "segment-button",
              ref: darkColorModeBtnRef,
              onclick: () => store.dispatch({ colorMode: "dark" })
            }, "Dark"),
            h("span", { className: "segment-separator" }),
            h("button", {
              className: "segment-button",
              ref: autoColorModeBtnRef,
              onclick: () => store.dispatch({ colorMode: "auto" })
            }, "Auto")
          )
        ),

        h("div", {
          className: "dropdown-item",
          onclick: onLogout
        }, "Logout")
      )
    ),
    h("div", { className: "header-input" },
      h("input", {
        className: "form-control pr-5",
        placeholder: "Search",
        ref: searchInputElRef,
        onfocus: onSearchFocus,
        onkeyup: onSearchKeyUp,
      }),
      h("button", {
        type: "button",
        className: "header-input-button d-none",
        ref: searchButtonElRef,
        onclick: onClearSearch
      }, icons.createCloseIcon({ size: 20 }))
    )
  )

  const disconnect = store.connect(function (state) {
    let myRoutingStatus: v35.agent.RoutingStatus | undefined = undefined

    if (state.myProfile) {
      myRoutingStatus = state.routingStatuses.get(state.myProfile.id)
    }

    return {
      myProfile: state.myProfile,
      searchMode: state.searchMode,
      myRoutingStatus: myRoutingStatus,
      colorModel: state.colorMode,
    }
  }, function (props) {
    if (routingInputElRef.current) {
      routingInputElRef.current.disabled = props.myRoutingStatus != null
      routingInputElRef.current.checked = props.myRoutingStatus === "accepting_chats"
    }

    if (props.myProfile) {
      if (myAvatarRef.current) {
        myAvatarRef.current.update({
          id: props.myProfile.id,
          alt: props.myProfile.name,
          src: props.myProfile.avatar,
          size: 32,
          badge: props.myRoutingStatus
        })
      }

      if (myProfileNameRef.current) {
        myProfileNameRef.current.innerText = props.myProfile.name
      }

      if (myProfileEmailRef.current) {
        myProfileEmailRef.current.innerText = props.myProfile.email
      }
    }

    menuButtonElRef.current.classList.toggle("d-none", props.searchMode !== null)
    backButtonElRef.current.classList.toggle("d-none", props.searchMode === null)
    lightColorModeBtnRef.current.classList.toggle("active", props.colorModel === "light")
    darkColorModeBtnRef.current.classList.toggle("active", props.colorModel === "dark")
    autoColorModeBtnRef.current.classList.toggle("active", props.colorModel === "auto")
  })

  document.addEventListener("click", onGlobalClick)

  return options.ref.current = {
    el,
    dispose
  }

  function dispose() {
    disconnect()
    document.removeEventListener("click", onGlobalClick)
    dropdownMenuElRef.current = null!
    routingInputElRef.current = null!
    searchInputElRef.current = null!
    searchButtonElRef.current = null!
    headerMenuElRef.current = null!
    menuButtonElRef.current.onmousedown = null
    menuButtonElRef.current = null!
    backButtonElRef.current.onmousedown = null
    backButtonElRef.current = null!
    lightColorModeBtnRef.current.onclick = null
    lightColorModeBtnRef.current = null!
    darkColorModeBtnRef.current.onclick = null
    darkColorModeBtnRef.current = null!
    autoColorModeBtnRef.current.onclick = null
    autoColorModeBtnRef.current = null!
    myProfileNameRef.current = null!
    myProfileEmailRef.current = null!
    el.remove()
  }

  function onToggleMenu() {
    if (dropdownMenuElRef.current) {
      dropdownMenuElRef.current.classList.toggle("open")
    }
  }

  function onToggleRoutingStatus(event: MouseEvent) {
    event.preventDefault()
    controller.toggleRoutingStatus()
  }

  function onShowQuickActions(event: MouseEvent) {
    event.preventDefault()
    onToggleMenu()
    $CommandsController().show()
  }

  function onLogout(event: MouseEvent) {
    event.preventDefault()
    onToggleMenu()
    $Controller().logout()
  }

  function onSearchFocus(event: FocusEvent) {
    store.dispatch(function (state) {
      if (state.searchMode === null || searchInputElRef.current?.value.length === 0) {
        return {
          searchMode: "focus"
        }
      }
    })
  }

  function onSearchKeyUp(event: KeyboardEvent) {
    if (!searchInputElRef.current) {
      return
    }

    if (searchButtonElRef.current) {
      searchButtonElRef.current.classList.toggle("d-none", searchButtonElRef.current.value.length === 0)
    }

    if (event.key === "Enter") {
      event.preventDefault()
      controller.search(searchInputElRef.current.value)
    }
  }

  function onClearSearch() {
    controller.cancelSearch()

    if (searchInputElRef.current) {
      searchInputElRef.current.value = ""
    }
  }

  function onCloseSearch() {
    controller.cancelSearch()

    if (searchInputElRef.current) {
      searchInputElRef.current.value = ""
    }

    store.dispatch({
      searchMode: null,
    })
  }

  function onGlobalClick(event: MouseEvent) {
    if (!dropdownMenuElRef.current || !dropdownMenuElRef.current.classList.contains("open")) {
      return
    }

    if (!headerMenuElRef.current) {
      return
    }

    if (!(event.target instanceof Node)) {
      return
    }

    if (!headerMenuElRef.current.contains(event.target)) {
      dropdownMenuElRef.current.classList.remove("open")
    }
  }
}

interface ChatFoldersView {
  el: HTMLDivElement
  dispose(): void
}

interface ChatFoldersViewOptions {
  ref: dom.Ref<ChatFoldersView>
}

function createChatFoldersView(options: ChatFoldersViewOptions): ChatFoldersView {
  const store = $Store()
  const controller = $Controller()
  const myTabBadge = dom.createElement("span", { className: "tab-badge" })
  const supervisedTabBadge = dom.createElement("span", { className: "tab-badge" })
  const queuedTabBadge = dom.createElement("span", { className: "tab-badge" })
  const pinnedTabBadge = dom.createElement("span", { className: "tab-badge" })
  const allTab = dom.createElement("button", {
    className: "tab",
    onmouseover() {
      controller.maybeSyncInactiveChats()
    },
    onclick() {
      controller.selectedChatFolder("all")
    }
  }, "All")
  const myTab = dom.createElement("button", {
    className: "tab",
    onclick() {
      controller.selectedChatFolder("my")
    }
  }, "My", myTabBadge)
  const supervisedTab = dom.createElement("button", {
    className: "tab",
    onclick() {
      controller.selectedChatFolder("supervised")
    },
  }, "Supervised", supervisedTabBadge)
  const queuedTab = dom.createElement("button", {
    className: "tab",
    onclick() {
      controller.selectedChatFolder("queued")
    }
  }, "Queued", queuedTabBadge)
  const unassignedTab = dom.createElement("button", {
    className: "tab",
    onmouseover() {
      controller.maybeSyncPinnedChats()
    },
    onclick() {
      controller.selectedChatFolder("unassigned")
    }
  }, "Unassigned", pinnedTabBadge)
  const archivedTab = dom.createElement("button", {
    className: "tab",
    onclick() {
      controller.selectedChatFolder("archived")
    },
    onmouseover() {
      controller.maybeSyncArchivedChats()
    }
  }, "Archived")
  const el = dom.createElement("div", { className: "tabs flex-shrink-0 border-bottom" },
    allTab,
    myTab,
    supervisedTab,
    queuedTab,
    unassignedTab,
    archivedTab,
  )
  const storeListener = store.connect(function (state) {
    return {
      selectedChatFolder: state.selectedChatFolder,
      selectedChatId: state.selectedChatId,
      queuedChatIds: state.queuedChatIds,
      supervisedChatIds: state.supervisedChatIds,
      unassignedChatIds: state.unassignedChatIds,
      countMyUnseenChats: countUnseenChats(state.myChatIds),
      countUnseenSupervisedChats: countUnseenChats(state.supervisedChatIds),
      countQueuedUnseenChats: countUnseenChats(state.queuedChatIds),
      countPinnedUnseenChats: countUnseenChats(state.pinnedChatIds),
    }

    function countUnseenChats(chatIds: string[]) {
      return chatIds.reduce(function (count, chatId) {
        const chat = state.chats.get(chatId)

        if (chat && state.myProfile && helpers.hasUnreadMessages(chat, state.myProfile.id)) {
          return count + 1
        }

        return count
      }, 0)
    }
  }, function (props) {
    allTab.classList.toggle("active", props.selectedChatFolder === "all")
    myTab.classList.toggle("active", props.selectedChatFolder === "my")
    supervisedTab.classList.toggle("active", props.selectedChatFolder === "supervised")
    supervisedTab.classList.toggle("hidden", props.supervisedChatIds.length === 0 && props.selectedChatFolder !== "supervised")
    queuedTab.classList.toggle("active", props.selectedChatFolder === "queued")
    queuedTab.classList.toggle("hidden", props.queuedChatIds.length === 0 && props.selectedChatFolder !== "queued")
    unassignedTab.classList.toggle("active", props.selectedChatFolder === "unassigned")
    // unassignedTab.classList.toggle("hidden", props.unassignedChatIds.size === 0 && props.selectedChatFolder !== "unassigned")
    archivedTab.classList.toggle("active", props.selectedChatFolder === "archived")
    myTabBadge.textContent = String(props.countMyUnseenChats)
    myTabBadge.classList.toggle("d-none", props.countMyUnseenChats === 0)
    supervisedTabBadge.textContent = String(props.countUnseenSupervisedChats)
    supervisedTabBadge.classList.toggle("d-none", props.countUnseenSupervisedChats === 0)
    queuedTabBadge.textContent = String(props.countQueuedUnseenChats)
    queuedTabBadge.classList.toggle("d-none", props.countQueuedUnseenChats === 0)
    pinnedTabBadge.textContent = String(props.countPinnedUnseenChats)
    pinnedTabBadge.classList.toggle("d-none", props.countPinnedUnseenChats === 0)

  })

  return options.ref.current = {
    el,
    dispose
  }

  function dispose() {
    storeListener()
    allTab.onmouseover = null
    allTab.onclick = null
    myTab.onclick = null
    supervisedTab.onclick = null
    queuedTab.onclick = null
    unassignedTab.onclick = null
    archivedTab.onclick = null
  }
}

interface ChatListView {
  el: HTMLDivElement
  dispose(): void
}

interface ChatListViewOptions {
  ref: dom.Ref<ChatListView>
}

function createChatListView(options: ChatListViewOptions): ChatListView {
  const controller = $Controller()
  const el = dom.createElement("div", { className: "chats-lists" })
  const emptyStateEl = dom.createElement("div", { className: "chats-list-empty hidden" }, "Nothing interesting here yet...")
  const loaderEl = dom.createElement("div", { className: "sticky-center hidden" },
    dom.createElement("div", { className: "loader" })
  )
  const allChatsList = dom.createElement("div", { className: "chats-list" })
  const myChatsList = dom.createElement("div", { className: "chats-list" })
  const supervisedChatsList = dom.createElement("div", { className: "chats-list" })
  const queuedChatsList = dom.createElement("div", { className: "chats-list" })
  const unassignedChatsList = dom.createElement("div", { className: "chats-list" })
  const archivedChatsList = dom.createElement("div", { className: "chats-list" })
  // let loaderAllChats: HTMLDivElement
  // let loaderArchivedChats: HTMLDivElement

  el.append(
    emptyStateEl,
    loaderEl,
    allChatsList,
    myChatsList,
    supervisedChatsList,
    queuedChatsList,
    unassignedChatsList,
    archivedChatsList,
  )

  allChatsList.addEventListener("scroll", onAllChatsScroll, {
    passive: true
  })

  archivedChatsList.addEventListener("scroll", onArchivedChatsScroll, {
    passive: true
  })

  unassignedChatsList.addEventListener("scroll", onUnassignedChatsScroll, {
    passive: true
  })

  const storeListener = $Store().connect(function (state) {
    return {
      chats: state.chats,
      selectedChatFolder: state.selectedChatFolder,
      myChatIds: state.myChatIds,
      otherChatIds: state.otherChatIds,
      supervisedChatIds: state.supervisedChatIds,
      queuedChatIds: state.queuedChatIds,
      unassignedChatIds: state.unassignedChatIds,
      archivedChatIds: state.archivedChatIds,
      archivedChatsStatus: state.archivedChatsStatus,
      pinnedChatIds: state.pinnedChatIds,
      inactiveChatIds: state.inactiveChatIds,
      inactiveChatsStatus: state.inactiveChatsStatus,
    }
  }, function name(props) {
    allChatsList.classList.toggle("hidden", props.selectedChatFolder !== "all")
    myChatsList.classList.toggle("hidden", props.selectedChatFolder !== "my")
    supervisedChatsList.classList.toggle("hidden", props.selectedChatFolder !== "supervised")
    queuedChatsList.classList.toggle("hidden", props.selectedChatFolder !== "queued")
    unassignedChatsList.classList.toggle("hidden", props.selectedChatFolder !== "unassigned")
    archivedChatsList.classList.toggle("hidden", props.selectedChatFolder !== "archived")

    if (props.selectedChatFolder === "all") {
      const chatIds = helpers.unique(
        props.myChatIds,
        props.otherChatIds,
        props.supervisedChatIds,
        props.queuedChatIds,
        props.unassignedChatIds,
        props.inactiveChatIds,
      )

      updateAllChats(chatIds, props.chats, props.inactiveChatsStatus)
    }

    if (props.selectedChatFolder === "my") {
      updateMyChats(Array.from(props.myChatIds))
    }

    if (props.selectedChatFolder === "supervised") {
      updateSupervisedChats(Array.from(props.supervisedChatIds))
    }

    if (props.selectedChatFolder === "queued") {
      updateQueuedChats(Array.from(props.queuedChatIds))
    }

    if (props.selectedChatFolder === "unassigned") {
      updateUnassignedChats(helpers.unique(props.unassignedChatIds, props.pinnedChatIds), props.chats)
    }

    if (props.selectedChatFolder === "archived") {
      updateArchivedChats(props.archivedChatIds, props.archivedChatsStatus)
    }
  })

  return options.ref.current = {
    el,
    dispose
  }

  function dispose() {
    storeListener()
    allChatsList.removeEventListener("scroll", onAllChatsScroll)
    archivedChatsList.removeEventListener("scroll", onArchivedChatsScroll)
    unassignedChatsList.removeEventListener("scroll", onUnassignedChatsScroll)
    updateAllChats([], new Map(), "unknown")
    updateMyChats([])
    updateSupervisedChats([])
    updateQueuedChats([])
    updateUnassignedChats([], new Map())
    updateArchivedChats([], "unknown")
    el.remove()
  }

  function updateAllChats(chatIds: string[], chats: Map<string, v35.agent.Chat>, status: InactiveChatsStatus) {
    if (status === "fetching") {
      loaderEl.classList.remove("hidden")
      emptyStateEl.classList.add("hidden")

      return renderChatsList(archivedChatsList, [])
    }

    loaderEl.classList.add("hidden")
    emptyStateEl.classList.toggle("hidden", chatIds.length > 0)

    sortChatIdsByLastMessage(chatIds, chats)

    renderChatsList(allChatsList, chatIds)
  }

  function updateMyChats(chatIds: string[]) {
    loaderEl.classList.add("hidden")
    emptyStateEl.classList.toggle("hidden", chatIds.length > 0)

    renderChatsList(myChatsList, chatIds)
  }

  function updateSupervisedChats(chatIds: string[]) {
    loaderEl.classList.add("hidden")
    emptyStateEl.classList.toggle("hidden", chatIds.length > 0)

    renderChatsList(supervisedChatsList, chatIds)
  }

  function updateQueuedChats(chatIds: string[]) {
    loaderEl.classList.add("hidden")
    emptyStateEl.classList.toggle("hidden", chatIds.length > 0)

    renderChatsList(queuedChatsList, chatIds)
  }

  function updateUnassignedChats(chatIds: string[], chats: Map<string, v35.agent.Chat>) {
    loaderEl.classList.add("hidden")
    emptyStateEl.classList.toggle("hidden", chatIds.length > 0)

    sortChatIdsByLastMessage(chatIds, chats)

    renderChatsList(unassignedChatsList, chatIds)
  }

  function updateArchivedChats(chatIds: string[], status: ArchivedChatsStatus) {
    if (status === "fetching") {
      loaderEl.classList.remove("hidden")
      emptyStateEl.classList.add("hidden")

      return renderChatsList(archivedChatsList, [])
    }

    loaderEl.classList.add("hidden")
    emptyStateEl.classList.toggle("hidden", chatIds.length > 0)

    renderChatsList(archivedChatsList, chatIds)
  }

  function sortChatIdsByLastMessage(chatIds: string[], chats: Map<string, v35.agent.Chat>) {
    let aChat: v35.agent.Chat | undefined
    let bChat: v35.agent.Chat | undefined
    let aLastMessage: v35.agent.Event | void
    let bLastMessage: v35.agent.Event | void
    let aCreatedAt: number
    let bCreatedAt: number

    return chatIds.sort(function (a, b) {
      aChat = chats.get(a)
      bChat = chats.get(b)
      aLastMessage = aChat ? helpers.getChatLastMessage(aChat) : undefined
      bLastMessage = bChat ? helpers.getChatLastMessage(bChat) : undefined
      aCreatedAt = aLastMessage ? aLastMessage.created_at.getTime() : 0
      bCreatedAt = bLastMessage ? bLastMessage.created_at.getTime() : 0

      return bCreatedAt - aCreatedAt
    })
  }

  function renderChatsList(target: HTMLElement, chatIds: string[]) {
    list2<string, {
      view: ChatsListItemView
    }>({
      target,
      values: chatIds,
      key: chatId => chatId,
      enter(ctx) {
        ctx.view = new ChatsListItemView({ chatId: ctx.value })
        ctx.el = ctx.view.el
      },
      update() { },
      exit(ctx) {
        ctx.view.dispose()
        ctx.el.remove()
      }
    })
  }

  function onAllChatsScroll(event: Event) {
    if (helpers.isScrollReachedBottom(event)) {
      controller.maybeLoadMoreInactiveChats()
    }
  }

  function onArchivedChatsScroll(event: Event) {
    if (helpers.isScrollReachedBottom(event)) {
      controller.maybeLoadMoreArchivedChats()
    }
  }

  function onUnassignedChatsScroll(event: Event) {
    if (helpers.isScrollReachedBottom(event)) {
      controller.maybeLoadMorePinnedChats()
    }
  }
}

interface ChatSearchResultsView {
  el: HTMLDivElement
  dispose(): void
}

interface ChatSearchResultsViewOptions {
  ref: dom.Ref<ChatSearchResultsView>
}

function createChatSearchResultsView(options: ChatSearchResultsViewOptions) {
  const store = $Store()
  const controller = $Controller()
  const placeholderRef = dom.createRef<HTMLDivElement>()
  const recentRef = dom.createRef<HTMLDivElement>()
  const resultsRef = dom.createRef<HTMLDivElement>()
  const el = h("div", { className: "position-relative flex-basis-100 overflow-auto" },
    h("div", { className: "text-secondary text-center sticky-center", ref: placeholderRef }),
    h("div", { className: "list", ref: recentRef }),
    h("div", { className: "list", ref: resultsRef }),
  )

  const disconnect = store.connect(function (state) {
    return {
      searchMode: state.searchMode,
      searchQuery: state.searchQuery,
      searchResults: state.searchResults,
      searchErrorMessage: state.searchErrorMessage,
      searchRecentQueries: state.searchRecentQueries,
      searchSelectedResult: state.searchSelectedResult,
    }
  }, function (props) {
    if (props.searchMode === null) {
      return
    }

    placeholderRef.current.classList.toggle("d-none", !(
      (props.searchMode === "focus" && props.searchRecentQueries.length === 0) ||
      (props.searchMode === "searching") ||
      (props.searchMode === "results" && props.searchResults.length === 0) ||
      (props.searchMode === "error")
    ))

    if (props.searchMode === "focus" && props.searchRecentQueries.length === 0) {
      placeholderRef.current.innerText = "Search in the chats"
    }

    if (props.searchMode === "searching") {
      placeholderRef.current.innerText = "Searching..."
    }

    if (props.searchMode === "results" && props.searchResults.length === 0) {
      placeholderRef.current.innerText = `No results for "${props.searchQuery}"`
    }

    if (props.searchMode === "error") {
      placeholderRef.current.innerText = props.searchErrorMessage
    }

    recentRef.current.classList.toggle("hidden",
      props.searchMode !== "focus" || props.searchRecentQueries.length === 0
    )

    updateRecentQueries(recentRef.current, props.searchRecentQueries)

    resultsRef.current.classList.toggle("d-none", !(
      props.searchMode === "results" && props.searchResults.length > 0
    ))

    updateResults(resultsRef.current, props.searchResults, props.searchSelectedResult)
  })

  return options.ref.current = {
    el,
    dispose
  }

  function dispose() {
    disconnect()
    el.remove()
  }

  function updateRecentQueries(target: HTMLElement, queries: string[]) {
    list2<string, {
      btnRef: dom.Ref<HTMLButtonElement>
      labelRef: dom.Ref<HTMLSpanElement>
    }>({
      target,
      values: queries,
      key: query => query,
      enter(ctx) {
        ctx.btnRef = dom.createRef()
        ctx.labelRef = dom.createRef()
        ctx.el = h("div", {
          className: "list-action d-flex align-items-center justify-content-space-between",
          onclick() {
            controller.updateAndFocusChatSearchInput(ctx.value)
            controller.search(ctx.value)
          }
        },
          h("span", { ref: ctx.labelRef }, ctx.value),
          h("button", {
            type: "button",
            className: "btn-close",
            ref: ctx.btnRef,
            onclick(event) {
              event.preventDefault()
              event.stopPropagation()
              controller.deleteRecentSearchQuery(ctx.value)
            }
          })
        )
      },
      update(ctx) {
        ctx.labelRef.current.innerText = ctx.value
      },
      exit(ctx) {
        ctx.btnRef.current.onclick = null!
        ctx.btnRef.current = null!
        ctx.labelRef.current = null!
        ctx.el.remove()
      }
    })
  }

  function updateResults(target: HTMLElement, results: SearchResult[], searchSelectedResult: string | null) {
    list2<SearchResult, {
      listElRef: dom.Ref<HTMLDivElement>
      avatarViewRef: dom.Ref<AvatarView>
    }>({
      target,
      values: results,
      key: result => result?.id,
      enter(ctx) {
        ctx.listElRef = dom.createRef<HTMLDivElement>()
        ctx.avatarViewRef = dom.createRef<AvatarView>()
        ctx.el = h("div", {
          ref: ctx.listElRef,
          className: `list-action d-flex align-items-center ${searchSelectedResult === ctx.value.id ? "active" : ""}`,
          onclick() {
            controller.selectSearchResult(ctx.value)
          }
        },
          h("div", {},
            createAvatarView({
              ref: ctx.avatarViewRef,
              id: ctx.value.userId,
              size: 48,
              alt: ctx.value.userName,
              src: ctx.value.userAvatar || void 0
            }).el
          ),
          h("div", { className: "pl-2 mw-0" },
            h("div", { className: "text-bold text-ellipsis" }, ctx.value.userName),
            h("div", { className: "text-clamp-2" }, ctx.value.body),
          )
        )
      },
      update(ctx) {
        ctx.listElRef.current.classList.toggle("active", searchSelectedResult === ctx.value.id)
        ctx.avatarViewRef.current.update({
          id: ctx.value.userId,
          size: 48,
          alt: ctx.value.userName,
          src: ctx.value.userAvatar || void 0
        })
      },
      exit(ctx) {
        ctx.listElRef.current.onclick = null!
        ctx.listElRef.current = null!
        ctx.avatarViewRef.current.dispose()
        ctx.avatarViewRef.current = null!
        ctx.el.remove()
      }
    })
  }
}

/**
 * This view handle only child content. the wrapper should be passed from outside
 */

interface ChatsListItemProps {
  chatId: string
}

interface ChatsListItemConnectedProps {
  chat?: v35.agent.Chat
  myProfileId?: string
  selectedChatId: string | null
}

class ChatsListItemView {
  el: HTMLDivElement
  chatRoute: ChatRoute | void
  itemAvatarEl: HTMLDivElement
  itemAvatar: AvatarView | null
  chatSummaryEl: Element
  chatTitle: Element
  chatMeta: Element
  lastMessageEl: Element
  badgeEl: Element
  storeListener: () => void
  clickListener: Unsubscriber
  chatRouteListener: Unsubscriber
  connectedProps?: ChatsListItemConnectedProps

  constructor(
    protected props: ChatsListItemProps,
    protected store = $Store(),
    protected controller = $Controller(),
    protected chatRouter = $ChatRouter(),
  ) {
    this.itemAvatar = null
    this.el = dom.createElement("div", { className: "chats-list-item", },
      this.itemAvatarEl = dom.createElement("div", { className: "chat-list-item-avatar" }),
      this.chatSummaryEl = dom.createElement("div", { className: "chat-item-caption", },
        dom.createElement("div", { className: "chat-item-title", },
          this.chatTitle = dom.createElement("div", { className: "chat-item-name text-ellipsis", textContent: "Unnamed visitor" }),
          this.chatMeta = dom.createElement("div", { className: "chat-item-meta" })
        ),
        dom.createElement("div", { className: "chat-item-subtitle" },
          this.lastMessageEl = dom.createElement("div", { className: "chat-item-last-message" }),
          this.badgeEl = dom.createElement("div", { className: "chat-item-badge" })
        )
      ),
    )

    this.clickListener = dom.addListener(this.el, "click", () => this.selectChat())
    this.chatRoute = this.controller.getCurrentChatRoute(props.chatId)

    this.storeListener = store.lazyConnect<ChatsListItemConnectedProps>(
      state => this.storeMapper(state),
      props => this.render(props)
    )

    this.chatRouteListener = this.chatRouter.onChatRouteChange(transition => {
      if (transition.chatId === props.chatId) {
        this.chatRoute = transition.finalChatRoute

        if (this.connectedProps) {
          this.render(this.connectedProps)
        }
      }
    })
  }

  dispose() {
    this.storeListener()
    this.clickListener()
    this.chatRouteListener()
    this.itemAvatar?.dispose()
    this.el.remove()
  }

  selectChat() {
    this.controller.selectChat(this.props.chatId)
  }

  protected render(props: ChatsListItemConnectedProps) {
    if (props.chat) {
      const user = helpers.getChatRecipient(props.chat.users)
      const lastMessage = helpers.getChatLastMessage(props.chat)
      let unseenMessagesCount = 0

      if (props.myProfileId) {
        unseenMessagesCount = helpers.countUnseenMessages(props.chat, props.myProfileId)
      }

      if (user && !this.itemAvatar) {
        this.itemAvatarEl.append(
          (
            this.itemAvatar = createAvatarView({
              id: user.id,
              size: 48,
              alt: user.name,
              src: user.avatar
            })
          ).el
        )
      }
      else if (user && this.itemAvatar) {
        this.itemAvatar.update({
          id: user.id,
          size: 48,
          alt: user.name,
          src: user.avatar,
        })

      }

      if (user) {
        this.chatTitle.textContent = user.name
      }
      else {
        this.chatTitle.textContent = "Unnamed visitor"
      }

      if (this.chatRoute === "queued") {
        this.lastMessageEl.textContent = `Waiting in a queue`
      }
      else if (this.chatRoute === "unassigned") {
        this.lastMessageEl.textContent = `Unassigned chat waiting for reply`
      }
      else if (lastMessage) {
        this.lastMessageEl.textContent = helpers.stringifyChatEntity(lastMessage)
      }

      this.badgeEl.classList.toggle("d-none", unseenMessagesCount === 0)
      this.badgeEl.textContent = String(unseenMessagesCount)
    }

    // update selected item
    if (this.props.chatId === props.selectedChatId) {
      this.el.classList.add("selected")
    }
    else {
      this.el.classList.remove("selected")
    }
  }

  protected storeMapper(state: State): ChatsListItemConnectedProps {
    return {
      chat: state.chats.get(this.props.chatId),
      myProfileId: state.myProfile?.id,
      selectedChatId: state.selectedChatId,
    }
  }
}

interface ChatsView {
  el: HTMLElement
  dispose(): void
}

interface ChatsViewOptions {
  ref?: dom.Ref<ChatsView>
}

function createChatsView(options?: ChatsViewOptions): ChatsView {
  const store = $Store()
  const lruCache = new helpers.LRUCache<ChatView>(10)
  const el = h("div", { className: "chats" })

  const lruCacheListener = lruCache.addListener("removed", function (chatView) {
    chatView.dispose()
  })

  const storeListener = store.connect(function (state) {
    return {
      selectedChatId: state.selectedChatId
    }
  }, render)

  const self: ChatsView = {
    el,
    dispose
  }

  if (options?.ref) {
    options.ref.current = self
  }

  return self

  function dispose() {
    lruCache.dispose()
    lruCacheListener()
    storeListener()
    el.remove()
  }

  function render(props: {
    selectedChatId: string | null
  }) {
    if (!props.selectedChatId) {
      el.classList.add("chats--empty")
    }
    else {
      el.classList.remove("chats--empty")
    }

    if (props.selectedChatId) {
      let chatView = getChatViewInstance(props.selectedChatId)

      // hide other ChatViews
      lruCache.forEach(function (v) {
        if (v === chatView) {
          v.show()
        }
        else {
          v.hide()
        }
      })
    }
    else {
      lruCache.forEach(function (v) {
        v.hide()
      })
    }
  }

  function getChatViewInstance(chatId: string): ChatView {
    let chatView = lruCache.get(chatId)

    if (chatView) {
      return chatView
    }

    chatView = createChatView({ chatId })

    el.append(chatView.el)

    lruCache.set(chatId, chatView)

    return chatView
  }
}


interface ChatView {
  el: HTMLElement
  dispose(): void
  show(): void
  hide(): void
  highlightEvent(eventId: string): void
}

interface ChatViewOptions {
  chatId: string
  ref?: dom.Ref<ChatView>
}

function createChatView(options: ChatViewOptions) {
  const controller = $Controller()
  const abort = new AbortController()
  const chatId = options.chatId
  const chatRef = dom.createRef<ChatFeedView>()
  const detailsRef = dom.createRef<CustomerDetailsView>()

  const el = h("div", { className: "chat" },
    createChatFeedView({ chatId, ref: chatRef }).el,
    createCustomerDetailsView({ chatId, ref: detailsRef }).el
  )

  const self: ChatView = {
    el,
    dispose,
    show,
    hide,
    highlightEvent,
  }

  if (options?.ref) {
    options.ref.current = self
  }

  return self

  function dispose() {
    if (controller.visibleChatViewRef.current === self) {
      controller.visibleChatViewRef.current = null!
    }
    abort.abort()
    chatRef.current.dispose()
    chatRef.current = null!
    detailsRef.current.dispose()
    detailsRef.current = null!
    el.remove()
  }

  function show() {
    el.classList.remove("hidden")
    controller.visibleChatViewRef.current = self
  }

  function hide() {
    el.classList.add("hidden")
  }

  function highlightEvent(eventId: string) {
    chatRef.current.highlightEvent(eventId)
  }
}

interface ChatFeedView {
  el: HTMLDivElement
  dispose(): void
  highlightEvent(eventId: string): void
}

interface ChatFeedViewProps {
  chatId: string
  ref: dom.Ref<ChatFeedView>
}

function createChatFeedView(props: ChatFeedViewProps) {
  const chatBodyRef = dom.createRef<ChatBodyView>()
  const chatHeaderRef = dom.createRef<ChatHeaderView>()
  const chatFooterRef = dom.createRef<ChatFooter>()

  const el = h("div", {
    className: "chat-feed"
  },
    createChatHeaderView({
      chatId: props.chatId,
      ref: chatHeaderRef
    }).el,
    (createChatBodyView({
      chatId: props.chatId,
      ref: chatBodyRef
    })).el,
    createChatFooter({
      chatId: props.chatId,
      ref: chatFooterRef,
    }).el,
  )

  return props.ref.current = {
    el,
    dispose,
    highlightEvent
  }

  function dispose() {
    chatHeaderRef.current.dispose()
    chatHeaderRef.current = null!
    chatBodyRef.current.dispose()
    chatBodyRef.current = null!
    chatFooterRef.current.dispose()
    chatFooterRef.current = null!
    el.remove()
  }

  function highlightEvent(eventId: string) {
    chatBodyRef.current.highlightEvent(eventId)
  }
}

interface ChatHeaderView {
  el: HTMLDivElement
  dispose(): void
}

function createChatHeaderView(props: {
  chatId: string
  ref: dom.Ref<ChatHeaderView>
}) {
  const commands = $CommandsController()
  let el: HTMLDivElement
  let headerAvatarEl: HTMLDivElement
  let headerAvatar: AvatarView | null = null
  const headerTitleRef = dom.createRef<HTMLDivElement>()

  el = h("div", { className: "chat-header" },
    headerAvatarEl = h("div", { className: "chat-header-avatar" }),
    h("div", { className: "chat-header-details" },
      h("div", { className: "chat-header-title text-ellipsis", ref: headerTitleRef })
    ),
    h("div", { className: "chat-header-menu" },
      h("div", { className: "chat-header-more-button" },
        h("button", {
          className: "chat-header-more-label",
          textContent: "More",
          onclick() {
            commands.show()
          }
        })
      ),
    )
  )

  const disconnectStore = $Store().lazyConnect(
    function (state: State) {
      const chat = state.chats.get(props.chatId)
      const user = chat ? helpers.getChatRecipient(chat.users) : void 0

      return { user }
    },
    function (props) {
      if (props.user && !headerAvatar) {
        headerAvatarEl.append(
          (
            headerAvatar = createAvatarView({
              id: props.user.id,
              size: 36,
              alt: props.user.name,
              src: props.user.avatar
            })
          ).el
        )
      }

      if (props.user) {
        headerTitleRef.current.textContent = props.user.name
      }
    }
  )

  return props.ref.current = {
    el,
    dispose
  }

  function dispose() {
    disconnectStore()
    headerTitleRef.current = null!
    headerAvatar?.dispose()
    el.remove()
  }
}

interface ChatFooter {
  el: HTMLDivElement
  dispose(): void
}

function createChatFooter(props: {
  readonly chatId: string
  ref: dom.Ref<ChatFooter>
}) {
  const el = dom.createElement("div", { className: "chat-footer" })
  const chatRouter = $ChatRouter()
  let composer: ComposerView | null = null
  let chatQuickActions: ChatQuickActions | null = null

  const unsubscribe = chatRouter.onChatRouteChange(function (event) {
    if (event.chatId === props.chatId) {
      updateContent(event.finalChatRoute)
    }
  });

  const chatRoute = $Controller().getCurrentChatRoute(props.chatId)

  if (chatRoute) {
    updateContent(chatRoute)
  }

  return props.ref.current = {
    el,
    dispose
  }

  function dispose() {
    unsubscribe()
    composer?.dispose()
    chatQuickActions?.dispose()
    el.remove()
  }

  function updateContent(chatRoute: ChatRoute) {
    const visibleComposer = chatRoute === "my" || chatRoute === "supervised"

    toggleComposer(visibleComposer)
    toggleChatQuickActions(!visibleComposer)
  }

  function toggleComposer(force: boolean) {
    if (force && !composer) {
      composer = createComposerView({
        chatId: props.chatId
      })
      el.append(composer.el)
    }

    if (!force && composer) {
      composer.dispose()
      composer = null
    }
  }

  function toggleChatQuickActions(force: boolean) {
    if (force && !chatQuickActions) {
      chatQuickActions = createChatQuickActions({ chatId: props.chatId })
      el.append(chatQuickActions.el)
    }

    if (!force && chatQuickActions) {
      chatQuickActions.dispose()
      chatQuickActions = null
    }
  }
}

interface ChatBodyView {
  el: HTMLDivElement
  dispose(): void
  highlightEvent(eventId: string): void
}

interface ChatBodyViewProps {
  chatId: string
  ref: dom.Ref<ChatBodyView>
}

function createChatBodyView(props: ChatBodyViewProps): ChatBodyView {
  const store = $Store()
  const controller = $Controller()
  const messagesElRef = dom.createRef<HTMLDivElement>()
  const onThrottledScrollMessages = helpers.throttle(onScrollMessages, 200)
  const el = h("div", { className: "chat-body" },
    h("div", { className: "messages", ref: messagesElRef })
  )

  el.addEventListener("scroll", onThrottledScrollMessages, {
    passive: true
  })

  const reverseScroll = ReverseScroll.create(el, messagesElRef.current)
  const storeListener = store.connect(state => {
    return {
      chat: state.chats.get(props.chatId),
      myProfileId: state.myProfile?.id,
      sneakPeak: state.sneakPeeks.get(props.chatId),
      messageStatuses: state.messageStatuses,
      filesUpload: state.filesUpload,
    }
  }, function (props) {
    if (!props.chat || !props.myProfileId) {
      return
    }

    const messages = helpers.getChatEntities(props.chat, props.sneakPeak)

    renderMessages(messages, props.messageStatuses, props.chat, props.myProfileId, props.filesUpload)

    onThrottledScrollMessages()
  })

  const self: ChatBodyView = {
    el,
    dispose,
    highlightEvent,
  }

  if (props.ref) {
    props.ref.current = self
  }

  return self

  function dispose() {
    onThrottledScrollMessages.cancel()
    el.removeEventListener("scroll", onThrottledScrollMessages)
    storeListener()
    reverseScroll.dispose()
    el.remove()
  }

  function renderMessages(
    chatEntities: ChatEntity[],
    messageStatuses: Map<string, MessageStatus>,
    chat: v35.agent.Chat,
    myProfileId: string,
    filesUpload: Map<string, [ProgressSignal, AbortController]>
  ) {
    const users = helpers.mapBy(chat.users, "id")
    const customer = helpers.getChatRecipient(chat.users)

    list2<ChatEntity, {
      view: MessageView<ChatEntity>
    }>({
      target: messagesElRef.current,
      values: chatEntities,
      key: m => m?.id,
      enter(ctx) {
        const fileUpload = ctx.value.type === "file" && ctx.value.custom_id ? filesUpload.get(ctx.value.custom_id) : null

        ctx.view = factoryMessageView({
          message: ctx.value,
          nextMessage: chatEntities[ctx.index + 1],
          prevMessage: chatEntities[ctx.index - 1],
          myProfileId: myProfileId,
          author: getAuthor(ctx.value),
          messageStatus: getMessageStatus(ctx.value),
          isMessageSeen: isMessageSeen(ctx.value),
          abortController: fileUpload ? fileUpload[1] : null,
          progressSignal: fileUpload ? fileUpload[0] : null,
        })

        ctx.el = ctx.view.el
      },
      update(ctx) {
        const fileUpload = ctx.value.type === "file" && ctx.value.custom_id ? filesUpload.get(ctx.value.custom_id) : null

        ctx.view.update({
          message: ctx.value,
          nextMessage: chatEntities[ctx.index + 1],
          prevMessage: chatEntities[ctx.index - 1],
          myProfileId,
          author: getAuthor(ctx.value),
          messageStatus: getMessageStatus(ctx.value),
          isMessageSeen: isMessageSeen(ctx.value),
          abortController: fileUpload ? fileUpload[1] : null,
          progressSignal: fileUpload ? fileUpload[0] : null,
        })
      },
      exit(ctx) {
        ctx.view.dispose()
        ctx.view = null!
        ctx.el.remove()
      }
    })

    function getAuthor(message: ChatEntity) {
      if (message.type !== "system_message" && message.type !== "restricted_thread" && message.type !== "chat_gap") {
        return users.get(message.author_id)
      }
    }

    function isMessageSeen(message: ChatEntity) {
      if (message.type === "system_message" || message.type === "chat_gap" || message.type === "sneak_peek" || message.type === "restricted_thread") {
        return false
      }

      if (message.author_id !== myProfileId) {
        return false
      }

      if (customer && customer.events_seen_up_to.getTime() >= message.created_at.getTime()) {
        return true
      }

      return false
    }

    function getMessageStatus(message: ChatEntity) {
      if ((message.type === "message" || message.type === "file") && message.custom_id) {
        return messageStatuses.get(message.custom_id)
      }
    }
  }

  function onScrollMessages() {
    const clientHeight = el.clientHeight
    const children = messagesElRef.current.children as HTMLCollectionOf<ElementWithContext<BaseContext<ChatEntity>>>
    let child: ElementWithContext<BaseContext<ChatEntity>>
    let d: ChatEntity | undefined
    let i: number

    for (i = children.length - 1; i >= 0; i--) {
      child = children[i]
      d = child.$context.value

      if (!d) {
        continue
      }

      if (d.type === "chat_gap") {
        const rect = child.getBoundingClientRect()

        if (rect.top >= 0 && rect.bottom <= clientHeight) {
          controller.maybeSyncChatGap(props.chatId, d, {
            onLoad: reverseScroll.stickToCurrent
          })
        }

        continue
      }

      if (d.type === "file" ||
        d.type === "form" ||
        d.type === "filled_form" ||
        d.type === "message" ||
        d.type === "rich_message"
      ) {
        const rect = child.getBoundingClientRect()

        if (rect.top >= 0 && rect.bottom <= clientHeight) {
          controller.maybeMarkEventsAsSeen(props.chatId, d)
        }

        continue
      }
    }
  }

  function highlightEvent(eventId: string) {
    for (let i = 0; i < messagesElRef.current.children.length; i++) {
      const messageEl = messagesElRef.current.children[i] as ElementWithContext<
        BaseContext<ChatEntity> & { view: MessageView }
      >

      const messageData = messageEl.$context.value
      const messageView = messageEl.$context.view

      if (!messageData || !messageView) {
        continue
      }

      if (messageData.type === "message" && messageData.id === eventId) {
        return messageView.highlight()
      }
    }
  }
}

/**
 * Composer View
 */

type ComposerView = ReturnType<typeof createComposerView>

let composerCounter = 0

function createComposerView(props: {
  chatId: string
}) {
  const store = $Store()
  const composerId = `composer_${++composerCounter}`
  const controller = $Controller()
  const chatRouter = $ChatRouter()
  const inputContainerRef = dom.createRef<HTMLLabelElement>()
  const inputRef = dom.createRef<HTMLTextAreaElement>()
  const sendButtonRef = dom.createRef<HTMLButtonElement>()
  const fileInputRef = dom.createRef<HTMLInputElement>()
  let chatRoute: ChatRoute
  let chatGroupIds: number[] = [0]
  const composerActions = new ComposerActions({ items: [] })
  const listeners = helpers.createUnsubscribers()
  let autoResize: AutoResize | null = null
  let autocompleteKey = ""
  let autocompleteQuery = ""
  let cannedResponses: Record<number, rest.CannedResponse[]>
  const el = h("div", { className: "composer" },
    composerActions.el,

    h("div", { className: "d-flex flex-direction-row" },
      h("label", { className: "composer-file" },
        icons.createAttachIcon({ size: 21 }),
        h("input", {
          type: "file",
          multiple: true,
          className: "composer-file-input",
          onchange: handleChangeFileInput,
          ref: fileInputRef
        })
      ),

      h("label", {
        htmlFor: composerId,
        className: "composer-label",
        ref: inputContainerRef
      },
        h("textarea", {
          id: composerId,
          rows: 1,
          className: "composer-input",
          placeholder: "Write a message...",
          ref: inputRef
        }),
        h("button", {
          className: "composer-send",
          ref: sendButtonRef,
          disabled: true
        },
          createIconEl({ name: "arrow-right-circle", size: "1.5em" })
        )
      )
    )
  )

  if (inputRef.current) {
    autoResize = createAutoResize(inputRef.current)

    inputRef.current.onkeydown = function (event) {
      handleKeyDown(event)
      render()
    }

    inputRef.current.onkeyup = function (event) {
      handleKeyUp(event)
      render()
    }
  }

  if (sendButtonRef.current) {
    listeners.add(dom.addListener(sendButtonRef.current, "click", function () {
      handleSend()
    }))
  }

  listeners.add(chatRouter.onChatRouteChange(function (t) {
    if (t.chatId === props.chatId) {
      chatRoute = t.finalChatRoute
      render()
    }
  }))

  listeners.add(composerActions.addListener("selected", function (item) {
    if (autocompleteKey.length > 0) {
      replaceAutocompleteQuery(item.text)
      render()
    }
  }))

  const disconnectStore = $Store().lazyConnect(
    state => {
      const chat = state.chats.get(props.chatId)

      return {
        cannedResponses: state.cannedResponses,
        chatGroupIds: chat?.access.group_ids
      }
    },
    props => {
      cannedResponses = props.cannedResponses
      chatGroupIds = props.chatGroupIds || [0]
      render()
    }
  )

  return {
    el,
    dispose
  }

  function dispose() {
    disconnectStore()

    if (autoResize) {
      autoResize.dispose()
    }

    listeners.removeAll()

    if (inputContainerRef.current) {
      inputContainerRef.current = null!
    }

    if (inputRef.current) {
      inputRef.current.onkeydown = null
      inputRef.current.onkeyup = null
      inputRef.current = null!
    }

    if (sendButtonRef.current) {
      sendButtonRef.current = null!
    }

    el.remove()
  }

  function replaceAutocompleteQuery(text: string) {
    const input = inputRef.current

    if (!input) {
      return
    }

    const start = (input.selectionStart ?? 0) - autocompleteKey.length - autocompleteQuery.length + text.length

    input.value = input.value.replace(autocompleteKey + autocompleteQuery, text);
    input.setSelectionRange(start, start)
    autocompleteKey = ""
    autocompleteQuery = ""
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (autocompleteKey.length > 0) {
      composerActions.handleKeyDown(event)
    }

    if (event.defaultPrevented) {
      return // Do nothing if event already handled
    }

    if (event.key === "Enter" && event.shiftKey === false) {
      event.preventDefault()
      handleSend()
      return
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (!inputRef.current) {
      return
    }

    const value = inputRef.current.value
    const selectionStart = inputRef.current.selectionStart || 0
    const autocomplete = helpers.extractAutocompleteQuery(value, selectionStart)

    autocompleteKey = autocomplete.key
    autocompleteQuery = autocomplete.query

    if (autocompleteKey.length > 0) {
      composerActions.handleKeyUp(event)
    }

    if (sendButtonRef.current) {
      sendButtonRef.current.disabled = value.length === 0
    }

    if (event.defaultPrevented) {
      return // Do nothing if event already handled
    }
  }

  function handleSend() {
    if (!inputRef.current) {
      return
    }

    const text = inputRef.current.value.trim()

    if (text.length === 0) {
      return // nothing to send
    }

    controller.sendTextMessage(props.chatId, text, "all")

    inputRef.current.value = ""

    if (autoResize) {
      autoResize.resize()
    }
  }

  function handleChangeFileInput(event: Event) {
    if (!fileInputRef.current) {
      return
    }

    const files = fileInputRef.current.files

    if (!files) {
      return
    }

    store.dispatch({
      openModal: {
        type: "file-upload-modal",
        chatId: props.chatId,
        files: Array.from(files)
      }
    })

    fileInputRef.current.value = "";
  }

  function render() {
    if (autocompleteKey.length > 0) {
      const groupIds = helpers.unique([0], chatGroupIds)

      let items = groupIds
        .map(groupId => cannedResponses[groupId])
        .reduce<ComposerActionsListItem[]>((prev, curr) => {
          if (Array.isArray(curr)) {
            for (let i = 0; i < curr.length; i++) {
              const cannedResponse = curr[i];
              const tagsStr = cannedResponse.tags.map(v => `#${v}`).join(", ")

              prev.push({
                id: String(cannedResponse.id),
                title: tagsStr,
                text: cannedResponse.text,
              })
            }
          }

          return prev
        }, [])

      if (autocompleteQuery.length > 0) {
        items = items.filter(item => item.title.includes(autocompleteQuery));
      }

      composerActions.setProps({ items })

      composerActions.toggle(autocompleteKey.length > 0 && items.length > 0)
    }
  }
}

type ChatQuickActions = ReturnType<typeof createChatQuickActions>

function createChatQuickActions(props: {
  readonly chatId: string
}) {
  const el = dom.createElement("div", { className: "chat-quick-actions" })
  const assignToMeBtn = dom.createElement("button", { className: "chat-quick-action" }, "Assign to me")
  const superviseBtn = dom.createElement("button", { className: "chat-quick-action" }, "Supervise")
  const takeOverBtn = dom.createElement("button", { className: "chat-quick-action" }, "Take over")
  const ctrl = $Controller()
  const unsubscribe = $ChatRouter().onChatRouteChange(function (event) {
    if (event.chatId === props.chatId) {
      update(event.finalChatRoute)
    }
  })

  const currChatRoute = $Controller().getCurrentChatRoute(props.chatId)

  if (currChatRoute) {
    update(currChatRoute)
  }

  el.append(
    assignToMeBtn,
    superviseBtn,
    takeOverBtn,
  )

  assignToMeBtn.onclick = assignToMe
  superviseBtn.onclick = supervise
  takeOverBtn.onclick = takeOver

  return {
    el,
    dispose
  }

  function dispose() {
    unsubscribe()
    assignToMeBtn.onclick = null!
    superviseBtn.onclick = null!
    takeOverBtn.onclick = null!
    el.remove()
  }

  function update(chatRoute: ChatRoute) {
    assignToMeBtn.classList.toggle("hidden", !(
      chatRoute === "unassigned" || chatRoute === "pinned" || chatRoute === "queued" || chatRoute === "closed"
    ))
    superviseBtn.classList.toggle("hidden", !(chatRoute == "other"))
    takeOverBtn.classList.toggle("hidden", !(chatRoute == "other"))
  }

  function assignToMe() {
    ctrl.assignChatToMe(props.chatId)
  }

  function supervise() {
    ctrl.startSuperviseChat(props.chatId)
  }

  function takeOver() {
    ctrl.takeOverChat(props.chatId)
  }
}

interface ComposerActionsListItem {
  id: string
  title: string
  text: string
}

interface ComposerActionsProps {
  items: ComposerActionsListItem[]
}

interface ComposerActionsEvents {
  selected(item: ComposerActionsListItem): void
}

class ComposerActions extends helpers.TypedEventEmitter<ComposerActionsEvents> {
  el: HTMLDivElement
  listEl: HTMLDivElement
  selectedItem: number

  constructor(protected props: ComposerActionsProps) {
    super()

    this.el = dom.createElement("div", { className: "composer-actions" },
      this.listEl = dom.createElement("div", { className: "composer-actions-list" })
    )
    this.selectedItem = 0
    this.render()
  }

  dispose() {
    this.el.remove()
  }

  setProps(props: ComposerActionsProps) {
    if (this.props.items.length !== props.items.length) {
      this.selectedItem = 0
    }

    this.props = props

    this.render()
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.code === "ArrowDown") {
      this.updateSelectedItem(1)
      this.render()
      event.preventDefault()
    }

    if (event.code === "ArrowUp") {
      this.updateSelectedItem(-1)
      this.render()
      event.preventDefault()
    }
  }

  handleKeyUp(event: KeyboardEvent) {
    if (event.code === "Enter") {
      this.emit("selected", this.props.items[this.selectedItem])
      event.preventDefault()
    }
  }

  toggle(isShown: boolean) {
    dom.toggleEl(this.el, isShown)
  }

  protected updateSelectedItem(offset: number) {
    this.selectedItem += offset

    if (this.selectedItem < 0) {
      this.selectedItem = this.props.items.length - 1
    }

    if (this.selectedItem > this.props.items.length - 1) {
      this.selectedItem = 0
    }
  }

  protected render() {
    const that = this

    list2<ComposerActionsListItem, { el: HTMLDivElement }>({
      target: this.listEl,
      values: this.props.items,
      key: d => d?.id,
      enter(ctx) {
        const classNames = helpers.cx("composer-action", {
          active: that.selectedItem === ctx.index
        })
        const item = dom.createElement("div", { className: classNames },
          dom.createElement("div", { className: "composer-action-title", textContent: ctx.value.title }),
          dom.createElement("div", { className: "composer-action-text", textContent: ctx.value.text })
        )

        item.onclick = function () {
          that.emit("selected", ctx.value)
        }

        ctx.el = item
      },
      update(ctx) {
        const selected = that.selectedItem === ctx.index

        ctx.el.classList.toggle("active", selected)

        if (selected) {
          ctx.el.scrollIntoView({ block: "nearest" })
        }
      },
      exit(ctx) {
        ctx.el.oninput = null!
        ctx.el.remove()
      }
    })
  }
}

export interface MessageView<T = ChatEntity> {
  el: HTMLElement
  dispose(): void
  highlight(): void
  update(props: MessageViewProps<T>): void
}

export interface MessageViewProps<T = ChatEntity> {
  message: T
  prevMessage: ChatEntity | null
  nextMessage: ChatEntity | null
  myProfileId: string
  author?: v35.agent.User
  messageStatus?: MessageStatus
  isMessageSeen: boolean
  abortController: AbortController | null
  progressSignal: ProgressSignal | null
}

export function factoryMessageView(props: MessageViewProps<ChatEntity>): MessageView<ChatEntity> {
  const message = props.message
  const nextMessage = props.nextMessage
  const prevMessage = props.prevMessage
  const author = props.author
  const myProfileId = props.myProfileId
  const isMessageSeen = props.isMessageSeen
  const abortSignal = props.abortController
  const progressSignal = props.progressSignal

  if (message.type === "message") {
    return createTextMessageView({ message, nextMessage, prevMessage, author, myProfileId, isMessageSeen, abortController: abortSignal, progressSignal })
  }

  if (message.type === "file") {
    return createFileMessageView({ message, nextMessage, prevMessage, author, myProfileId, isMessageSeen, abortController: abortSignal, progressSignal })
  }

  if (message.type === "filled_form") {
    return createFilledFormMessageView({ message, nextMessage, prevMessage, author, myProfileId, isMessageSeen, abortController: abortSignal, progressSignal })
  }

  if (message.type === "rich_message") {
    return createRichMessageMessageView({ message, nextMessage, prevMessage, author, myProfileId, isMessageSeen, abortController: abortSignal, progressSignal })
  }

  if (message.type === "system_message") {
    return createSystemMessageView({ message, nextMessage, prevMessage, author, myProfileId, isMessageSeen, abortController: abortSignal, progressSignal })
  }

  if (message.type === "restricted_thread") {
    return createRestrictedThreadMessageView({ message, nextMessage, prevMessage, author, myProfileId, isMessageSeen, abortController: abortSignal, progressSignal })
  }

  if (message.type === "chat_gap") {
    return createChatGapMessageView({ message, nextMessage, prevMessage, author, myProfileId, isMessageSeen, abortController: abortSignal, progressSignal })
  }

  if (message.type === "sneak_peek") {
    return createSneakPeekMessageView({ message, nextMessage, prevMessage, author, myProfileId, isMessageSeen, abortController: abortSignal, progressSignal })
  }

  return createUnsupportedMessageView({ message, nextMessage, prevMessage, author, myProfileId, isMessageSeen, abortController: abortSignal, progressSignal })
}

function createTextMessageView(props: MessageViewProps<v35.agent.MessageEvent>): MessageView<v35.agent.MessageEvent> {
  const avatarViewRef = dom.createRef<AvatarView>()
  const messageIndicatorRef = dom.createRef<MessageIndicatorView>()
  const myMessage = props.author?.id === props.myProfileId
  const el = h("div", { className: `message ${myMessage ? "right" : "left"}` },
    props.author && !myMessage && h("div", {
      className: "message-avatar",
    },
      createAvatarView({
        id: props.author.id,
        alt: props.author.name,
        src: props.author.avatar,
        size: 36,
        ref: avatarViewRef
      }).el
    ),
    h("div", { className: "message-bubble" },
      !myMessage && props.author && h("div", {
        className: "text-small text-secondary text-ellipsis"
      }, props.author.name),
      h("div", { className: "message-text" },
        props.message.text,
        createMessageIndicatorView({
          time: helpers.formatTime(props.message.created_at),
          status: props.messageStatus,
          isMessageSeen: props.isMessageSeen,
          ref: messageIndicatorRef
        }).el
      )
    )
  )

  return { el, dispose, update, highlight }

  function dispose() {
    if (messageIndicatorRef.current) {
      messageIndicatorRef.current.dispose()
      messageIndicatorRef.current = null!
    }

    if (avatarViewRef.current) {
      avatarViewRef.current.dispose()
      avatarViewRef.current = null!
    }

    el.remove()
  }

  function update(props: MessageViewProps<v35.agent.MessageEvent>) {
    if (messageIndicatorRef.current) {
      messageIndicatorRef.current.update({
        time: helpers.formatTime(props.message.created_at),
        status: props.messageStatus,
        isMessageSeen: props.isMessageSeen,
        ref: messageIndicatorRef
      })
    }
  }

  function highlight() {

  }
}

function createFileMessageView(props: MessageViewProps<v35.agent.FileEvent>): MessageView<v35.agent.FileEvent> {
  const messageIndicatorRef = dom.createRef<MessageIndicatorView>()
  const avatarViewRef = dom.createRef<AvatarView>()
  const progressButtonRef = dom.createRef<ProgressButton>()
  const subtitleRef = dom.createRef<HTMLDivElement>()
  const imageProgressContainer = dom.createRef<HTMLDivElement>()
  const progressLabelRef = dom.createRef<HTMLDivElement>()
  const fileEarmarkRef = dom.createRef<SVGSVGElement>()
  const myMessage = props.author?.id === props.myProfileId
  const el = h("div", { className: `message ${myMessage ? "right" : "left"}` })
  let progressSignal = props.progressSignal

  if (props.author && !myMessage) {
    el.append(
      h("div", { className: "message-avatar" },
        createAvatarView({
          id: props.author.id,
          alt: props.author.name,
          src: props.author.avatar,
          size: 36,
          ref: avatarViewRef
        }).el
      )
    )
  }

  if (["image/png", "image/jpg", "image/jpeg", "image/gif"].includes(props.message.content_type)) {
    el.append(h("div", { className: "message-image-container" },
      h("img", {
        className: "message-image",
        src: props.message.thumbnail2x_url,
        alt: props.message.name,
      }),
      createMessageIndicatorView({
        sticky: true,
        contrast: true,
        time: helpers.formatTime(props.message.created_at),
        status: props.messageStatus,
        isMessageSeen: props.isMessageSeen,
        ref: messageIndicatorRef
      }).el,
      h("div", { className: "message-image-progress-container", ref: imageProgressContainer },
        createProgressButton({
          ref: progressButtonRef,
          progress: 0,
          size: 48,
          onClick() {
            props.abortController?.abort()
          }
        }).el
      )
    ))
  }
  else {
    el.append(
      h("div", { className: "message-bubble" },
        h("div", { className: "message-file" },
          h("div", { className: "message-file-icon" },
            icons.createFileEarmarkIcon({ size: 24, ref: fileEarmarkRef }),
            createProgressButton({
              ref: progressButtonRef,
              progress: 0,
              size: 24,
              onClick() {
                props.abortController?.abort()
              }
            }).el
          ),
          h("div", { className: "message-file-details" },
            h("div", { className: "text-primary text-ellipsis" }, props.message.name),
            h("div", { className: "text-secondary" },
              h("span", { ref: subtitleRef }, helpers.formatSize(props.message.size, true)),
              h("span", { ref: progressLabelRef }, "Loading..."),
              createMessageIndicatorView({
                time: helpers.formatTime(props.message.created_at),
                status: props.messageStatus,
                isMessageSeen: props.isMessageSeen,
                ref: messageIndicatorRef
              }).el)
          )
        )
      )
    )
  }

  if (props.progressSignal) {
    progressSignal = props.progressSignal
    progressSignal.onprogress = updateProgressStatus
  }

  toggleProgress(Boolean(props.progressSignal))

  return { el, dispose, update, highlight }

  function dispose() {
    if (messageIndicatorRef.current) {
      messageIndicatorRef.current.dispose()
      messageIndicatorRef.current = null!
    }

    if (avatarViewRef.current) {
      avatarViewRef.current.dispose()
      avatarViewRef.current = null!
    }

    if (progressButtonRef.current) {
      progressButtonRef.current.dispose()
      progressButtonRef.current = null!
    }

    subtitleRef.current = null!
    progressLabelRef.current = null!
    fileEarmarkRef.current = null!
    imageProgressContainer.current = null!

    if (progressSignal) {
      progressSignal.onprogress = null
    }

    el.remove()
  }

  function update(nextProps: MessageViewProps<v35.agent.FileEvent>) {

    if (messageIndicatorRef.current) {
      messageIndicatorRef.current.update({
        time: helpers.formatTime(nextProps.message.created_at),
        status: nextProps.messageStatus,
        isMessageSeen: nextProps.isMessageSeen,
        ref: messageIndicatorRef
      })
    }

    if (progressSignal && !nextProps.progressSignal) {
      progressSignal.onprogress = null
      progressSignal = null
      toggleProgress(false)
    }

    if (!progressSignal && nextProps.progressSignal) {
      progressSignal = nextProps.progressSignal
      progressSignal.onprogress = updateProgressStatus
      toggleProgress(true)
    }

    props = nextProps
  }

  function highlight() { }

  function updateProgressStatus(event: ProgressEvent) {
    const total = event.total
    const loaded = event.loaded

    if (typeof total === "number" && typeof loaded === "number") {
      const progress = loaded / total

      if (progressLabelRef.current) {
        progressLabelRef.current.innerText = `${Math.round(progress * 100)}% loaded`
      }

      progressButtonRef.current.update({ progress })
    }
  }

  function toggleProgress(on: boolean) {
    if (imageProgressContainer.current) {
      imageProgressContainer.current.classList.toggle("hidden", !on)
    }

    if (subtitleRef.current) {
      subtitleRef.current.classList.toggle("hidden", on)
    }

    if (progressLabelRef.current) {
      progressLabelRef.current.classList.toggle("hidden", !on)
    }

    progressButtonRef.current.el.classList.toggle("hidden", !on)

    if (fileEarmarkRef.current) {
      fileEarmarkRef.current.classList.toggle("hidden", on)
    }
  }
}

function createRichMessageMessageView(props: MessageViewProps<v35.agent.RichMessageEvent>): MessageView<v35.agent.RichMessageEvent> {
  const avatarViewRef = dom.createRef<AvatarView>()
  const messageIndicatorRef = dom.createRef<MessageIndicatorView>()
  const myMessage = props.author?.id === props.myProfileId
  const el = h("div", { className: `message ${myMessage ? "right" : "left"}` },
    props.author && !myMessage && (
      h("div", { className: "message-avatar" },
        createAvatarView({
          id: props.author.id,
          alt: props.author.name,
          src: props.author.avatar,
          size: 36,
          ref: avatarViewRef
        }).el
      )
    ),

    props.message.template_id === "quick_replies" && h("div", { className: "message-quick-replies" },
      ...props.message.elements.map(function (element) {
        return f(
          element.title && h("div", { className: "message-bubble" },
            !myMessage && props.author && (
              h("div", { className: "text-small text-secondary" }, props.author.name)
            ),

            h("div", { className: "message-text" },
              element.title,
              createMessageIndicatorView({
                time: helpers.formatTime(props.message.created_at),
                status: props.messageStatus,
                isMessageSeen: props.isMessageSeen,
                ref: messageIndicatorRef
              }).el
            )
          ),

          element.buttons && element.buttons.length > 0 && (
            h("div", { className: "message-buttons" },
              ...element.buttons.map(function (button) {
                return h("button", { className: "btn btn-secondary btn-sm mr-2", disabled: true }, button.text)
              })
            )
          )
        )
      })
    ),

    props.message.template_id === "cards" && h("div", { className: "message-cards" },
      !myMessage && props.author && (
        h("div", { className: "text-small text-secondary" }, props.author.name)
      ),
      h("div", { className: "message-card-elements" },
        ...props.message.elements.map(function (element) {
          return h("div", { className: "message-card" },
            element.image && h("div", { className: "message-card-img-container" },
              h("img", {
                className: "message-card-img",
                src: element.image.url,
                alt: element.image.alternative_text
              })
            ),
            (element.title || element.subtitle) && h("div", { className: "p-2" },
              element.title && h("div", { className: "mb-1 text-primary" }, element.title),
              element.subtitle && h("div", { className: "mb-1 text-secondary" }, element.subtitle)
            ),
            element.buttons && element.buttons.length > 0 && (
              h("div", { className: "message-card-buttons" },
                ...element.buttons.map(function (button) {
                  return h("button", {
                    className: "message-card-button",
                    disabled: true
                  }, button.text)
                })
              )
            )
          )
        })
      )
    )
  )

  return { el, dispose, update, highlight }

  function dispose() {
    if (messageIndicatorRef.current) {
      messageIndicatorRef.current.dispose()
      messageIndicatorRef.current = null!
    }

    if (avatarViewRef.current) {
      avatarViewRef.current.dispose()
      avatarViewRef.current = null!
    }

    el.remove()
  }

  function update(props: MessageViewProps<v35.agent.RichMessageEvent>) {
    if (messageIndicatorRef.current) {
      messageIndicatorRef.current.update({
        time: helpers.formatTime(props.message.created_at),
        status: props.messageStatus,
        isMessageSeen: props.isMessageSeen,
        ref: messageIndicatorRef
      })
    }
  }

  function highlight() {

  }
}

function createFilledFormMessageView(props: MessageViewProps<v35.agent.FilledFormEvent>): MessageView<v35.agent.FilledFormEvent> {
  const avatarViewRef = dom.createRef<AvatarView>()
  const messageIndicatorRef = dom.createRef<MessageIndicatorView>()
  const myMessage = props.author?.id === props.myProfileId
  const el = h("div", { className: `message ${myMessage ? "right" : "left"}` },
    props.author && !myMessage && h("div", {
      className: "message-avatar",
    },
      createAvatarView({
        id: props.author.id,
        alt: props.author.name,
        src: props.author.avatar,
        size: 36,
        ref: avatarViewRef
      }).el
    ),
    h("div", { className: "message-bubble" },
      !myMessage && props.author && h("div", {
        className: "text-small text-secondary text-ellipsis"
      }, props.author.name),
      h("div", { className: "message-text" },
        h("div", { className: "text-primary text-bold mb-2" },
          helpers.stringifyFormType(props.message.form_type || props.message.form_id)
        ),
        ...props.message.fields.map(function (field, index, arr) {
          return h("div", { className: index === arr.length - 1 ? "mb-0" : "mb-2" },
            h("div", { className: "text-small text-secondary" }, field.label),
            h("div", { className: "text-primary" }, helpers.stringifyFilledFormAnswer(field.answer || field.answers))
          )
        }),
        createMessageIndicatorView({
          time: helpers.formatTime(props.message.created_at),
          status: props.messageStatus,
          isMessageSeen: props.isMessageSeen,
          ref: messageIndicatorRef
        }).el
      )
    )
  )

  return { el, dispose, update, highlight }

  function dispose() {
    messageIndicatorRef.current.dispose()
    messageIndicatorRef.current = null!
    avatarViewRef.current.dispose()
    avatarViewRef.current = null!
    el.remove()
  }

  function update(props: MessageViewProps<v35.agent.FilledFormEvent>) {

  }

  function highlight() {

  }
}

function createSystemMessageView(props: MessageViewProps<v35.agent.SystemMessageEvent>): MessageView<v35.agent.SystemMessageEvent> {
  const el = h("div", { className: "message message-system text-secondary" },
    props.message.text
  )

  return { el, dispose, update, highlight }

  function dispose() {
    el.remove()
  }

  function update(props: MessageViewProps<v35.agent.SystemMessageEvent>) {

  }

  function highlight() {

  }
}

function createRestrictedThreadMessageView(props: MessageViewProps<RestrictedThread>): MessageView<RestrictedThread> {
  const el = h("div", { className: "message center" },
    h("div", { className: "text-secondary" }, props.message.text)
  )

  return { el, dispose, update, highlight }

  function dispose() {
    el.remove()
  }

  function update(props: MessageViewProps<RestrictedThread>) { }

  function highlight() { }
}

function createChatGapMessageView(props: MessageViewProps<ChatGap>): MessageView<ChatGap> {
  const el = h("div", { className: "message" },
    "Loading chat messages..."
  )

  return { el, dispose, update, highlight }

  function dispose() {
    el.remove()
  }

  function update(props: MessageViewProps<ChatGap>) {

  }

  function highlight() {

  }
}

function createSneakPeekMessageView(props: MessageViewProps<SneakPeekAsEvent>): MessageView<SneakPeekAsEvent> {
  const avatarViewRef = dom.createRef<AvatarView>()
  const myMessage = props.author?.id === props.myProfileId
  const textElRef = dom.createRef<HTMLSpanElement>()
  const el = h("div", { className: `message ${myMessage ? "right" : "left"}` },
    props.author && !myMessage && h("div", {
      className: "message-avatar",
    },
      createAvatarView({
        id: props.author.id,
        alt: props.author.name,
        src: props.author.avatar,
        size: 36,
        ref: avatarViewRef
      }).el
    ),
    h("div", { className: "message-bubble" },
      !myMessage && props.author && h("div", { className: "text-small text-secondary" }, props.author.name),
      h("div", { className: "message-text" },
        h("span", {}, "✍️ "),
        h("span", { ref: textElRef }, props.message.text),
        h("span", {}, "...")
      )
    )
  )

  return { el, dispose, update, highlight }

  function dispose() {
    if (textElRef.current) {
      textElRef.current = null!
    }

    if (avatarViewRef.current) {
      avatarViewRef.current.dispose()
      avatarViewRef.current = null!
    }

    el.remove()
  }

  function update(props: MessageViewProps<SneakPeekAsEvent>) {
    if (textElRef.current) {
      textElRef.current.textContent = props.message.text
    }
  }

  function highlight() {

  }
}

function createUnsupportedMessageView(props: MessageViewProps<any>): MessageView<any> {
  const el = h("div", { className: "message" },
    "Unsupported message..."
  )

  return { el, dispose, update, highlight }

  function dispose() {
    el.remove()
  }

  function update(props: MessageViewProps<any>) {

  }

  function highlight() {

  }
}

interface MessageIndicatorView {
  el: HTMLDivElement
  dispose(): void
  update(props: MessageIndicatorProps): void
}

interface MessageIndicatorProps {
  time: string
  sticky?: true
  contrast?: boolean
  status?: MessageStatus
  isMessageSeen: boolean
  ref: dom.Ref<MessageIndicatorView>
}

function createMessageIndicatorView(props: MessageIndicatorProps) {
  const timeElRef = dom.createRef<HTMLDivElement>()
  const el = h("div", { className: `message-indicator ${props.sticky ? "sticky" : ""} ${props.contrast ? "contrast" : ""}` },
    h("span", { ref: timeElRef, className: "message-indicator-time" }, props.time || ""),
    icons.createClockIcon({ size: 14, class: "message-indicator-icon message-indicator-clock-icon" }),
    icons.createCheckIcon({ size: 14, class: "message-indicator-icon message-indicator-check-icon" }),
    icons.createCheckIcon({ size: 14, class: "message-indicator-icon message-indicator-fail-icon" }), // todo: fix wrong icon for failed status
    icons.createCheckAllIcon({ size: 14, class: "message-indicator-icon message-indicator-check-all-icon" })
  )

  el.dataset.status = stringifyMessageStatus(props.status)
  el.dataset.messageSeen = stringifyMessageSeen(props.isMessageSeen)

  update(props)

  return props.ref.current = {
    el,
    dispose,
    update
  }

  function dispose() {
    timeElRef.current = null!
    el.remove()
  }

  function update(props: MessageIndicatorProps) {
    el.dataset.status = stringifyMessageStatus(props.status)
    el.dataset.messageSeen = stringifyMessageSeen(props.isMessageSeen)
    // el.classList.toggle("sticky", props.sticky)
    // el.classList.toggle("contrast", props.contrast)
    timeElRef.current.textContent = props.time
  }

  function stringifyMessageStatus(messageStatus?: MessageStatus) {
    return String(messageStatus || "unknown")
  }

  function stringifyMessageSeen(isMessageSeen?: boolean) {
    return String(typeof isMessageSeen === "boolean" ? isMessageSeen : "unknown")
  }
}

interface CustomerDetailsView {
  el: HTMLDivElement
  dispose(): void
}

interface DetailsViewProps {
  chatId: string
  ref: dom.Ref<CustomerDetailsView>
}

interface DetailsItem {
  name: string
  value: string
}

interface DetailsItemsListInstance {
  nameElRef: dom.Ref<HTMLDivElement>
  valueElRef: dom.Ref<HTMLDivElement>
}

function createCustomerDetailsView(props: DetailsViewProps): CustomerDetailsView {
  const store = $Store()
  const controller = $Controller()
  const nameElRef = dom.createRef<HTMLDivElement>()
  const emailElRef = dom.createRef<HTMLDivElement>()
  const avatarViewRef = dom.createRef<AvatarView>()
  const detailsElRef = dom.createRef<HTMLDivElement>()
  const el = h("div", { className: "details" },
    h("div", { className: "details-header" },
      h("div", { className: "details-title", textContent: "Details" })
    ),
    h("div", { className: "details-body" },
      h("div", { className: "d-flex p-2 px-3 border-bottom" },
        h("div", { className: "details-avatar" },
          createAvatarView({
            ref: avatarViewRef,
            id: props.chatId,
            size: 48,
            alt: "",
            src: "",
          }).el
        ),
        h("div", { className: "mw-0" },
          h("div", { className: "text-primary text-ellipsis", ref: nameElRef }),
          h("div", { className: "text-secondary", ref: emailElRef })
        )
      ),

      h("div", { className: "mb-3", ref: detailsElRef })
    )
  )

  const disconnect = store.lazyConnect(function (state) {
    const chat = state.chats.get(props.chatId)
    const customer = chat ? helpers.getChatRecipient(chat.users) : void 0


    return {
      user: customer,
      parsedUserAgents: state.parsedUserAgents,
    }
  }, function (props) {
    const user = props.user
    const lastVisit = user && user.type === "customer" ? user.last_visit : null
    const statistics = user && user.type === "customer" ? user.statistics : null
    const fields = user && user.type === "customer" ? user.session_fields : void 0
    const geolocation = lastVisit ? lastVisit.geolocation : void 0
    const details: DetailsItem[] = []

    if (nameElRef.current) {
      nameElRef.current.textContent = user ? user.name : "Unnamed customer"
    }

    if (emailElRef.current) {
      emailElRef.current.textContent = user ? user.email : "-"
    }

    if (user && avatarViewRef.current) {
      avatarViewRef.current.update({ id: user.id, size: 48, alt: user.name, src: user.avatar })
    }

    if (geolocation) {
      details.push({
        name: "Location",
        value: helpers.stringifyGeolocation(geolocation)
      })
    }

    if (lastVisit?.user_agent) {
      const parsedUserAgent = props.parsedUserAgents[lastVisit.user_agent]
      const item: DetailsItem = {
        name: "Device",
        value: "Loading..."
      }

      if (!parsedUserAgent) {
        requestAnimationFrame(function () {
          controller.maybeParseUserAgent(lastVisit.user_agent)
        })
      }

      if (parsedUserAgent?.status === "done") {
        item.value = helpers.formatUserAgent(parsedUserAgent.userAgent)
      }

      if (parsedUserAgent?.status === "failed") {
        item.value = "Unknown device details"
      }

      details.push(item)
    }

    if (lastVisit) {
      details.push({
        name: "IP Address",
        value: lastVisit.ip || "127.0.0.1",
      })

      if (lastVisit.last_pages.length > 0) {
        const lastPage = lastVisit.last_pages[lastVisit.last_pages.length - 1]

        details.push({
          name: "Last page",
          value: lastPage.url
        })
      }
    }

    if (statistics) {
      details.push({
        name: "Statistics",
        value: `${statistics.threads_count} conversations and ${statistics.visits_count} visits`
      })
    }

    if (fields && fields.length > 0) {
      for (const field of fields) {
        const keys = Object.keys(field)

        for (const key of keys) {
          details.push({
            name: key,
            value: String(field[key] || "")
          })
        }
      }
    }

    if (detailsElRef.current) {
      renderDetailsItems(detailsElRef.current, details)
    }
  })

  return props.ref.current = {
    el,
    dispose
  }

  function dispose() {
    disconnect()

    if (nameElRef.current) {
      nameElRef.current = null!
    }

    if (emailElRef.current) {
      emailElRef.current = null!
    }

    if (avatarViewRef.current) {
      avatarViewRef.current.dispose()
      avatarViewRef.current = null!
    }

    if (detailsElRef.current) {
      renderDetailsItems(detailsElRef.current, [])
      detailsElRef.current = null!
    }

    el.remove()
  }

  function renderDetailsItems(target: HTMLElement, details: DetailsItem[]) {
    list2<DetailsItem, {
      nameElRef: dom.Ref<HTMLDivElement>
      valueElRef: dom.Ref<HTMLDivElement>
    }>({
      target,
      values: details,
      key: (v) => v?.name,
      enter(ctx) {
        ctx.nameElRef = dom.createRef<HTMLDivElement>()
        ctx.valueElRef = dom.createRef<HTMLDivElement>()

        ctx.el = h("div", { className: "p-2 px-3 border-bottom" },
          h("small", { className: "text-secondary", ref: ctx.nameElRef }, ctx.value.name),
          h("div", { className: "text-primary", ref: ctx.valueElRef }, ctx.value.value),
        )
      },
      update(ctx) {
        ctx.nameElRef.current.textContent = ctx.value.name
        ctx.valueElRef.current.textContent = ctx.value.value
      },
      exit(ctx) {
        ctx.nameElRef.current = null!
        ctx.valueElRef.current = null!
        ctx.el.remove()
      }
    })
  }
}

interface AvatarView {
  el: HTMLDivElement
  dispose(): void
  update(props: AvatarViewProps): void
}

interface AvatarViewProps {
  id: string
  size: number,
  alt: string,
  src?: string
  badge?: "accepting_chats" | "not_accepting_chats" | "offline"
}

function createAvatarView(props: AvatarViewProps & {
  ref?: dom.Ref<AvatarView>
}): AvatarView {
  const imageElRef = dom.createRef<HTMLDivElement>()
  const imgElRef = dom.createRef<HTMLImageElement>()
  const initialsElRef = dom.createRef<HTMLDivElement>()
  const badgeElRef = dom.createRef<HTMLDivElement>()
  const el = dom.createElement("div", { className: "avatar" },
    dom.createElement("div", { className: "avatar-image", ref: imageElRef },
      dom.createElement("img", { src: props.src, alt: props.alt, ref: imgElRef })
    ),
    dom.createElement("div", {
      className: "avatar-initials",
      textContent: helpers.getInitials(props.alt),
      ref: initialsElRef,
    }),
    dom.createElement("div", { className: "avatar-badge", ref: badgeElRef })
  )

  imgElRef.current.onerror = onImgError

  update(props)

  const avatarView: AvatarView = {
    el,
    dispose,
    update
  }

  if (props.ref) {
    props.ref.current = avatarView
  }

  return avatarView

  function dispose() {
    imageElRef.current.onerror = null
    imageElRef.current = null!
    initialsElRef.current = null!
    badgeElRef.current = null!

    el.remove()
  }

  function update(props: AvatarViewProps) {
    el.style.width = `${props.size}px`
    el.style.height = `${props.size}px`

    if (el.id !== props.id) {
      el.id = props.id
      el.style.backgroundColor = randomColor(props.id)
    }

    imgElRef.current.alt = props.alt

    if (imgElRef.current.src !== props.src) {
      imgElRef.current.src = props.src || ""

      if (imageElRef.current) {
        imageElRef.current.classList.toggle("hidden", !props.src)
      }
    }

    // @todo: append / remove img based on src

    initialsElRef.current.style.lineHeight = `${props.size}px`
    initialsElRef.current.textContent = helpers.getInitials(props.alt)

    badgeElRef.current.classList.toggle("accepting_chats", props.badge === "accepting_chats")
    badgeElRef.current.classList.toggle("not_accepting_chats", props.badge === "not_accepting_chats")
    badgeElRef.current.classList.toggle("offline", props.badge === "offline")
  }

  function onImgError() {
    if (imageElRef.current) {
      imageElRef.current.classList.add("hidden")
    }
  }

  function randomColor(id: string) {
    const colors = ["#548057", "#537280", "#58658e", "#394c82", "#745480", "#845b5b", "#a95c4a", "#b1915d", "#d0b454", "#67aca2"]

    return colors[toNum(String(id), 0, colors.length - 1)];
  }

  function toNum(string: string, from: number, to: number) {
    return from + (hashCode(string) % (to - from + 1));
  }

  function hashCode(string: string) {
    let hash = 0;

    for (let i = 0; i < string.length; i += 1) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash)
    }

    return Math.abs(hash)
  }
}

interface IconViewProps {
  name: "moon" | "search" | "arrow-right-circle" | "caret-down-fill"
  size?: string | number
  className?: string
}

function createIconEl(props: IconViewProps) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  const size = String(props.size ?? 16)

  svg.setAttribute("fill", "currentColor")
  svg.setAttribute("width", size)
  svg.setAttribute("height", size)
  svg.setAttribute("viewBox", "0 0 16 16")

  if (props.className) {
    svg.setAttribute("class", props.className)
  }

  if (props.name === "moon") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("fill-rule", "evenodd")
    path.setAttribute("d", "M14.53 10.53a7 7 0 0 1-9.058-9.058A7.003 7.003 0 0 0 8 15a7.002 7.002 0 0 0 6.53-4.47z")
    svg.appendChild(path)
  }
  else if (props.name === "search") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path")

    path.setAttribute("fill-rule", "evenodd")
    path2.setAttribute("fill-rule", "evenodd")
    path.setAttribute("d", "M10.442 10.442a1 1 0 0 1 1.415 0l3.85 3.85a1 1 0 0 1-1.414 1.415l-3.85-3.85a1 1 0 0 1 0-1.415z")
    path2.setAttribute("d", "M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z")
    svg.appendChild(path)
    svg.appendChild(path2)
  }
  else if (props.name === "arrow-right-circle") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path")

    path.setAttribute("fill-rule", "evenodd")
    path2.setAttribute("fill-rule", "evenodd")
    path.setAttribute("d", "M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z")
    path2.setAttribute("d", "M4 8a.5.5 0 0 0 .5.5h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5A.5.5 0 0 0 4 8z")
    svg.appendChild(path)
    svg.appendChild(path2)
  }
  else if (props.name === "caret-down-fill") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")

    path.setAttribute("fill-rule", "evenodd")
    path.setAttribute("d", "M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z")
    svg.appendChild(path)
  }
  else {
    throw new Error("Unsupported name for icons")
  }

  return svg
}

function createModalsView() {
  const store = $Store()
  const el = h("div", {})
  let fileUploadModalView: FileUploadModalView | null = null

  const disconnect = store.lazyConnect(state => state.openModal, update)

  return {
    el,
    dispose
  }

  function dispose() {
    disconnect()
    update(null)
  }

  function update(openModal: Modal | null) {
    document.body.classList.toggle("overflow-hidden", Boolean(openModal))


    if (openModal?.type === "file-upload-modal") {
      // enter
      if (!fileUploadModalView) {
        fileUploadModalView = createFileUploadModal({
          modal: openModal
        })
        el.append(fileUploadModalView.el)
      }

      // update
      if (fileUploadModalView) {
        fileUploadModalView.update({
          modal: openModal
        })
      }
    }

    // exit
    if (openModal?.type !== "file-upload-modal" && fileUploadModalView) {
      fileUploadModalView.dispose()
      fileUploadModalView.el.remove()
      fileUploadModalView = null
    }
  }
}

interface FileUploadModalProps {
  modal: FileUploadModal
}

type FileUploadModalView = ReturnType<typeof createFileUploadModal>

function createFileUploadModal(props: FileUploadModalProps) {
  const store = $Store()
  const controller = $Controller()
  const modalRef = dom.createRef<HTMLDivElement>()
  const modalContentRef = dom.createRef<HTMLDivElement>()
  const modalBodyRef = dom.createRef<HTMLDivElement>()
  const sendButtonRef = dom.createRef<HTMLButtonElement>()
  const el = h("div", {
    className: "modal",
    ref: modalRef,
    onclick: onModalClick
  },
    h("div", { className: "modal-content modal-small modal-center p-4", ref: modalContentRef, onclick: onModalContentClick },
      h("div", { className: "mb-2" }, "Send Files"),
      h("button", { className: "modal-close", onclick: onCloseButtonClick },
        icons.createCloseIcon({ size: 24 })
      ),
      h("div", { className: "mb-2", ref: modalBodyRef }),
      h("div", { className: "text-right" },
        h("button", {
          className: "btn btn-outline btn-sm",
          ref: sendButtonRef,
          onclick: onSendFiles
        }, "Send")
      )
    )
  )

  return {
    el,
    dispose,
    update,
  }

  function dispose() {
    modalRef.current.onclick = null!
    modalRef.current = null!
    modalContentRef.current.onclick = null!
    modalContentRef.current = null!
    sendButtonRef.current.onclick = null!
    sendButtonRef.current = null!
  }

  function update(props: FileUploadModalProps) {
    if (!modalBodyRef.current) {
      return
    }

    list2<File, {
      nameRef: dom.Ref<HTMLDivElement>
      sizeRef: dom.Ref<HTMLDivElement>
    }>({
      target: modalBodyRef.current,
      values: props.modal.files,
      key: (file, index) => String(index),
      enter(ctx) {
        ctx.nameRef = dom.createRef<HTMLDivElement>()
        ctx.sizeRef = dom.createRef<HTMLDivElement>()
        ctx.el = h("div", { className: "mb-2" },
          h("div", { className: "text-primary text-bold", ref: ctx.nameRef }, ctx.value.name),
          h("div", { className: "text-secondary", ref: ctx.sizeRef }, helpers.formatSize(ctx.value.size, true))
        )
      },
      update(ctx) {
        ctx.nameRef.current.innerText = ctx.value.name
        ctx.sizeRef.current.innerText = helpers.formatSize(ctx.value.size, true)
      },
      exit(ctx) {
        ctx.nameRef.current = null!
        ctx.sizeRef.current = null!
        ctx.el.remove()
      }
    })
  }

  function onModalClick(event: Event) {
    event.stopPropagation()

    store.dispatch({ openModal: null })
  }

  function onCloseButtonClick() {
    store.dispatch({ openModal: null })
  }

  function onModalContentClick(event: Event) {
    event.stopPropagation()
  }

  function onSendFiles() {
    for (const file of props.modal.files) {
      controller.sendFileMessage(props.modal.chatId, file)
    }

    store.dispatch({ openModal: null })
  }
}

interface ProgressButton {
  el: HTMLButtonElement
  dispose(): void
  update(nextProps: ProgressButtonNextProps): void
}

interface ProgressButtonProps {
  ref: dom.Ref<ProgressButton>
  progress: number
  size: number
  onClick(): void
}

interface ProgressButtonNextProps {
  progress: number
}

export function createProgressButton(props: ProgressButtonProps) {
  const circleRef = dom.createRef<SVGCircleElement>()
  const el = h("button", { className: "progress-button", onclick: props.onClick },
    icons.createLoaderIcons({
      circleRef,
      size: props.size
    })
  )

  updateCircle(props.progress)

  return props.ref.current = {
    el,
    dispose,
    update
  }

  function dispose() {
    el.onclick = null!
    circleRef.current = null!
  }

  function update(nextProps: ProgressButtonNextProps) {
    if (nextProps.progress !== props.progress) {
      updateCircle(nextProps.progress)
    }

    Object.assign(props, nextProps)
  }

  function updateCircle(progress: number) {
    const dasharray = 2 * Math.PI * icons.LOADER_ICONS_R;
    const dashoffset = Math.min(dasharray, Math.max(0, dasharray - dasharray * progress))

    circleRef.current.setAttribute("stroke-dashoffset", String(dashoffset))
  }
}

namespace icons {
  interface Props {
    class?: string
    size?: number
    ref?: dom.Ref<SVGSVGElement>
  }

  export function createMenuIcon(props?: Props) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 48,
      height: props?.size || 48,
      viewBox: "0 96 960 960",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        d: "M120 816v-60h720v60H120Zm0-210v-60h720v60H120Zm0-210v-60h720v60H120Z"
      })
    )
  }

  export function createCloseIcon(props?: Props) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 48,
      height: props?.size || 48,
      viewBox: "0 96 960 960",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        d: "m249 849-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z"
      })
    )
  }

  export function createArrowBackIcon(props?: Props) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 48,
      height: props?.size || 48,
      viewBox: "0 96 960 960",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        d: "M480 896 160 576l320-320 42 42-248 248h526v60H274l248 248-42 42Z"
      })
    )
  }

  export function createClockIcon(props?: Props) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 48,
      height: props?.size || 48,
      viewBox: "0 0 16 16",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        "fill-rule": "evenodd",
        d: "M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm8-7A8 8 0 1 1 0 8a8 8 0 0 1 16 0z"
      }),
      dom.createElementNS("path", {
        "fill-rule": "evenodd",
        d: "M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z"
      })
    )
  }

  export function createCheckIcon(props?: Props) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 48,
      height: props?.size || 48,
      viewBox: "0 0 16 16",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        "fill-rule": "evenodd",
        d: "M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
      })
    )
  }

  export function createCheckAllIcon(props?: Props) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 48,
      height: props?.size || 48,
      viewBox: "0 0 16 16",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        "fill-rule": "evenodd",
        d: "M12.354 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
      }),
      dom.createElementNS("path", {
        "fill-rule": "evenodd",
        d: "M6.25 8.043l-.896-.897a.5.5 0 1 0-.708.708l.897.896.707-.707zm1 2.414l.896.897a.5.5 0 0 0 .708 0l7-7a.5.5 0 0 0-.708-.708L8.5 10.293l-.543-.543-.707.707z"
      })
    )
  }

  export function createPinIcon(props?: Props) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 48,
      height: props?.size || 48,
      viewBox: "0 0 16 16",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        "fill-rule": "evenodd",
        d: "M12.166 8.94C12.696 7.867 13 6.862 13 6A5 5 0 0 0 3 6c0 .862.305 1.867.834 2.94.524 1.062 1.234 2.12 1.96 3.07A31.481 31.481 0 0 0 8 14.58l.208-.22a31.493 31.493 0 0 0 1.998-2.35c.726-.95 1.436-2.008 1.96-3.07zM8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10z"
      }),
      dom.createElementNS("path", {
        "fill-rule": "evenodd",
        d: "M8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
      })
    )
  }

  export function createAttachIcon(props?: Props) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 24,
      height: props?.size || 24,
      viewBox: "0 0 512 512",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        "fill-rule": "evenodd",
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "round",
        "stroke-miterlimit": "10",
        "stroke-width": "32",
        d: "M216.08 192v143.85a40.08 40.08 0 0080.15 0l.13-188.55a67.94 67.94 0 10-135.87 0v189.82a95.51 95.51 0 10191 0V159.74"
      }),
    )
  }

  export const LOADER_ICONS_R = 8.5

  export function createLoaderIcons(props?: Props & {
    circleRef?: dom.Ref<SVGCircleElement>
  }) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 24,
      height: props?.size || 24,
      viewBox: "0 0 24 24",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        fill: "currentColor",
        stroke: "none",
        d: "M8.43078 16.2154L12 12.6462L15.5692 16.2154L16.2154 15.5692L12.6462 12L16.2154 8.43078L15.5692 7.7846L12 11.3538L8.43078 7.7846L7.7846 8.43078L11.3538 12L7.7846 15.5692L8.43078 16.2154Z"
      }),
      dom.createElementNS("circle", {
        ref: props?.circleRef,
        cx: "12",
        cy: "12",
        r: `${LOADER_ICONS_R}`,
        stroke: "currentColor",
        "stroke-dasharray": "53.40707511102649",
        "stroke-dashoffset": "50.40707511102649",
        transform: "rotate(-90, 12, 12)",
        fill: "none",
      })
    )
  }

  export function createFileEarmarkIcon(props?: Props) {
    return dom.createElementNS("svg", {
      class: props?.class ?? "",
      fill: "currentColor",
      width: props?.size || 24,
      height: props?.size || 24,
      viewBox: "0 0 16 16",
      ref: props?.ref
    },
      dom.createElementNS("path", {
        fill: "currentColor",
        d: "M4 0h5.5v1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h1V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z"
      }),
      dom.createElementNS("path", {
        fill: "currentColor",
        d: "M9.5 3V0L14 4.5h-3A1.5 1.5 0 0 1 9.5 3z"
      })
    )
  }
}
