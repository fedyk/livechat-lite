import { describe, test, equal, ok } from "./test.js"
import {
  createMediaViewer,
  fitImage,
  openMediaPreview
} from "./media-viewer.js"
import { createStore, $Store } from "./store.js"

describe("media viewer", function () {
  test("fits large images and never enlarges small ones", function () {
    equal(fitImage(2000, 1000, 1000, 800), 0.5)
    equal(fitImage(1000, 2000, 1000, 800), 0.4)
    equal(fitImage(100, 50, 1000, 800), 1)
  })

  test(
    "zoom, close, focus restoration, stacked modal and chat independence",
    async function () {
      const store = createStore({})

      $Store.setInstance(
        store
      )

      const trigger = document.createElement("button")
      trigger.textContent = "Preview fixture"
      document.body.append(trigger)
      trigger.focus()

      const viewer = createMediaViewer()
      document.body.append(viewer.el)

      const canvas = document.createElement("canvas")
      canvas.width = 100
      canvas.height = 50

      const src = canvas.toDataURL()

      try {
        store.dispatch({
          openModal: {
            type: "file-upload-modal",
            chatId: "one",
            files: []
          }
        })
        openMediaPreview({
          kind: "image",
          src,
          name: "fixture.png"
        })
        await frame()

        const img = viewer.el.querySelector("img")!
        await img.decode()
        await frame()
        equal(viewer.el.open, true)
        equal(img.style.width, "100px")

        document.dispatchEvent(new KeyboardEvent("keydown", {
          key: "+",
          ctrlKey: true,
          cancelable: true
        }))
        equal(img.style.width, "125px")

        document.dispatchEvent(new KeyboardEvent("keydown", {
          key: "-",
          metaKey: true,
          cancelable: true
        }))
        equal(img.style.width, "100px")

        store.dispatch({ selectedChatId: "two" })
        await frame()
        equal(viewer.el.open, true)

        img.click()
        await frame()
        equal(viewer.el.open, false)
        equal(store.getState().openModal?.type, "file-upload-modal")
        equal(document.activeElement, trigger)
        ok(document.body.classList.contains("overflow-hidden"))

        store.dispatch({ openModal: null })
        openMediaPreview({
          kind: "image",
          src,
          name: "fixture.png"
        })
        await frame()

        document.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape",
          cancelable: true
        }))
        await frame()
        equal(viewer.el.open, false)
        equal(document.body.classList.contains("overflow-hidden"), false)
      }
      finally {
        viewer.dispose()
        store.dispose()
        trigger.remove()
      }
    }
  )

  test(
    "video expansion pauses and resumes original player without seeking it",
    async function () {
      const store = createStore({})

      $Store.setInstance(store)

      const inline = document.createElement("video")
      inline.currentTime = 12
      let paused = 0
      let resumed = 0

      inline.pause = function () {
        paused++
      }

      inline.play = async function () {
        resumed++
      }

      document.body.append(inline)

      const viewer = createMediaViewer()
      document.body.append(viewer.el)

      try {
        openMediaPreview({
          kind: "video",
          src: "data:video/mp4;base64,",
          name: "fixture.mp4",
          inlineVideo: inline
        })
        await frame()
        equal(paused, 1)

        const video = viewer.el.querySelector("video")!
        equal(video.currentTime, 0)
        equal(video.muted, false)

        store.dispatch({ mediaPreview: null })
        await frame()
        equal(resumed, 1)
        equal(inline.currentTime, 12)
        equal(video.getAttribute("src"), null)
      }
      finally {
        viewer.dispose()
        store.dispose()
        inline.remove()
      }
    }
  )
})

function frame() {
  return new Promise<void>(function (resolve) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        resolve()
      })
    })
  })
}
