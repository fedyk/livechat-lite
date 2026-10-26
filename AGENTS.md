# Repository guidance

## Code style

- Use braces and multiline bodies for every `if`, including single-statement guards. Never write `if (condition) action()`.
- Prefer `function (event) { ... }` expressions for event handlers and callbacks over arrow functions. Use `async function () { ... }` for asynchronous callbacks. Keep type signatures such as `() => void` as types.
- Put each statement on its own line. Expand handlers, cleanup functions, `catch`, and `finally` blocks instead of compressing them onto one line.
- Leave a blank line before an `if` when it follows another statement or declaration. Separate logical steps and adjacent handler definitions with blank lines.
- Use two-space indentation and double-quoted strings. Follow the surrounding file's semicolon convention; the media viewer files omit statement semicolons.
- Prefer one variable declaration per line when tracking independent state.
- Expand long inline object literals, especially DOM attributes and options passed to nested calls, with one property per line. Keep the object opening alongside the call when readable; do not compress multiple properties into a long line.
- Aim for lines around 80 characters and keep new or changed code within 100 characters. Wrap long calls, conditions, type declarations, and expressions instead of compressing them.
- In DOM helper calls with multiple children, place each child on its own indented line and the closing parenthesis on its own line. Keep the tag and short attributes together on the opening line when they fit.
- Follow existing surrounding structure. Preserve unrelated user edits and avoid broad reformatting outside the requested files.

Example:

```ts
const img = imgElRef.current

if (downloadUrl) {
  URL.revokeObjectURL(downloadUrl)
}

el.oncancel = function (event) {
  event.preventDefault()
  close()
}

const toolbar = h("div", { className: "media-toolbar" },
  h("span", { textContent: preview.name }),
  download,
  closeButton
)

status.replaceChildren("Download unavailable. ", h("a", {
  href: preview!.src,
  target: "_blank",
  rel: "noopener",
  textContent: "Open original to save"
}))
```

## Project structure and validation

- This is a browser application written in TypeScript with direct DOM manipulation, without a UI framework.
- `src/dom.ts` supplies element and reference helpers. Views use explicit update/dispose lifecycles.
- `src/views.ts` contains the application root, message rendering, shared avatars, and the upload modal.
- `src/store.ts` holds state and subscriptions; `$Store()` accesses the shared store. `lazyConnect` delivers updates on the store's scheduled digest, so UI tests must allow updates to run.
- `src/controller.ts` coordinates API operations and uploads. `src/livechat-api.ts` defines and parses API data. Keep parser property names aligned with their declared types.
- Styles live in `css/styles.css`. TypeScript compiles from `src/` to ignored `js/` files. Edit source files, not generated JavaScript.
- Run `npm run build` for TypeScript validation and `git diff --check` for whitespace issues.
- Browser tests use the small harness in `src/test.ts`; `test.html` loads the test modules. Serve the repository locally and open that page to run them. `npm run dev` serves port 9090; use an available localhost port if occupied.
- There is no package-script test runner. A passing build is not proof that browser tests ran. Report actual checks and any unverified live-backend behavior accurately.

## Media viewer: agreed behavior

- `src/media-viewer.ts` implements one global full-screen dark viewer using a native modal `dialog`. `src/media-viewer.test.ts` covers its behavior.
- `state.mediaPreview` is transient and separate from `state.openModal`. The viewer can appear above an existing modal; closing it preserves that modal and its scroll lock. Changing chats must not close the viewer.
- Open from successful message attachments, avatars in the chat feed, and rich-message card images. Other avatar locations are not automatically preview triggers. Avatar titles and download names use the person's name.
- Show the filename, Download, and Close actions. Restore focus on close and keep underlying UI from responding while the viewer is open.
- Keep status below the media, separate from the filename toolbar, with reserved space when empty and `role="status"`.
- Initially fit the whole image into the available space, preserve aspect ratio, and do not enlarge small images above their original size.
- Cmd +/− on macOS and Ctrl +/− on Windows/Linux zoom images. Cmd/Ctrl + 0 restores the initial fitted size and centered position.
- Allow dragging when zoomed in. A drag release must not be interpreted as a click that closes the viewer.
- Image clicks, backdrop clicks, Escape, and Close dismiss the viewer. Video clicks retain normal player behavior.
- Inline videos autoplay muted without native controls. A transparent, keyboard-accessible overlay covering the video opens its preview; do not restore the old visible "Expand video" button.
- Opening a video preview pauses the inline player and starts the modal video from the beginning with sound and controls. Closing stops modal playback and resumes the original inline player at its previous position if it still exists.
- Browsers may reject autoplay with sound; leave usable playback controls and a visible explanation. Remote download fetches may be blocked; provide an original-file fallback.
- Treat `.webm` filenames case-insensitively as `video/webm`, even when the supplied MIME type is generic or missing. Use `helpers.getFileContentType` consistently for rendering, source MIME, and preview kind.
- Attachment previews are enabled only after upload succeeds. Replace temporary blob URLs with the uploaded server URL before revoking them, and update rendered attachment sources.
- Keep cleanup explicit: remove listeners, disconnect observers, stop modal playback, abort pending downloads, and revoke viewer-owned object URLs.

## Outside the current media scope

- Previous/next media navigation or loading older history for navigation.
- Previewing uploads in progress or files in the pre-send confirmation modal.
- Mobile/touch support, pinch gestures, and scroll-wheel zoom.
- A separate actual-size/100% control.

When a product requirement is unresolved, ask for clarification instead of silently choosing behavior. Explicit later user decisions supersede earlier requirements.
