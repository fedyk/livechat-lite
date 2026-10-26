import { getFileContentType } from "./helpers.js";
import { describe, equal, test } from "./test.js";

describe("helpers", function () {
  test(getFileContentType.name, function () {
    equal(getFileContentType({
      name: "https://file.webm",
      content_type: "audio/webm",
    }), "video/webm")

    equal(getFileContentType({
      name: "https://file.mp4",
      content_type: "video/webm",
    }), "video/webm")
  })
})
