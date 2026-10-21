export const TELEGRAM_CLIENT_ID = "618cd4034d7f68c21c505db150712465"
export const INSTAGRAM_CLIENT_ID = "e598b0031d95aeb7180fce9d7090eddc"
export const CHAT_WIDGET_CLIENT_ID = "c5e4f61e1a6c3b1521b541bc5c5a2ac5"

export type Channel = "telegram" | "instagram" | "chat_widget"

export function getChannelLabel(channel: Channel): string {
  switch (channel) {
    case "telegram": return "Telegram"
    case "instagram": return "Instagram"
    case "chat_widget": return "Chat widget"
  }
}

export function getChannel(customerClientId: string | undefined): Channel | undefined {
  switch (customerClientId) {
    case TELEGRAM_CLIENT_ID: return "telegram"
    case INSTAGRAM_CLIENT_ID: return "instagram"
    case CHAT_WIDGET_CLIENT_ID: return "chat_widget"
  }
}
