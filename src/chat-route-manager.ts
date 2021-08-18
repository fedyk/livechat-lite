import { createInjector, getChatRoute, IDisposable, IListener, unique } from "./helpers"
import { ChatRouter, ChatRouterTransition } from "./services"
import { Store } from "./store"
import { ChatRoute } from "./types"

interface Subscriber {
  (chatRoute: ChatRoute): void
}

export const $CharRouteManager = createInjector<CharRouteManager>()

export class CharRouteManager implements IDisposable {
  store: Store
  chatRouter: ChatRouter
  routeChangeSubscribers: Map<string, Subscriber[]>
  routeChangeListener: IListener

  constructor(store: Store, chatRouter: ChatRouter) {
    this.store = store
    this.chatRouter = chatRouter
    this.routeChangeSubscribers = new Map()
    this.routeChangeListener = this.chatRouter.addListener("routeChange", transition => {
      this.handleRouteChange(transition)
    })
  }

  dispose() {
    this.routeChangeSubscribers.clear()
    this.routeChangeListener.unbind()
  }

  getCurrentChatRoute(chatId: string) {
    const transition = this.chatRouter.transitions.get(chatId)

    if (transition) {
      return transition.initialChatRoute
    }

    return this.getChatRoute(chatId)
  }

  beginChatTransition(chatId: string) {
    const prevChatRoute = this.getChatRoute(chatId)
    const commitChatTransition = (requesterId: string | void) => {
      const nextChatRoute = this.getChatRoute(chatId)

      if (!nextChatRoute) {
        return
      }

      this.chatRouter.setChatRoute(
        chatId,
        prevChatRoute,
        nextChatRoute,
        requesterId
      )
    }

    return {
      commitChatTransition
    }
  }

  subscribe(chatId: string, subscriber: Subscriber): IListener {
    const subscribers = this.routeChangeSubscribers.get(chatId)
    const chatRoute = this.getChatRoute(chatId)

    if (!subscribers) {
      this.routeChangeSubscribers.set(chatId, [subscriber])
    }
    else {
      subscribers.push(subscriber)
    }

    // initial call
    if (chatRoute) {
      subscriber(chatRoute)
    }

    return {
      unbind: () => this.unsubscribe(chatId, subscriber)
    }
  }

  unsubscribe(chatId: string, subscriber: Subscriber) {
    const subscribers = this.routeChangeSubscribers.get(chatId)

    if (!subscribers) {
      return
    }

    this.routeChangeSubscribers.set(chatId, subscribers.filter(v => v !== subscriber))
  }

  protected handleRouteChange(t: ChatRouterTransition) {
    const state = this.store.getState()
    let chatIds = state.chatIds

    this.emitSubscribers(t)

    if (t.finalChatRoute === "my") {
      chatIds = unique([t.chatId], chatIds)
    }

    if (t.finalChatRoute === "queued") {
      chatIds = unique([t.chatId], chatIds)
    }

    if (t.finalChatRoute === "unassigned") {
      chatIds = unique([t.chatId], chatIds)
    }

    if (t.finalChatRoute === "supervised") {
      chatIds = unique([t.chatId], chatIds)
    }

    this.store.setChatIds(chatIds)
  }

  protected emitSubscribers(t: ChatRouterTransition) {
    const subscribers = this.routeChangeSubscribers.get(t.chatId)

    if (!subscribers) {
      return
    }

    for (let i = 0; i < subscribers.length; i++) {
      subscribers[i](t.finalChatRoute);
    }
  }

  protected getChatRoute(chatId: string) {
    const state = this.store.getState()
    const myProfileId = state.myProfile?.id
    const chat = state.chatsByIds[chatId]

    if (!myProfileId) {
      return
    }

    if (!chat) {
      return
    }

    return getChatRoute(chat, myProfileId)
  }
}
