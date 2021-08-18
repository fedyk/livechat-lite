export const __DEV__ = location.hostname === "localhost"
export const LIVECHAT_CLIENT_ID = "b71bb162a2aaebf04bdc4abcb91632ae"
export const LIVEHCAT_REDIRECT_URL = __DEV__ ? "http://localhost:8080" : "https://fedyk.github.io/livechat-x/"
export const AGENT_API_HOSTS: Record<string, string> = {
  dal: "api.livechatinc.com",
  fra: "api-fra.livechatinc.com",
}

export function getAccountsUrl(path = "", state = "") {
  return `https://accounts.livechat.com/${path}` +
    `?response_type=token` +
    `&client_id=${encodeURIComponent(LIVECHAT_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(LIVEHCAT_REDIRECT_URL)}` +
    `&state=${encodeURIComponent(state)}`
}

export function getAgentAPIHost(region: string) {
  const host = AGENT_API_HOSTS[region]

  if (!host) {
    throw new Error(`Unsupported region ${region}`)
  }

  return host
}
