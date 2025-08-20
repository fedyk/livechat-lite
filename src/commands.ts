import { $Controller } from "./controller.js";
import { createElement as h, createRef as Ref } from "./dom.js";
import { createInjector, getColorModeName, sortAgents, sortGroups } from "./helpers.js";
import { list2 } from "./list.js";
import { v35 } from "./livechat-api.js";
import { $Store } from "./store.js";
import { ColorMode } from "./types.js";

const ESCAPE_KEY = 'Escape'
const ENTER_KEY = 'Enter'
const ARROW_UP_KEY = 'ArrowUp'
const ARROW_DOWN_KEY = 'ArrowDown'

interface ICommand {
  id: string
  title: string
  subtitle?: string
  placeholder?: string
  highlight?: string
  select(): Promise<ICommand[] | void>
}

interface ISelected {
  command: ICommand
  status: "idle" | "pending"
}

export const $CommandsController = createInjector<ICommandsController>()

export type ICommandsController = ReturnType<typeof createCommandsController>

export function createCommandsController() {
  const self = {
    show,
    dispose,
    onshow(commandId?: string) {
      commandId // to be redefined
    }
  }

  return self

  function dispose() {
    self.onshow = null!
  }

  function show(commandId?: string) {
    self.onshow(commandId)
  }
}

export type ICommandsView = ReturnType<typeof createCommandsView>

export function createCommandsView() {
  let el: HTMLDivElement
  let inputEl: HTMLInputElement
  let listEl: HTMLDivElement
  let progressEl: HTMLDivElement
  let emptyListEl: HTMLDivElement
  let visible = false
  let commands: ICommand[] = []
  let active: ICommand | void
  let selected: ISelected | void
  let isCommandMouseEventFiring = false

  el = h("div", { className: "commands" },
    h("div", { className: "commands-head" },
      inputEl = h("input", { className: "commands-input", placeholder: "Search the command" })
    ),
    progressEl = h("div", { className: "commands-progress" }),
    listEl = h("div", { className: "commands-list" }),
    emptyListEl = h("div", { className: "commands-empty" }, "Nothing found"),
  )

  document.addEventListener("keydown", keydownHandler)
  inputEl.addEventListener("input", render)
  inputEl.addEventListener("blur", onInputBlur)

  render()

  return {
    el,
    dispose,
    show
  }

  function dispose() {
    commands = []
    selected = void 0
    render()
    document.removeEventListener("keydown", keydownHandler)
    inputEl.removeEventListener("input", render)
    el.remove()
  }

  function show(commandId?: string) {
    visible = true
    commands = getCommands()
    selected = void 0

    if (commands.length > 0) {
      active = commands[0]
    }

    if (commandId) {
      const command = commands.find(c => c.id === commandId)

      if (command) {
        selectCommand(command)
      }
    }

    inputEl.value = ""

    render()

    focusInput()
  }

  function render() {
    let data = commands

    if (inputEl.value) {
      data = filterOutCommands(data, inputEl.value)
    }

    if (selected?.command?.placeholder) {
      inputEl.placeholder = selected.command.placeholder
    }

    el.classList.toggle("visible", visible)
    progressEl.classList.toggle("pending", selected?.status === "pending")
    listEl.classList.toggle("d-none", data.length === 0 || selected?.status === "pending")
    emptyListEl.classList.toggle("d-none", data.length > 0 || selected?.status === "pending")

    list2<ICommand, { view: ICommandView }>({
      target: listEl,
      values: data,
      key: d => d?.id,
      enter(ctx) {
        ctx.view = createCommandView({
          command: ctx.value,
          isActive: active?.id === ctx.value.id
        })

        ctx.view.onmousedown = createCommandMouseDownHandler(ctx.value)
        ctx.view.onmouseup = createCommandMouseUpHandler(ctx.value)
        ctx.view.onclick = createCommandClickHandler(ctx.value)
        ctx.el = ctx.view.el
      },
      update(ctx) {
        ctx.view.update({
          command: ctx.value,
          isActive: active?.id === ctx.value.id
        })

        ctx.view.onmousedown = createCommandMouseDownHandler(ctx.value)
        ctx.view.onmouseup = createCommandMouseUpHandler(ctx.value)
        ctx.view.onclick = createCommandClickHandler(ctx.value)

        if (active?.id === ctx.value.id) {
          ctx.view.el.scrollIntoView(false)
        }
      },
      exit(ctx) {
        ctx.view.onmousedown = null!
        ctx.view.onmouseup = null!
        ctx.view.onclick = null!
        ctx.view.dispose()
        ctx.el.remove()
      }
    })
  }

  function keydownHandler(event: KeyboardEvent) {
    if (!visible) {
      return
    }

    const isEscapeEvent = event.key === ESCAPE_KEY
    const isEnterEvent = event.key === ENTER_KEY
    const isUpOrDownEvent = event.key === ARROW_UP_KEY || event.key === ARROW_DOWN_KEY

    if (!isEscapeEvent && !isEnterEvent && !isUpOrDownEvent) {
      return
    }

    event.preventDefault()

    if (isEscapeEvent) {
      visible = false
      render()
    }

    if (isEnterEvent) {
      event.stopPropagation()

      if (active) {
        selectCommand(active)
      }
    }

    if (isUpOrDownEvent) {
      let index = 0

      if (active) {
        index = commands.indexOf(active)
      }

      if (event.key === ARROW_UP_KEY) {
        index -= 1
      }
      else {
        index += 1
      }

      if (index < 0) {
        index = commands.length - 1
      }

      if (index > commands.length - 1) {
        index = 0
      }

      active = commands[index]

      event.stopPropagation()
    }

    render()
  }

  function onInputBlur(event: FocusEvent) {
    if (visible && event.target === inputEl && !isCommandMouseEventFiring) {
      visible = false
      render()

      // todo restore focus on prev input
    }
  }

  function createCommandMouseDownHandler(command: ICommand) {
    return function () {
      isCommandMouseEventFiring = true
    }
  }

  function createCommandMouseUpHandler(command: ICommand) {
    return function () {
      isCommandMouseEventFiring = false
    }
  }

  function createCommandClickHandler(command: ICommand) {
    return function () {
      selectCommand(command)
      focusInput()
    }
  }

  function selectCommand(command: ICommand) {
    commands = []
    selected = {
      command,
      status: "pending"
    }

    render()

    command.select().then(function (result) {
      if (result) {
        commands = result

        if (commands.length > 0) {
          active = commands[0]
        }

        if (selected) {
          selected.status = "idle"
        }
      }
      else {
        visible = false
      }
    }, function (err) {
      alert(err.message)
    }).finally(render)
  }

  function focusInput() {
    requestAnimationFrame(function () {
      inputEl.focus()
    })
  }
}

type ICommandView = ReturnType<typeof createCommandView>

type ICommandViewProps = {
  command: ICommand
  isActive: boolean
}

function createCommandView(props: ICommandViewProps) {
  const title = Ref<HTMLDivElement>()
  const subtitle = Ref<HTMLDivElement>()

  const el = h("div", { className: "command-item" },
    h("div", { className: "command-name" },
      h("div", { className: "", ref: title}),
      h("div", { className: "text-secondary", ref: subtitle})
    )
  )

  el.onmousedown = function (event) {
    self.onmousedown(event)
  }

  el.onmouseup = function (event) {
    self.onmouseup(event)
  }

  el.onclick = function (event) {
    self.onclick(event)
  }

  el.onmouseover = function (event) {
    self.onmouseover(event)
  }

  render()

  const self = {
    el,
    dispose,
    update,
    onmousedown(event: MouseEvent) { },
    onmouseup(event: MouseEvent) { },
    onclick(event: MouseEvent) { },
    onmouseover(event: MouseEvent) { },
  }

  return self

  function dispose() {
    el.onmousedown = null
    el.onmouseup = null
    el.onclick = null
    el.onmouseover = null
    el.remove()
  }

  function update(nextProps: ICommandViewProps) {
    props = nextProps
    render()
  }

  function render() {
    if (props.command.highlight) {
      title.current.innerHTML = props.command.highlight
    }
    else {
      title.current.textContent = props.command.title
    }

    subtitle.current.textContent = props.command.subtitle ?? ""

    el.classList.toggle("active", props.isActive)
  }
}

function getCommands(): ICommand[] {
  const store = $Store()
  const controller = $Controller()
  const commands: ICommand[] = []
  const state = store.getState()
  const selectedChatId = state.selectedChatId

  if (selectedChatId) {
    const chatRoute = controller.getCurrentChatRoute(selectedChatId)

    if (chatRoute === "my") {
      commands.push(createTransferCommand(selectedChatId))
      commands.push(createCloseChatCommand(selectedChatId))
    }

    if (chatRoute === "unassigned") {
      commands.push(createAssignToMeCommand(selectedChatId))
    }

    if (chatRoute === "pinned") {
      commands.push(createAssignToMeCommand(selectedChatId))
      commands.push(createUnpinCommand(selectedChatId))
    }

    if (chatRoute === "queued") {
      commands.push(createAssignToMeCommand(selectedChatId))
      commands.push(createCloseChatCommand(selectedChatId))
    }

    if (chatRoute === "closed") {
      commands.push(createAssignToMeCommand(selectedChatId))
    }
  }

  const routingToggleCommand = createRoutingToggleCommand()

  if (routingToggleCommand) {
    commands.push(routingToggleCommand)
  }
  
  commands.push(createColorModeCommand())

  return commands
}

function createTransferCommand(chatId: string): ICommand {
  const store = $Store()
  const controller = $Controller()

  return {
    id: `transfer_command`,
    title: "Transfer chat",
    placeholder: "Select Agent or Group",
    select: select,
  }

  async function select() {
    return Promise.all([
      controller.syncAgents(),
      controller.syncGroups()
    ]).then(function () {
      const state = store.getState()
      const agents = sortAgents(state.agents, state.routingStatuses)
      const groups = sortGroups(state.groups)

      return new Array<ICommand>().concat(
        agents.map(function (agent) {
          return createTransferToAgentCommand(chatId, agent)
        }),
        groups.map(function (group) {
          return createTransferToGroupCommand(chatId, group)
        })
      )
    })
  }
}

function createAssignToMeCommand(chatId: string): ICommand {
  const controller = $Controller()

  return {
    id: `assign_to_me_command`,
    title: "Assign chat to me",
    select: select,
  }

  async function select() {
    controller.assignChatToMe(chatId)
  }
}

function createUnpinCommand(chatId: string): ICommand {
  const controller = $Controller()

  return {
    id: `unpin_chat_command`,
    title: "Archive chat",
    select: select,
  }

  async function select() {
    controller.unpinChat(chatId)
  }
}

function createRoutingToggleCommand(): ICommand | void {
  const store = $Store()
  const state = store.getState()
  const myProfileId = state.myProfile?.id

  if (!myProfileId) {
    return
  }

  const routingStatus = state.routingStatuses.get(myProfileId)

  if (!routingStatus || routingStatus === "offline") {
    return
  }


  const controller = $Controller()
  let commandName = "Start accepting chats"

  if (routingStatus === "accepting_chats") {
    commandName = "Stop accepting chats"
  }

  return {
    id: `routing_toggle_command`,
    title: commandName,
    select: select,
  }

  async function select() {
    if (routingStatus === "accepting_chats") {
      controller.setRoutingStatus("not_accepting_chats")
    }
    else {
      controller.setRoutingStatus("accepting_chats")
    }
  }
}

function createColorModeCommand(store = $Store()): ICommand {
  const { colorMode } = store.getState()

  return {
    id: `color_mode_command`,
    title: `Color mode: ${getColorModeName(colorMode)}`,
    select: select,
  }

  async function select() {
    return [
      createSelectColorModeCommand("light"),
      createSelectColorModeCommand("dark"),
      createSelectColorModeCommand("auto")
    ]
  }
}

function createSelectColorModeCommand(colorMode: ColorMode, store = $Store()) {
  return {
    id: `select_color_mode_${colorMode}_command`,
    title: `Color mode: ${getColorModeName(colorMode)}`,
    select: select,
  }

  async function select() {
    store.dispatch({ colorMode })
  }
}


function createTransferToAgentCommand(chatId: string, agent: v35.conf.Agent): ICommand {
  const controller = $Controller()

  return {
    id: `transfer_to_agent_${agent.id}`,
    title: agent.name,
    subtitle: agent.id,
    select
  }

  async function select() {
    controller.transferChat(chatId, {
      type: "agent",
      ids: [agent.id]
    })
  }
}

function createTransferToGroupCommand(chatId: string, group: v35.conf.Group): ICommand {
  const controller = $Controller()

  return {
    id: `transfer_to_group_${group.id}`,
    title: group.name,
    select
  }

  async function select() {
    controller.transferChat(chatId, {
      type: "group",
      ids: [group.id]
    })
  }
}

function createCloseChatCommand(chatId: string): ICommand {
  const controller = $Controller()

  return {
    id: `close_chat_command_${chatId}`,
    title: "Archive chat",
    select
  }

  async function select() {
    controller.deactivateChat(chatId)
  }
}

function filterOutCommands(commands: ICommand[], query: string): ICommand[] {
  if (typeof query !== "string") {
    throw new RangeError("`query` needs to be a string")
  }

  query = query.trim().toLowerCase()

  if (query.length === 0) {
    return commands
  }

  const results = new Array<ICommand>()
  const length = query.length
  let highlight: string
  let name: string
  let index: number
  let c: ICommand

  for (c of commands) {
    name = c.title.toLocaleLowerCase()
    index = name.indexOf(query)

    if (index === -1) {
      continue
    }

    highlight = c.title.slice(0, index) + "<mark>" + c.title.slice(index, index + length) + `</mark>` + c.title.slice(index + length)

    results.push({
      id: c.id,
      title: c.title,
      highlight: highlight,
      select: c.select,
    })
  }

  return results
}
