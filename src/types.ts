import { v35 } from "./livechat-api.js"

export interface Credentials {
  access_token: string
  refresh_token: string
  entity_id: string
  account_id: string
  license_id: number
  organization_id: string
  expired_at: Date
  scopes: Set<string>
}

export interface Subscriber<T> {
  (value: T): void
}

export type Unsubscriber = () => void;

export type ChatFolder = "all" | "my" | "supervised" | "queued" | "unassigned" | "archived"

export type ArchivedChatsStatus = "unknown" | "up" | "fail" | "fetching" | "fetching-more"

export type PinnedChatsStatus = "unknown" | "fail" | "up" | "fetching" | "fetching-more"

export type InactiveChatsStatus = "unknown" | "fail" | "up" | "fetching" | "fetching-more"

export type ChatGapStatus = "idle" | "fetching"

export type ThreadSyncStatus = "idle" | "fetching"

export type MessageStatus = "sending" | "sent" | "failed"

export type NetworkStatus = "offline" | "connecting" | "updating" | "online"

export type ChatRoute = "my" | "other" | "closed" | "queued" | "supervised" | "unassigned" | "pinned"

export type ColorMode = "light" | "dark" | "auto"

export type ColorScheme = "light" | "dark"

export type ChatEntity = v35.agent.Event | SneakPeekAsEvent | ChatGap | RestrictedThread

export interface ChatGap {
  id: string
  type: "chat_gap",
  sort_order: "asc" | "desc" // asc - oldest threads first and desc - newest threads first (default)
  limit: number,
  filters_from?: Date
  filters_to?: Date
}

export interface RestrictedThread {
  id: string
  type: "restricted_thread"
  text: string
}

export interface SneakPeekAsEvent {
  id: string
  type: "sneak_peek",
  author_id: string
  text: string
  created_at: Date
  recipients: string
}

export interface SearchResult {
  id: string
  chatId: string
  threadId: string | null
  eventId: string | null
  body: DocumentFragment
  date: Date | null
  userId: string
  userName: string
  userAvatar: string | null
}

export type ParsedUserAgent = {
  status: "pending"
} | {
  status: "done"
  userAgent: unknown
} | {
  status: "failed"
  errorMessage: string
}

/**
 * Modals
 */
export type Modal = FileUploadModal

export interface FileUploadModal {
  type: "file-upload-modal"
  chatId: string
  files: File[]
}

export interface CannedResponse {
  id: number
  group: number
  tags: string[]
  text: string
}
