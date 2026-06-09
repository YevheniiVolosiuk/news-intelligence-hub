/** What a notifier needs to deliver a confirmation link to a freshly-registered User. */
export interface ConfirmationLinkPayload {
  userId: string;
  email: string;
  /** The full URL a User clicks to confirm; embeds the raw (un-hashed) token. */
  confirmationUrl: string;
  /** The raw token, exposed on the seam so tests need not parse the URL. */
  rawToken: string;
}

/**
 * The seam between registration and however the confirmation link reaches the
 * User. The dev-mode implementation logs the link and makes it retrievable for
 * the post-registration page; a real async email transport can replace it later
 * without any caller change.
 */
export interface ConfirmationLinkNotifier {
  notify(payload: ConfirmationLinkPayload): Promise<void>;
}

/** Nest DI token for the notifier seam. */
export const CONFIRMATION_LINK_NOTIFIER = Symbol('ConfirmationLinkNotifier');
