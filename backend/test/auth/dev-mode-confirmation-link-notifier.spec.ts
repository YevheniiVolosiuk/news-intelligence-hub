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

  it('returns the confirmation URL so the caller can surface it in the response', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const notifier = new DevModeConfirmationLinkNotifier();
    const url = 'http://localhost:3000/confirm?token=xyz-123';

    const delivery = await notifier.notify({
      userId: 'user-456',
      email: 'surface@example.com',
      confirmationUrl: url,
      rawToken: 'xyz-123',
    });

    expect(delivery.confirmationUrl).toBe(url);

    jest.restoreAllMocks();
  });
});
