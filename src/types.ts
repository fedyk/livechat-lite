export interface Credentials {
  accessToken: string
  expiredAt: number
  scopes: string[]
}

export interface SelectedChatSegment {
  segment: "my" | "queued" | "supervised" | "unassigned" | "archived"
}

export interface Chat {
  id: string
  sneakPeek: SneakPeek | null
  customerId?: string
  properties: ChatProperties
  groupId: number
  users: {
    [userId: string]: User
  }
  threadIds: string[]
  threads: {
    [threadId: string]: Thread
  }
  history: {
    status: "incomplete" | "up-to-date"
    foundThreads: number | null
    nextPageId: string | null
  }
  /** Synthetic props user by service/api */
  isSyncingIncompleteThreads?: boolean
}

export interface License {
  id: number
}

export interface SneakPeek {
  authorId: string
  text: string
  timestamp: number
}

export interface ChatProperties {
  routing: {
    continuous: boolean
    pinned: boolean
  }
  source: {
    customerClientId: string
  }
  supervising: {
    agentIds: string[]
  }
}

export interface Thread {
  id: string
  tags: string[]
  active: boolean
  messages: Message[]
  createdAt: number
  properties: ThreadProperties
  incomplete: boolean
  restrictedAccess?: string
  highlights: Highlight[]
  queue: Queue | null
}

export interface ThreadProperties {
  routing: {
    idle: boolean
    lastTransferTimestamp: number
  }
  rating: {
    score?: number | null
    comment: string | null
  }
}

export interface Queue {
  position: number
  waitTime: number
  queuedAt: number
}

export type RoutingStatus = "accepting_chats" | "not_accepting_chats" | "offline"

export interface MyProfile {
  id: string
  name: string
  email: string
  avatar: string
  // routingStatus: RoutingStatus
}

export interface Agent {
  id: string
  name: string
  jobTitle: string
  avatarUrl: string
}

export interface Group {
  id: number
  name: string
  routingStatus: RoutingStatus
}

export type User = UserAgent | UserCustomer;

export interface UserAgent {
  id: string
  name: string
  email: string
  type: "agent"
  avatar?: string
  present: boolean
  /** @type {number} Timestamp in MILLISECONDS */
  seenUpTo: number
}

export interface UserCustomer extends Customer {
  type: "customer"
  avatar?: string
  present: boolean
  /** @type {number} Timestamp in MILLISECONDS */
  seenUpTo: number
}

export interface Customer {
  id: string
  name: string
  email: string
  avatar?: string
  lastVisit?: CustomerLastVisit
  statistics: CustomerStatistics
  fields: Fields
}


export interface CustomerLastVisit {
  ip: string
  startedAt: number
  /** @type {number} milliseconds */
  endedAt?: number
  userAgent: string
  referrer: string
  lastPages: VisitedPage[]
  geolocation?: Geolocation
}

export interface CustomerStatistics {
  chatsCount: number
  threadCount: number
  visitsCount: number
}

export interface VisitedPage {
  url: string
  title: string
  openedAt: number
}

export interface Geolocation {
  city: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
  region: string
  timezone: string
}

export type Fields = Array<{
  name: string
  value: string
}>

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

export interface FileMessage {
  id: string
  customId?: string
  type: "file",
  authorId: string
  createdAt: number,
  recipients: "all" | "agents"
  name: string
  url: string
  thumbnailUrl?: string
  thumbnail2xUrl?: string
  contentType: string
  size: number
  width?: number
  height?: number
}

export interface FilledFormEvent {
  id: string
  customId?: string
  type: "filled_form",
  authorId: string
  createdAt: number,
  recipients: "all" | "agents",
  formId: string
  fields: Array<{
    name: string
    value: string
  }>
}

export interface TextMessage {
  id: string
  customId?: string
  /** send request is in progress */
  isSending?: boolean
  type: "message",
  authorId: string
  createdAt: number
  text: string
  postback: any
  recipients: "all" | "agents"
}

export interface RichMessage {
  id: string
  customId?: string
  type: "rich_message"
  authorId: string
  createdAt: number
  recipients: "all" | "agents"
  templateId: "cards" | "sticker" | "quick_replies"
  elements: Array<{
    title?: string
    subtitle?: string
    image?: {
      name: string,
      url: string
      contentType: string
      size: number
      width: number
      height: number
      alternativeText: string
    }
    buttons?: Array<{
      text: string
    }>
  }>
}

export interface SystemMessage {
  id: string
  customId?: string
  recipients: "all" | "agents"
  type: "system_message"
  createdAt: number
  text: string
}

export interface SneakPeekMessage {
  id: string
  customId?: string
  type: "sneak_peek",
  authorId: string
  createdAt: number
  text: string
  recipients: "all" | "agents"
}

export type Message = FileMessage | FilledFormEvent | TextMessage | RichMessage | SystemMessage | SneakPeekMessage

export type ChatRoute =
  /** Active and assigned to me */
  "my" |
  /** Active and assigned to other agent/bot */
  "other" |
  /** Closed */
  "closed" |
  /** Active and unassigned */
  "queued" |
  /** Active, assigned to other and has me in list of supervisors */
  "supervised" |
  /** Active, unassigned, continuous, pinned */
  "unassigned" |
  /** Inactive, continuous, pinned */
  "pinned"

export interface CannedResponse {
  id: number
  text: string
  tags: string[]
  tagsStr: string // #tag1, #tag2
}

export interface API$Push<A, P = any> {
  action: A
  type: "push"
  payload: P
  request_id: string
}

export type API$Pushes = API$Push$RoutingStatusSet |
  API$Push$ChatDeactivated |
  API$Push$IncomingChat |
  API$Push$IncomingEvent |
  API$Push$ChatTransferred |
  API$Push$ChatThreadTagged |
  API$Push$ChatThreadUntagged |
  API$Push$ChatAccessGranted |
  API$Push$ChatAccessRevoked |
  API$Push$UserAddedToChat |
  API$Push$UserRemovedToChat |
  API$Push$ChatPropertiesUpdated |
  API$Push$ChatPropertiesDeleted |
  API$Push$ThreadPropertiesUpdated |
  API$Push$ThreadPropertiesDeleted |
  API$Push$EventsMarkedAsSeen |
  API$Push$IncomingSneakPeek |
  API$Push$Multicast |
  API$Push$AgentDisconnected |
  API$Push$QueuePositionsUpdated;

export type API$Push$RoutingStatusSet = API$Push<"routing_status_set", {
  agent_id: string
  status: "accepting_chats" | "not_accepting_chats" | "offline"
}>

export type API$Push$IncomingChat = API$Push<"incoming_chat", {
  chat: API$Chat
  requester_id?: string
}>

export type API$Push$ChatDeactivated = API$Push<"chat_deactivated", {
  chat_id: string
  thread_id: string
  user_id?: string
}>

export type API$Push$IncomingEvent = API$Push<"incoming_event", {
  chat_id: string
  thread_id: string
  event: API$Event
}>

export type API$Push$ChatTransferred = API$Push<"chat_transferred", {
  chat_id: string
  thread_id: string
  requester_id?: string
  transferred_to: {
    group_ids: number[]
    agent_ids: string[]
  }
  queue?: API$Queue
}>

export type API$Push$ChatThreadTagged = API$Push<"thread_tagged", {
  chat_id: string,
  thread_id: string
  tag: string
}>

export type API$Push$ChatThreadUntagged = API$Push<"thread_untagged", {
  chat_id: string,
  thread_id: string
  tag: string
}>

export type API$Push$ChatAccessGranted = API$Push<"chat_access_granted", {
  id: string
  access: {
    groups_ids: number[]
  }
}>

export type API$Push$ChatAccessRevoked = API$Push<"chat_access_revoked", {
  id: string
  access: {
    groups_ids: number[]
  }
}>

export type API$Push$UserAddedToChat = API$Push<"user_added_to_chat", {
  chat_id: string
  thread_id: string
  user: API$User
  requester_id?: string
}>

export type API$Push$UserRemovedToChat = API$Push<"user_removed_from_chat", {
  chat_id: string
  thread_id: string
  user_id: string
  requester_id?: string
}>


export type API$Push$EventsMarkedAsSeen = API$Push<"events_marked_as_seen", {
  chat_id: string
  user_id: string
  seen_up_to: string
}>

export type API$Push$ChatPropertiesUpdated = API$Push<"chat_properties_updated", {
  chat_id: string
  properties: Partial<API$ChatProperties>
}>

export type API$Push$ChatPropertiesDeleted = API$Push<"chat_properties_deleted", {
  chat_id: string
  properties: {
    [namespace: string]: string[]
  }
}>

export type API$Push$ThreadPropertiesUpdated = API$Push<"thread_properties_updated", {
  chat_id: string
  thread_id: string
  properties: Partial<API$ThreadProperties>
}>

export type API$Push$ThreadPropertiesDeleted = API$Push<"thread_properties_deleted", {
  chat_id: string
  thread_id: string
  properties: {
    [namespace: string]: string[]
  }
}>

export type API$Push$IncomingSneakPeek = API$Push<"incoming_sneak_peek", {
  chat_id: string
  thread_id: string
  sneak_peek: API$SneakPeek
}>

export type API$Push$Multicast = API$Push<"incoming_multicast", API$Multicast$IWCS0014R |
  API$Multicast$CannedResponseAdd |
  API$Multicast$CannedResponseUpdate |
  API$Multicast$CannedResponseRemove>

export interface API$Multicast$IWCS0014R {
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

export interface API$Multicast$CannedResponseAdd {
  type: "lc2"
  content: {
    name: "canned_response_add"
    canned_response: API$CannedResponse
    group: number
  }
}

export interface API$Multicast$CannedResponseUpdate {
  type: "lc2"
  content: {
    name: "canned_response_update"
    canned_response: API$CannedResponse
    group: number
  }
}

export interface API$Multicast$CannedResponseRemove {
  type: "lc2"
  content: {
    name: "canned_response_remove"
    canned_response: { id: number }
    group: number
  }
}

export type API$Push$AgentDisconnected = API$Push<"agent_disconnected", {
  reason: "connection_timeout" |
  "access_token_revoked" |
  "access_token_expired" |
  "license_expired" |
  "agent_deleted" |
  "agent_logged_out_remotely" |
  "agent_disconnected_by_server" |
  "unsupported_version" |
  "ping_timeout" |
  "internal_error" |
  "too_many_connections" |
  "misdirected_request" |
  "product_version_changed" |
  "license_not_found"
}>

export type API$Push$QueuePositionsUpdated = API$Push<"queue_positions_updated", Array<{
  chat_id: string
  thread_id: string
  queue: {
    position: number
    wait_time: number
  }
}>>

export interface API$MyProfile {
  id: string
  name: string
  email: string
  avatar: string
  routing_status: "accepting_chats" | "not_accepting_chats" | "offline"
  permission: string
}

export interface API$License {
  id: string
}


export interface API$Chat {
  id: string
  users: Array<API$User$Agent | API$User$Customer>
  thread: API$Thread
  access?: {
    group_ids: number[]
  }
  is_followed: boolean
  properties: API$ChatProperties
}


export interface API$ChatProperties {
  routing?: {
    continuous?: boolean
    pinned?: boolean
    was_pinned?: boolean
  }
  source?: {
    client_id: string
  }
  supervising?: {
    agent_ids: string
  }
}

export interface API$Thread {
  id: string
  active: boolean
  events?: API$Event
  user_ids: string[]
  tags: string[] | undefined
  access: {
    group_ids: number[]
  }
  highlight?: API$Highlight[]
  properties: API$ThreadProperties
  restricted_access?: string
  custom_variables?: {
    key: string,
    value: string
  }[]
  created_at: string
  queue?: API$Queue
}


export interface API$ChatSummary {
  id: string;
  last_event_per_type: {
    filled_form: {
      thread_id: string
      thread_order: 1
      event: API$Event$FilledForm
    }
    message: {
      thread_id: string
      thread_order: number
      event: API$Event$Message
    }
    system_message: {
      thread_id: string
      thread_order: number
      event: API$Event$System
    }
  },
  users: Array<API$User$Agent | API$User$Customer>
  last_thread_summary: API$ThreadSummary
  properties?: API$ChatProperties
  access?: {
    group_ids: number[]
  },
  order: number,
  is_followed: boolean
}

export interface API$ThreadSummary {
  id: string
  tags: string[]
  active: boolean
  user_ids: string[]
  created_at: string
  properties: API$ThreadProperties
  queue?: API$Queue
  access: {
    group_ids: number[]
  }
}

export interface API$Queue {
  position: number
  wait_time: number
  queued_at?: string
}


export type API$Event = API$Event$Message |
  API$Event$System |
  API$Event$FilledForm |
  API$Event$File |
  API$Event$Annotation |
  API$Event$Custom |
  API$Event$RichMessage;

export interface API$Event$Message {
  id: string
  text: string
  created_at: string
  author_id: string
  custom_id: string
  recipients: "all" | "agents"
  type: "message"
  properties?: {
    lc2?: {
      greeting_id?: {
        value: number
      }
      greeting_unique_id?: {
        value: string
      }
      welcome_message?: {
        value: boolean
      }
    }
  }
  postback?: {
    type: string
  }
}

export interface API$Event$System {
  id: string
  type: "system_message"
  custom_id: string
  created_at: string
  text: string
  recipients: "all" | "agents"
  system_message_type: string
  text_vars: {
    [key: string]: string
  }
}

export interface API$Event$FilledForm {
  id: string
  type: "filled_form"
  custom_id: string
  author_id: string
  created_at: string
  form_id: string
  recipients: "all" | "agents"
  properties?: any
  fields?: API$Event$FilledForm$Field[]
}

export interface API$Event$FilledForm$Field {
  id?: string
  type: "name" | "email" | "question" | "textarea" | "radio" | "select" | "checkbox" | "group_chooser"
  label: string
  value?: string
  answer?: API$Event$FilledForm$FieldAnswer
  answers?: API$Event$FilledForm$FieldAnswer[]
}

export type API$Event$FilledForm$FieldAnswer = string | {
  id: string
  label: string
} | {
  group_id: number
  label: string
}

export interface API$Event$File {
  id: string
  custom_id: string
  type: "file"
  author_id: string
  created_at: string
  recipients: "all" | "agents"
  name: string
  url: string
  content_type: string // e.g. "image/png"
  size: number
  /** Optional. Available only for images */
  thumbnail_url?: string
  /** Optional. Available only for images */
  thumbnail2x_url?: string
  /** Optional. Available only for images */
  width?: number
  /** Optional. Available only for images */
  height?: number
  properties?: any
}

export interface API$Event$Annotation {
  id: string
  custom_id: string
  type: "annotation"
  author_id: string
  created_at: string
  recipients: "all" | "agents"
  annotation_type: "rating" | "rating_cancel"
  properties: {
    rating?: {
      score?: {
        value: number
      }
      comment?: {
        value: string
      }
    }
  }
}

export interface API$Event$Custom {
  id: string
  custom_id?: string
  author_id: string
  recipients: "agents" | "all"
  type: "custom"
  created_at: string
  // TODO..
}

export interface API$Event$RichMessage {
  id: string
  custom_id?: string
  author_id: string
  type: "rich_message"
  created_at: string
  recipients: "agents" | "all"
  template_id: "cards" | "quick_replies"
  elements?: Array<{
    title?: string
    subtitle?: string
    image?: {
      name?: string
      url: string
      content_type?: string
      size: number
      width: number
      height: number
      alternative_text?: number
    }
    buttons?: Array<{
      type: "message" | "phone"
      text: string
      value?: string
      webview_height?: "compact" | "tall" | "full"
      postback_id: string
      user_ids?: string[]
    }>
  }>
}

export type API$User = API$User$Agent | API$User$Customer;

export interface API$User$Agent {
  id: string
  type: "agent"
  name: string
  email: string
  present: true
  events_seen_up_to?: string
  avatar?: string,
}

export interface API$User$Customer {
  id: string
  name: string
  email: string
  type: "customer"
  present: true,
  avatar?: string,
  created_at?: string
  last_visit?: API$Customer$Visit
  events_seen_up_to?: string
  statistics?: {
    chats_count: number,
    threads_count?: number
    visits_count?: number
  }
  session_fields?: {
    [key: string]: string
  }[]
  agent_last_event_created_at?: string
  customer_last_event_created_at?: string
}

export interface API$Customer$Visit {
  started_at: string
  ip: string
  user_agent: string
  referrer?: string
  geolocation: API$Geolocation
  last_pages?: {
    opened_at: string;
    title: string;
    url: string;
  }[]
}

export interface API$Agent {
  id: string
  name: string
  job_title: string
  avatar_path: string
}

export interface API$Group {
  id: string
  name: string
  routing_status: string
}

// export interface API$Customer {
//   id: string
//   name: string
//   email: string
//   type: "customer"
//   avatar?: string
//   created_at?: string
//   last_visit?: {
//     started_at: string
//     ip: string
//     user_agent: string
//     referrer?: string
//     geolocation: API$Geolocation
//     last_pages?: Array<{
//       opened_at: string;
//       title: string;
//       url: string;
//     }>
//   }
//   session_fields: Array<object>
//   agent_last_event_created_at?: string
//   customer_last_event_created_at?: string
//   chat_ids: string[]
//   statistics: {
//     chats_count: number,
//     threads_count: number,
//     visits_count: number
//     page_views_count: number
//     greetings_shown_count: number
//     greetings_accepted_count: number
//   }
// }

export interface API$Geolocation {
  country: string
  country_code: string
  region: string
  city: string
  timezone: string
  latitude: string
  longitude: string
}

export type API$Highlight = {
  type: "event.message",
  field: "text"
  highlight: string
} | {
  type: "event.file",
  field: "name"
  highlight: string
} | {
  type: "event.filled_form",
  field: "answer"
  highlight: string
}

export interface API$ThreadProperties {
  routing: {
    idle?: boolean
    last_transfer_timestamp?: number
    unassigned?: boolean
  }
  source?: {
    client_id?: string
  }
  rating?: {
    comment?: string
    score?: number
  }
}

export interface API$SneakPeek {
  author_id: string
  recipients: "all"
  text: string
  timestamp: number
}

export interface API$CannedResponse {
  id: number
  group: number
  tags: string[]
  text: string
}

export interface API$Response$Login {
  license: API$License
  my_profile: API$MyProfile
  chats_summary: API$ChatSummary[]
}

export interface API$Response$SendEvent {
  event_id: string;
}

export interface API$Response$GetChat extends API$Chat {
  // empty
}

export interface API$RequestPayload$ListAgents {
  filters?: {
    group_ids?: number[]
  }
}

export interface API$RequestPayload$ListGroups {
  fields?: string[]
}

export interface API$RequestPayload$TransferChat {
  id: string
  target: {
    type: "agent" | "group"
    ids: (string | number)[]
  }
  force: boolean
}

export type API$Response$ListAgents = API$Agent[]
export type API$Response$ListGroups = API$Group[]
