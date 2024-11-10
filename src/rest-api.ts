import { ErrorWithType } from "./helpers.js"

export namespace rest {
  export interface CannedResponse {
    id: number
    group: number
    tags: string[]
    text: string
  }

  export function getCannedResponse(accessToken: string, groupId: number, signal?: AbortSignal) {
    return fetch(`/rest/canned_responses?group=${encodeURIComponent(groupId)}`, {
      method: "GET",
      headers: getRequestHeaders(accessToken),
      signal: signal
    }).then(parseResponse).then(parseCannedResponses)
  }

  export function parseUserAgent(accessToken: string, body: {
    user_agent: string
  }, signal?: AbortSignal) {
    return fetch(`/api/parse-user-agent`, {
      method: "POST",
      headers: getRequestHeaders(accessToken),
      signal: signal
    }).then(parseResponse).then(parseCannedResponses)
  }

  function getRequestHeaders(accessToken: string) {
    return {
      "authorization": `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-api-version": "2",
      "x-region": getRegion(accessToken),
    }
  }

  function parseResponse<T>(response: Response) {
    return response.text().then(function (text) {
      let json;

      try {
        json = JSON.parse(text)
      }
      catch (err) {
        throw new ErrorWithType("Fail to parse JSON response: " + text, "internal_error", response.status)
      }

      if (response.ok) {
        return json as T
      }

      let type = "internal_error"
      let message = `Unknow error`

      if (json && Array.isArray(json.errors)) {
        message = json?.errors.join(", ")
      }

      throw new ErrorWithType(message, type, response.status)
    })
  }

  export function parseCannedResponses(cannedResponses: any): CannedResponse[] {
    if (!Array.isArray(cannedResponses)) {
      return []
    }

    return cannedResponses.map(function (cannedResponse) {
      return parseCannedResponse(cannedResponse)
    })
  }

  export function parseCannedResponse(cannedResponse: any): CannedResponse {
    if (!Array.isArray(cannedResponse.tags)) {
      throw new RangeError("tags should be an array of string")
    }

    return {
      id: Number(cannedResponse.id),
      text: String(cannedResponse.text).trim(),
      tags: cannedResponse.tags,
      group: Number(cannedResponse.group),
    }
  }
}

function getRegion(accessToken: string) {
  return accessToken?.split(":")[0] || "dal"
}
