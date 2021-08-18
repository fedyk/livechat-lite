import { IDisposable, IListener } from "./helpers";

export class DomListener implements IDisposable, IListener {
  private handler: (e: any) => void;
  private node: EventTarget;
  private readonly type: string;
  private readonly options: boolean | AddEventListenerOptions;

  constructor(node: EventTarget, type: string, handler: (e: any) => void, options?: boolean | AddEventListenerOptions) {
    this.node = node;
    this.type = type;
    this.handler = handler;
    this.options = (options || false);
    this.node.addEventListener(this.type, this.handler, this.options);
  }

  public dispose(): void {
    if (!this.handler) {
      // Already disposed
      return;
    }

    this.node.removeEventListener(this.type, this.handler, this.options);

    // Prevent leakers from holding on to the dom or handler func
    this.node = null!;
    this.handler = null!;
  }

  public unbind() {
    this.dispose()
  }
}

export function addListener<K extends keyof GlobalEventHandlersEventMap>(node: EventTarget, type: K, handler: (event: GlobalEventHandlersEventMap[K]) => void, useCapture?: boolean): DomListener;
export function addListener(node: EventTarget, type: string, handler: (event: any) => void, useCapture?: boolean): DomListener;
export function addListener(node: EventTarget, type: string, handler: (event: any) => void, options: AddEventListenerOptions): DomListener;
export function addListener(node: EventTarget, type: string, handler: (event: any) => void, useCaptureOrOptions?: boolean | AddEventListenerOptions): DomListener {
  return new DomListener(node, type, handler, useCaptureOrOptions);
}

/**
 * Node element with attached corresponding datum
 * @interface
 */
export interface ElementWithDatum<T> extends HTMLElement {
  __data__?: T
}

/**
 * Document and Element have mismatch in types, so we can not use them
 * Instead we create new interface that extends only needed methods
 */
export interface ParentElement extends ParentNode, Node { }

/**
 * This callback says what is correlation between DOM node and datum
 */
interface Key<T> {
  (d: T | undefined, i: number, el: ElementWithDatum<T> | ParentElement): void
}

/**
 * Simple implementation of General Update Patter. basically it is how React renders list, but in less code
 * @example
 * selectAll(container).data([1, 2, 3], datum => datum)
 *   .join(
 *     enterEl => enter.append(document.createElement("ul")),
 *     (update, d) => update.textContent = d,
 *     exit => exit.remove()
 *   )
 */
export function selectAll(parent: ParentElement, selector?: string) {
  const group = selector ? parent.querySelectorAll(selector) : parent.childNodes

  return {
    data<T>(data: T[], key: Key<T>) {
      // @ts-ignore
      return new DataBinder(parent, group, data, key)
    }
  }
}

export class DataBinder<T> {
  protected enterGroup: Array<EnterNode<T>>
  protected updateGroup: Array<ElementWithDatum<T>>
  protected exitGroup: Array<ElementWithDatum<T>>

  constructor(parent: ParentElement, group: NodeListOf<ElementWithDatum<T>>, data: T[], key: Key<T>) {
    const groupLength = group.length
    const dataLength = data.length

    this.enterGroup = new Array(dataLength)
    this.updateGroup = new Array(dataLength)
    this.exitGroup = new Array(groupLength)

    // bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);
    // bind by key
    const nodeByKeyValue = new Map
    const keyValues = new Array(groupLength)
    let node: ElementWithDatum<T>
    let keyValue: string

    // Compute the key for each node.
    // If multiple nodes have the same key, the duplicates are added to exit.
    for (let i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = key(node.__data__, i, node) + "";
        if (nodeByKeyValue.has(keyValue)) {
          this.exitGroup[i] = node;
        } else {
          nodeByKeyValue.set(keyValue, node);
        }
      }
    }

    // Compute the key for each datum.
    // If there a node associated with this key, join and add it to update.
    // If there is not (or the key is a duplicate), add it to enter.
    for (let i = 0; i < dataLength; ++i) {
      keyValue = key(data[i], i, parent) + "";
      if (node = nodeByKeyValue.get(keyValue)) {
        this.updateGroup[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue.delete(keyValue);
      } else {
        this.enterGroup[i] = new EnterNode(parent, data[i]);
      }
    }

    // Add any remaining nodes that were not bound to data to exit.
    for (let i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && (nodeByKeyValue.get(keyValues[i]) === node)) {
        this.exitGroup[i] = node;
      }
    }

    // Now connect the enter nodes to their following update node, such that
    // appendChild can insert the materialized enter node before this node,
    // rather than at the end of the parent node.
    for (var i0 = 0, i1 = 0; i0 < dataLength; ++i0) {
      let previous = this.enterGroup[i0]
      let next: Element

      if (previous) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = this.updateGroup[i1]) && ++i1 < dataLength);
        previous.next = next || null;
      }
    }
  }

  join(
    enter: (node: EnterNode<T>, d: T, i: number) => void | void,
    update: (node: ElementWithDatum<T>, d: T, i: number) => void | void,
    exit: (node: ElementWithDatum<T>, d: T, i: number) => void | void
  ) {
    if (typeof enter === "function") {
      this.enter(enter)
    }

    if (typeof update === "function") {
      this.update(update)
    }

    if (typeof exit === "function") {
      this.exit(exit)
    }

    const dataLength = this.enterGroup.length
    const merge = new Array(dataLength)

    // merge enter and update nodes in one array
    for (let i = 0, node: Element | void; i < dataLength; ++i) {
      if (node = this.updateGroup[i] || (this.enterGroup[i] && this.enterGroup[i].node)) {
        merge[i] = node
      }
    }

    // sort the nodes
    for (let i = merge.length - 1, next = merge[i], node: Element; --i >= 0;) {
      if (node = merge[i]) {
        if (next && node.compareDocumentPosition(next) ^ 4) {
          next.parentNode.insertBefore(node, next);
        }

        next = node;
      }
    }
  }

  protected enter(cb: (node: EnterNode<T>, d: T, i: number) => void) {
    for (let i = 0; i < this.enterGroup.length; i++) {
      const node = this.enterGroup[i]

      if (node) {
        cb(node, node.d, i)
      }
    }

    return this
  }

  protected update(cb: (node: ElementWithDatum<T>, d: T, i: number) => void) {
    for (let i = 0; i < this.updateGroup.length; i++) {
      const node = this.updateGroup[i]

      if (node) {
        cb(node, node.__data__ as T, i)
      }
    }

    return this
  }

  protected exit(cb: (node: ElementWithDatum<T>, d: T, i: number) => void) {
    for (let i = 0; i < this.exitGroup.length; i++) {
      const node = this.exitGroup[i]

      if (node) {
        cb(node, node.__data__ as T, i)
      }
    }

    return this
  }
}

export class EnterNode<T> {
  parent: ParentElement
  node: ElementWithDatum<T> | null
  next: Element | null
  d: T

  constructor(parent: ParentElement, d: T) {
    this.parent = parent
    this.d = d
    this.node = null
    this.next = null
  }

  append(node: Element): ElementWithDatum<T> {
    this.node = node as ElementWithDatum<T>
    this.node.__data__ = this.d

    if (this.next) {
      this.parent.insertBefore(this.node, this.next)
    }
    else {
      this.parent.appendChild(this.node)
    }

    return this.node
  }
}

export interface CreateAttrs extends InnerHTML {
  id: string
  className: string
  textContent: string
  child: Node[]

  // label attrs
  htmlFor: string

  // input attrs
  name: string
  placeholder: string
  readOnly: boolean
  disabled: boolean
  type: string
  autocomplete: string

  // img
  src: string
  width: number
  height: number
  alt: string
}

export function createEl<K extends keyof HTMLElementTagNameMap>(tagName: K, attrs?: Partial<HTMLElementTagNameMap[K]>, child?: Array<string | Node>) {
  const newBorn = document.createElement(tagName)

  if (attrs) {
    Object.assign(newBorn, attrs)
  }

  if (child) {
    newBorn.append(...child)
  }

  return newBorn
}

export function getDatum<T>(node: ElementWithDatum<T>) {
  return node.__data__
}

/**
 * @example safeHTML`Hello ${userName}`
 */
export function safeHTML(data: TemplateStringsArray, ...args: any[]) {
  let result = data[0];

  for (var i = 0; i < args.length; i++) {
    var arg = String(arguments[i]);

    // Escape special characters in the substitution.
    result += arg.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Don't escape special characters in the template.
    result += data[i];
  }

  return result;
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
