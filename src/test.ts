type Fn = () => (void | Promise<unknown>)

class Test {
  child: Test[]
  el: HTMLElement

  constructor(
    public name: string,
    public fn: Fn
  ) {
    this.child = []
    this.el = document.createElement("li")
    this.el.textContent = name
  }

  async run() {
    this.el.setAttribute("status", "pending")

    try {
      this.fn()
      this.el.setAttribute("status", "ok")
    }
    catch (err) {      
      const error = document.createElement("pre")

      error.innerText = String(err)

      this.el.append(error)
      this.el.setAttribute("status", "error")
    }
  }
}

class Suite extends Test {
  constructor(public name: string) {
    super(name, noop)
    this.el = document.createElement("ul")
    this.el.setAttribute("name", name)
  }

  async run() { }
}

class Root extends Suite {
  constructor() {
    super("")
    this.el = document.createElement("div")
  }

  async run() { }
}

class AssertionError extends Error {
  value?: any
  actual?: any
  expected?: any

  constructor(message: string, options?: (ErrorOptions & {
    value?: any
    actual?: any
    expected?: any
  })) {
    super(message, options)
    this.value = options?.value
    this.actual = options?.actual
    this.expected = options?.expected
  }

  toString() {
    let string = this.message

    if (this.value) {
      string += `\nValue\n - ${JSON.stringify(this.value)}`
    }
    
    if (this.actual) {
      string += `\nActual\n - ${this.actual}`
    }

    if (this.expected) {
      string += `\nExpected\n + ${this.expected}`
    }

    return string
  }
}

const noop = function () { }
let root: Test = new Root()

export function describe(name: string, fn: Fn) {
  const current = new Suite(name)
  const parent = root

  root.child.push(current)
  root = current

  fn()

  root = parent
}

export function test(name: string, fn: Fn) {
  root.child.push(new Test(name, fn))
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

export async function run(target: HTMLElement, test: Test = root,) {
  target.append(test.el)

  for (const child of test.child) {
    child.run()
    test.el.append(child.el)
    run(test.el, child)
  }
}
