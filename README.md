<p align="center">
  <p align="center">
    <a href="#" target="_blank">
      <img src="./favicon.svg" alt="LiveChat X" height="38">
    </a>
  </p>
  <h1 align="center">LiveChat X </h1>
</p>

## [LiveChat X](https://fedyk.github.io/livechat-x) — Blazing fast LiveChat ⚡️

LiveChat is a customer service platform, that allows to aggregates chats from different sources: websites, facebook pages, SMS, Apple Business Chat and many more. The magic routing in the cloud will nicely assign all chats with your Customer Service employees.

This app is attempt to create a simple and fast client for agents. 

## Supported features

livechat-api: communication & data parsing
store: keeping and merging + connect with IO
parsers: parseData from raw
mapper

 - [x] Chats (auto and manual routing)
 - [x] Sneak peek
 - [x] Chat folders
 - [x] Empty placeholders on chat's list?
 - [x] Archived chats
 - [x] Pinned chats
 - [x] All chats (+ change *ChatIds from Set<> to Array<>)
 - [x] All chats (+ add separated list of all chat ids)
 - [x] Chat history
   - [x] add prev_thread_id/next_thread_id to thread, user Chat/Thread from lc-api-2; ChatSummary -> Chat + incomplete thread
   - [x] fill thread_gaps
   - [x] fulfill gaps with threads
 - [x] Notifications and new RTM
 - [x] Host it on ~livechat-apps.com/x~ https://lite.livechat-apps.com/
 - [x] Transfers
 - [x] Close chat
 - [x] Logout
 - [x] Mark as seen
 - [x] Search
 - [x] New menu
 - [x] Archived chats
 - [x] All chats
 - [x] Dark mode
 - [x] Recently used canned responses
 - [x] Send file/image
 - [ ] Copy paste
 - [ ] Support of messages with images & videos
 - [ ] Image preview
 - [ ] Video preview
 - [ ] Auth screen
 - [ ] Commands
 - [ ] Parse UA
 - [ ] Keep refresh token
 - [ ] Personal canned responses
 - [ ] Add notes to customer

## Technical details

This app is based on pure JS. The real time communication is based on WebSocket. The app use modern browser features, that why it can expect problems on older browsers and IE.
