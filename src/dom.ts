import { Unsubscriber } from "./types.js"

export function addListener<K extends keyof GlobalEventHandlersEventMap>(node: EventTarget, type: K, handler: (event: GlobalEventHandlersEventMap[K]) => void, useCapture?: boolean): Unsubscriber;
export function addListener(node: EventTarget, type: string, handler: (event: any) => void, useCapture?: boolean): Unsubscriber
export function addListener(node: EventTarget, type: string, handler: (event: any) => void, options: AddEventListenerOptions): Unsubscriber;
export function addListener<T extends Document, K extends keyof HTMLElementEventMap>(el: T, event: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): Unsubscriber;
export function addListener<T extends HTMLElement, K extends keyof HTMLElementEventMap>(el: T, event: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): Unsubscriber {
  el.addEventListener(event, listener, options)

  return function () {
    el.removeEventListener(event, listener, options)
  }
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attrs?: Partial<HTMLElementTagNameMap[K]> & {
    ref?: Ref<HTMLElementTagNameMap[K]>
  },
  ...childNodes: Array<Node | string | undefined | null | false>
) {
  const el = document.createElement(tagName)

  if (attrs?.ref) {
    attrs.ref.current = el
    attrs = Object.assign({}, attrs)
    delete attrs.ref
  }

  if (attrs) {
    Object.assign(el, attrs)
  }

  if (childNodes) {
    for (let i = 0; i < childNodes.length; i++) {
      const childNode = childNodes[i]

      if (childNode) {
        el.append(childNode)
      }
    }
  }

  return el
}

export function createElementNS<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Partial<{
    cx: string
    cy: string
    r: string
    class: string
    fill: string
    stroke: string
    "stroke-linecap": string
    "stroke-miterlimit": string
    "stroke-width": string
    "stroke-dasharray": string
    "stroke-dashoffset": string
    "transform": string
    width: number
    height: number
    viewBox: string
    d: string
    "fill-rule": string
    ref: Ref<SVGElementTagNameMap[K]>
  }>,
  ...children: Array<Node | string>
): SVGElementTagNameMap[K] {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name)

  if (attributes.ref) {
    attributes.ref.current = el
    attributes = Object.assign({}, attributes)
    delete attributes.ref
  }

  Object.entries(attributes).forEach(function (entity) {
    el.setAttribute(entity[0], String(entity[1] || ""))
  })

  if (children) {
    el.append(...children)
  }

  return el
}

export function createFragment(...childNodes: Array<Node | string | undefined | null | false>) {
  const fragment = document.createDocumentFragment()

  if (childNodes) {
    for (let i = 0; i < childNodes.length; i++) {
      const childNode = childNodes[i]

      if (childNode) {
        fragment.append(childNode)
      }
    }
  }

  return fragment
}

/**
 * `yourRef.current` initially is `null`.
 */
export interface Ref<T> {
  current: T
}

export function createRef<T>(): Ref<T> {
  return {
    current: null as T
  }
}

export function toggleEl(el: Element, visible?: boolean) {
  if (visible === true) {
    return el.classList.remove("hidden")
  }

  if (visible === false) {
    return el.classList.add("hidden")
  }

  if (el.classList.contains("hidden")) {
    el.classList.remove("hidden")
  }
  else {
    el.classList.add("hidden")
  }
}
