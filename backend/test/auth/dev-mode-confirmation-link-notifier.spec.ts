import {Logger} from '@nestjs/common';
import {DevModeConfirmationLinkNotifier} from '../../src/modules/auth/dev-mode-confirmation-link-notifier';

describe('DevModeConfirmationLinkNotifier', () => {
  it('writes the confirmation link to the structured log marked DEV MODE', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const notifier = new DevModeConfirmationLinkNotifier();

    await notifier.notify({
      userId: 'user-123',
      email: 'logme@example.com',
      confirmationUrl: 'http://localhost:3000/confirm?token=raw-token-abc',
      rawToken: 'raw-token-abc',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = String(logSpy.mock.calls[0][0]);
    expect(line).toMatch(/DEV MODE/);
    expect(line).toContain('http://localhost:3000/confirm?token=raw-token-abc');
    expect(line).toContain('user-123');

    logSpy.mockRestore();
  });
});
