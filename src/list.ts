type DefaultExtend = {
  [key: PropertyKey]: any
}

export type BaseContext<Value>  =  {
  parent: Element
  next: Element | null
  value: Value
  index: number
  el: Element
}

export type ElementWithContext<Context> = HTMLElement & {
  $context: Context
}

function createContext<Value, Extends, Context = Extends & BaseContext<Value>>(
  parent: Element,
  value: Value,
  index: number
) {
  let el: Element | null = null
  let next: Element | null = null

  const context = {
    parent,
    next,
    value,
    index,
    get el() {
      if (!el) {
        throw new RangeError("`_el` is empty")
      }
  
      return el
    },
    set el(element: Element) {
      if (el) {
        throw new RangeError("`_el` is already settled")
      }
  
      el = element;
      (el as ElementWithContext<Context>).$context = context;
  
      if (next) {
        parent.insertBefore(element, next)
      }
      else {
        parent.appendChild(element)
      }
    }
  } as Context

  return context
}

export function list2<Value, Extends = DefaultExtend>(options: {
  target: Element
  values: Value[]
  key(value: Value, index: number): string
  enter(ctx: Extends & BaseContext<Value>): void
  update(ctx: Extends & BaseContext<Value>): void
  exit(ctx: Extends & BaseContext<Value>): void
}) {
  const parent = options.target
  const data = options.values
  const group = new Array<ElementWithContext<Extends & BaseContext<Value>>>(parent.children.length)
  const groupLength = group.length
  const dataLength = data.length
  const enterGroup = new Array<Extends & BaseContext<Value>>(dataLength)
  const updateGroup = new Array<ElementWithContext<Extends & BaseContext<Value>>>(dataLength)
  const exitGroup = new Array<ElementWithContext<Extends & BaseContext<Value>>>(groupLength)
  const nodeByKeyValue = new Map
  const keyValues = new Array(groupLength)
  let i: number
  let el: Element
  let node: ElementWithContext<Extends & BaseContext<Value>>
  let keyValue: string

  // copy children
  for (i = 0; i < parent.children.length; i++) {
    el = parent.children[i]

    if (el instanceof HTMLElement) {
      group[i] = el as ElementWithContext<Extends & BaseContext<Value>>
    }
  }

  // Compute the key for each node.
  // If multiple nodes have the same key, the duplicates are added to exit.
  for (i = 0; i < groupLength; ++i) {
    if (node = group[i]) {
      keyValues[i] = keyValue = String(options.key(node.$context.value, i))

      if (nodeByKeyValue.has(keyValue)) {
        exitGroup[i] = node;
      }
      else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }

  // Compute the key for each datum.
  // If there a node associated with this key, join and add it to update.
  // If there is not (or the key is a duplicate), add it to enter.
  for (i = 0; i < dataLength; ++i) {
    keyValue = options.key(data[i], i) + "";

    if (node = nodeByKeyValue.get(keyValue)) {
      updateGroup[i] = node;
      node.$context.value = data[i];
      nodeByKeyValue.delete(keyValue);
    }
    else {
      enterGroup[i] = createContext(parent, data[i], i)
    }
  }

  // Add any remaining nodes that were not bound to data to exit.
  for (let i = 0; i < groupLength; ++i) {
    if ((node = group[i]) && (nodeByKeyValue.get(keyValues[i]) === node)) {
      exitGroup[i] = node;
    }
  }

  // Now connect the enter nodes to their following update node, such that
  // appendChild can insert the materialized enter node before this node,
  // rather than at the end of the parent node.
  for (var i0 = 0, i1 = 0; i0 < dataLength; ++i0) {
    let previous = enterGroup[i0]
    let next: Element

    if (previous) {
      if (i0 >= i1) {
        i1 = i0 + 1;
      }

      while (!(next = updateGroup[i1]) && ++i1 < dataLength);

      previous.next = next || null;
    }
  }

  // enter
  for (let i = 0; i < enterGroup.length; i++) {
    const node = enterGroup[i]

    if (node) {
      node.index = i
      options.enter(node)
    }
  }

  // update
  for (let i = 0; i < updateGroup.length; i++) {
    const node = updateGroup[i]

    if (node) {
      node.$context.index = i
      options.update(node.$context)
    }
  }

  // exit
  for (let i = 0; i < exitGroup.length; i++) {
    const node = exitGroup[i]

    if (node) {
      node.$context.index = i
      options.exit(node.$context)
      node.$context.parent = null!
      node.$context.next = null!
      node.$context.value = null!
      node.$context.index = null!
      node.$context = null!
    }
  }

  const merge = new Array(dataLength)

  // merge enter and update nodes in one array
  for (let i = 0, node: Element | void; i < dataLength; ++i) {
    if (node = updateGroup[i] || (enterGroup[i] && enterGroup[i].el)) {
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
