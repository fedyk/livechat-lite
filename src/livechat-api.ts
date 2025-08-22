import { AbortError, ErrorWithType } from "./helpers.js"
import { ProgressSignal } from "./services.js"

export namespace v35 {
  export namespace agent {
    export interface Chat {
      id: string
      users: User[]
      threads: Thread[]
      access: Access
      is_followed: boolean
      properties: ChatProperties
    }

    export interface Thread {
      id: string
      active: boolean
      incomplete: boolean
      events: Event[]
      access: Access
      highlight: Highlight[]
      properties: ThreadProperties
      restricted_access: string
      queue: Queue | null
      tags: string[]
      created_at: Date
      next_thread_id: string
      previous_thread_id: string
    }

    export interface Access {
      group_ids: number[]
    }

    export type User = Agent | Customer

    export type Visibility = "all" | "agents"

    export interface Agent {
      id: string
      type: "agent"
      visibility: Visibility
      name: string
      email: string
      present: boolean
      avatar: string
      events_seen_up_to: Date
    }

    export interface Customer {
      id: string
      type: "customer"
      name: string
      email: string
      email_verified: boolean
      avatar: string
      present: boolean
      last_visit: CustomerVisit | null
      created_at: Date
      events_seen_up_to: Date
      statistics: Statistics
      session_fields: SessionField[]
    }

    export interface Queue {
      position: number
      wait_time: number
      queued_at: Date
    }

    export type QueuePositions = QueuePosition[]

    export interface QueuePosition {
      chat_id: string
      thread_id: string
      queue: Queue
    }

    export interface MyProfile {
      id: string
      name: string
      email: string
      avatar: string
      permission: string
      routing_status: RoutingStatus
    }

    export interface License {
      id: number
    }

    export type Event = MessageEvent
      | SystemMessageEvent
      | FilledFormEvent
      | FormEvent
      | FileEvent
      | AnnotationEvent
      | CustomEvent
      | RichMessageEvent

    export interface MessageEvent {
      id: string
      type: "message"
      custom_id: string
      text: string
      author_id: string
      visibility: Visibility
      properties: EventProperties
      postback: Postback | null
      created_at: Date
    }

    export interface SystemMessageEvent {
      id: string
      type: "system_message"
      custom_id: string
      text: string
      system_message_type: string
      created_at: Date
      visibility: Visibility
      text_vars: Record<string, string>
      properties: EventProperties
    }

    export interface FilledFormEvent {
      id: string
      type: "filled_form"
      custom_id: string
      author_id: string
      created_at: Date
      form_id: string
      form_type: FormType
      visibility: Visibility
      properties: EventProperties
      fields: FilledFormField[]
    }

    export type FormType = "prechat" | "postchat" | "ask_for_email" | string

    export interface FormEvent {
      id: string
      type: "form"
      custom_id: string
      author_id: string
      created_at: Date
      form_id: string
      form_type: string
      visibility: Visibility
      properties: EventProperties
      fields: FilledFormField[]
    }

    export interface FileEvent {
      id: string
      custom_id?: string
      type: "file"
      visibility: Visibility
      properties: EventProperties
      url: string
      alternative_text?: string
      author_id: string
      name: string
      content_type: string
      size: number
      thumbnail_url: string
      thumbnail2x_url: string
      width: number
      height: number
      created_at: Date
    }

    export interface AnnotationEvent {
      id: string
      custom_id: string
      type: "annotation"
      author_id: string
      created_at: Date
      visibility: Visibility
      annotation_type: "rating" | "rating_cancel"
      properties: EventProperties
    }

    export interface CustomEvent {
      id: string
      custom_id?: string
      type: "custom"
      author_id: string
      visibility: Visibility
      created_at: Date
    }

    export interface RichMessageEvent {
      id: string
      custom_id: string
      type: "rich_message"
      author_id: string
      created_at: Date
      visibility: Visibility
      template_id: "cards" | "quick_replies" | "sticker"
      elements: Element[]
      properties: EventProperties
    }

    export interface ThreadProperties {
      routing: {
        idle: boolean
        unassigned?: boolean
        last_transfer_timestamp?: number
      }
      source: {
        client_id: string
      }
      rating: {
        comment: string
        score: number
      }
    }

    export type PartialThreadProperties = {
      [K in keyof ThreadProperties]: Partial<ThreadProperties[K]>
    }

    export type DeletedThreadProperties = {
      [K in keyof ThreadProperties]: Array<keyof ThreadProperties[K]>
    }

    export interface EventProperties {
      rating?: {
        score?: {
          value: number
        }
        comment?: {
          value: string
        }
      }
      translation?: {
        source_lang_code: string
        target_lang_code: string
        target_message: string
      }
    }

    export type PartialEventProperties = {
      [K in keyof EventProperties]: Partial<EventProperties[K]>
    }

    export type DeletedEventProperties = {
      [K in keyof EventProperties]: Array<keyof EventProperties[K]>
    }

    export interface ChatProperties {
      routing: {
        continuous: boolean
        pinned: boolean
      }
      source: {
        customer_client_id: string
      }
    }

    export type PartialChatProperties = Partial<{
      [P in keyof ChatProperties]: Partial<ChatProperties[P]>
    }>

    export type DeletedChatProperties = {
      [K in keyof ChatProperties]: Array<keyof ChatProperties[K]>
    }

    export type PropertyFilterType = {
      exists: boolean
    } | {
      values: Array<string | number | boolean>
    } | {
      exclude_values: Array<string | number | boolean>
    }

    export type RoutingStatus = "accepting_chats" | "not_accepting_chats" | "offline"

    export interface CustomerVisit {
      started_at: Date
      ip: string
      user_agent: string
      referrer: string
      geolocation: Geolocation | null
      last_pages: LastPage[]
    }

    export interface Geolocation {
      latitude: number
      longitude: number
      country: string
      country_code: string
      region: string
      city: string
      timezone: string
    }

    export interface LastPage {
      url: string
      title: string
      opened_at: Date
    }

    export interface FilledFormField {
      id: string
      type: "name" | "email" | "question" | "textarea" | "radio" | "select" | "checkbox" | "group_chooser" | "header"
      label: string
      answer?: FilledFormAnswer
      answers: FilledFormAnswer[]
    }

    export type FilledFormAnswer = string | {
      id: string
      label: string
      group_id?: number
    }

    export interface Element {
      title?: string
      subtitle?: string
      image?: {
        name?: string
        url: string
        content_type?: string
        size: number
        width: number
        height: number
        alternative_text?: string
      }
      buttons?: Array<{
        type: "message" | "phone"
        text: string
        value?: string
        webview_height?: "compact" | "tall" | "full"
        postback_id: string
        user_ids?: string[]
      }>
    }

    export type Highlight = {
      type: "event.message"
      field: "text"
      highlight: string
    } | {
      type: "event.file"
      field: "name"
      highlight: string
    } | {
      type: "event.filled_form"
      field: "answer"
      highlight: string
    } | {
      type: "thread"
      field: "id" | "tag"
      highlight: string
    } | {
      type: "chat"
      field: "id"
      highlight: string
    } | {
      type: "customer"
      field: "id" | "email" | "name" | "session-field-value"
      highlight: string
    } | {
      type: "agent"
      field: "id" | "name"
      highlight: string
    }

    export interface Statistics {
      chats_count: number
      threads_count: number
      visits_count: number
    }

    export interface Postback {
      id: string
      thread_id: string
      event_id: string
      type: string
      value: string
    }

    export type LastEventPerType = {
      [P in Event["type"]]: {
        thread_id: string
        thread_created_at: Date
        event: Event
      } | null
    };

    export type SessionField = {
      [key: string]: string
    }

    export interface SneakPeek {
      author_id: string
      text: string
      timestamp: number
      recipients: string
    }

    interface Tag {
      name: string
      group_ids: number[]
      created_at: Date
      author_id: string
    }

    /**
     * RTM
     */
    export type Methods = Ping
      | Login
      | SetRoutingStatus
      | ListChats

    export interface Ping {
      method: "ping"
      request: {}
      response: {}
    }

    export interface Login {
      method: "login"
      request: {
        token: string
        timezone: string
        reconnect: boolean
        application: {
          name: string
          version: string
        }
        customer_monitoring_level?: CustomerPushLevel
        pushes?: {
          [K: `${number}.${number}`]: Pushes["action"][]
        }
      }
      response: {
        license: License
        my_profile: MyProfile
        chats_summary: Chat[]
      }
    }

    export interface SetRoutingStatus {
      method: "set_routing_status"
      request: {
        status: RoutingStatus
        agent_id: string
      }
      response: {}
    }

    export interface ListChats {
      method: "list_chats"
      request: {
        filters?: {
          include_active?: boolean
          include_chats_without_threads?: boolean
          group_ids?: number[]
          properties?: {
            routing?: {
              pinned?: PropertyFilterType
            }
          }
        },
        sort_order?: "asc" | "desc"
        limit?: number
        page_id?: string
      }
      response: {
        chats: Chat[]
        found_chats: number
        next_page_id: string
      }
    }

    export type Pushes = IncomingChat
      | ChatDeactivated
      | ChatDeleted
      | ThreadDeleted
      | ThreadsDeleted
      | ChatAccessUpdated
      | ChatTransferred
      | UserAddedToChat
      | UserRemovedFromChat
      | IncomingEvent
      | EventUpdated
      | IncomingRichMessagePostback
      | ChatPropertiesUpdated
      | ChatPropertiesDeleted
      | ThreadPropertiesUpdated
      | ThreadPropertiesDeleted
      | EventPropertiesUpdated
      | EventPropertiesDeleted
      | ThreadTagged
      | ThreadUntagged
      | IncomingCustomers
      | IncomingCustomer
      | CustomerUpdated
      | CustomerPageUpdated
      | CustomerBanned
      | CustomerTransferred
      | CustomerLeft
      | RoutingStatusSet
      | AgentDisconnected
      | AgentCreated
      | AgentApproved
      | AgentUpdated
      | AgentSuspended
      | AgentUnsuspended
      | AgentDeleted
      | AutoAccessAdded
      | AutoAccessUpdated
      | AutoAccessDeleted
      | BotCreated
      | BotUpdated
      | BotDeleted
      | GroupCreated
      | GroupDeleted
      | GroupUpdated
      | GroupsStatusUpdated
      | EventsMarkedAsSeen
      | IncomingSneakPeek
      | IncomingTypingIndicator
      | IncomingMulticast
      | CustomerUnfollowed
      | QueuePositionsUpdated
      | ChatUnfollowed
      | TagCreated
      | TagDeleted
      | TagUpdated

    export interface IncomingChat {
      action: "incoming_chat"
      type: "push"
      payload: {
        chat: Chat
        requester_id: string
        transferred_from: {
          group_ids: number[]
          agent_ids: string[]
        }
      }
    }

    export interface ChatDeactivated {
      action: "chat_deactivated"
      type: "push"
      payload: {
        chat_id: string
        thread_id: string
        user_id: string
      }
    }

    export interface ChatDeleted {
      action: "chat_deleted"
      type: "push"
      payload: {
        chat_id: string
      }
    }

    export interface ThreadDeleted {
      action: "thread_deleted"
      type: "push"
      payload: {
        chat_id: string
        thread_id: string
      }
    }

    export interface ThreadsDeleted {
      action: "threads_deleted"
      type: "push"
      payload: {
        date_from: Date
        date_to: Date
        tag: string
      }
    }

    export interface ChatAccessUpdated {
      action: "chat_access_updated"
      type: "push"
      payload: {
        id: string
        access: {
          group_ids: number[]
        }
      }
    }

    export interface ChatTransferred {
      action: "chat_transferred"
      type: "push"
      payload: {
        chat_id: string
        thread_id: string
        requester_id: string
        reason: string
        transferred_to: {
          group_ids: number[]
          agent_ids: string[]
        }
        queue: Queue | null
      }
    }

    export interface UserAddedToChat {
      action: "user_added_to_chat"
      type: "push"
      payload: {
        chat_id: string
        thread_id: string
        user: User
        reason: string
        requester_id: string
      }
    }

    export interface UserRemovedFromChat {
      action: "user_removed_from_chat"
      type: "push"
      payload: {
        chat_id: string
        thread_id: string
        user_id: string
        reason: string
        requester_id: string
      }
    }

    export interface IncomingEvent {
      action: "incoming_event"
      type: "push"
      payload: {
        chat_id: string
        thread_id: string
        event: Event
      }
    }

    export interface EventUpdated {
      action: "event_updated"
      type: "push"
      payload: {
        chat_id: string
        thread_id: string
        event: Event
      }
    }

    export interface IncomingRichMessagePostback {
      action: "incoming_rich_message_postback"
      type: "push"
      payload: {

        user_id: string
        chat_id: string
        thread_id: string
        event_id: string
        postback: {
          id: string
          toggled: boolean
        }
      }
    }

    export interface ChatPropertiesUpdated {
      action: "chat_properties_updated"
      type: "push",
      payload: {
        chat_id: string
        properties: PartialChatProperties
      }
    }

    export interface ChatPropertiesDeleted {
      action: "chat_properties_deleted"
      type: "push",
      payload: {
        chat_id: string
        properties: DeletedChatProperties
      }
    }

    export interface ThreadPropertiesUpdated {
      action: "thread_properties_updated"
      type: "push",
      payload: {
        chat_id: string
        thread_id: string
        properties: PartialThreadProperties
      }
    }

    export interface ThreadPropertiesDeleted {
      action: "thread_properties_deleted"
      type: "push",
      payload: {
        chat_id: string
        thread_id: string
        properties: DeletedThreadProperties
      }
    }

    export interface EventPropertiesUpdated {
      action: "event_properties_updated"
      type: "push",
      payload: {
        chat_id: string,
        thread_id: string,
        event_id: string,
        properties: PartialEventProperties
      }
    }

    export interface EventPropertiesDeleted {
      action: "event_properties_deleted"
      type: "push",
      payload: {
        chat_id: string
        thread_id: string
        event_id: string
        properties: DeletedEventProperties
      }
    }

    export interface ThreadTagged {
      action: "thread_tagged"
      type: "push",
      payload: {
        chat_id: string
        thread_id: string
        tag: string
      }
    }

    export interface ThreadUntagged {
      action: "thread_untagged"
      type: "push",
      payload: {
        chat_id: string
        thread_id: string
        tag: string
      }
    }

    export interface IncomingCustomers {
      action: "incoming_customers"
      type: "push",
      payload: {
        customer_monitoring_level: CustomerPushLevel
        customers: Customer[]
      }
    }

    export interface IncomingCustomer {
      action: "incoming_customer"
      type: "push",
      payload: Customer
    }

    export interface CustomerUpdated {
      action: "customer_updated"
      type: "push",
      payload: Partial<Customer>
    }

    export interface CustomerPageUpdated {
      action: "customer_page_updated"
      type: "push",
      payload: {
        customer_id: string
        visit_id: number
        opened_at: Date
        url: string
        title: string
      }
    }

    export interface CustomerBanned {
      action: "customer_banned"
      type: "push",
      payload: {
        customer_id: string
        ban: {
          days: number
        }
      }
    }

    export interface CustomerTransferred {
      action: "customer_transferred"
      type: "push",
      payload: {
        id: string
        transferred_to: {
          group_ids: number[]
        },
        followed: boolean
      }
    }

    export interface CustomerLeft {
      action: "customer_left"
      type: "push",
      payload: {
        id: string
        left_at: Date
      }
    }

    export interface RoutingStatusSet {
      action: "routing_status_set"
      type: "push",
      payload: {
        agent_id: string
        status: RoutingStatus
      }
    }

    export interface AgentDisconnected {
      action: "agent_disconnected"
      type: "push",
      payload: {
        reason: string
        data: unknown
      }
    }

    export interface AgentCreated {
      action: "agent_created"
      type: "push",
      payload: unknown
    }

    export interface AgentApproved {
      action: "agent_approved"
      type: "push",
      payload: unknown
    }

    export interface AgentUpdated {
      action: "agent_updated"
      type: "push",
      payload: unknown
    }

    export interface AgentSuspended {
      action: "agent_suspended"
      type: "push",
      payload: {
        id: string
      }
    }

    export interface AgentUnsuspended {
      action: "agent_unsuspended"
      type: "push",
      payload: {
        id: string
      }
    }

    export interface AgentDeleted {
      action: "agent_deleted"
      type: "push",
      payload: {
        id: string
      }
    }

    export interface AutoAccessAdded {
      action: "auto_access_added"
      type: "push",
      payload: unknown
    }

    export interface AutoAccessUpdated {
      action: "auto_access_updated"
      type: "push",
      payload: unknown
    }

    export interface AutoAccessDeleted {
      action: "auto_access_deleted"
      type: "push",
      payload: {
        id: string
      }
    }

    export interface BotCreated {
      action: "bot_created"
      type: "push",
      payload: unknown
    }

    export interface BotUpdated {
      action: "bot_updated"
      type: "push",
      payload: unknown
    }

    export interface BotDeleted {
      action: "bot_deleted"
      type: "push",
      payload: {
        id: string
      }
    }

    export interface GroupCreated {
      action: "group_created"
      type: "push",
      payload: unknown
    }

    export interface GroupDeleted {
      action: "group_deleted"
      type: "push",
      payload: {
        id: number
      }
    }

    export interface GroupUpdated {
      action: "group_updated"
      type: "push",
      payload: unknown
    }

    export interface GroupsStatusUpdated {
      action: "groups_status_updated"
      type: "push"
      payload: {
        groups: {
          id: number
          status: RoutingStatus
        }[]
      }
    }

    export interface IncomingTypingIndicator {
      action: "incoming_typing_indicator"
      type: "push",
      payload: {
        chat_id: string
        thread_id: string
        typing_indicator: {
          author_id: string
          visibility: Visibility
          timestamp: number
          is_typing: boolean
        }
      }
    }

    export interface IncomingSneakPeek {
      action: "incoming_sneak_peek"
      type: "push"
      payload: {
        chat_id: string
        thread_id: string
        sneak_peek: SneakPeek
      }
    }

    export interface EventsMarkedAsSeen {
      action: "events_marked_as_seen"
      type: "push"
      payload: {
        user_id: string
        chat_id: string
        seen_up_to: Date
      }
    }

    export interface IncomingMulticast {
      action: "incoming_multicast"
      type: "push",
      payload: Multicast$IWCS0014R
      | Multicast$CannedResponseAdd
      | Multicast$CannedResponseUpdate
      | Multicast$CannedResponseRemove
    }

    export interface Multicast$IWCS0014R {
      type: "lc2_iwcs"
      content: {
        command: "IWCS0014R",
        agent: {
          login: string
          name: string
          sessions: Array<{
            ip: string
            version: string
            app_info: string
          }>
        }
      }
    }

    export interface Multicast$CannedResponseAdd {
      type: "lc2"
      content: {
        name: "canned_response_add"
        canned_response: {
          id: number
          group: number
          tags: string[]
          text: string
        }
        group: number
      }
    }

    export interface Multicast$CannedResponseUpdate {
      type: "lc2"
      content: {
        name: "canned_response_update"
        canned_response: {
          id: number
          group: number
          tags: string[]
          text: string
        }
        group: number
      }
    }

    export interface Multicast$CannedResponseRemove {
      type: "lc2"
      content: {
        name: "canned_response_remove"
        canned_response: { id: number }
        group: number
      }
    }

    export interface ChatUnfollowed {
      action: "chat_unfollowed"
      type: "push",
      payload: {
        chat_id: string
      }
    }

    export interface QueuePositionsUpdated {
      action: "queue_positions_updated"
      type: "push"
      payload: QueuePositions
    }

    export interface CustomerUnfollowed {
      action: "customer_unfollowed"
      type: "push"
      payload: {
        id: string
      }
    }

    interface TagCreated {
      action: "tag_created"
      type: "push"
      payload: {

      }
    }
    interface TagDeleted {
      action: "tag_deleted"
      type: "push"
      payload: {
        name: string
      }
    }

    interface TagUpdated {
      action: "tag_updated"
      type: "push"
      payload: {
        name: string
        group_ids: number
      }
    }

    export type CustomerPushLevel = "my" | "chatting" | "invited" | "online"

    /**
     * @methods
     */

    export function listRoutingStatuses(accessToken: string) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/list_routing_statuses", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: "{}"
      }).then(parseResponse).then(parseRoutingStatuses)
    }

    export function setRoutingStatus(accessToken: string, payload: SetRoutingStatus["request"]) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/set_routing_status", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload)
      }).then(parseResponse)
    }

    export function getChat(accessToken: string, body: {
      chat_id: string
      thread_id?: string
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/get_chat", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(body)
      }).then(parseResponse).then(parseChat)
    }

    export function addUserToChat(accessToken: string, payload: {
      chat_id: string
      user_id: string
      user_type: "agent" | "customer"
      visibility: Visibility
      ignore_requester_presence?: boolean
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/add_user_to_chat", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function (response) {
        return parseResponse<{}>(response)
      })
    }

    export function resumeChat(accessToken: string, payload: {
      chat: {
        id: string
        active?: boolean
        continuous?: boolean
        access: {
          group_ids: number[]
        }
        users?: {
          id: string
          type: "agent" | "customer"
        }[]
        thread?: {
          events?: Partial<Event>[]
        }
      }
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/resume_chat", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(parseResponse).then(function (resp: any) {
        let event_ids = new Array<string>()

        if (Array.isArray(resp.event_ids)) {
          event_ids = resp.event_ids
        }

        return {
          thread_id: String(resp.thread_id),
          event_ids: event_ids
        }
      })
    }

    export function deactivateChat(accessToken: string, payload: {
      id: string
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/deactivate_chat", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function (response) {
        return parseResponse<{}>(response)
      })
    }

    export function followChat(accessToken: string, payload: {
      id: string
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/follow_chat", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function (response) {
        return parseResponse<{}>(response)
      })
    }

    export function unfollowChat(accessToken: string, payload: {
      id: string
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/unfollow_chat", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function (response) {
        return parseResponse<{}>(response)
      })
    }

    export function transferChat(accessToken: string, payload: {
      id: string
      target: {
        type: "group" | "agent"
        ids: Array<string | number>
      }
      ignore_agents_availability: boolean
      ignore_requester_presence: boolean
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/transfer_chat", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function (response) {
        return parseResponse<{}>(response)
      })
    }

    export function listChats(accessToken: string, payload: ListChats["request"]) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/list_chats", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(parseResponse).then(parseListChats)
    }

    export function listArchives(accessToken: string, payload: {
      filters: {
        query: string
        from?: string
        to?: string
        group_ids?: number[]
      }
      page_id?: string
      sort_order?: "asc" | "desc"
      limit?: number
      highlights?: {} | {
        pre_tag: string
        post_tag: string
      }
    }, signal?: AbortSignal) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/list_archives", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
        signal: signal
      }).then(parseResponse).then(function (response) {
        const chats = parseChats(response?.chats);
        const found_chats = Number(response?.found_chats);
        const next_page_id = String(response?.next_page_id ?? "");

        return {
          chats,
          found_chats,
          next_page_id
        }
      })
    }

    export function listThreads(accessToken: string, payload: {
      chat_id: string
      sort_order?: "asc" | "desc"
      limit?: number
      page_id?: string
      min_events_count?: number
      filters?: {
        from?: string
        to?: string
      }
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/list_threads", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(parseResponse).then(function (resp: any) {
        return {
          threads: parseThreads(resp?.threads),
          found_threads: Number(resp?.found_threads),
          next_page_id: String(resp?.next_page_id ?? "")
        }
      })
    }

    export function sendEvent(accessToken: string, payload: {
      chat_id: string
      event: Partial<Event>
      attach_to_last_thread: boolean
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/send_event", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(parseResponse).then(function (resp: any) {
        return {
          event_id: String(resp.event_id)
        }
      })
    }

    export function markEventsAsSeen(accessToken: string, payload: {
      chat_id: string
      seen_up_to: string
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/mark_events_as_seen", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(parseResponse).then(function (resp: any) {
        if (!Array.isArray(resp)) {
          return []
        }

        return resp.map(function (item: any) {
          return {
            agent_id: String(item.agent_id),
            total_active_chats: Number(item.total_active_chats),
          }
        })
      })
    }

    export function listAgentsForTransfer(accessToken: string, payload: {
      chat_id: string
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/list_agents_for_transfer", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(parseResponse).then(function (resp: any) {
        if (!Array.isArray(resp)) {
          return []
        }

        return resp.map(function (item: any) {
          return {
            agent_id: String(item.agent_id),
            total_active_chats: Number(item.total_active_chats),
          }
        })
      })
    }

    export function updateChatProperties(accessToken: string, payload: {
      id: string
      properties: PartialChatProperties
    }) {
      return fetch("https://api.livechatinc.com/v3.5/agent/action/update_chat_properties", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
      }).then(function (response) {
        return parseResponse<{}>(response)
      })
    }

    export function uploadFile(accessToken: string, file: File, abort: AbortSignal, progress: ProgressSignal): Promise<{ url: string }> {
      return new Promise<any>(function (resolve, reject) {
        if (abort.aborted) {
          return reject(new AbortError("Upload aborted"))
        }

        const xhr = new XMLHttpRequest()
        const formData = new FormData()

        formData.append("file", file)

        abort.onabort = function () {
          xhr.abort()
        }

        xhr.onload = function () {
          if (xhr.readyState === xhr.DONE) {
            try {
              const data = JSON.parse(xhr.responseText)

              if (xhr.status === 200) {
                resolve(data)
              }
              else {
                reject(new ErrorWithType(String(data.error?.message), String(data.error?.type), xhr.status))
              }
            }
            catch (err) {
              reject(new ErrorWithType("Upload error", "upload_error", xhr.status, err))
            }
            finally {
              cleanup()
            }
          }
        }

        xhr.onerror = function (event) {
          reject(new Error("Upload failed"))
          cleanup()
        }

        xhr.onabort = function () {
          reject(Object.assign(new Error("Upload aborted"), { name: "AbortError" }))
          cleanup()
        }

        xhr.upload.onprogress = onProgress
        xhr.open("POST", "https://api.livechatinc.com/v3.5/agent/action/upload_file")
        xhr.setRequestHeader("X-Region", getRegion(accessToken))
        xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`)
        xhr.send(formData)

        function onProgress(event: ProgressEvent) {
          progress.progress(event)
        }

        function onDone() {

        }

        function cleanup() {
          abort.onabort = null
          xhr.onload = null
          xhr.onerror = null
          xhr.onabort = null
          xhr.upload.onprogress = null
        }
      }).then(function (data) {
        return {
          url: String(data.url)
        }
      })
    }

    /**
     * RTM
     */
    export type RTM = Awaited<ReturnType<typeof createRTM>>

    export interface RTMRequest {
      resolve(value: unknown): void
      reject(error: Error): void
      error: ErrorWithType
    }

    export async function createRTM(organization_id: string, options: Login["request"]) {
      const url = `wss://api.livechatinc.com/v3.5/agent/rtm/ws?organization_id=${organization_id}`
      const ws = await openWebSocket(url)
      const requests = new Map<string, RTMRequest>()
      const pingTimeout = 10000
      const pongTimeout = 5000
      let pingTimer: number
      let pongTimer: number
      let counter = 0

      ws.onclose = onClose
      ws.onerror = onError
      ws.onmessage = onMessage

      const initState = await login(options)
      let self = {
        initState,
        setRoutingStatus,
        listChats,
        close,
        onClose() { },
        onPush(push: Pushes): void { }
      }

      pingTimer = window.setTimeout(ping, pingTimeout)

      return self

      function close(code?: number) {
        ws.close(code)
      }

      function login(payload: Login["request"]) {
        return perform<Login>("login", payload).then(function (resp) {
          return {
            license: parseLicense(resp.license),
            my_profile: parseMyProfile(resp.my_profile),
            chats_summary: parseChatsSummary(resp.chats_summary),
          }
        })
      }

      function setRoutingStatus(payload: SetRoutingStatus["request"]) {
        return perform<SetRoutingStatus>("set_routing_status", payload)
      }

      function listChats(payload: ListChats["request"]) {
        return perform<ListChats>("list_chats", payload).then(parseListChats)
      }

      function perform<T extends Methods>(action: T["method"], payload?: T["request"]): Promise<T["response"]> {
        const requestId = String(++counter)
        const error = new ErrorWithType("Unknown error", "unknown_error", 500)

        return new Promise(function (resolve, reject) {
          ws.send(JSON.stringify({
            request_id: requestId,
            action: action,
            payload: payload
          }))

          requests.set(requestId, {
            resolve,
            reject,
            error
          })
        })
      }

      function onClose() {
        requests.forEach(function (request) {
          request.error.message = "Request timeout"
          request.error.type = "request_timeout"
          request.error.status = 400
          request.reject(request.error)
        })
        requests.clear()
        clearTimeout(pingTimeout)
        clearTimeout(pongTimeout)

        if (typeof self.onClose === "function") {
          self.onClose()
        }
      }

      function onError(event: globalThis.Event) {
        console.warn("close rtm connection", event)
      }

      function onMessage(event: globalThis.MessageEvent) {
        const data = JSON.parse(event.data)

        if (data && data.type === "response") {
          const requestId = data.request_id

          if (!requestId) {
            throw new RangeError("Received an unknown request_id: " + requestId)
          }

          const request = requests.get(requestId)

          if (!request) {
            throw new RangeError("Missed handler for request:" + event.data)
          }

          if (Boolean(data.success)) {
            request.resolve(data.payload || {})
          }
          else {
            request.error.message = data?.payload?.error?.message || "Failed to parse response"
            request.error.type = data.payload.error.type ?? "response_parse_error"
            request.reject(request.error)
          }

        }

        if (data?.type === "push") {
          const push = parsePush(data)

          if (push && typeof self.onPush === "function") {
            self.onPush(push)
          }
        }
      }

      function ping() {
        perform("ping").then(function () {
          window.clearTimeout(pongTimer)
          pingTimer = window.setTimeout(ping, pingTimeout)
        }, function (err) {
          console.warn(err)
          ws.close(4000)
        })

        pongTimer = window.setTimeout(function () {
          ws.close(4000)
        }, pongTimeout)
      }
    }

    function openWebSocket(url: string) {
      return new Promise<WebSocket>(function (resolve, reject) {
        const ws = new WebSocket(url)

        ws.onopen = onOpen
        ws.onclose = onClose

        function onOpen() {
          cleanup()
          resolve(ws)
        }

        function onClose() {
          reject(new Error("Connection was closed"))
        }

        function cleanup() {
          ws.onopen = null
          ws.onclose = null
        }
      })
    }


    /**
     * Parsers
     */

    function parseChats(chats: any): Chat[] {
      if (!Array.isArray(chats)) {
        return []
      }

      return chats.map(parseChat)
    }

    export function parseChat(chat: any): Chat {
      return {
        id: String(chat.id),
        users: parseUsers(chat.users),
        access: parseAccess(chat.access),
        properties: parseChatProperties(chat.properties),
        threads: [parseThread(chat.thread)],
        is_followed: Boolean(chat.is_followed),
      }
    }

    function parseThreads(threads: any) {
      if (Array.isArray(threads)) {
        return threads.map(parseThread)
      }

      return []
    }

    export function parseThread(thread: any): Thread {
      return {
        id: thread.id,
        tags: thread.tags || [],
        active: thread.active,
        incomplete: false,
        queue: parseQueue(thread.queue),
        access: parseAccess(thread.access),
        events: parseThreadMessages(thread),
        created_at: parseDate(thread.created_at),
        highlight: parseHighlights(thread.highlight),
        properties: parseThreadProperties(thread.properties),
        restricted_access: parseThreadRestrictedAccess(thread.restricted_access),
        next_thread_id: String(thread.next_thread_id || ""),
        previous_thread_id: String(thread.previous_thread_id || ""),
      }
    }

    export function parseUsers(users: User[]) {
      if (!Array.isArray(users)) {
        return []
      }

      return users.map(parseUser)
    }

    export function parseUser(user: any): User {
      switch (user.type) {
        case "agent":
          return {
            id: String(user.id),
            email: String(user.email || ""),
            name: String(user.name || "Agent").trim(),
            type: "agent",
            visibility: String(user.visibility || "all") as "all" | "agents",
            avatar: parseAvatarUrl(user.avatar),
            events_seen_up_to: parseEventsSeenUpTo(user.events_seen_up_to),
            present: Boolean(user.present),
          }

        case "customer":
          return {
            id: String(user.id),
            email: String(user.email || ""),
            email_verified: Boolean(user.email_verified),
            name: String(user.name || "Visitor").trim(),
            type: "customer",
            avatar: parseAvatarUrl(user.avatar),
            present: Boolean(user.present),
            events_seen_up_to: parseEventsSeenUpTo(user.events_seen_up_to),
            last_visit: parseCustomerLastVisit(user.last_visit),
            statistics: parseStatistics(user.statistics),
            session_fields: parseSessionFields(user.session_fields),
            created_at: parseDate(user.created_at),
          }

        default:
          throw new Error("Invalid user type passed")
      }
    }

    function parseEventsSeenUpTo(eventsSeenUpTo?: any) {
      if (typeof eventsSeenUpTo !== "string") {
        return new Date(0)
      }

      return parseDate(eventsSeenUpTo)
    }

    export function parseChatsSummary(chatSummaries: any): Chat[] {
      if (!Array.isArray(chatSummaries)) {
        return []
      }

      return chatSummaries.map(parseChatSummary)
    }

    export function parseChatSummary(chat: any): Chat {
      return {
        id: String(chat.id),
        users: parseUsers(chat.users),
        is_followed: Boolean(chat.is_followed),
        properties: parseChatProperties(chat.properties || {}),
        threads: parseThreadSummary(chat.last_thread_summary, chat.last_event_per_type),
        access: parseAccess(chat.access),
      }
    }

    export function parseThreadSummary(lastThreadSummary: any, lastEventsByType: any): Thread[] {
      const keys = Object.keys(lastEventsByType) as Event["type"][]
      const events: Event[] = []
      const threads = new Map<string, Thread>([
        [
          String(lastThreadSummary.id),
          {
            id: String(lastThreadSummary.id),
            active: Boolean(lastThreadSummary.active),
            incomplete: true,
            properties: parseThreadProperties(lastThreadSummary.properties),
            restricted_access: "",
            events: events,
            highlight: [],
            created_at: parseDate(lastThreadSummary.created_at),
            access: parseAccess(lastThreadSummary.access),
            tags: parseTags(lastThreadSummary.tags),
            queue: parseQueue(lastThreadSummary.queue),
            next_thread_id: String(lastThreadSummary.next_thread_id || ""),
            previous_thread_id: String(lastThreadSummary.previous_thread_id || ""),
          }
        ]
      ])

      for (const key of keys) {
        const lastEventByType = lastEventsByType[key]
        let thread = threads.get(lastEventByType.thread_id)

        if (!thread) {
          if (lastEventByType.thread_id === lastThreadSummary.id) {
            throw new RangeError("`lastThreadSummary` has to be already stored in `threads`")
          }

          thread = {
            id: String(lastEventByType.thread_id),
            active: false,
            incomplete: true,
            properties: {
              routing: {
                idle: false,
              },
              source: {
                client_id: String(lastThreadSummary?.properties?.source?.client_id ?? "")
              },
              rating: {
                comment: "",
                score: 0,
              }
            },
            restricted_access: String(lastEventByType.restricted_access ?? ""),
            events: [],
            highlight: [],
            created_at: parseDate(lastEventByType.thread_created_at),
            access: parseAccess(lastThreadSummary.access),
            tags: [],
            queue: null,
            next_thread_id: "",
            previous_thread_id: "",
          }

          threads.set(lastEventByType.thread_id, thread)
        }

        if (lastEventByType.restricted_access) {
          thread.restricted_access = lastEventByType.restricted_access
        }

        if (lastEventByType.event) {
          const event = parseEvent(lastEventByType.event)

          thread.events.push(event)
        }
      }

      return Array.from(threads.values()).sort(function (a, b) {
        return a.created_at.getTime() - b.created_at.getTime()
      })
    }

    export function parseChatProperties(properties: ChatProperties): ChatProperties {
      return {
        routing: {
          continuous: getPropertyValue<boolean>(properties, "routing", "continuous", false),
          pinned: getPropertyValue<boolean>(properties, "routing", "pinned", false),
        },
        source: {
          customer_client_id: getPropertyValue<string>(properties, "source", "customer_client_id", "")
        },
      }
    }

    export function parsePartialChatProperties(properties: any): PartialChatProperties {
      const p: PartialChatProperties = {
        routing: {},
        source: {},
      }

      if (p.routing && hasPropertyValue(properties, "routing", "continuous")) {
        p.routing.continuous = getPropertyValue<boolean>(properties, "routing", "continuous", false)
      }

      if (p.routing && hasPropertyValue(properties, "routing", "pinned")) {
        p.routing.pinned = getPropertyValue<boolean>(properties, "routing", "pinned", false)
      }

      if (p.source && hasPropertyValue(properties, "source", "customer_client_id")) {
        p.source.customer_client_id = getPropertyValue<string>(properties, "source", "customer_client_id", "")
      }

      return p
    }

    export function parseDeletedChatProperties(properties: any = {}): DeletedChatProperties {
      const p: DeletedChatProperties = {
        routing: [],
        source: [],
      }

      if (Array.isArray(properties.routing)) {
        p.routing = properties.routing
      }

      if (Array.isArray(properties.source)) {
        p.source = properties.source
      }

      return p
    }

    export function parseThreadProperties(properties: Partial<ThreadProperties>): ThreadProperties {
      return {
        routing: {
          idle: getPropertyValue<boolean>(properties, "routing", "idle", false),
          unassigned: getPropertyValue<boolean>(properties, "routing", "unassigned", false),
          last_transfer_timestamp: getNumericPropertyValue(properties, "routing", "last_transfer_timestamp", 0),
        },
        source: {
          client_id: getPropertyValue<string>(properties, "source", "client_id", ""),
        },
        rating: {
          score: getNumericPropertyValue(properties, "rating", "score", 0),
          comment: getPropertyValue<string>(properties, "rating", "comment", "")
        },
      }
    }

    export function parsePartialThreadProperties(properties: any = {}): PartialThreadProperties {
      const p: PartialThreadProperties = {
        routing: {},
        source: {},
        rating: {}
      }

      if (hasPropertyValue(properties, "routing", "idle")) {
        p.routing.idle = getPropertyValue<boolean>(properties, "routing", "idle", false)
      }

      if (hasPropertyValue(properties, "routing", "unassigned")) {
        p.routing.unassigned = getPropertyValue<boolean>(properties, "routing", "unassigned", false)
      }

      if (hasPropertyValue(properties, "routing", "last_transfer_timestamp")) {
        p.routing.last_transfer_timestamp = getNumericPropertyValue(properties, "routing", "last_transfer_timestamp", 0)
      }

      if (hasPropertyValue(properties, "source", "client_id")) {
        p.source.client_id = getPropertyValue<string>(properties, "source", "client_id", "")
      }

      if (hasPropertyValue(properties, "rating", "score")) {
        p.rating.score = getNumericPropertyValue(properties, "rating", "score", 0)
      }

      if (hasPropertyValue(properties, "rating", "comment")) {
        p.rating.comment = getPropertyValue<string>(properties, "rating", "comment", "")
      }

      return p
    }

    export function parseDeletedThreadProperties(properties: any): DeletedThreadProperties {
      const p: DeletedThreadProperties = {
        routing: [],
        source: [],
        rating: []
      }

      if (Array.isArray(properties.routing)) {
        p.routing = properties.routing
      }

      if (Array.isArray(properties.source)) {
        p.source = properties.source
      }

      if (Array.isArray(properties.rating)) {
        p.rating = properties.rating
      }

      return p
    }

    export function parseEventProperties(properties: any): EventProperties {
      return {
        translation: {
          source_lang_code: getPropertyValue<string>(properties, 'translation', 'source_lang_code', ''),
          target_lang_code: getPropertyValue<string>(properties, 'translation', 'target_lang_code', ''),
          target_message: getPropertyValue<string>(properties, 'translation', 'target_message', '')
        }
      }
    }

    export function parsePartialEventProperties(properties: any): PartialEventProperties {
      const p: PartialEventProperties = {
        translation: {},
      }

      if (hasPropertyValue(properties, "translation", "source_lang_code") && p.translation) {
        p.translation.target_lang_code = getPropertyValue<string>(properties, "translation", "target_message", "")
      }

      if (hasPropertyValue(properties, "translation", "target_lang_code") && p.translation) {
        p.translation.target_lang_code = getPropertyValue<string>(properties, "translation", "target_lang_code", "")
      }

      if (hasPropertyValue(properties, "translation", "target_message") && p.translation) {
        p.translation.target_message = getPropertyValue<string>(properties, "translation", "target_message", "")
      }

      return p
    }

    export function parseDeletedEventProperties(properties: any): DeletedEventProperties {
      const p: DeletedEventProperties = {
        translation: [],
      }

      if (Array.isArray(properties.translation)) {
        p.translation = properties.translation
      }

      return p
    }

    function parseThreadRestrictedAccess(restrictedAccess?: any) {
      return String(restrictedAccess ?? "")
    }

    export function getPropertyValue<T>(properties: any, ns: string, key: string, def: T): T {
      return properties && properties[ns] && properties[ns][key] !== undefined ? properties[ns][key] : def
    }

    export function getNumericPropertyValue(properties: Partial<ChatProperties | ThreadProperties>, ns: string, key: string, def: any): number {
      let value = getPropertyValue<number>(properties, ns, key, def)

      // do not force parsing for default value
      if (value === def) {
        return value
      }

      if (typeof value !== "number") {
        value = parseInt(value, 10)
      }

      if (Number.isNaN(value)) {
        return def
      }

      return value
    }

    export function hasPropertyValue(properties: any, ns: string, key: string) {
      return properties && properties[ns] && properties[ns][key] !== undefined
    }

    export function hasProperty(properties: any, ns: string) {
      return properties && properties[ns] !== undefined
    }

    export function parseEvent(event: any): Event {
      switch (event.type) {
        case "message":
          return {
            id: String(event.id),
            type: "message",
            custom_id: String(event.custom_id ?? ""),
            text: String(event.text || ""),
            visibility: parseEventVisibility(event.visibility),
            properties: parseEventProperties(event.properties),
            author_id: String(event.author_id),
            created_at: parseDate(event.created_at),
            postback: parsePostbank(event.postback),
          }

        case "filled_form":
          return {
            id: String(event.id),
            type: "filled_form",
            custom_id: String(event.custom_id ?? ""),
            properties: parseEventProperties(event.properties),
            visibility: parseEventVisibility(event.visibility),
            author_id: String(event.author_id || ""),
            form_id: String(event.form_id || ""),
            form_type: String(event.form_type || ""),
            created_at: parseDate(event.created_at),
            fields: parseFilledFormFields(event.fields),
          }

        case "system_message":
          return {
            id: String(event.id),
            type: "system_message",
            system_message_type: String(event.system_message_type),
            custom_id: String(event.custom_id || ""),
            properties: parseEventProperties(event.properties),
            visibility: parseEventVisibility(event.visibility),
            text: String(event.text || ""),
            created_at: parseDate(event.created_at),
            text_vars: event.text_vars || {}
          }

        case "file":
          return {
            id: String(event.id),
            custom_id: String(event.custom_id || ""),
            author_id: String(event.author_id),
            properties: parseEventProperties(event.properties),
            visibility: parseEventVisibility(event.visibility),
            created_at: parseDate(event.created_at),
            type: "file",
            name: String(event.name || ""),
            url: String(event.url || ""),
            thumbnail_url: String(event.thumbnail_url || ""),
            thumbnail2x_url: String(event.thumbnail2x_url || ""),
            content_type: String(event.content_type || ""),
            size: Number(event.size || ""),
            width: Number(event.width || ""),
            height: Number(event.height || ""),
          }

        case "rich_message":
          return {
            id: String(event.id),
            custom_id: String(event.custom_id || ""),
            type: "rich_message",
            author_id: String(event.author_id),
            created_at: parseDate(event.created_at),
            properties: parseEventProperties(event.properties),
            visibility: parseEventVisibility(event.visibility),
            template_id: parseTemplateId(event.template_id),
            elements: Array.isArray(event.elements) ? event.elements.map(function (el: any) {
              return {
                title: String(el.title),
                subtitle: String(el.subtitle),
                image: el.image ? {
                  name: el.image.name || "",
                  url: el.image.url,
                  contentType: String(el.image.content_type ?? ""),
                  size: el.image.size,
                  width: el.image.width,
                  height: el.image.height,
                  alternativeText: String(el.image.alternative_text ?? ""),
                } : void 0,
                buttons: Array.isArray(el.buttons) ? el.buttons.map(function (button: any) {
                  return {
                    text: button.text
                  }
                }) : void 0
              }
            }) : []
          }

        case "annotation":
          return {
            id: String(event.id),
            custom_id: String(event.custom_id ?? ""),
            author_id: String(event.author_id),
            properties: parseEventProperties(event.properties),
            visibility: parseEventVisibility(event.visibility),
            type: "annotation",
            annotation_type: event.annotation_type,
            created_at: parseDate(event.created_at),
          }

        case "form":
          return {
            id: String(event.id),
            custom_id: String(event.custom_id || ""),
            created_at: parseDate(event.created_at),
            type: "form",
            author_id: String(event.author_id),
            visibility: parseEventVisibility(event.visibility),
            properties: parseEventProperties(event.properties),
            form_id: String(event.form_id),
            form_type: String(event.form_type || ""),
            fields: parseFilledFormFields(event.fields),
          }


        default: {
          console.warn(`Parser: Unknown message type ${event.type}, ${JSON.stringify(event, null, 2)}`)

          return {
            id: String(event.id),
            custom_id: String(event.custom_id ?? ""),
            properties: parseEventProperties(event.recipients),
            visibility: parseEventVisibility(event.visibility),
            type: "system_message",
            system_message_type: "unknown_event_type",
            text: "Unsupported type of message",
            created_at: parseDate(event.created_at),
            text_vars: {}
          }
        }
      }

      function parsePostbank(postback: any): Postback | null {
        if (!postback) {
          return null
        }

        return {
          id: String(postback.id),
          thread_id: String(postback.thread_id),
          event_id: String(postback.event_id),
          type: String(postback.type),
          value: String(postback.value),
        }
      }

      function parseTemplateId(templateId: any) {
        switch (templateId) {
          case "cards":
            return "cards"
          case "quick_replies":
            return "quick_replies"
          case "sticker":
            return "sticker"
          default:
            throw new RangeError("`template_id` has unssuported value: " + templateId)
        }
      }
    }

    export function parseFilledFormFields(fields: any): FilledFormField[] {
      if (!fields) {
        return [];
      }

      return fields.map(parseFilledFormField)
    }

    function parseFilledFormField(field: any): FilledFormField {
      return {
        id: String(field.id),
        label: String(field.label),
        type: parseFilledFormType(field.type),
        answer: parseFilledFormAnswer(field.answer),
        answers: parseFilledFormAnswers(field.answers),
      }

      function parseFilledFormType(type: any) {
        switch (type) {
          case "name": return "name"
          case "email": return "email"
          case "header": return "header"
          case "question": return "question"
          case "textarea": return "textarea"
          case "radio": return "radio"
          case "select": return "select"
          case "checkbox": return "checkbox"
          case "group_chooser": return "group_chooser"
          default: throw new RangeError("Unsupported type of answer: " + type)
        }
      }

      function parseFilledFormAnswers(answers: any): FilledFormAnswer[] {
        if (!Array.isArray(answers)) {
          return []
        }

        return answers.map(parseFilledFormAnswer)
      }

      function parseFilledFormAnswer(answer: any): FilledFormAnswer {
        if (!answer) {
          return ""
        }

        if (typeof answer === "string") {
          return answer
        }

        const result: FilledFormAnswer = {
          id: String(answer.id),
          label: String(answer.label),
        }

        if (answer.group_id) {
          result.group_id = Number(answer.group_id)
        }

        return result
      }
    }

    export function parseMyProfile(myProfile: any): MyProfile {
      return {
        id: String(myProfile.id),
        name: String(myProfile.name),
        email: String(myProfile.email),
        avatar: String(myProfile.avatar),
        permission: String(myProfile.permission),
        routing_status: parseRoutingStatus(myProfile.routing_status),
      }
    }

    export function parseLicense(license: any): License {
      return {
        id: Number(license.id),
      }
    }

    export function parseGeolocation(geolocation?: Geolocation): Geolocation | null {
      if (!geolocation) {
        return null
      }

      // geolocation can be an empty object
      if (Object.values(geolocation).length === 0) {
        return null
      }

      return {
        country: String(geolocation.country),
        country_code: String(geolocation.country_code),
        region: String(geolocation.region),
        city: String(geolocation.city),
        timezone: String(geolocation.timezone),
        latitude: Number(geolocation.latitude),
        longitude: Number(geolocation.longitude),
      }
    }

    export function parseStatistics(statistics: any): Statistics {
      return {
        chats_count: Number(statistics?.chats_count ?? 0),
        threads_count: Number(statistics?.threads_count ?? 0),
        visits_count: Number(statistics?.visits_count ?? 0),
      }
    }

    export function parseThreadMessages(thread: Thread) {
      if (Array.isArray(thread.events)) {
        return thread.events.map(event => parseEvent(event));
      }

      return []
    }

    export function parseCustomerLastVisit(lastVisit?: any): CustomerVisit | null {
      if (!lastVisit) {
        return null
      }

      const lastPages: LastPage[] = []

      if (Array.isArray(lastVisit.last_pages)) {
        lastVisit.last_pages.forEach(function (lastPage: any) {
          lastPages.push({
            url: String(lastPage.url),
            title: String(lastPage.title),
            opened_at: parseDate(lastPage.opened_at),
          })
        })
      }

      return {
        ip: String(lastVisit.ip),
        referrer: String(lastVisit.referrer ?? "").trim(),
        started_at: parseDate(lastVisit.started_at),
        user_agent: String(lastVisit.user_agent ?? ""),
        last_pages: lastPages,
        geolocation: parseGeolocation(lastVisit.geolocation),
      }
    }

    export function parseSessionFields(fields?: any): SessionField[] {
      const result: SessionField[] = []

      if (!Array.isArray(fields)) {
        return result
      }

      fields.forEach(function (field) {
        if (typeof field !== "object") {
          return
        }

        if (field.hasOwnProperty("__details_json")) {
          result.push(...parseDetailsJson(field["__details_json"]))
        }
        else {
          const keys = Object.keys(field)
          const key = keys.length === 1 ? keys[0] : void 0

          if (!key) {
            return
          }

          result.push({
            [key]: String(field[key])
          })
        }
      })

      return result
    }

    export function parseDetailsJson(details: string): SessionField[] {
      const result: SessionField[] = []

      if (typeof details !== "string") {
        return result
      }

      let data;

      try {
        data = JSON.parse(details)
      }
      catch (err) {
        let error = err instanceof Error ? err.message : String(err)

        return [{
          "__details_json": "failed to parse: " + error,
        }]
      }

      if (!Array.isArray(data)) {
        return result
      }

      data.forEach(function (item) {
        if (!Array.isArray(item?.fields)) {
          return
        }

        // @ts-ignore
        item.fields.forEach(function (field) {
          const name = String(field.name || field.value)
          const value = String(field.url || field.value)

          result.push({
            [name]: value
          })
        })
      })

      return result
    }

    export function parseSneakPeek(sneakPeek: any): SneakPeek {
      return {
        author_id: String(sneakPeek?.author_id ?? ""),
        text: String(sneakPeek?.text ?? ""),
        recipients: String(sneakPeek?.recipients ?? ""),
        timestamp: Number(sneakPeek.timestamp)
      }
    }

    export function parseChatTransferredPayload(payload?: any): ChatTransferred["payload"] {
      return {
        chat_id: String(payload?.chat_id ?? ""),
        thread_id: String(payload?.thread_id ?? ""),
        requester_id: String(payload?.requester_id ?? ""),
        reason: String(payload?.reason ?? ""),
        transferred_to: {
          group_ids: parseGroupIds(payload?.transferred_to?.group_ids),
          agent_ids: parseAgentIds(payload?.transferred_to?.agent_ids),
        },
        queue: parseQueue(payload?.queue)
      }
    }

    export function parseQueue(queue?: any): Queue | null {
      if (!queue) {
        return null
      }

      let position = Number(queue.position)
      let wait_time = Number(queue.wait_time)
      let queued_at = parseDate(queue.queued_at)

      return {
        position,
        wait_time,
        queued_at,
      }
    }

    export function parseQueuePositions(queuePositions: any): QueuePositions {
      if (!Array.isArray(queuePositions)) {
        return []
      }

      return queuePositions.map(function (queuePosition) {
        const queue = parseQueue(queuePosition.queue)

        if (!queue) {
          throw new RangeError("`queue` can't be empty")
        }

        return {
          chat_id: String(queuePosition.chat_id),
          thread_id: String(queuePosition.thread_id),
          queue,
        }
      })
    }

    export function parseListChats(resp: any) {
      const chats = parseChatsSummary(resp?.chats_summary)
      const found_chats = Number(resp?.found_chats)
      const next_page_id = String(resp?.next_page_id ?? "")

      return {
        chats,
        found_chats,
        next_page_id
      }
    }

    export function parseRoutingStatuses(statuses: any) {
      const result = new Map<string, RoutingStatus>()

      if (!Array.isArray(statuses)) {
        return result
      }

      statuses.forEach(function (status) {
        result.set(status.agent_id, parseRoutingStatus(status.status))
      })

      return result
    }

    export function parseRoutingStatus(routingStatus: any): RoutingStatus {
      switch (routingStatus) {
        case "accepting_chats":
        case "accepting chats":
        case "online":
          return "accepting_chats"

        case "not_accepting_chats":
        case "not accepting chats":
        case "away":
          return "not_accepting_chats"

        case "offline":
          return "offline"

        default:
          throw new Error("Unsupported value for routing status: " + routingStatus)
      }
    }

    export function parseAccess(access: any): Access {
      let group_ids = access?.group_ids as number[]

      if (!Array.isArray(group_ids)) {
        console.warn(`'group_ids' is not array: ${JSON.stringify(access)}`)
        group_ids = [0]
      }

      return {
        group_ids
      }
    }

    export function parseDate(date: any) {
      const d = new Date(date)

      if (Number.isNaN(d.getTime())) {
        console.warn(`parseDate: can't parse the date: ${date}`)
      }

      return d
    }

    export function parseHighlights(highlights: any): Highlight[] {
      if (!Array.isArray(highlights)) {
        return []
      }

      return highlights.map(parseHighlight)
    }

    export function parseHighlight(highlight: any): Highlight {
      switch (highlight.type) {
        case "event.message":
          return {
            type: "event.message",
            field: "text",
            highlight: String(highlight.highlight),
          }
        case "event.file":
          return {
            type: "event.file",
            field: "name",
            highlight: String(highlight.highlight),
          }
        case "event.filled_form":
          return {
            type: "event.filled_form",
            field: "answer",
            highlight: String(highlight.highlight),
          }

        default: throw new RangeError("Unsupported type of highlight: " + JSON.stringify(highlight))
      }
    }

    export function parseEventVisibility(visibility: any): Event["visibility"] {
      switch (visibility) {
        case "all":
          return "all" as const
        case "agents":
          return "agents" as const
        default:
          throw new RangeError(`Unsupported visibility: ${visibility}`)
      }
    }

    export function parseGroupIds(userIds: any) {
      if (!Array.isArray(userIds)) {
        return []
      }

      return userIds.map(Number)
    }

    export function parseAgentIds(tags: any) {
      if (!Array.isArray(tags)) {
        return []
      }

      return tags.map(String)
    }

    export function parseTags(tags: any) {
      if (!Array.isArray(tags)) {
        return []
      }

      return tags.map(String)
    }

    export function parsePush(data: any): Pushes | void {
      switch (data?.action) {
        case "incoming_chat":
          return {
            action: "incoming_chat",
            type: "push",
            payload: {
              chat: parseChat(data.payload.chat),
              requester_id: String(data.payload.requester_id ?? ""),
              transferred_from: {
                group_ids: parseGroupIds(data.payload.transferred_from?.group_ids),
                agent_ids: parseAgentIds(data.payload.transferred_from?.agent_ids),
              }
            }
          }
        case "chat_deactivated":
          return {
            action: "chat_deactivated",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id ?? ""),
              user_id: String(data.payload.user_id ?? ""),
            }
          }
        case "chat_deleted":
          return {
            action: "chat_deleted",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
            }
          }
        case "thread_deleted":
          return {
            action: "thread_deleted",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
            }
          }
        case "threads_deleted":
          return {
            action: "threads_deleted",
            type: "push",
            payload: {
              date_from: parseDate(data.payload.date_from),
              date_to: parseDate(data.payload.date_to),
              tag: String(data.payload.tag)
            }
          }
        case "chat_access_updated":
          return {
            action: "chat_access_updated",
            type: "push",
            payload: {
              id: String(data.payload.id),
              access: parseAccess(data.payload.access),
            }
          }
        case "chat_transferred":
          return {
            action: "chat_transferred",
            type: "push",
            payload: parseChatTransferredPayload(data.payload)
          }
        case "user_added_to_chat":
          return {
            action: "user_added_to_chat",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              user: parseUser(data.payload.user),
              reason: String(data.payload.reason ?? ""),
              requester_id: String(data.payload.requester_id ?? ""),
            }
          }
        case "user_removed_from_chat":
          return {
            action: "user_removed_from_chat",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              user_id: String(data.payload.user_id),
              reason: String(data.payload.reason ?? ""),
              requester_id: String(data.payload.requester_id ?? ""),
            }
          }
        case "incoming_event":
          return {
            action: "incoming_event",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              event: parseEvent(data.payload.event),
            }
          }
        case "event_updated":
          return {
            action: "event_updated",
            type: "push",
            payload: data.payload as any
          }
        case "incoming_rich_message_postback":
          return {
            action: "incoming_rich_message_postback",
            type: "push",
            payload: data.payload as any
          }
        case "chat_properties_updated":
          return {
            action: "chat_properties_updated",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              properties: parsePartialChatProperties(data.payload.properties),
            }
          }
        case "chat_properties_deleted":
          return {
            action: "chat_properties_deleted",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              properties: parseDeletedChatProperties(data.payload.properties),
            }
          }
        case "thread_properties_updated":
          return {
            action: "thread_properties_updated",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              properties: parsePartialThreadProperties(data.payload.properties),
            }
          }
        case "thread_properties_deleted":
          return {
            action: "thread_properties_deleted",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              properties: parseDeletedThreadProperties(data.payload.properties),
            }
          }
        case "event_properties_updated":
          return {
            action: "event_properties_updated",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              event_id: String(data.payload.event_id),
              properties: parsePartialEventProperties(data.payload.properties),
            }
          }
        case "event_properties_deleted":
          return {
            action: "event_properties_deleted",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              event_id: String(data.payload.event_id),
              properties: parseDeletedEventProperties(data.payload.properties),
            }
          }
        case "thread_tagged":
          return {
            action: "thread_tagged",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              tag: String(data.payload.tag),
            }
          }
        case "thread_untagged":
          return {
            action: "thread_untagged",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              tag: String(data.payload.tag),
            }
          }
        case "incoming_customers":
          return {
            action: "incoming_customers",
            type: "push",
            payload: data.payload as any
          }
        case "incoming_customer":
          return {
            action: "incoming_customer",
            type: "push",
            payload: data.payload as any
          }
        case "customer_updated":
          return {
            action: "customer_updated",
            type: "push",
            payload: data.payload as any
          }
        case "customer_page_updated":
          return {
            action: "customer_page_updated",
            type: "push",
            payload: data.payload as any
          }
        case "customer_banned":
          return {
            action: "customer_banned",
            type: "push",
            payload: data.payload as any
          }
        case "customer_transferred":
          return {
            action: "customer_transferred",
            type: "push",
            payload: data.payload as any
          }
        case "customer_left":
          return {
            action: "customer_left",
            type: "push",
            payload: data.payload as any
          }
        case "routing_status_set":
          return {
            action: "routing_status_set",
            type: "push",
            payload: {
              agent_id: String(data.payload.agent_id),
              status: parseRoutingStatus(data.payload.status),
            }
          }
        case "agent_disconnected":
          return {
            action: "agent_disconnected",
            type: "push",
            payload: {
              reason: String(data.payload.reason),
              data: data.payload.data
            }
          }
        case "agent_created":
          return {
            action: "agent_created",
            type: "push",
            payload: data.payload as any
          }
        case "agent_approved":
          return {
            action: "agent_approved",
            type: "push",
            payload: data.payload as any
          }
        case "agent_updated":
          return {
            action: "agent_updated",
            type: "push",
            payload: data.payload as any
          }
        case "agent_suspended":
          return {
            action: "agent_suspended",
            type: "push",
            payload: data.payload as any
          }
        case "agent_unsuspended":
          return {
            action: "agent_unsuspended",
            type: "push",
            payload: data.payload as any
          }
        case "agent_deleted":
          return {
            action: "agent_deleted",
            type: "push",
            payload: data.payload as any
          }
        case "auto_access_added":
          return {
            action: "auto_access_added",
            type: "push",
            payload: data.payload as any
          }
        case "auto_access_updated":
          return {
            action: "auto_access_updated",
            type: "push",
            payload: data.payload as any
          }
        case "auto_access_deleted":
          return {
            action: "auto_access_deleted",
            type: "push",
            payload: data.payload as any
          }
        case "bot_created":
          return {
            action: "bot_created",
            type: "push",
            payload: data.payload as any
          }
        case "bot_updated":
          return {
            action: "bot_updated",
            type: "push",
            payload: data.payload as any
          }
        case "bot_deleted":
          return {
            action: "bot_deleted",
            type: "push",
            payload: data.payload as any
          }
        case "group_created":
          return {
            action: "group_created",
            type: "push",
            payload: data.payload as any
          }
        case "group_deleted":
          return {
            action: "group_deleted",
            type: "push",
            payload: data.payload as any
          }
        case "group_updated":
          return {
            action: "group_updated",
            type: "push",
            payload: data.payload as any
          }
        case "incoming_typing_indicator":
          return {
            action: "incoming_typing_indicator",
            type: "push",
            payload: data.payload as any
          }
        case "incoming_sneak_peek":
          return {
            action: "incoming_sneak_peek",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              thread_id: String(data.payload.thread_id),
              sneak_peek: parseSneakPeek(data.payload.sneak_peek),
            }
          }
        case "events_marked_as_seen":
          return {
            action: "events_marked_as_seen",
            type: "push",
            payload: {
              chat_id: String(data.payload.chat_id),
              user_id: String(data.payload.user_id),
              seen_up_to: parseDate(data.payload.seen_up_to),
            }
          }
        case "incoming_multicast":
          return {
            action: "incoming_multicast",
            type: "push",
            payload: data.payload as any
          }
        case "chat_unfollowed":
          return {
            action: "chat_unfollowed",
            type: "push",
            payload: data.payload as any
          }
        case "queue_positions_updated":
          return {
            action: "queue_positions_updated",
            type: "push",
            payload: parseQueuePositions(data.payload)
          }
        case "customer_unfollowed":
          return {
            action: "customer_unfollowed",
            type: "push",
            payload: data.payload as any
          }
        default: {
          return data
        }
      }
    }
  }

  /**
   * Configuration API
   */

  export namespace conf {
    /**
     * Types
     */
    export interface Agent {
      id: string
      name: string
      avatar_path: string
      job_title: string
    }

    export interface Group {
      id: number
      name: string
      routing_status: agent.RoutingStatus
    }

    export interface Channel {
      channel_type: "code" | "direct_link" | "integration"
      channel_subtype: string
      first_activity_timestamp: string
    }

    /**
     * Method
     */

    interface listAgents$Payload {
      filters?: {
        group_ids?: number[]
      }
    }

    export function listAgents(accessToken: string, payload: listAgents$Payload, signal: AbortSignal) {
      return fetch("https://api.livechatinc.com/v3.5/configuration/action/list_agents", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
        signal,
      }).then(parseResponse).then(parseAgents)
    }

    export function listGroups(accessToken: string, payload: {
      fields?: string[]
    }, signal: AbortSignal) {
      return fetch("https://api.livechatinc.com/v3.5/configuration/action/list_groups", {
        headers: getRequestHeaders(accessToken),
        method: "POST",
        body: JSON.stringify(payload),
        signal,
      }).then(parseResponse<Group[]>)
    }

    export function listlChannels(token: string, signal: AbortSignal) {
      return fetch("https://api.livechatinc.com/v3.6/configuration/action/list_channels", {
        headers: getRequestHeaders(token),
        method: "POST",
        body: JSON.stringify({}),
        signal,
      }).then(parseResponse<Channel>)
    }

    /**
     * Parsers
     */
    function parseAgents(agents: any): Agent[] {
      if (!Array.isArray(agents)) {
        throw new RangeError("`agents` should be an list")
      }

      return agents.map(parseAgent)
    }

    function parseAgent(agent: any): Agent {
      return {
        ...agent,
        avatar_path: parseAvatarUrl(agent.avatar_path),
      }
    }
  }
}

export namespace accounts {
  export interface GetAccountsUrlOptions {
    path?: "signout"
    response_type: "token" | "code"
    client_id: string
    redirect_uri: string
  }

  export function getAccountsUrl(options: GetAccountsUrlOptions) {
    return `https://accounts.livechat.com/${options.path || ""}?${new URLSearchParams({ ...options })}`
  }
}

function getRegion(accessToken: string) {
  return accessToken?.split(":")[0] || "dal"
}

function getRequestHeaders(accessToken: string) {
  return {
    "X-Region": getRegion(accessToken),
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  }
}

function parseAvatarUrl(avatarUrl?: string) {
  if (!avatarUrl) {
    return ""
  }

  if (avatarUrl.startsWith("https://")) {
    return avatarUrl
  }

  if (avatarUrl.startsWith("http://")) {
    return avatarUrl.replace("http://", "https://")
  }


  return `https://${avatarUrl}`
}

function parseResponse<T = any>(response: Response) {
  return response.text().then(function (text) {
    let json;

    try {
      json = JSON.parse(text)
    }
    catch (err) {
      throw new ErrorWithType("Fail to parse JSON response: " + text, "internal_error", response.status)
    }

    if (response.ok) {
      return json as T
    }

    const message = json.error && json.error.message || json.error_description || json.error || "Request failed"
    const type = json.error && json.error.type || json.type || json.error || "internal_error"

    throw new ErrorWithType(message, type, response.status)
  })
}
