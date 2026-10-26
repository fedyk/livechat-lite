import { createElement as h } from "./dom.js"
import { $Store } from "./store.js"
import type { MediaPreview } from "./types.js"

export function createMediaViewer() {
  const store = $Store()
  const el = h("dialog", {
    className: "media-viewer",
    ariaLabel: "Media preview"
  })

  let cleanup: (() => void) | undefined

  const disconnect = store.lazyConnect(function (state) {
    return state.mediaPreview
  }, render)

  function closePreview() {
    store.dispatch({ mediaPreview: null })
  }

  function render(preview: MediaPreview | null) {
    cleanup?.()
    cleanup = undefined

    el.replaceChildren()

    if (!preview) {
      return
    }

    const previousFocus = document.activeElement as HTMLElement | null
    const closeButton = h("button", {
      textContent: "Close",
      onclick: closePreview
    })
    const download = h("button", {
      textContent: "Download",
      onclick: downloadFile
    })
    const status = h("p", {
      className: "media-status",
      textContent: "Loading…",
      role: "status"
    })
    const toolbar = h("div", { className: "media-toolbar" },
      h("span", { textContent: preview.name }),
      download,
      closeButton
    )
    const stage = h("div", { className: "media-stage" })

    el.append(toolbar, stage, status)

    const image = preview.kind === "image" ? h("img", {
      alt: preview.alt || preview.name,
      draggable: false
    }) : null
    const video = preview.kind === "video" ? h("video", {
      controls: true,
      autoplay: true,
      playsInline: true,
      muted: false
    }) : null
    let zoom = 1
    let x = 0
    let y = 0
    let drag: {
      id: number
      x: number
      y: number
      originX: number
      originY: number
    } | null = null
    let dragged = false
    let disposed = false
    const abort = new AbortController()
    let downloadUrl: string | undefined
    const inline = preview.inlineVideo

    inline?.pause()

    function layout() {
      if (!image?.naturalWidth) {
        return
      }

      const fit = fitImage(
        image.naturalWidth,
        image.naturalHeight,
        stage.clientWidth,
        stage.clientHeight
      )
      const width = image.naturalWidth * fit * zoom
      const height = image.naturalHeight * fit * zoom

      x = Math.max(
        -Math.max(0, (width - stage.clientWidth) / 2),
        Math.min(Math.max(0, (width - stage.clientWidth) / 2), x)
      )
      y = Math.max(
        -Math.max(0, (height - stage.clientHeight) / 2),
        Math.min(Math.max(0, (height - stage.clientHeight) / 2), y)
      )
      image.style.width = `${width}px`
      image.style.height = `${height}px`
      image.style.transform = `translate(${x}px, ${y}px)`
      image.style.cursor = zoom > 1 ? "grab" : "zoom-out"
    }

    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopImmediatePropagation()
        closePreview()
        return
      }

      if (
        image &&
        (event.metaKey || event.ctrlKey) &&
        ["+", "=", "-", "_", "0"].includes(event.key)
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()

        if (event.key === "0") {
          zoom = 1
          x = 0
          y = 0
          drag = null
        }
        else {
          zoom = Math.max(1, Math.min(
            16,
            zoom * (["-", "_"].includes(event.key) ? 1 / 1.25 : 1.25)
          ))
        }

        layout()
      }
    }

    function onClick(event: MouseEvent) {
      if (dragged) {
        dragged = false
        return
      }

      if (event.target === stage || event.target === image || event.target === el) {
        closePreview()
      }
    }

    el.onclick = onClick
    el.oncancel = function (event) {
      event.preventDefault()
      closePreview()
    }

    document.addEventListener("keydown", keydown, true)
    const observer = new ResizeObserver(layout)

    observer.observe(stage)

    if (image) {
      image.onload = function () {
        status.textContent = ""
        layout()
      }

      image.onerror = function () {
        status.textContent = "Unable to load this image."
      }

      image.onpointerdown = function (event) {
        if (event.button !== 0) {
          return
        }

        dragged = false

        if (zoom <= 1) {
          return
        }

        drag = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          originX: x,
          originY: y
        }
        image.setPointerCapture(event.pointerId)
        event.preventDefault()
      }

      image.onpointermove = function (event) {
        if (!drag || drag.id !== event.pointerId) {
          return
        }

        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) {
          dragged = true
        }

        if (dragged) {
          x = drag.originX + event.clientX - drag.x
          y = drag.originY + event.clientY - drag.y
          layout()
        }
      }

      image.onpointerup = image.onpointercancel = function () {
        drag = null
      }

      stage.append(image)
      image.src = preview.src
    }

    if (video) {
      video.onloadeddata = function () {
        status.textContent = ""
      }

      video.onerror = function () {
        status.textContent = "Unable to play this video."
      }

      stage.append(video)
      video.src = preview.src
    }

    el.showModal()

    document.body.classList.add("overflow-hidden")

    closeButton.focus()

    video?.play().catch(function () {
      if (!disposed) {
        status.textContent = "Press Play to start the video."
      }
    })

    async function downloadFile() {
      download.disabled = true

      try {
        const response = await fetch(preview!.src, { signal: abort.signal })

        if (!response.ok) {
          throw new Error("Download failed")
        }

        const blob = await response.blob()

        if (disposed) {
          return
        }

        if (downloadUrl) {
          URL.revokeObjectURL(downloadUrl)
        }

        downloadUrl = URL.createObjectURL(blob)
        const link = h("a", {
          href: downloadUrl,
          download: preview!.name || "media"
        })

        el.append(link)
        link.click()
        link.remove()
      }
      catch {
        if (!disposed) {
          status.replaceChildren("Download unavailable. ", h("a", {
            href: preview!.src,
            target: "_blank",
            rel: "noopener",
            textContent: "Open original to save"
          }))
        }
      }
      finally {
        download.disabled = false
      }
    }

    cleanup = function () {
      disposed = true
      abort.abort()

      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl)
      }

      observer.disconnect()
      document.removeEventListener("keydown", keydown, true)

      if (video) {
        video.pause()
        video.removeAttribute("src")
        video.load()
      }

      el.onclick = null
      el.oncancel = null
      el.close()
      document.body.classList.toggle(
        "overflow-hidden",
        Boolean(store.getState().openModal)
      )

      if (previousFocus?.isConnected) {
        previousFocus.focus()
      }

      if (inline?.isConnected) {
        inline.play().catch(function () {
        })
      }
    }
  }

  return {
    el,
    dispose() {
      disconnect()
      cleanup?.()
      el.remove()
    }
  }
}

export function fitImage(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number
) {
  return Math.min(1, availableWidth / width, availableHeight / height)
}

export function openMediaPreview(preview: MediaPreview) {
  $Store().dispatch({ mediaPreview: preview })
}
