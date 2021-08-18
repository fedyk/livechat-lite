import { indexBy } from "./helpers";
import { Agent, API$Agent, API$CannedResponse, API$Chat, API$ChatProperties, API$ChatSummary, API$Customer$Visit, API$Event, API$Event$FilledForm$Field, API$Event$FilledForm$FieldAnswer, API$Geolocation, API$Group, API$License, API$MyProfile, API$Push$ChatTransferred, API$Queue, API$SneakPeek, API$Thread, API$ThreadProperties, API$User, API$User$Customer, CannedResponse, Chat, ChatProperties, Fields, Geolocation, Group, License, Message, MyProfile, RoutingStatus, SneakPeek, Thread, ThreadProperties, User } from "./types";

export function parseQueryParams(query: string) {
  const vars = query.split('&');
  const values: {
    [key: string]: string
  } = {}

  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    const key = decodeURIComponent(pair[0])
    const value = decodeURIComponent(pair[1])

    values[key] = value
  }

  return values
}

/**
 * Parse data from LiveChat Accounts
 * @see https://developers.livechat.com/docs/authorization/authorizing-api-calls/#step-3-get-an-access-token-from-the-url 
 */
export function parseAccountsCredentials(credentials: any) {
  const accessToken = String(credentials.access_token ?? "").trim()
  const expiresIn = Number(credentials.expires_in ?? 0)
  const scopes = String(credentials.scope ?? 0).split(",")
  const state = Number(credentials.state ?? 0)
  const expiredAt = Date.now() + (Number.isNaN(expiresIn) ? 1000 * 60 * 60 * 24 : expiresIn * 1000)

  if (accessToken.length === 0) {
    throw new Error("Invalid access token was passed")
  }

  return {
    accessToken,
    expiredAt,
    state,
    scopes
  }
}

export function parseChat(chat: API$Chat): Chat {
  const groupId = getChatGroupId(chat)
  const thread = parseThread(chat.thread)
  const users = parseChatUsers(chat.users)
  const properties = parseChatProperties(chat.properties)
  const customerId = getCustomerId(users)

  return {
    id: chat.id,
    users: indexBy(users, "id"),
    customerId,
    sneakPeek: null,
    properties,
    groupId,
    threadIds: [thread.id],
    threads: {
      [thread.id]: thread
    },
    history: {
      status: "incomplete",
      foundThreads: null,
      nextPageId: null
    }
  }
}

export function getChatGroupId(chat: Pick<API$Chat, "id" | "access">) {
  const access = chat?.access

  if (!access) {
    console.warn(`Chat has missed 'access' property`);
    return 0
  }

  if (!Array.isArray(access.group_ids) || access.group_ids.length === 0) {
    console.warn("Chat has empty group_ids property")
    return 0
  }

  if (access.group_ids.length > 1) {
    console.warn(`Chat ${chat.id} has more the one (${access.group_ids}) group ids in access`)
  }

  return access.group_ids[0] ?? 0
}


export function parseThread(thread: API$Thread): Thread {
  const createdAt = new Date(thread.created_at).getTime()

  if (Number.isNaN(createdAt)) {
    console.warn(`parseThread: invalid created_at value: ${JSON.stringify({ thread_id: thread.id, created_at: thread.created_at })}`)
  }

  const messages = parseThreadMessages(thread)

  return {
    id: thread.id,
    tags: thread.tags || [],
    active: thread.active,
    createdAt: createdAt,
    messages: messages,
    properties: parseThreadProperties(thread.properties),
    incomplete: false,
    restrictedAccess: parseThreadRestrictedAccess(thread.restricted_access),
    highlights: thread.highlight || [],
    queue: parseQueue(thread.queue),
  }
}

export function parseChatUsers(users: API$User[]) {
  if (!Array.isArray(users)) {
    return []
  }

  return users.map(u => parseUser(u))
}

export function parseUser(user: API$User): User {
  let seenUpTo = 0;

  if (user.events_seen_up_to) {
    const eventsSeenUpTo = new Date(user.events_seen_up_to).getTime()

    if (!Number.isNaN(eventsSeenUpTo)) {
      seenUpTo = eventsSeenUpTo
    }
    else {
      console.warn("User has invalid date time in `events_seen_up_to`", user)
    }
  }

  switch (user.type) {
    case "agent":
      return {
        id: String(user.id),
        email: String(user.email),
        name: String(user.name || "Agent").trim(),
        type: "agent",
        avatar: parseAvatarUrl(user.avatar),
        seenUpTo: seenUpTo,
        present: Boolean(user.present),
      }

    case "customer":
      return {
        id: String(user.id),
        email: String(user.email),
        name: String(user.name || "Visitor").trim(),
        type: "customer",
        avatar: parseAvatarUrl(user.avatar),
        present: Boolean(user.present),
        seenUpTo: seenUpTo,
        lastVisit: parseCustomerLastVisit(user.last_visit),
        statistics: parseStatistics(user.statistics),
        fields: parseCustomerSessionFields(user.session_fields)
      }

    default:
      throw new Error("Invalid user type passed")
  }
}

export function parseChatProperties(properties: API$ChatProperties): ChatProperties {
  return {
    routing: {
      continuous: getPropertyValue<boolean>(properties, "routing", "continuous", false),
      pinned: getPropertyValue<boolean>(properties, "routing", "pinned", false),
    },
    source: {
      customerClientId: getPropertyValue<string>(properties, "source", "customer_client_id", "")
    },
    supervising: {
      agentIds: parseSupervisingAgentsIds(properties)
    },
  }
}

export function parseChatsSummary(chatSummaries: API$ChatSummary[]): Chat[] {
  if (!Array.isArray(chatSummaries)) {
    return []
  }

  return chatSummaries.map(chatSummary => parseChatSummary(chatSummary))
}

export function parseChatSummary(chat: API$ChatSummary): Chat {
  const groupId = getChatGroupId(chat)
  const users = chat.users.map(u => parseUser(u))
  const customerId = getCustomerId(users)
  const properties = parseChatProperties(chat.properties || {})
  const thread = parseLastThreadSummary(chat)

  return {
    id: chat.id,
    sneakPeek: null,
    customerId,
    properties,
    groupId,
    users: indexBy(users, "id"),
    threadIds: [thread.id],
    threads: {
      [thread.id]: thread
    },
    history: {
      status: "incomplete",
      foundThreads: null,
      nextPageId: null
    },
  }
}

export function parseLastThreadSummary(chatSummary: API$ChatSummary): Thread {
  const lastThreadSummary = chatSummary.last_thread_summary;
  const messagesPerThread = parseEventsFromLastEventPerType(chatSummary.last_event_per_type)
  const lastThreadMessages = messagesPerThread.get(lastThreadSummary.id) || []
  const createdAt = new Date(lastThreadSummary.created_at).getTime()

  if (Number.isNaN(createdAt)) {
    console.warn(`parseLastThreadSummary: invalid created_at value: ${JSON.stringify({
      lastThreadSummary
    })}`)
  }

  return {
    id: lastThreadSummary.id,
    tags: lastThreadSummary.tags || [],
    active: lastThreadSummary.active,
    messages: lastThreadMessages,
    createdAt: createdAt,
    properties: parseThreadProperties(lastThreadSummary.properties),
    incomplete: true,
    highlights: [],
    queue: parseQueue(lastThreadSummary.queue),
  }
}


export function parseEventsFromLastEventPerType(lastEventsByType: API$ChatSummary["last_event_per_type"]): Map<string, Message[]> {
  const eventsSummaries = Object.values(lastEventsByType)
    .filter(function (eventSummary) {
      return Boolean(eventSummary && eventSummary.event && eventSummary.thread_id)
    })
    .map(function (eventSummary) {
      return {
        threadId: eventSummary.thread_id,
        event: parseChatEvent(eventSummary.event)
      }
    })
    .sort(function (a, b) {
      return a.event.createdAt - b.event.createdAt
    })

  const messagesByThreadId = new Map<string, Message[]>();

  eventsSummaries.forEach(function (eventSummary) {
    const threadMessages = messagesByThreadId.get(eventSummary.threadId)

    if (threadMessages) {
      threadMessages.push(eventSummary.event)
    }
    else {
      messagesByThreadId.set(eventSummary.threadId, [eventSummary.event])
    }
  })

  return messagesByThreadId
}

export function parseThreadProperties(properties: Partial<API$ThreadProperties>): ThreadProperties {
  return {
    routing: {
      idle: getPropertyValue<boolean>(properties, "routing", "idle", false),
      lastTransferTimestamp: getNumericPropertyValue(properties, "routing", "last_transfer_timestamp", 0),
    },
    rating: {
      score: getNumericPropertyValue(properties, "rating", "score", null),
      comment: getPropertyValue<string>(properties, "rating", "comment", "")
    },
  }
}

function parseThreadRestrictedAccess(restrictedAccess?: any) {
  if (typeof restrictedAccess !== "string") {
    return
  }

  if (restrictedAccess.length === 0) {
    return
  }

  return restrictedAccess
}

export function getPropertyValue<T>(properties: any, ns: string, key: string, def: T): T {
  return properties && properties[ns] && properties[ns][key] !== undefined ? properties[ns][key] : def
}

export function getNumericPropertyValue(properties: Partial<API$ChatProperties | API$ThreadProperties>, ns: string, key: string, def: any): number {
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

export function parseSupervisingAgentsIds(properties: Partial<API$ChatProperties>): string[] {
  const stringifiedAgentsIds = getPropertyValue<string>(properties, "supervising", "agent_ids", "")

  if (typeof stringifiedAgentsIds !== "string") {
    console.warn(`Parser: wrong type of supervising agents ids property:`, typeof stringifiedAgentsIds)
    return [];
  }

  if (stringifiedAgentsIds === "") {
    return [];
  }

  return stringifiedAgentsIds.split(",").map(agentId => agentId.trim().toLowerCase()).filter(Boolean);
}

export function hasPropertyValue(properties: any, ns: string, key: string) {
  return properties && properties[ns] && properties[ns][key] !== undefined
}

export function parseChatEvent(event: API$Event): Message {
  const id = String(event?.id)
  const type = String(event?.type)
  const createdAt = new Date(event.created_at).getTime()

  if (Number.isNaN(createdAt)) {
    console.warn("Event has invalid creating date: " + JSON.stringify(event))
  }

  switch (event.type) {
    case "message":
      return {
        id,
        type: "message",
        customId: event.custom_id,
        text: event.text,
        recipients: event.recipients,
        authorId: event.author_id,
        createdAt: createdAt,
        postback: {},
      }

    case "filled_form":
      return {
        id,
        customId: event.custom_id,
        recipients: event.recipients,
        authorId: event.author_id,
        formId: event.form_id,
        createdAt,
        fields: parseFilledFormFields(event.fields),
        type: "filled_form"
      }

    case "system_message":
      return {
        id,
        recipients: event.recipients,
        text: event.text,
        createdAt,
        type: "system_message",
      }

    case "file":
      return {
        id,
        customId: event.custom_id,
        authorId: event.author_id,
        recipients: event.recipients,
        createdAt,
        type: "file",
        name: event.name,
        url: event.name,
        thumbnailUrl: event.thumbnail_url,
        thumbnail2xUrl: event.thumbnail2x_url,
        contentType: event.content_type,
        size: event.size,
        width: event.width,
        height: event.height,
      }

    case "rich_message":
      return {
        id: event.id,
        customId: event.custom_id,
        type: "rich_message",
        authorId: event.author_id,
        createdAt,
        recipients: event.recipients,
        templateId: event.template_id,
        elements: Array.isArray(event.elements) ? event.elements.map(el => {
          return {
            title: el.title,
            subtitle: el.subtitle,
            image: el.image ? {
              name: el.image.name || "",
              url: el.image.url,
              contentType: String(el.image.content_type ?? ""),
              size: el.image.size,
              width: el.image.width,
              height: el.image.height,
              alternativeText: String(el.image.alternative_text ?? ""),
            } : void 0,
            buttons: Array.isArray(el.buttons) ? el.buttons.map(button => {
              return {
                text: button.text
              }
            }) : void 0
          }
        }) : []
      }

    case "annotation":
      console.warn(`Parser: Unknown message type ${type}, ${JSON.stringify(event, null, 2)}`)

      return {
        id: event.id,
        recipients: event.recipients,
        type: "system_message",
        text: "Unsupported type of message",
        createdAt,
      }

    default: {
      console.warn(`Parser: Unknown message type ${type}, ${JSON.stringify(event, null, 2)}`)

      return {
        id: event.id,
        recipients: event.recipients,
        type: "system_message",
        text: "Unsupported type of message",
        createdAt,
      }
    }
  }
}

export function parseFilledFormFields(fields?: API$Event$FilledForm$Field[]) {
  if (!fields) {
    return [];
  }
  return fields.map(field => ({
    name: field.label,
    value: parseFilledFormAnswer(field.value || field.answer || field.answers) || ''
  }))
}

function parseFilledFormAnswer(answer: API$Event$FilledForm$FieldAnswer | API$Event$FilledForm$FieldAnswer[] | void): string {
  if (!answer) {
    return ''
  }

  if (typeof answer === "string") {
    return answer
  }

  if (typeof answer === 'boolean') {
    return answer ? "Yes" : "No";
  }

  if (Array.isArray(answer)) {
    return answer.map(v => parseFilledFormAnswer(v)).filter(Boolean).join(", ")
  }

  if (answer && answer.label) {
    return answer.label
  }

  return '';
}

export function parseMyProfile(myProfile: API$MyProfile): MyProfile {
  return {
    id: String(myProfile.id),
    name: String(myProfile.name),
    email: String(myProfile.email),
    avatar: String(myProfile.avatar),
  }
}
export function parseLicense(license: API$License): License {
  return {
    id: Number(license.id),
  }
}

export function parseRoutingStatus(routingStatus: any): RoutingStatus {
  if (routingStatus === "accepting_chats" || routingStatus === "accepting chats") {
    return "accepting_chats"
  }

  if (routingStatus === "not_accepting_chats" || routingStatus === "not accepting chats") {
    return "not_accepting_chats"
  }

  if (routingStatus === "offline") {
    return "offline"
  }

  if (routingStatus === "online") {
    return "accepting_chats"
  }

  throw new RangeError("Unsupported routing status: " + routingStatus)
}


export function parseAvatarUrl(avatarUrl?: string) {
  if (!avatarUrl) {
    return ""
  }

  if (avatarUrl.startsWith("http")) {
    return avatarUrl
  }

  return `https://${avatarUrl}`
}

export function parseGeolocation(geolocation?: API$Geolocation): Geolocation | undefined {
  if (!geolocation) {
    return void 0
  }

  // geolocation can be an empty object
  if (Object.values(geolocation).length === 0) {
    return void 0
  }

  return {
    country: geolocation.country,
    countryCode: geolocation.country_code,
    region: geolocation.region,
    city: geolocation.city,
    timezone: geolocation.timezone,
    latitude: Number(geolocation.latitude),
    longitude: Number(geolocation.longitude),
  }
}

export function parseStatistics(statistics: API$User$Customer["statistics"]) {
  return {
    chatsCount: Number(statistics?.chats_count ?? 0),
    threadCount: Number(statistics?.threads_count ?? 0),
    visitsCount: Number(statistics?.visits_count ?? 0),
  }
}

export function parseThreadMessages(thread: API$Thread) {
  if (Array.isArray(thread.events)) {
    return thread.events.map(event => parseChatEvent(event));
  }

  return []
}

export function parseCustomerLastVisit(lastVisit?: API$Customer$Visit) {
  if (!lastVisit) {
    return
  }

  const lastPages = Array.isArray(lastVisit.last_pages)
    ? lastVisit.last_pages.map(function (last_page) {
      return {
        url: last_page.url,
        title: last_page.title,
        openedAt: new Date(last_page.opened_at).getTime()
      }
    })
    : []

  return {
    ip: lastVisit.ip,
    referrer: String(lastVisit.referrer ?? "").trim(),
    startedAt: lastVisit.started_at ? new Date(lastVisit.started_at).getTime() : Date.now(),
    userAgent: lastVisit.user_agent ?? "Unknown device",
    lastPages: lastPages,
    geolocation: parseGeolocation(lastVisit.geolocation)
  }
}

export function parseCustomerSessionFields(fields?: object[]): Fields {
  const result: Fields = []

  if (!Array.isArray(fields)) {
    return result
  }

  fields.forEach(function (field) {
    if (typeof field !== "object") {
      return
    }

    if (field.hasOwnProperty("__details_json")) {

      // @ts-ignore
      result.push(...parseDetailsJson(field["__details_json"]))
    }
    else {
      // { key: "val" } -> { name: "key", value: "val" }
      const keys = Object.keys(field)
      const key = keys.length === 1 ? keys[0] : void 0

      if (!key) {
        return
      }

      result.push({
        name: key,
        // @ts-ignore
        value: String(field[key])
      })
    }
  })

  return result
}

export function parseDetailsJson(details: string): Fields {
  const result: Fields = []

  if (typeof details !== "string") {
    return result
  }

  let data;

  try {
    data = JSON.parse(details)
  }
  catch (err) {
    return [{
      name: "__details_json",
      value: "failed to parse: " + err.message
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
      const name = field.name || field.value
      const value = field.url || field.value

      result.push({ name, value })
    })
  })

  return result
}

export function parseSneakPeek(sneakPeek?: API$SneakPeek): SneakPeek | null {
  if (!sneakPeek) {
    return null
  }

  if (!sneakPeek.text || typeof sneakPeek.text === "string" && sneakPeek.text.trim().length === 0) {
    return null
  }

  return {
    authorId: sneakPeek.author_id,
    text: sneakPeek.text,
    timestamp: sneakPeek.timestamp
  }
}

function getCustomerId(users: User[]) {
  const customer = users.find((user) => user.type === "customer")

  return customer ? customer.id : void 0
}

export function parseChatTransferredPayload(payload?: API$Push$ChatTransferred["payload"]) {
  return {
    chatId: String(payload?.chat_id ?? ""),
    threadId: String(payload?.thread_id ?? ""),
    requesterId: String(payload?.requester_id ?? ""),
    transferredTo: parseTransferredTo(payload?.transferred_to),
    queue: parseQueue(payload?.queue)
  }

  function parseTransferredTo(data: any) {
    if (typeof data !== "object") {
      return
    }

    let groupId: number | void = void 0;
    let agentId: string | void = void 0;

    if (Array.isArray(data.group_ids) && data.group_ids.length > 0) {
      groupId = Number(data.group_ids[0])
    }

    if (Array.isArray(data.agent_ids) && data.agent_ids.length > 0) {
      agentId = String(data.agent_ids[0])
    }

    return {
      groupId,
      agentId,
    }
  }
}

export function parseQueue(queue?: API$Queue) {
  if (!queue) {
    return null
  }

  let position = Number(queue.position)
  let waitTime = Number(queue.wait_time)
  let queuedAt = queue.queued_at ? new Date(queue.queued_at).getTime() : 0

  if (Number.isNaN(position)) {
    console.warn(`parseQueue: invalid position: ${JSON.stringify(queue)}`)

    position = 0
  }

  if (Number.isNaN(waitTime)) {
    console.warn(`parseQueue: wait_time position: ${JSON.stringify(queue)}`)

    waitTime = 0
  }

  if (Number.isNaN(queuedAt)) {
    console.warn(`parseQueue: queued_at position: ${JSON.stringify(queue)}`)

    queuedAt = 0
  }

  return {
    position,
    waitTime,
    queuedAt
  }
}

export function parseCannedResponses(cannedResponses: API$CannedResponse[]): CannedResponse[] {
  if (!Array.isArray(cannedResponses)) {
    throw new RangeError("`canned_responses` should be an array")
  }

  return cannedResponses.map(function (cannedResponse) {
    return parseCannedResponse(cannedResponse)
  })
}

export function parseCannedResponse(cannedResponse: API$CannedResponse): CannedResponse {
  if (!Array.isArray(cannedResponse.tags)) {
    throw new RangeError("tags should be an array of string")
  }

  return {
    id: Number(cannedResponse.id),
    text: String(cannedResponse.text).trim(),
    tags: cannedResponse.tags,
    tagsStr: cannedResponse.tags.map(tag => `#${tag}`).join(" "),
  }
}

export function parseScopes(scopes: any) {
  if (!Array.isArray(scopes)) {
    return []
  }

  return scopes.map(scope => String(scope))
}

export function parseAgents(agents: API$Agent[]) {
  if (!Array.isArray(agents)) {
    throw new RangeError("`agents` should be an list")
  }

  return agents.map(agent => parseAgent(agent))
}

export function parseAgent(agent: API$Agent): Agent {
  return {
    id: String(agent.id),
    name: String(agent.name ?? ""),
    jobTitle: String(agent.job_title ?? ""),
    avatarUrl: parseAvatarUrl(agent.avatar_path ?? ""),
  }
}

export function parseGroups(groups: API$Group[]) {
  if (!Array.isArray(groups)) {
    throw new RangeError("`agents` should be an list")
  }

  return groups.map(group => parseGroup(group))
}

export function parseGroup(group: API$Group): Group {
  return {
    id: Number(group.id),
    name: String(group.name ?? ""),
    routingStatus: parseRoutingStatus(group.routing_status)
  }
}
