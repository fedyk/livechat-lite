import { Credentials } from "./types.js"
import { ErrorWithType } from "./helpers.js"

export namespace api {
  export function parseUserAgent(accessToken: string, body: {
    user_agent: string
  }, signal?: AbortSignal) {
    return fetch(`/api/parse-user-agent`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: getRequestHeaders(accessToken),
      signal: signal
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

  export function refreshToken(body: {
    refresh_token: string
  }, signal?: AbortSignal) {
    return fetch(`/api/refresh-token`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: getRequestHeaders(),
      signal
    }).then(parseResponse).then(function (resp: any): Credentials {
      return {
        access_token: String(resp.access_token),
        refresh_token: String(resp.refresh_token),
        entity_id: String(resp.entity_id),
        account_id: String(resp.account_id),
        license_id: Number(resp.license_id),
        organization_id: String(resp.organization_id),
        expired_at: new Date(Date.now() + resp.expires_in * 1000),
        scopes: new Set(String(resp.scope).split(","))
      }
    })
  }

  function getRequestHeaders(accessToken?: string) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    }

    if (accessToken) {
      headers["authorization"] = `Bearer ${accessToken}`
    }

    return headers
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
}
