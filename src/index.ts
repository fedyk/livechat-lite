import { addListener } from "./dom.js"
import { createAppView } from "./views.js"
import { accounts } from "./livechat-api.js"
import { $Store, createStore } from "./store.js"
import { $Controller, createController } from "./controller.js"
import { ColorMode, ColorScheme, Credentials } from "./types.js"
import { $CommandsController, createCommandsController } from "./commands.js"
import { createUnsubscribers, getStateFromLocalStore, setStateToLocalStore } from "./helpers.js"
import { $ChatRouter, ChatRouter, createColorSchemaWatcher, initNotifications } from "./services.js"
import { api } from "./api.js"

interface Options {
  clientId: string
  redirectUrl: string
}

export function initApp(p: Options) {
  const options = parseOptions(p)
  const initialState = getStateFromLocalStore()
  const store = createStore(initialState)
  const chatRouter = new ChatRouter()
  const notifications = initNotifications()
  const controller = createController({ store, chatRouter, notifications, ...options })
  const listeners = createUnsubscribers()
  const commandsController = createCommandsController()
  const colorSchemaWatcher = createColorSchemaWatcher()

  $Store.setInstance(store)
  $ChatRouter.setInstance(chatRouter)
  $Controller.setInstance(controller)
  $CommandsController.setInstance(commandsController)

  listeners.add(addListener(document, "dblclick", () => {
    console.log(store.getState())
  }))

  listeners.add(colorSchemaWatcher.subscribe(onColorSchemaChange))

  listeners.add(store.lazyConnect(state => state.colorMode, onChangeColorMode))

  listeners.add(store.lazyConnect(function (state) {
    return {
      myProfile: state.myProfile,
      credentials: state.credentials,
      searchRecentQueries: state.searchRecentQueries,
      colorMode: state.colorMode,
    }
  }, setStateToLocalStore))

  return {
    dispose,
    bootstrap,
  }

  function dispose() {
    controller.dispose()
    chatRouter.dispose()
    store.dispose()
  }

  async function bootstrap() {
    const state = store.getState()
    const query = parseQueryParams(window.location.search)
    let credentials = state.credentials

    if (query.code) {
      /**
       * @todo restore original url from state
       */
      history.replaceState("", document.title, window.location.pathname)

      credentials = await api.token({
        grant_type: "authorization_code",
        code: query.code,
        redirect_uri: options.redirectUrl,
      })
    }

    if (!credentials) {
      return window.location.href = accounts.getAccountsUrl({
        response_type: "code",
        client_id: options.clientId,
        redirect_uri: options.redirectUrl,
      })
    }

    store.dispatch({ credentials })

    const appView = createAppView()
    const target = document.getElementById("app")

    if (!target) {
      throw new Error("`container` is empty")
    }

    target.replaceWith(appView.el)

    controller.connect()
  }

  function onColorSchemaChange(colorScheme: ColorScheme) {
    const state = store.getState()

    if (state.colorMode === "auto") {
      document.body.classList.toggle("dark", colorScheme === "dark")
    }
  }

  function onChangeColorMode(colorMode: ColorMode) {
    if (colorMode === "auto") {
      document.body.classList.toggle("dark", colorSchemaWatcher.current() === "dark")
    }
    else {
      document.body.classList.toggle("dark", colorMode === "dark")
    }
  }
}

function parseOptions(options: Options) {
  if (!options) {
    throw new RangeError("`options` can't be empty")
  }

  if (!options.clientId) {
    throw new RangeError("`options.clientId` can't be empty")
  }

  return options
}

function parseCredentialsFromQuery(query: any): Credentials | null {
  if (query.startsWith("?")) {
    query = query.substring(1)
  }

  if (query.startsWith("#")) {
    query = query.substring(1)
  }

  const params = new URLSearchParams(query)
  const values: Record<string, string> = {}

  for (const [key, value] of params.entries()) {
    values[key] = value
  }

  const access_token = String(values.access_token ?? "").trim()
  const refresh_token = String(values.refresh_token ?? "").trim()
  const entity_id = String(values.entity_id ?? "").trim()
  const account_id = String(values.account_id ?? "").trim()
  const license_id = Number(values.license_id ?? 0)
  const organization_id = String(values.organization_id ?? "")
  const expires_in = Number(values.expires_in ?? 0)
  const scopes = new Set(String(values.scope ?? 0).split(","))
  const expired_at = new Date(Date.now() + (Number.isNaN(expires_in) ? 1000 * 60 * 60 * 24 : expires_in * 1000))

  if (!access_token) {
    return null
  }

  if (!refresh_token) {
    return null
  }

  return {
    access_token,
    refresh_token,
    entity_id,
    account_id,
    license_id,
    organization_id,
    expired_at,
    scopes,
  }
}

function parseQueryParams(query: string) {
  if (query.startsWith("?")) {
    query = query.substring(1)
  }

  if (query.startsWith("#")) {
    query = query.substring(1)
  }

  const params = new URLSearchParams(query)
  const values: Record<string, string> = {}

  for (const [key, value] of params.entries()) {
    values[key] = value
  }

  return values
}
