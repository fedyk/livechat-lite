import { $API, API } from "./api"
import { $CharRouteManager } from "./chat-route-manager"
import { getAccountsUrl } from "./config"
import * as dom from "./dom"
import * as helpers from "./helpers"
import { $LazyConnect } from "./lazy-connect"
import { ReverseScroll } from "./reverse-scroll"
import { TextAreaAutoResize } from "./services"
import { $Store, State, Store } from "./store"
import { Agent, CannedResponse, Chat, ChatRoute, CustomerLastVisit, CustomerStatistics, Fields, Group, Message, MyProfile, RoutingStatus, User, VisitedPage } from "./types"

export class GridView implements helpers.IDisposable {
  el: Element
  main: MainView
  sidebar: GridSidebarView

  constructor() {
    this.el = dom.createEl("div", { className: "grid" }, [
      (this.sidebar = new GridSidebarView()).el,
      (this.main = new MainView()).el
    ])
  }

  dispose() {
    this.sidebar.dispose()
    this.main.dispose()
    this.el.remove()
    this.el = null!
  }
}

export class GridSidebarView implements helpers.IDisposable {
  el: Element
  header: HeaderView
  chatsList: ChatsListView

  constructor() {
    this.el = dom.createEl("div", {
      className: "grid-sidebar"
    }, [
      (this.header = new HeaderView()).el,
      (this.chatsList = new ChatsListView()).el
    ])
  }

  dispose() {
    this.header.dispose()
    this.chatsList.dispose()
    this.el.remove()
  }
}

interface HeaderViewConnectProps {
  myProfile: MyProfile | null
  myRoutingStatus: RoutingStatus | null
}

export class HeaderView implements helpers.IDisposable {
  store: Store
  api: API
  el: Element
  routingCheckbox: CheckboxView
  avatarView?: AvatarView
  dropdown: DropdownView
  profile: Element
  search: Element
  storeListener: helpers.IListener
  routingListener: helpers.IListener

  constructor(store = $Store(), api = $API()) {
    this.store = store
    this.api = api
    this.routingCheckbox = new CheckboxView({ id: "router_status" })

    this.el = dom.createEl("div", { className: "header" }, [
      (
        this.dropdown = new DropdownView({
          content: (
            this.profile = dom.createEl("div", { className: "dropdown-profile" })
          ),
          menuContent: ([
            dom.createEl("label", { className: "dropdown-item dropdown-router-status", htmlFor: "router_status" }, [
              dom.createEl("span", { textContent: "Accept chats" }),
              this.routingCheckbox.el
            ]),
            dom.createEl("div", { className: "dropdown-divider" }),
            dom.createEl("a", { className: "dropdown-item", href: getAccountsUrl("signout"), textContent: "Logout" }),
            dom.createEl("div", { className: "dropdown-footer" }, [
              dom.createEl("a", { href: "#", textContent: "Report problem" }),
              dom.createEl("a", { href: "#", textContent: "About" })
            ])
          ])
        })
      ).el,
      dom.createEl("div", { className: "temp-logo", textContent: "LiveChat X" }),
      this.search = dom.createEl("div", { className: "search hidden" }, [
        dom.createEl("label", { className: "search-label", htmlFor: "search", }, [
          createIconEl({ name: "search", size: 14 })
        ]),
        dom.createEl("input", {
          id: "search",
          type: "text",
          placeholder: "Search",
          className: "search-input",
          autocomplete: "off",
        })
      ])
    ])

    this.routingListener = this.routingCheckbox.addListener("change", () => {
      this.changeRoutingStatus()
    })

    this.storeListener = store.connect<HeaderViewConnectProps>(state => {
      const myProfile = state.myProfile

      return {
        myProfile,
        myRoutingStatus: myProfile ? state.routingStatuses[myProfile.id] : null
      }
    }, props => this.render(props))
  }

  dispose() {
    this.storeListener.unbind()
    this.avatarView?.dispose()
    this.routingCheckbox.dispose()
    this.dropdown.dispose()
    this.profile = null!
    this.search = null!
    this.el.remove()
    this.el = null!
  }

  protected render(props: HeaderViewConnectProps) {
    this.renderMyProfileAvatar(props.myProfile)
    this.renderMyRoutingStatus(props.myRoutingStatus)
  }

  protected renderMyProfileAvatar(myProfile: MyProfile | null) {
    if (myProfile) {
      if (!this.avatarView) {
        this.profile.append(
          (this.avatarView = new AvatarView({
            alt: helpers.getInitials(myProfile.name),
            src: myProfile.avatar,
            size: 36
          })).el,
          createIconEl({ name: "caret-down-fill", size: "10" })
        )
      }
      else {
        this.avatarView.setAlt(myProfile.name)
        this.avatarView.setSrc(myProfile.avatar)
      }
    }
    else {
      this.avatarView?.dispose()
      this.profile.textContent = ""
    }
  }

  renderMyRoutingStatus(myRoutingStatus: RoutingStatus | null) {
    if (myRoutingStatus) {
      this.routingCheckbox.setValue(myRoutingStatus === "accepting_chats")
    }
  }

  changeRoutingStatus() {
    const acceptingChats = this.routingCheckbox.getValue()

    this.api.setRoutingStatus(acceptingChats ? "accepting_chats" : "not_accepting_chats")
      .catch(err => console.error(err))
  }
}

interface ChatsListConnectedProps {
  chatIds: string[],
}

export class ChatsListView implements helpers.IDisposable {
  el: Element
  chatsListItems: Map<string, ChatsListItemView>
  storeListener: helpers.IListener

  constructor(store = $Store()) {
    this.chatsListItems = new Map()

    this.el = dom.createEl("div", { className: "chats-list" })

    this.storeListener = store.connect<ChatsListConnectedProps>(
      state => ({
        chatIds: state.chatIds
      }),
      data => this.render(data)
    )
  }

  dispose() {
    this.el.remove()
    this.el = null!
  }

  render(data: ChatsListConnectedProps) {
    const chatsListItems = this.chatsListItems

    dom.selectAll(this.el)
      .data(data.chatIds, chatId => chatId)
      .join(
        enter => enterChatsListItem(enter),
        update => updateChatsListItem(update),
        exit => exitChatsListItem(exit)
      )

    function enterChatsListItem(enter: dom.EnterNode<string>) {
      const chatsListItem = new ChatsListItemView({ chatId: enter.d })

      chatsListItems.set(enter.d, chatsListItem)

      enter.append(chatsListItem.el)
    }

    function updateChatsListItem(update: dom.ElementWithDatum<string>) {

    }

    function exitChatsListItem(exit: dom.ElementWithDatum<string>) {
      const d = dom.getDatum(exit)

      if (!d) {
        return
      }

      const chatsListItem = chatsListItems.get(d)

      if (chatsListItem) {
        chatsListItem.dispose()
      }
      else {
        console.warn("unexpected missed instance for element"), exit.remove()
      }
    }
  }
}


/**
 * This view handle only child content. the wrapper should be passed from outside
 */

interface ChatsListItemProps {
  chatId: string
}

interface ChatsListItemConnectedProps {
  chat?: Chat
  selectedChatId: string | null
}

export class ChatsListItemView implements helpers.IDisposable {
  el: Element
  chatRoute: ChatRoute | void
  itemAvatarEl: HTMLDivElement
  chatSummaryEl: Element
  chatTitle: Element
  chatMeta: Element
  chatSubtitle: Element
  storeListener: helpers.IListener
  clickListener: helpers.IListener
  chatRouteListener: helpers.IListener
  connectedProps?: ChatsListItemConnectedProps

  constructor(
    protected props: ChatsListItemProps,
    protected store = $Store(),
    protected charRouteManager = $CharRouteManager(),
    protected lazyConnect = $LazyConnect()
  ) {
    const connProps = this.storeMapper(this.store.getState())
    const customer = connProps.chat ? helpers.getChatRecipient(connProps.chat) : void 0

    this.el = dom.createEl("div", { className: "chats-list-item", }, [
      this.itemAvatarEl = dom.createEl("div", { className: "chat-list-item-avatar" }),
      this.chatSummaryEl = dom.createEl("div", { className: "chat-summary", }, [
        dom.createEl("div", { className: "chat-summary-row", }, [
          this.chatTitle = dom.createEl("div", { className: "chat-title", textContent: "Unnamed visitor" }),
          this.chatMeta = dom.createEl("div", { className: "chat-meta" })
        ]),
        this.chatSubtitle = dom.createEl("div", { className: "chat-subtitle" })
      ])
    ])

    this.clickListener = dom.addListener(this.el, "click", () => this.selectChat())
    this.chatRoute = this.charRouteManager.getCurrentChatRoute(props.chatId)

    this.storeListener = lazyConnect.connect<ChatsListItemConnectedProps>(
      state => this.storeMapper(state),
      props => this.render(props)
    )

    this.chatRouteListener = this.charRouteManager.subscribe(props.chatId, nextChatRoute => {
      this.chatRoute = nextChatRoute

      if (this.connectedProps) {
        this.render(this.connectedProps)
      }
    })
  }

  dispose() {
    this.storeListener.unbind()
    this.clickListener.unbind()
    this.chatRouteListener.unbind()
    AvatarView.removeAvatar(this.itemAvatarEl)
    this.el.remove()
  }

  selectChat() {
    this.store.setSelectedChatId(this.props.chatId)
  }

  protected render(props: ChatsListItemConnectedProps) {
    if (props.chat) {
      const user = helpers.getChatRecipient(props.chat)
      const lastMessage = helpers.getChatLastMessage(props.chat)

      if (user) {
        this.chatTitle.textContent = user.name

        AvatarView.renderAvatar(this.itemAvatarEl, {
          size: 48,
          alt: user.name,
          src: user.avatar
        })
      }

      this.chatTitle.textContent = user ? user.name : "Unnamed visitor"

      if (this.chatRoute === "queued") {
        this.chatSubtitle.textContent = `Waiting in a queue`
      }
      else if (this.chatRoute === "unassigned") {
        this.chatSubtitle.textContent = `Unassigned chat waiting for reply`
      }
      else if (lastMessage) {
        this.chatSubtitle.textContent = helpers.stringifyMessage(lastMessage)
      }
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
      chat: state.chatsByIds[this.props.chatId],
      selectedChatId: state.selectedChatId,
    }
  }
}


export class MainView implements helpers.IDisposable {
  el: Element
  chatFeed: ChatsView

  constructor() {
    this.el = dom.createEl("div", { className: "grid-main" }, [
      (this.chatFeed = new ChatsView()).el
    ])
  }

  dispose() {
    this.chatFeed.dispose()
    this.el.remove()
    this.el = null!
  }
}

interface ChatsViewConnectedProps {
  selectedChatId: string | null
}

export class ChatsView implements helpers.IDisposable {
  el: Element
  lruCache: helpers.LRUCache<ChatView>
  cacheListener: helpers.IListener
  storeListener: helpers.IListener

  constructor(store = $Store()) {
    this.lruCache = new helpers.LRUCache(10)
    this.el = dom.createEl("div", { className: "chats" })

    this.cacheListener = this.lruCache.addListener("removed", chatView => {
      chatView.dispose()
    })

    this.storeListener = store.connect<ChatsViewConnectedProps>(state => ({
      selectedChatId: state.selectedChatId
    }), props => this.render(props))
  }

  dispose() {
    this.lruCache.dispose()
    this.cacheListener.unbind()
    this.storeListener.unbind()
    this.el.remove()
    this.el = null!
  }

  render(props: ChatsViewConnectedProps) {
    if (!props.selectedChatId) {
      this.el.classList.add("chats--empty")
    }
    else {
      this.el.classList.remove("chats--empty")
    }

    if (props.selectedChatId) {
      let chatView = this._getChatViewInstance(props.selectedChatId)

      // hide other ChatViews
      this.lruCache.forEach(v => {
        if (v === chatView) {
          v.show()
        }
        else {
          v.hide()
        }
      })
    }
  }

  /**
   * create / get from cache a chat view
   * @private
   */
  _getChatViewInstance(chatId: string): ChatView {
    let chatView = this.lruCache.get(chatId)

    if (chatView) {
      return chatView
    }

    chatView = new ChatView({ chatId: chatId })

    return this.el.append(chatView.el),
      this.lruCache.set(chatId, chatView),
      chatView
  }
}


interface ChatViewProps {
  chatId: string
}

export class ChatView implements helpers.IDisposable {
  chatId: string
  el: Element
  chat: ChatFeedView
  details: CustomerDetailsView
  api: API
  abort: AbortController

  constructor(props: ChatViewProps, api = $API()) {
    this.api = api
    this.abort = new AbortController()
    this.chatId = props.chatId
    this.el = dom.createEl("div", { className: "chat-container" }, [
      (this.chat = new ChatFeedView({ chatId: props.chatId })).el,
      (this.details = new CustomerDetailsView({ chatId: props.chatId })).el
    ])

    console.warn("uncomment this.details = ... above")
  }

  dispose() {
    this.abort.abort()
    this.chat.dispose()
    // this.details.dispose()
    this.el.remove()
    this.el = null!
  }

  show() {
    this.el.classList.remove("hidden")

    this.api.syncIncompleteThreadsAsync(this.chatId, this.abort.signal)
      .catch(err => console.warn(err))
  }

  hide() {
    this.el.classList.add("hidden")
  }
}

interface ChatFeedViewProps {
  chatId: string
}

export class ChatFeedView implements helpers.IDisposable {
  el: Element
  chatHeader: ChatHeaderView
  chatBody: ChatBodyView
  chatComposer: ComposerView

  constructor(props: ChatFeedViewProps) {
    this.el = dom.createEl("div", {
      className: "chat-feed"
    }, [
      (this.chatHeader = new ChatHeaderView({
        chatId: props.chatId
      })).el,
      (this.chatBody = new ChatBodyView({
        chatId: props.chatId
      })).el,
      (this.chatComposer = new ComposerView({
        chatId: props.chatId
      })).el,
    ])
  }

  dispose() {
    this.chatHeader.dispose()
    this.chatBody.dispose()
    this.chatComposer.dispose()
    this.el.remove()
    this.el = null!
  }
}

interface ChatHeaderViewProps {
  chatId: string
}

interface ChatHeaderViewRenderProps {
  user: User | void
}

export class ChatHeaderView implements helpers.IDisposable {
  el: HTMLDivElement
  headerAvatar: HTMLDivElement
  headerTitle: HTMLDivElement
  dropdown: DropdownView
  listeners: helpers.Listeners
  transferToModal: TransferModalView

  constructor(protected props: ChatHeaderViewProps, lazyConnect = $LazyConnect()) {
    let transferToEl: HTMLButtonElement

    this.listeners = new helpers.Listeners()

    this.el = dom.createEl("div", { className: "chat-header" }, [
      this.headerAvatar = dom.createEl("div", { className: "chat-header-avatar" }),
      dom.createEl("div", { className: "chat-header-details" }, [
        this.headerTitle = dom.createEl("div", { className: "chat-header-title" })
      ]),
      dom.createEl("div", { className: "chat-header-menu" }, [
        (this.dropdown = new DropdownView({
          content: dom.createEl("div", { className: "chat-header-more-button" }, [
            dom.createEl("div", { className: "chat-header-more-label", textContent: "More" }),
            createIconEl({ name: "caret-down-fill", size: 10 })
          ]),
          menuContent: [
            transferToEl = dom.createEl("button", {
              className: "dropdown-item",
              textContent: "Transfer to.."
            }),
            dom.createEl("button", {
              className: "dropdown-item",
              textContent: "Archive",
              onclick: () => alert("todo")
            }),
          ],
          menuContentAlignRight: true
        })).el
      ])
    ])

    this.transferToModal = new TransferModalView({
      chatId: props.chatId
    })

    this.listeners.register(lazyConnect.connect<ChatHeaderViewRenderProps>(
      state => this.mapper(state),
      props => this.render(props)
    ))

    this.listeners.register(
      dom.addListener(transferToEl, "click", () => this.transferToModal.show())
    )
  }

  dispose() {
    AvatarView.removeAvatar(this.headerAvatar)
    this.dropdown.dispose()
    this.listeners.unbindAll()
    this.el.remove()
  }

  protected render(props: ChatHeaderViewRenderProps) {
    if (!props.user) {
      return
    }

    AvatarView.renderAvatar(this.headerAvatar, {
      size: 36,
      alt: props.user.name,
      src: props.user.avatar
    })

    this.headerTitle.textContent = props.user.name
  }

  protected mapper(state: State): ChatHeaderViewRenderProps {
    const chat = state.chatsByIds[this.props.chatId]
    const user = chat ? helpers.getChatRecipient(chat) : void 0

    return { user }
  }
}

interface ChatBodyViewProps {
  chatId: string
}

interface ChatBodyViewConnectedProps {
  chat?: Chat
  myProfileId?: string
}

export class ChatBodyView implements helpers.IDisposable {
  el: Element
  props: ChatBodyViewProps
  messages: Map<string, MessageView>
  messagesEl: Element
  reverseScroll: ReverseScroll
  storeListener: helpers.IListener

  constructor(props: ChatBodyViewProps, store = $Store()) {
    this.messages = new Map()
    this.props = props
    this.el = dom.createEl("div", { className: "chat-body" }, [
      this.messagesEl = dom.createEl("div", { className: "messages" })
    ])
    this.reverseScroll = new ReverseScroll(this.el, this.messagesEl)
    this.storeListener = store.connect<ChatBodyViewConnectedProps>(state => {
      return {
        chat: state.chatsByIds[this.props.chatId],
        myProfileId: state.myProfile?.id,
      }
    }, props => this.render(props))
  }

  dispose() {
    this.storeListener.unbind()
    this.reverseScroll.dispose()
    this.el.remove()
    this.el = null!
  }

  render(props: ChatBodyViewConnectedProps) {
    if (!props.chat || !props.myProfileId) {
      return
    }

    const messages = helpers.getChatMessages(props.chat)

    this.renderMessages(messages, props.chat, props.myProfileId)
  }

  renderMessages(messages: Message[], chat: Chat, myProfileId: string) {
    const messageViews = this.messages

    dom.selectAll(this.messagesEl)
      .data(messages, m => m?.id)
      .join(
        enter => enterMessage(enter),
        update => updateMessage(update),
        exit => exitMessage(exit)
      )

    function enterMessage(enterNode: dom.EnterNode<Message>) {
      const messageView = new MessageView({
        message: enterNode.d,
        author: getMessageAuthor(enterNode.d),
        messageMetaState: getMessageMetaState(enterNode.d),
        myProfileId: myProfileId,
      })

      // save reference to View
      messageViews.set(enterNode.d.id, messageView)

      // append to DOM
      enterNode.append(messageView.el)
    }

    function updateMessage(updateNode: dom.ElementWithDatum<Message>) {
      const d = dom.getDatum(updateNode)

      if (!d) {
        return
      }

      const messageView = messageViews.get(d.id)

      if (!messageView) {
        return
      }

      const messageMetaState = getMessageMetaState(d)

      if (messageMetaState) {
        messageView.setMessageState(messageMetaState)
      }

      if (d.type === "sneak_peek") {
        messageView.setText(d.text)
      }
    }

    function exitMessage(exitNode: dom.ElementWithDatum<Message>) {
      const d = dom.getDatum(exitNode)

      if (!d) {
        return
      }

      const messageView = messageViews.get(d.id)

      if (!messageView) {
        return
      }

      // remove from DOM
      messageView.dispose()

      // remove reference to view
      messageViews.delete(d.id)
    }

    function getMessageMetaState(message: Message): void | MessageMetaState {
      if (message.type === "system_message" || message.authorId !== myProfileId) {
        return
      }

      if (message.type === "message" && message.isSending) {
        return "sending"
      }

      const customer = helpers.getChatRecipient(chat)

      if (customer && customer.seenUpTo > message.createdAt) {
        return "seen"
      }

      return "sent"
    }

    function getMessageAuthor(message: Message) {
      return message.type !== "system_message" ? chat.users[message.authorId] : void 0
    }
  }
}

interface ComposerViewProps {
  chatId: string
}

export class ComposerView implements helpers.IDisposable {
  el: HTMLDivElement
  inputContainer: Element
  input: HTMLTextAreaElement
  sendButton: Element
  buttons: Element
  chatRoute!: ChatRoute
  chatGroupId?: number
  actions: ComposerActions
  listeners: helpers.Listeners
  textAreaAutoResize: TextAreaAutoResize
  autocompleteKey: string
  autocompleteQuery: string
  cannedResponses!: {
    [groupId: number]: CannedResponse[]
  }

  constructor(
    protected props: ComposerViewProps,
    protected api = $API(),
    protected charRouteManager = $CharRouteManager(),
    protected lazyConnect = $LazyConnect(),
  ) {
    this.autocompleteKey = ""
    this.autocompleteQuery = ""
    this.actions = new ComposerActions({ items: [] })

    this.el = dom.createEl("div", { className: "composer" }, [
      this.actions.el,
      this.inputContainer = dom.createEl("div", { className: "composer-container" }, [
        dom.createEl("div", { className: "composer-input-container" }, [
          this.input = dom.createEl("textarea", { className: "composer-input", placeholder: "Message", rows: 1 }),
        ]),
        this.sendButton = dom.createEl("button", { className: "composer-send" }, [
          createIconEl({ name: "arrow-right-circle", size: "1.5em" })
        ])
      ]),
      this.buttons = dom.createEl("div", { className: "composer-buttons" }, [
        dom.createEl("button", { className: "composer-button" }, ["Assign to me"])
      ])
    ])

    this.textAreaAutoResize = new TextAreaAutoResize(this.input)
    this.listeners = new helpers.Listeners()

    this.listeners.register(dom.addListener(this.input, "keydown", (event) => {
      this.handleKeyDown(event)
      this.render()
    }))

    this.listeners.register(dom.addListener(this.input, "keyup", (event) => {
      this.handleKeyUp(event)
      this.render()
    }))

    this.listeners.register(dom.addListener(this.sendButton, "click", (event) => {
      this.handleSend()
    }))

    this.listeners.register(charRouteManager.subscribe(props.chatId, chatRoute => {
      this.chatRoute = chatRoute
      this.render()
    }))

    this.listeners.register(this.actions.addListener("selected", (item) => {
      if (this.autocompleteKey.length > 0) {
        this.replaceAutocompleteQuery(item.text)
        this.render()
      }
    }))

    this.listeners.register(lazyConnect.connect(
      state => {
        return {
          cannedResponses: state.cannedResponses,
          chatGroupId: state.chatsByIds[this.props.chatId]?.groupId
        }
      },
      props => {
        this.cannedResponses = props.cannedResponses
        this.chatGroupId = props.chatGroupId
        this.render()
      }
    ))

    this.api.syncCannedResponses(0).catch(err => console.error(err))

    if (this.chatGroupId) {
      this.api.syncCannedResponses(0).catch(err => console.error(err))
    }
  }

  dispose() {
    this.listeners.unbindAll()
    this.el.remove()
  }

  protected replaceAutocompleteQuery(text: string) {
    const start = (this.input.selectionStart ?? 0) - this.autocompleteKey.length - this.autocompleteQuery.length + text.length

    this.input.value = this.input.value.replace(this.autocompleteKey + this.autocompleteQuery, text);
    this.input.setSelectionRange(start, start)
    this.autocompleteKey = ""
    this.autocompleteQuery = ""
  }

  protected handleKeyDown(event: KeyboardEvent) {
    if (this.autocompleteKey.length > 0) {
      this.actions.handleKeyDown(event)
    }

    if (event.defaultPrevented) {
      return // Do nothing if event already handled
    }

    if (event.key === "Enter" && event.shiftKey === false) {
      event.preventDefault()
      this.handleSend()
      return
    }
  }

  protected handleKeyUp(event: KeyboardEvent) {
    const autocomplete = helpers.extractAutocompleteQuery(this.input.value, this.input.selectionStart || 0)

    this.autocompleteKey = autocomplete.key
    this.autocompleteQuery = autocomplete.query

    if (this.autocompleteKey.length > 0) {
      this.actions.handleKeyUp(event)
    }

    if (event.defaultPrevented) {
      return // Do nothing if event already handled
    }
  }

  protected handleSend() {
    const text = this.input.value.trim()

    if (text.length === 0) {
      return // nothing to send
    }

    this.api.sendMessage(this.props.chatId, text, "all").catch(err => {
      console.warn(err)
    })

    this.input.value = ""
    this.textAreaAutoResize.resize()
  }

  protected render() {
    if (this.chatRoute === "queued" || this.chatRoute === "unassigned" || this.chatRoute === "pinned") {
      dom.toggleEl(this.inputContainer, false)
      dom.toggleEl(this.buttons, true)
      this.renderActionsButtons([{
        title: "Assign to me",
        handler: () => this.api.startChat(this.props.chatId)
      }])
    }
    else if (this.chatRoute === "closed") {
      this.actions.toggle(false)
      console.error(new Error("TODO"))
    }
    else if (this.chatRoute === "other") {
      console.error(new Error("TODO"))
    }
    else if (this.chatRoute === "supervised") {
      console.error(new Error("TODO"))
    }
    else if (this.chatRoute === "my") {
      dom.toggleEl(this.inputContainer, true)
      dom.toggleEl(this.buttons, false)
      this.renderActionsButtons([])
    }

    this.actions.toggle(this.autocompleteKey.length > 0)

    if (this.autocompleteKey.length > 0) {
      const groupIds = [0]

      if (this.chatGroupId) {
        groupIds.push(this.chatGroupId)
      }

      let items = groupIds
        .map(groupId => this.cannedResponses[groupId])
        .reduce<ComposerActionsListItem[]>((prev, curr) => {
          if (Array.isArray(curr)) {
            for (let i = 0; i < curr.length; i++) {
              const cannedResponse = curr[i];

              prev.push({
                id: String(cannedResponse.id),
                title: cannedResponse.tagsStr,
                text: cannedResponse.text,
              })
            }
          }

          return prev
        }, [])

      if (this.autocompleteQuery.length > 0) {
        items = items.filter(item => item.title.includes(this.autocompleteQuery));
      }

      this.actions.setProps({
        items: items
      })
    }
  }

  protected renderActionsButtons<T extends { title: string; handler: () => void }>(actions: T[]) {
    dom.selectAll(this.buttons)
      .data(actions, (d, i) => i)
      .join(
        enter,
        update,
        exit
      )

    function enter(enterNode: dom.EnterNode<T>) {
      enterNode.append(dom.createEl("button", {
        className: "composer-button",
        textContent: enterNode.d.title,
        onclick: enterNode.d.handler
      }))
    }

    function update(updateNode: dom.ElementWithDatum<T>) {
      const d = dom.getDatum(updateNode)

      if (d) {
        updateNode.textContent = d.title
        updateNode.onclick = d.handler
      }
    }

    function exit(exitNode: dom.ElementWithDatum<T>) {
      exitNode.onclick = null
      exitNode.remove()
    }
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

class ComposerActions extends helpers.TypedEventEmitter<ComposerActionsEvents> implements helpers.IDisposable {
  el: HTMLDivElement
  list: HTMLDivElement
  selectedItem: number

  constructor(protected props: ComposerActionsProps) {
    super()

    this.el = dom.createEl("div", { className: "composer-actions" }, [
      this.list = dom.createEl("div", { className: "composer-actions-list" }),
    ])
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

    dom.selectAll(this.list)
      .data(this.props.items, d => d?.id)
      .join(enter, update, exit)

    function enter(node: dom.EnterNode<ComposerActionsListItem>, d: ComposerActionsListItem, i: number) {
      const classNames = helpers.classNames("composer-action", {
        active: that.selectedItem === i
      })
      const item = dom.createEl("div", { className: classNames }, [
        dom.createEl("div", { className: "composer-action-title", textContent: d.title }),
        dom.createEl("div", { className: "composer-action-text", textContent: d.text })
      ])

      item.onclick = function () {
        that.emit("selected", d)
      }

      node.append(item)
    }

    function update(node: dom.ElementWithDatum<ComposerActionsListItem>, d: ComposerActionsListItem, i: number) {
      const selected = that.selectedItem === i

      node.classList.toggle("active", selected)

      if (selected) {
        node.scrollIntoView({ block: "nearest" })
      }
    }

    function exit(node: dom.ElementWithDatum<ComposerActionsListItem>) {
      node.oninput = null
      node.remove()
    }
  }
}

export interface MessageViewProps {
  message: Message
  author?: User
  myProfileId: string
  messageMetaState: MessageMetaState | void
}

export class MessageView implements helpers.IDisposable {
  el: Element
  avatar?: AvatarView
  textEl?: HTMLSpanElement
  messageMeta?: MessageMetaView

  constructor(props: MessageViewProps) {
    const isMyMessage = props.message.type !== "system_message" && (props.message.authorId === props.myProfileId)
    const author = props.author

    this.el = dom.createEl("div", {
      className: helpers.classNames("message", {
        "message-right": isMyMessage
      })
    })

    if (props.message.type === "system_message") {
      this.el.append(
        dom.createEl("div", {
          className: "message-system",
          textContent: props.message.text,
        })
      )
    }
    else if (props.message.type === "file") {
      if (author && !isMyMessage) {
        this.el.append(
          dom.createEl("div", { className: "message-avatar" }, [
            (this.avatar = new AvatarView({
              src: author.avatar,
              alt: author.name,
              size: 36
            })).el
          ])
        )
      }

      this.el.append(
        dom.createEl("div", { className: "message-bubble" }, [
          dom.createEl("div", { className: "message-file" }, [
            dom.createEl("div", { className: "message-file-icon" }, [
              createIconEl({ name: "file-earmark", size: 24 })
            ]),
            dom.createEl("div", { className: "message-file-details" }, [
              dom.createEl("div", {
                className: "message-file-title",
                textContent: props.message.name,
              }),
              dom.createEl("div", {
                className: "message-file-subtitle",
                textContent: props.message.size + "mb",
              })
            ])
          ]),
          props.messageMetaState ? (this.messageMeta = new MessageMetaView({
            time: helpers.formatTime(props.message.createdAt),
            isSticky: true,
            isFloat: false,
            inContrast: false,
            state: props.messageMetaState
          })).el : ""
        ])
      )
    }
    else if (props.message.type === "filled_form") {
      if (author && !isMyMessage) {
        this.el.append(
          dom.createEl("div", { className: "message-avatar" }, [
            (this.avatar = new AvatarView({
              src: author.avatar,
              alt: author.name,
              size: 36
            })).el
          ])
        )
      }

      this.el.append(
        dom.createEl("div", { className: "message-bubble" }, [
          dom.createEl(
            "dl",
            { className: "definitions-list" },
            props.message.fields.reduce<HTMLElement[]>((prevVal, field) => {
              prevVal.push(dom.createEl("dt", {
                textContent: field.name
              }))
              prevVal.push(dom.createEl("dd", {
                textContent: field.value
              }))

              return prevVal;
            }, [])
          ),
          props.messageMetaState ? (this.messageMeta = new MessageMetaView({
            time: helpers.formatTime(props.message.createdAt),
            isSticky: true,
            isFloat: false,
            inContrast: false,
            state: props.messageMetaState
          })).el : ""
        ])
      )
    }
    else if (props.message.type === "rich_message") {
      if (author && !isMyMessage) {
        this.el.append(
          dom.createEl("div", { className: "message-avatar" }, [
            (this.avatar = new AvatarView({
              src: author.avatar,
              alt: author.name,
              size: 36
            })).el
          ])
        )
      }

      if (props.message.templateId === "quick_replies") {
        this.el.append(
          dom.createEl("div", { className: "message-rich" }, [
            dom.createEl("div", { className: "message-rich-title", textContent: "Hello" }, [
              props.messageMetaState ? (this.messageMeta = new MessageMetaView({
                time: helpers.formatTime(props.message.createdAt),
                isSticky: true,
                isFloat: false,
                inContrast: false,
                state: props.messageMetaState
              })).el : ""
            ]),
            dom.createEl("div", { className: "message-buttons" }, [
              dom.createEl("button", { className: "message-button", textContent: "button.text" }),
              dom.createEl("button", { className: "message-button", textContent: "button.text" }),
              dom.createEl("button", { className: "message-button", textContent: "button.text" }),
              dom.createEl("button", { className: "message-button", textContent: "button.text" }),
              dom.createEl("button", { className: "message-button", textContent: "button.text" }),
            ])
          ]),
        )
      }
      else {
        this.el.append(
          dom.createEl("div", {
            className: "message-bubble",
            textContent: "Unsupported type of rich message"
          })
        )
      }
    }
    else if (props.message.type === "message") {
      if (author && !isMyMessage) {
        this.el.append(
          dom.createEl("div", { className: "message-avatar" }, [
            (this.avatar = new AvatarView({
              src: author.avatar,
              alt: author.name,
              size: 36
            })).el
          ])
        )
      }

      this.el.append(
        dom.createEl("div", { className: "message-bubble" }, [
          dom.createEl("span", { className: "message-text", textContent: props.message.text }),
          props.messageMetaState ? (this.messageMeta = new MessageMetaView({
            time: helpers.formatTime(props.message.createdAt),
            isSticky: false,
            isFloat: false,
            inContrast: false,
            state: props.messageMetaState
          })).el : ""
        ]),
      )
    }
    else if (props.message.type === "sneak_peek") {
      if (author && !isMyMessage) {
        this.el.append(
          dom.createEl("div", { className: "message-avatar" }, [
            (this.avatar = new AvatarView({
              src: author.avatar,
              alt: author.name,
              size: 36
            })).el
          ])
        )
      }

      this.el.append(
        dom.createEl("div", { className: "message-bubble" }, [
          dom.createEl("span", { textContent: "✍️ " }),
          this.textEl = dom.createEl("span", { className: "message-text", textContent: props.message.text }),
          props.messageMetaState ? (this.messageMeta = new MessageMetaView({
            time: helpers.formatTime(props.message.createdAt),
            isSticky: false,
            isFloat: false,
            inContrast: false,
            state: props.messageMetaState
          })).el : ""
        ]),
      )
    }
  }

  setMessageState(state: MessageMetaState) {
    this.messageMeta?.setState(state)
  }

  setText(text: string) {
    if (this.textEl) {
      this.textEl.textContent = text
    }
  }

  dispose() {
    this.messageMeta?.dispose()
    this.avatar?.dispose()
    this.el.remove()
  }
}

/**
 * It shows time when message was create, sending progress and reading indicator
 */

type MessageMetaState = "sending" | "sent" | "seen"

interface MessageMetaViewProps {
  time: string
  isFloat: boolean
  isSticky: boolean
  inContrast: boolean
  state: MessageMetaState
}

class MessageMetaView implements helpers.IDisposable {
  el: HTMLDivElement

  constructor(props: MessageMetaViewProps) {
    const className = helpers.classNames("message-meta", {
      "message-meta-float": props.isFloat,
      "message-meta-sticky": props.isSticky,
      "message-meta-contrast": props.inContrast,
    })

    this.el = dom.createEl("div", { className: className }, [
      dom.createEl("span", { textContent: props.time }),
      createIconEl({ name: "clock", size: "1em", className: "message-meta-clock" }),
      createIconEl({ name: "check2", size: "1em", className: "message-meta-check2" }),
      createIconEl({ name: "check2-all", size: "1em", className: "message-meta-check2-all" }),
    ])

    this.el.dataset.state = props.state ?? ""
  }

  setState(state: MessageMetaState) {
    this.el.dataset.state = state
  }

  dispose() {
    this.el.remove()
    this.el = null!
  }
}


interface DetailsViewProps {
  chatId: string
}

interface DetailsViewConnProps {
  user: User | void
}

export class CustomerDetailsView implements helpers.IDisposable {
  el: HTMLDivElement
  detailsAvatar: HTMLDivElement
  name: HTMLDivElement
  email: HTMLDivElement
  location: HTMLDivElement
  locationRow: HTMLDivElement
  ipRow: HTMLDivElement
  ip: HTMLDivElement
  generalInfoRow: HTMLDivElement
  generalInfoList: HTMLDListElement
  sessionFieldsRow: HTMLDivElement
  sessionFieldsList: HTMLDListElement
  lastPagesRow: HTMLDivElement
  lastPagesList: HTMLDListElement
  connProps: DetailsViewConnProps
  storeListener: helpers.IListener

  constructor(
    protected props: DetailsViewProps,
    protected store = $Store(),
    protected lazyConnect = $LazyConnect()
  ) {
    this.connProps = this.storeMapper(this.store.getState())
    this.el = dom.createEl("div", { className: "details" }, [
      dom.createEl("div", { className: "details-header" }, [
        dom.createEl("div", { className: "details-title", textContent: "Details" }),
        dom.createEl("button", {
          className: "details-close hidden", innerHTML: `
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
          </svg>
        ` }),
      ]),
      dom.createEl("div", { className: "details-body" }, [
        dom.createEl("div", { className: "details-row" }, [
          this.detailsAvatar = dom.createEl("div", { className: "details-avatar" }),
          dom.createEl("div", {}, [
            this.name = dom.createEl("div", { className: "text-primary", textContent: this.connProps.user ? this.connProps.user.name : "" }),
            this.email = dom.createEl("div", { className: "text-small", textContent: this.connProps.user ? this.connProps.user.email : "" })
          ])
        ]),

        this.locationRow = dom.createEl("div", { className: "details-row" }, [
          dom.createEl("div", {
            className: "details-icon", innerHTML: `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-geo-alt" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M12.166 8.94C12.696 7.867 13 6.862 13 6A5 5 0 0 0 3 6c0 .862.305 1.867.834 2.94.524 1.062 1.234 2.12 1.96 3.07A31.481 31.481 0 0 0 8 14.58l.208-.22a31.493 31.493 0 0 0 1.998-2.35c.726-.95 1.436-2.008 1.96-3.07zM8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10z" />
              <path fill-rule="evenodd" d="M8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            </svg>
          `}),
          this.location = dom.createEl("div", { className: "text-primary", textContent: "..." })
        ]),

        this.ipRow = dom.createEl("div", { className: "details-row" }, [
          dom.createEl("div", {
            className: "details-icon", innerHTML: `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-wifi" viewBox="0 0 16 16">
              <path d="M15.385 6.115a.485.485 0 0 0-.048-.736A12.443 12.443 0 0 0 8 3 12.44 12.44 0 0 0 .663 5.379a.485.485 0 0 0-.048.736.518.518 0 0 0 .668.05A11.448 11.448 0 0 1 8 4c2.507 0 4.827.802 6.717 2.164.204.148.489.13.668-.049z" />
              <path d="M13.229 8.271c.216-.216.194-.578-.063-.745A9.456 9.456 0 0 0 8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065A8.46 8.46 0 0 1 8 7a8.46 8.46 0 0 1 4.577 1.336c.205.132.48.108.652-.065zm-2.183 2.183c.226-.226.185-.605-.1-.75A6.472 6.472 0 0 0 8 9c-1.06 0-2.062.254-2.946.704-.285.145-.326.524-.1.75l.015.015c.16.16.408.19.611.09A5.478 5.478 0 0 1 8 10c.868 0 1.69.201 2.42.56.203.1.45.07.611-.091l.015-.015zM9.06 12.44c.196-.196.198-.52-.04-.66A1.99 1.99 0 0 0 8 11.5a1.99 1.99 0 0 0-1.02.28c-.238.14-.236.464-.04.66l.706.706a.5.5 0 0 0 .708 0l.707-.707z" />
            </svg>
          `}),
          this.ip = dom.createEl("div", { className: "text-primary", textContent: "..." })
        ]),

        this.generalInfoRow = dom.createEl("div", { className: "details-row" }, [
          this.generalInfoList = dom.createEl("dl", { className: "definitions-list" })
        ]),

        this.sessionFieldsRow = dom.createEl("div", { className: "details-row" }, [
          dom.createEl("div", {}, [
            dom.createEl("div", { className: "regular-text py-2", textContent: "Session Fields" }),
            this.sessionFieldsList = dom.createEl("dl", { className: "definitions-list" })
          ])
        ]),

        this.lastPagesRow = dom.createEl("div", { className: "details-row" }, [
          dom.createEl("div", {}, [
            dom.createEl("div", { className: "regular-text py-2", textContent: "Last Pages" }),
            this.lastPagesList = dom.createEl("dl", { className: "definitions-list" })
          ])
        ]),

        /**
         * @todo add handlers
         */
        dom.createEl("div", { className: "details-actions hidden" }, [
          dom.createEl("a", { className: "details-action", textContent: "Edit visitor" }),
          dom.createEl("a", { className: "details-action details-action-destroy", textContent: "Ban visitor" })
        ])
      ])
    ])

    this.storeListener = lazyConnect.connect(
      s => this.storeMapper(s),
      p => this.render(p)
    )
  }

  dispose() {
    AvatarView.removeAvatar(this.detailsAvatar)
    this.storeListener.unbind()
    this.el.remove()
  }

  protected storeMapper(state: State): DetailsViewConnProps {
    const chat = state.chatsByIds[this.props.chatId]
    const customer = chat ? helpers.getChatRecipient(chat) : void 0

    return { user: customer }
  }

  protected render(props: DetailsViewConnProps) {
    const user = props.user
    const lastVisit = user && user.type === "customer" ? user.lastVisit : void 0
    const statistics = user && user.type === "customer" ? user.statistics : void 0
    const fields = user && user.type === "customer" ? user.fields : void 0
    const geolocation = lastVisit ? lastVisit.geolocation : void 0

    this.name.textContent = user ? user.name : "Unnamed customer"
    this.email.textContent = user ? user.email : "-"
    this.location.textContent = geolocation ? helpers.stringifyGeolocation(geolocation) : "Mars 🛸"
    this.ip.textContent = lastVisit ? lastVisit.ip : "127.0.0.1"

    // show or hide row
    dom.toggleEl(this.locationRow, Boolean(geolocation))
    dom.toggleEl(this.ipRow, Boolean(lastVisit))

    this.renderAvatar(user)
    this.renderGeneralInfo(lastVisit, statistics)
    this.renderSessionFields(fields)
    this.renderLastPages(lastVisit?.lastPages)
  }

  protected renderAvatar(user: User | void) {
    dom.toggleEl(this.detailsAvatar, Boolean(user))

    if (!user) {
      AvatarView.removeAvatar(this.detailsAvatar)
    }
    else {
      AvatarView.renderAvatar(this.detailsAvatar, {
        size: 48,
        alt: user.name,
        src: user.avatar
      })
    }
  }

  protected renderGeneralInfo(lastVisit?: CustomerLastVisit, statistics?: CustomerStatistics) {
    dom.toggleEl(this.generalInfoList, Boolean(lastVisit && statistics))

    const data: string[] = []

    if (lastVisit?.referrer) {
      data.push("Referrer", lastVisit.referrer)
    }

    if (lastVisit?.userAgent) {
      data.push("Browser", lastVisit.userAgent)
    }

    if (statistics) {
      data.push("Total visits", String(statistics.visitsCount))
    }

    this.renderList(this.generalInfoList, data)
  }

  protected renderSessionFields(fields?: Fields) {
    const data = (fields || []).reduce<string[]>((prev, curr) => {
      return prev.push(curr.name, curr.value), prev
    }, [])

    dom.toggleEl(this.sessionFieldsRow, data.length > 0)
    this.renderList(this.sessionFieldsList, data)
  }

  protected renderLastPages(lastPages?: VisitedPage[]) {
    const data = (lastPages || []).reduce<string[]>((prev, curr) => {
      return prev.push(curr.title, curr.title), prev
    }, [])

    dom.toggleEl(this.lastPagesRow, data.length > 0)
    this.renderList(this.lastPagesList, data)
  }

  protected renderList(container: HTMLElement, data: string[]) {
    dom.selectAll(container)
      .data(data, (d, i) => i)
      .join(enter, update, exit)

    function enter(enterNode: dom.EnterNode<string>, d: string, i: number) {
      enterNode.append(dom.createEl(i % 2 ? "dd" : "dt", { textContent: enterNode.d }))
    }

    function update(updateNode: dom.ElementWithDatum<string>) {
      updateNode.textContent = dom.getDatum(updateNode) ?? "n/a"
    }

    function exit(exitNode: HTMLElement) {
      exitNode.remove()
    }
  }
}

interface AvatarProps {
  size: number
  alt: string
  src?: string
}

export class AvatarView implements helpers.IDisposable {
  static avatars = new WeakMap<HTMLElement, AvatarView>()

  static renderAvatar(container: HTMLElement, props: AvatarProps) {
    let avatar = AvatarView.avatars.get(container)

    if (!avatar) {
      AvatarView.avatars.set(container, avatar = new AvatarView(props))

      container.append(avatar.el)
    }
    else {
      avatar.setAlt(props.alt)
      avatar.setSrc(props.src)
    }
  }

  static removeAvatar(container: HTMLElement) {
    const avatar = AvatarView.avatars.get(container)

    if (avatar) {
      avatar.dispose()
    }
  }

  el: HTMLDivElement
  img?: HTMLImageElement
  alt: HTMLDivElement
  imgListener?: dom.DomListener

  constructor(
    protected props: AvatarProps
  ) {
    const className = helpers.classNames("avatar", { "avatar-no-img": !props.src })
    const altText = helpers.getInitials(props.alt)

    this.el = dom.createEl("div", { className: className }, [
      props.src ? (this.img = dom.createEl("img", { className: "avatar-img", src: props.src })) : "",
      this.alt = dom.createEl("div", { className: "avatar-alt", textContent: altText })
    ])

    this.el.style.width = `${props.size}px`
    this.el.style.height = `${props.size}px`
    this.alt.style.lineHeight = `${props.size}px`

    if (this.img) {
      this.imgListener = dom.addListener(this.img, "error", () => this.handleImgError())
    }
  }

  dispose() {
    this.imgListener?.dispose()
    this.el.remove()
  }

  setAlt(alt: string) {
    if (this.props.alt === alt) return // no changes
    if (this.img) this.img.alt = alt
    this.alt.textContent = helpers.getInitials(alt)
    this.props.alt === alt
  }

  setSrc(src?: string) {
    if (this.props.src === src) {
      return // no changes
    }

    if (this.img && src) {
      this.img.src = src
    }

    /**
     * @todo handle case when src has changed to empty
     */

    this.props.src = src
  }

  protected handleImgError() {
    this.el.classList.add("avatar-no-img")
  }
}

interface IconViewProps {
  name: "moon" | "search" | "file-earmark" | "arrow-right-circle" | "clock" | "check2" | "check2-all" | "caret-down-fill"
  size?: string | number
  className?: string
}

export function createIconEl(props: IconViewProps) {
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
  else if (props.name === "file-earmark") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path")

    path.setAttribute("d", "M4 0h5.5v1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h1V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z")
    path2.setAttribute("d", "M9.5 3V0L14 4.5h-3A1.5 1.5 0 0 1 9.5 3z")
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
  else if (props.name === "clock") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path")

    path.setAttribute("fill-rule", "evenodd")
    path2.setAttribute("fill-rule", "evenodd")
    path.setAttribute("d", "M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm8-7A8 8 0 1 1 0 8a8 8 0 0 1 16 0z")
    path2.setAttribute("d", "M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z")
    svg.appendChild(path)
    svg.appendChild(path2)
  }
  else if (props.name === "check2") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")

    path.setAttribute("fill-rule", "evenodd")
    path.setAttribute("d", "M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z")
    svg.appendChild(path)
  }
  else if (props.name === "check2-all") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path")

    path.setAttribute("fill-rule", "evenodd")
    path2.setAttribute("fill-rule", "evenodd")
    path.setAttribute("d", "M12.354 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z")
    path2.setAttribute("d", "M6.25 8.043l-.896-.897a.5.5 0 1 0-.708.708l.897.896.707-.707zm1 2.414l.896.897a.5.5 0 0 0 .708 0l7-7a.5.5 0 0 0-.708-.708L8.5 10.293l-.543-.543-.707.707z")
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

interface CheckboxViewProps {
  id: string
}

interface CheckboxChangeEvent {
  nativeEvent: Event
  value: boolean
}

interface CheckboxViewEvents {
  change(event: CheckboxChangeEvent): void
}

export class CheckboxView extends helpers.TypedEventEmitter<CheckboxViewEvents> implements helpers.IDisposable {
  el: Element
  input: HTMLInputElement
  label: Element
  changeListener: helpers.IListener
  clickListener: helpers.IListener

  constructor(props: CheckboxViewProps) {
    super()

    this.el = dom.createEl("span", { className: "checkbox-container" }, [
      this.input = dom.createEl("input", { type: "checkbox", className: "checkbox", id: props.id }),
      this.label = dom.createEl("label", { className: "checkbox-label", htmlFor: props.id })
    ])

    this.changeListener = dom.addListener(this.input, "change", event => this.handleChange(event))
    this.clickListener = dom.addListener(this.el, "click", event => {
      event.stopPropagation()
    })
  }

  dispose() {
    this.changeListener.unbind()
    this.clickListener.unbind()
    this.label = null!
    this.input = null!
    this.el.remove()
    this.el = null!
  }

  getValue() {
    return this.input.checked
  }

  setValue(value: boolean) {
    this.input.checked = value
  }

  handleChange(event: Event) {
    this.emit("change", {
      nativeEvent: event,
      value: this.input.checked
    })
  }
}

interface DropdownViewProps {
  content: Element
  menuContent: (string | Node)[]
  menuContentAlignRight?: boolean
}

class DropdownView implements helpers.IDisposable {
  el: Element
  timerId?: number
  listeners: helpers.Listeners

  constructor(props: DropdownViewProps) {
    const menuClassName = helpers.classNames("dropdown-menu", {
      "dropdown-menu--align-right": props.menuContentAlignRight
    })

    this.el = dom.createEl("div", { className: "dropdown" }, [
      props.content,
      dom.createEl("div", { className: menuClassName }, props.menuContent)
    ])
    this.listeners = new helpers.Listeners(
      dom.addListener(this.el, "mouseenter", () => this.handleMouseEnter()),
      dom.addListener(this.el, "mouseleave", () => this.handleMouseLeave()),
    )
  }

  dispose() {
    clearTimeout(this.timerId)
    this.listeners.unbindAll()
    this.el.remove()
    this.el = null!
  }

  handleMouseEnter() {
    clearTimeout(this.timerId)
    this.el.classList.add("dropdown-mouse-enter")
  }

  handleMouseLeave() {
    clearTimeout(this.timerId)
    this.timerId = window.setTimeout(() => {
      this.el.classList.remove("dropdown-mouse-enter")
    }, 200)
  }
}

interface SearchControlProps {
  placeholder?: string
}

interface SearchControlEvents {
  onChange(value: string): void
}

export class SearchControlView extends helpers.TypedEventEmitter<SearchControlEvents> implements helpers.IDisposable {
  el: HTMLDivElement
  input: HTMLInputElement

  constructor(props: SearchControlProps) {
    super()

    this.el = dom.createEl("div", { className: "search" }, [
      dom.createEl("label", { className: "search-label", htmlFor: "search", }, [
        createIconEl({ name: "search", size: 12 })
      ]),
      this.input = dom.createEl("input", {
        id: "search",
        type: "text",
        placeholder: props.placeholder ?? "Search",
        className: "search-input",
        autocomplete: "off",
      })
    ])

    this.input.oninput = () => this.handleInput()
  }

  dispose() {
    this.input.oninput = null!
    this.el.remove()
  }

  protected handleInput() {
    this.emit("onChange", this.input.value)
  }
}

export class ModalView implements helpers.IDisposable {
  el: HTMLDivElement
  dialog: HTMLDivElement
  content: HTMLDivElement
  backdrop: HTMLDivElement
  isShown: boolean

  constructor() {
    this.isShown = false
    this.el = dom.createEl("div", { className: "modal", tabIndex: -1 }, [
      this.dialog = dom.createEl("div", { className: "modal-dialog" }, [
        this.content = dom.createEl("div", { className: "modal-content" })
      ])
    ])

    this.backdrop = dom.createEl("div", { className: "modal-backdrop" })

    document.body.append(this.backdrop, this.el)
  }

  dispose() {
    this.el.onkeydown = null!
    this.el.onclick = null!
    this.el.remove()
    this.backdrop.remove()
  }

  show() {
    if (this.isShown) {
      return
    }

    this.isShown = true
    this.el.classList.add("show")
    this.backdrop.classList.add("show")

    this.el.onkeydown = event => {
      if (event.code === "Escape") {
        this.hide()
      }
    }

    this.el.onclick = event => {
      if (event.target !== event.currentTarget) {
        return
      }

      this.hide()
    }
  }

  hide() {
    if (!this.isShown) {
      return
    }

    this.isShown = false
    this.el.classList.remove("show")
    this.backdrop.classList.remove("show")
    this.el.onkeydown = null!
    this.el.onclick = null!
  }
}

interface TransferModalViewProps {
  chatId: string
}

export class TransferModalView extends ModalView implements helpers.IDisposable {
  abort: AbortController
  body: HTMLDivElement
  footer: HTMLDivElement
  loaderEl: HTMLDivElement
  list: HTMLDivElement
  listAvatars: WeakMap<HTMLButtonElement, HTMLDivElement>
  input: HTMLInputElement
  search: SearchControlView
  isFetching: boolean
  agents: Agent[]
  groups: Group[]
  filterQuery: string

  constructor(protected props: TransferModalViewProps, protected api = $API()) {
    super()

    this.content.append(
      (this.search = new SearchControlView({ placeholder: "Search" })).el,
      this.body = dom.createEl("div", {}, [
        this.loaderEl = dom.createEl("div", { className: "p-5 text-center", textContent: "Loading.." }),
        this.list = dom.createEl("div", { className: "list-group" }),
      ]),
      this.footer = dom.createEl("div", { className: "" }, [
        this.input = dom.createEl("input", { className: "form-control", placeholder: "Add a comment..." })
      ]),
    )

    this.listAvatars = new WeakMap()
    this.abort = new AbortController()
    this.isFetching = true
    this.agents = []
    this.groups = []
    this.filterQuery = ""
    this.input.oninput = () => {
      this.filterQuery = this.input.value
      this.render()
    }

    this.render()
  }

  dispose() {
    this.abort.abort()
  }

  show() {
    super.show()
    this.input.value = ""
    this.filterQuery = ""
    this.input.focus()
    this.syncData()
  }

  protected syncData() {
    this.isFetching = true
    this.render()

    const promise = this.api.fetchAgents()
      .then(agents => this.agents = agents)

    const promise2 = this.api.fetchGroups({ fields: ["routing_status"] })
      .then(groups => this.groups = groups)

    return Promise.all([promise, promise2])
      .catch(err => console.error(err))
      .finally(() => {
        this.isFetching = false
        this.render()
      })
  }

  protected getFilteredData() {
    const agents = this.filterQuery.length === 0
      ? this.agents
      : this.agents.filter(a => a.name.localeCompare(this.filterQuery))

    const groups = this.filterQuery.length === 0
      ? this.groups
      : this.groups.filter(g => g.name.localeCompare(this.filterQuery))

    const data = agents.map(a => ({
      id: a.id,
      title: a.name,
      subTitle: a.jobTitle,
      avatarUrl: a.avatarUrl,
      onClick: () => this.transferToAgent(a.id)
    }))

    return data.concat(groups.map(g => ({
      id: g.id.toString(),
      title: g.name,
      subTitle: g.routingStatus,
      avatarUrl: "",
      onClick: () => this.transferToGroup(g.id)
    })))
  }

  protected transferToAgent(agentId: string) {
    return this.api.transferChat({
      id: this.props.chatId,
      target: {
        type: "agent",
        ids: [agentId]
      },
      force: true
    })
      .then(() => this.hide())
      .catch(err => alert(err.message))
  }

  protected transferToGroup(groupId: number) {
    return this.api.transferChat({
      id: this.props.chatId,
      target: {
        type: "group",
        ids: [groupId]
      },
      force: true
    })
      .then(() => this.hide())
      .catch(err => alert(err.message))
  }

  protected render() {
    const data = this.getFilteredData()

    dom.toggleEl(this.loaderEl, this.isFetching)
    dom.toggleEl(this.list, !this.isFetching)

    dom.selectAll(this.list)
      .data(data, d => d?.id)
      .join(
        (enter, d) => enter.append(TransferModalListItem.enter(d)),
        (update, d) => TransferModalListItem.update(update, d),
        exit => TransferModalListItem.exit(exit)
      )
  }
}

interface ListGroupItemProps {
  title: string
  subTitle: string
  avatarUrl?: string
  onClick(): void
}

class TransferModalListItem implements helpers.IDisposable {
  // static
  static instances = new WeakMap<HTMLElement, TransferModalListItem>()

  static enter(props: ListGroupItemProps) {
    const listGroupItem = new TransferModalListItem(props)

    TransferModalListItem.instances.set(listGroupItem.el, listGroupItem)

    return listGroupItem.el
  }

  static update(el: HTMLElement, props: ListGroupItemProps) {
    const listGroupItem = TransferModalListItem.instances.get(el)

    if (listGroupItem) {
      listGroupItem.setProps(props)
    }
  }

  static exit(el: HTMLElement) {
    const listGroupItem = TransferModalListItem.instances.get(el)

    if (listGroupItem) {
      listGroupItem.dispose()
    }
  }

  // class
  el: HTMLButtonElement
  title: HTMLDivElement
  sutTitle: HTMLDivElement
  avatarContainer: HTMLDivElement
  clickListener: helpers.IListener

  constructor(protected props: ListGroupItemProps) {
    this.el = dom.createEl("button", { className: "list-group-item list-group-item-action", type: "button" }, [
      dom.createEl("div", { className: "d-flex align-items-center" }, [
        this.avatarContainer = dom.createEl("div", { className: "pr-2" }),
        dom.createEl("div", {}, [
          this.title = dom.createEl("div", { className: "text-primary", innerText: props.title }),
          this.sutTitle = dom.createEl("div", { className: "text-secondary", innerText: props.subTitle }),
        ])
      ])
    ])

    this.clickListener = dom.addListener(this.el, "click", () => this.handleClick())

    AvatarView.renderAvatar(this.avatarContainer, {
      size: 42,
      alt: props.subTitle,
      src: props.avatarUrl
    })
  }

  dispose() {
    AvatarView.removeAvatar(this.avatarContainer)
    this.clickListener.unbind()
    this.el.remove()
  }

  setProps(props: ListGroupItemProps) {
    this.props = props
    this.render()
  }

  protected handleClick() {
    if (typeof this.props.onClick === "function") {
      this.props.onClick()
    }
  }

  protected render() {
    this.title.textContent = this.props.title
    this.sutTitle.textContent = this.props.subTitle

    AvatarView.renderAvatar(this.avatarContainer, {
      size: 42,
      alt: this.props.subTitle,
      src: this.props.avatarUrl
    })
  }
}
