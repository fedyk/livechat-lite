import { addListener } from "./dom";
import { IDisposable, IListener } from "./helpers";

interface ResizeObserverSize {
  readonly inlineSize: number;
  readonly blockSize: number;
}

declare class ResizeObserver {
  constructor(callback: ResizeObserverCallback);
  disconnect(): void;
  observe(target: Element, options?: { box?: 'content-box' | 'border-box' }): void;
  unobserve(target: Element): void;
}

type ResizeObserverCallback = (entries: ReadonlyArray<ResizeObserverEntry>, observer: ResizeObserver) => void;

interface ResizeObserverEntry {
  readonly target: Element;
  readonly contentRect: DOMRectReadOnly;
  readonly borderBoxSize?: ReadonlyArray<ResizeObserverSize>;
  readonly contentBoxSize?: ReadonlyArray<ResizeObserverSize>;
  readonly devicePixelContentBoxSize?: ReadonlyArray<ResizeObserverSize>;
}

const resizeObserver = new ResizeObserver(function (entries) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const reverseScroll = reverseScrolls.get(entry.target)

    if (!reverseScroll) {
      return
    }

    if (reverseScroll.isStickyToBottom) {
      reverseScroll.scrollToBottom()
    }
  }
})

const reverseScrolls = new WeakMap<Element, ReverseScroll>()

export class ReverseScroll implements IDisposable {
  scrollEl: Element
  contentContainerEl: Element
  isStickyToBottom: boolean
  scrollListener: IListener
  timerId?: number

  constructor(scrollEl: Element, contentContainerEl: Element) {
    this.scrollEl = scrollEl
    this.contentContainerEl = contentContainerEl
    this.isStickyToBottom = true
    this.scrollListener = addListener(this.scrollEl, "scroll", () => {
      if (this.timerId !== void 0) {
        clearTimeout(this.timerId)
      }

      this.timerId = window.setTimeout(() => {
        this.checkScrollPosition()
      }, 200)
    })

    reverseScrolls.set(this.contentContainerEl, this)
    resizeObserver.observe(this.contentContainerEl)
  }

  dispose() {
    this.scrollListener.unbind()
    reverseScrolls.delete(this.contentContainerEl)
    resizeObserver.unobserve(this.contentContainerEl)
  }

  scrollToBottom() {
    this.scrollEl.scrollTop = this.scrollEl.scrollHeight - this.scrollEl.clientHeight
  }

  checkScrollPosition() {
    this.isStickyToBottom = this.scrollEl.scrollTop === this.scrollEl.scrollHeight - this.scrollEl.clientHeight
  }
}
