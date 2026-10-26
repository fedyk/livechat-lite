import { createElement, createRef } from "./dom.js";
import { describe, equal, test } from "./test.js";

describe(createElement.name, function () {
  test("create span with content", function () {
    const el = createElement("span", { className: "test", textContent: "hello" })

    equal(el.outerHTML, `<span class="test">hello</span>`)
  })

  test("create el with aria label", function () {
    const el = createElement("span", { ariaLabel: "test" })

    equal(el.outerHTML, `<span aria-label="test"></span>`)
  })

  test("create el with ref", function () {
    const ref = createRef<HTMLSpanElement>()
    const el = createElement("span", { ref })

    equal(el, ref.current)
  })
})
