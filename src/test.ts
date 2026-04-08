type Fn = () => (void | Promise<unknown>)

type Status = "idle" | "pending" | "ok" | "error"

type AssertionOptions = ErrorOptions & {
  value?: any
  actual?: any
  expected?: any
}

class Test {
  child: Test[]
  el: HTMLElement
  labelEl: HTMLSpanElement
  statusEl: HTMLSpanElement
  errorEl: HTMLPreElement | null

  constructor(
    public name: string,
    public fn: Fn
  ) {
    this.child = []
    this.errorEl = null
    this.el = document.createElement("li")
    this.statusEl = document.createElement("span")
    this.labelEl = document.createElement("span")
    this.labelEl.textContent = name
    this.el.append(this.labelEl, document.createTextNode(" "), this.statusEl)
    this.setStatus("idle")
  }

  async run() {
    this.reset()
    this.setStatus("pending")

    try {
      await this.fn()
      this.setStatus("ok")
    }
    catch (err) {
      this.errorEl = document.createElement("pre")
      this.errorEl.innerText = String(err)
      this.el.append(this.errorEl)
      this.setStatus("error")
    }
  }

  protected reset() {
    if (this.errorEl) {
      this.errorEl.remove()
      this.errorEl = null
    }
  }

  protected setStatus(status: Status) {
    this.el.dataset.status = status
    this.el.classList.toggle("text-success", status === "ok")
    this.el.classList.toggle("text-error", status === "error")
    this.statusEl.textContent = `[${status}]`
  }
}

class Suite extends Test {
  bodyEl: HTMLUListElement

  constructor(public name: string) {
    super(name, noop)
    this.el = document.createElement("li")
    this.bodyEl = document.createElement("ul")
    this.el.append(this.labelEl, document.createTextNode(" "), this.statusEl, this.bodyEl,)
  }

  append(test: Test) {
    this.child.push(test)
    this.bodyEl.append(test.el)
  }

  async run() {
    this.reset()
    this.setStatus("pending")

    let failed = false

    for (const child of this.child) {
      await child.run()

      if (child.el.dataset.status === "error") {
        failed = true
      }
    }

    this.setStatus(failed ? "error" : "ok")
  }
}

class Root extends Suite {
  summaryEl: HTMLParagraphElement

  constructor() {
    super("tests")
    const titleEl = document.createElement("h1")

    titleEl.textContent = "Tests"
    this.el = document.createElement("div")
    this.summaryEl = document.createElement("p")
    this.summaryEl.textContent = "Pending"
    this.el.append(titleEl, this.summaryEl, this.bodyEl)
  }

  async run() {
    await super.run()

    const total = countTests(this)
    const failed = countFailedTests(this)
    const passed = total - failed

    if (total === 0) {
      this.summaryEl.textContent = "No tests declared"
    }
    else if (failed === 0) {
      this.summaryEl.textContent = `${passed}/${total} passed`
    }
    else {
      this.summaryEl.textContent = `${passed}/${total} passed, ${failed} failed`
    }

    this.el.dataset.status = failed === 0 ? "ok" : "error"
  }
}

class AssertionError extends Error {
  value?: any
  actual?: any
  expected?: any
  hasValue: boolean
  hasActual: boolean
  hasExpected: boolean

  constructor(message: string, options?: AssertionOptions) {
    super(message, options)
    this.hasValue = hasOwn(options, "value")
    this.hasActual = hasOwn(options, "actual")
    this.hasExpected = hasOwn(options, "expected")
    this.value = options?.value
    this.actual = options?.actual
    this.expected = options?.expected
  }

  toString() {
    let string = this.message

    if (this.hasValue) {
      string += `\nValue\n - ${formatValue(this.value)}`
    }

    if (this.hasActual) {
      string += `\nActual\n - ${formatValue(this.actual)}`
    }

    if (this.hasExpected) {
      string += `\nExpected\n + ${formatValue(this.expected)}`
    }

    return string
  }
}

const noop = function () { }
let root: Suite = new Root()

export function describe(name: string, fn: Fn) {
  const current = new Suite(name)
  const parent = root

  root.append(current)
  root = current

  fn()

  root = parent
}

export function test(name: string, fn: Fn) {
  root.append(new Test(name, fn))
}

export function equal(actual: any, expected: any) {
  if (actual !== expected) {
    throw new AssertionError("The actual value is not equal to expected", {
      actual,
      expected
    })
  }
}

export function ok(value: any) {
  if (!value) {
    throw new AssertionError("The value is not truthy", {
      value,
    })
  }
}

export function run(target: HTMLElement) {
  target.replaceChildren(root.el)

  return root.run()
}

function countTests(test: Test): number {
  if (!(test instanceof Suite)) {
    return 1
  }

  let total = 0

  for (const child of test.child) {
    total += countTests(child)
  }

  return total
}

function countFailedTests(test: Test): number {
  if (!(test instanceof Suite)) {
    return test.el.dataset.status === "error" ? 1 : 0
  }

  let total = 0

  for (const child of test.child) {
    total += countFailedTests(child)
  }

  return total
}

function formatValue(value: unknown) {
  try {
    const string = JSON.stringify(value)

    return string ?? String(value)
  }
  catch {
    return String(value)
  }
}

function hasOwn(options: AssertionOptions | undefined, key: keyof AssertionOptions) {
  return Boolean(options && Object.prototype.hasOwnProperty.call(options, key))
}
