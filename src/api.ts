import { Credentials, CannedResponse } from "./types.js"
import { ErrorWithType } from "./helpers.js"

const host = "www.livechat-apps.com"

export namespace api {
  export function parseUserAgent(body: {
    user_agent: string
  }, signal?: AbortSignal) {
    return fetch(`https://${host}/lite/parse-user-agent`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: getRequestHeaders(),
      signal: signal,
    }).then(parseResponse<{
      browser_name?: string
      browser_version?: string
      device_model?: string
      device_vendor?: string
      device_type?: string
      os_name?: string
      os_version?: string
    }>)
  }

  export function token(body: {
    grant_type: "authorization_code",
    code: string
    redirect_uri: string
  } | {
    grant_type: "refresh_token",
    refresh_token: string
  }, signal?: AbortSignal) {
    return fetch(`https://${host}/lite/token`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: getRequestHeaders(),
      signal,
      mode: "cors",
    })
      .then(parseResponse)
      .then(function (resp: any): Credentials {
        return {
          access_token: String(resp.access_token || ""),
          refresh_token: String(resp.refresh_token || ""),
          entity_id: String(resp.entity_id || ""),
          account_id: String(resp.account_id || ""),
          license_id: Number(resp.license_id),
          organization_id: String(resp.organization_id || ""),
          expired_at: new Date(Date.now() + resp.expires_in * 1000),
          scopes: new Set(String(resp.scope || "").split(","))
        }
      })
  }

  export function getCannedResponse(accessToken: string, groupId: number, signal?: AbortSignal) {
    return fetch(`https://${host}/lite/rest/canned_responses?group=${encodeURIComponent(groupId)}`, {
      method: "GET",
      headers: {
        "authorization": `Bearer ${accessToken}`,
        "content-type": "application/json",
        "x-api-version": "2",
        "x-region": getRegion(accessToken),
      },
      signal: signal
    }).then(parseResponse<CannedResponse[]>)
  }

  function getRequestHeaders(accessToken?: string) {
    const headers: Record<string, string> = {
      "content-type": "text/plain",
    }

    if (accessToken) {
      headers["authorization"] = `Bearer ${accessToken}`
    }

    return headers
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

    const message = String(json.message ?? "Unknown error")
    const type = String(json.type ?? "unknown_error")

    throw new ErrorWithType(message, type, response.status)
  })
}

function getRegion(accessToken: string) {
  return accessToken?.split(":")[0] || "dal"
}
