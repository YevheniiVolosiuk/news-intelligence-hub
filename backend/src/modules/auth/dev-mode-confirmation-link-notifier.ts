import {Injectable, Logger} from '@nestjs/common';
import {
  ConfirmationLinkDelivery,
  ConfirmationLinkNotifier,
  ConfirmationLinkPayload,
} from './confirmation-link-notifier';

/**
 * Dev-mode notifier: there is no email transport yet, so it writes the
 * confirmation link to the structured log clearly marked DEV MODE and surfaces
 * the URL for the post-registration response. A real async transport replaces
 * this without touching callers.
 */
@Injectable()
export class DevModeConfirmationLinkNotifier implements ConfirmationLinkNotifier {
  private readonly logger = new Logger(DevModeConfirmationLinkNotifier.name);

  async notify(
    payload: ConfirmationLinkPayload,
  ): Promise<ConfirmationLinkDelivery> {
    this.logger.log(
      `DEV MODE confirmation link issued userId=${payload.userId} ` +
        `email=${payload.email} url=${payload.confirmationUrl}`,
    );
    return {confirmationUrl: payload.confirmationUrl};
  }
}
