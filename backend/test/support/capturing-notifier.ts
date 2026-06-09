import {
  ConfirmationLinkNotifier,
  ConfirmationLinkPayload,
} from '../../src/modules/auth/confirmation-link-notifier';

/**
 * Test double for the notifier seam: records every confirmation link instead of
 * sending it, so e2e tests read the token from the seam rather than scraping
 * logs. Injected in place of the dev-mode notifier by the harness.
 */
export class CapturingConfirmationLinkNotifier implements ConfirmationLinkNotifier {
  readonly captured: ConfirmationLinkPayload[] = [];

  async notify(payload: ConfirmationLinkPayload): Promise<void> {
    this.captured.push(payload);
  }

  lastFor(email: string): ConfirmationLinkPayload | undefined {
    return [...this.captured]
      .reverse()
      .find(p => p.email.toLowerCase() === email.toLowerCase());
  }

  clear(): void {
    this.captured.length = 0;
  }
}
