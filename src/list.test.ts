import { list2 } from "./list.js";
import { describe, equal, ok, test } from "./test.js";

describe("list", function () {
  describe("render", function () {
    const target = document.createElement("div")

    test("enter", function () {
      render([1, 2, 3])

      equal(target.outerHTML, `<div><span>1</span><span>2</span><span>3</span></div>`)
    })

    test("update", function () {
      render([3, 2, 1])

      equal(target.outerHTML, `<div><span>3</span><span>2</span><span>1</span></div>`)
    })

    test("exit", function () {
      render([])

      equal(target.outerHTML, `<div></div>`)
    })

    function render(values: number[]) {
      list2({
        target,
        values,
        key(value, index) {
          return index.toString()
        },
        enter(ctx) {
          ctx.el = document.createElement("span")
          ctx.el.textContent = String(ctx.value)
        },
        update(ctx) {
          ctx.el.textContent = String(ctx.value)
        },
        exit(ctx) {
          ctx.el.remove()
        }
      })
    }
  })

  describe("context", function () {
    const target = document.createElement("div")

    test("enter", function () {
      render([1, 2, 3])

      equal(target.outerHTML, `<div><span>1</span><span>2</span><span>3</span></div>`)
    })

    test("update", function () {
      render([3, 2, 1])

      equal(target.outerHTML, `<div><span>3</span><span>2</span><span>1</span></div>`)
    })

    test("exit", function () {
      render([])

      equal(target.outerHTML, `<div></div>`)
    })

    function render(values: number[]) {
      list2({
        target,
        values,
        key(value, index) {
          return index.toString()
        },
        enter(ctx) {
          ctx.view = createView(ctx.value)
          ctx.el = ctx.view.el
        },
        update(ctx) {
          ctx.view.update(ctx.value)
        },
        exit(ctx) {
          ctx.view.remove()
        }
      })
    }

    function createView(text: number) {
      const el = document.createElement("span")

      update(text)

      return {
        el,
        update,
        remove,
      }

      function update(text: number) {
        el.textContent = String(text)
      }

      function remove() {
        el.remove()
      }
    }
  })

  describe("key binding", function () {
    const target = document.createElement("div")

    test("enter", function () {
      render([{
        id: 1,
        text: "test1"
      }, {
        id: 2,
        text: "test2"
      }])

      equal(target.outerHTML, `<div><span>id: 1 text: test1</span><span>id: 2 text: test2</span></div>`)
    })

    test("update", function () {
      const el1 = target.children[0]
      const el2 = target.children[1]

      render([{
        id: 1,
        text: "test1"
      }, {
        id: 3,
        text: "test3"
      }])

      // element remains the same
      equal(target.children[0], el1)

      // new element has to be placed
      ok(target.children[0] !== el2)

      equal(target.children.length, 2)
    })

    test("exit", function () {
      render([])

      equal(target.outerHTML, `<div></div>`)
    })

    function render(values: Props[]) {
      list2<Props, {
        view: View
      }>({
        target,
        values,
        key(value) {
          return value.id.toString()
        },
        enter(ctx) {
          ctx.view = new View(ctx.value)
          ctx.el = ctx.view.el
        },
        update(ctx) {
          ctx.view.render(ctx.value)
        },
        exit(ctx) {
          ctx.view.dispose()
        }
      })
    }

    interface Props {
      id: number
      text: string
    }

    class View {
      el: HTMLSpanElement

      constructor(props: Props) {
        this.el = document.createElement("span")
        this.render(props)
      }

      dispose() {
        this.el.remove()
        this.el = null!
      }

      render(props: Props) {
        this.el.textContent = `id: ${props.id} text: ${props.text}`
      }
    }
  })
})
