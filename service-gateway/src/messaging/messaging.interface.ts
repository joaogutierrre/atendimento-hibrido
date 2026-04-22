import { ChannelType, MessagingChannel } from '@prisma/client';

export interface SendResult {
  /** External message id returned by the channel provider. */
  externalId: string;
}

export interface IMessagingProvider {
  readonly channel: ChannelType;

  /**
   * Send a message through the underlying channel.
   * @param channel - persisted MessagingChannel (contains token in `identifier`)
   * @param to - recipient identifier (chat id, phone, etc.)
   * @param content - plain text message
   */
  sendMessage(channel: MessagingChannel, to: string, content: string): Promise<SendResult>;

  /**
   * Perform one-time setup for a newly registered channel
   * (e.g. register webhook with Telegram's Bot API).
   * Implementations should be idempotent and tolerant of missing public URLs.
   */
  setup(channel: MessagingChannel): Promise<void>;
}
