import * as jose from 'jose';
import {JwtVerifier} from '../../src/common/auth/jwt-verifier';
import {AuthenticatedUser} from '../../src/common/decorators/current-user.decorator';

describe('JwtVerifier', () => {
  const secret = 'test-secret-for-verifier';
  const cookieName = 'test_session';
  let verifier: JwtVerifier;

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
    process.env.SESSION_COOKIE_NAME = cookieName;
    verifier = new JwtVerifier();
  });

  it('verifies a valid JWT and returns the authenticated principal', async () => {
    const encoded = new TextEncoder().encode(secret);
    const jwt = await new jose.SignJWT({userId: 'u-1', email: 'a@b.com'})
      .setProtectedHeader({alg: 'HS256'})
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(encoded);

    const user: AuthenticatedUser | null = await verifier.verifyToken(jwt);

    expect(user).toEqual({userId: 'u-1', email: 'a@b.com'});
  });

  it('returns null for a token signed with a different secret', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret');
    const jwt = await new jose.SignJWT({userId: 'u-2', email: 'x@y.com'})
      .setProtectedHeader({alg: 'HS256'})
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongSecret);

    expect(await verifier.verifyToken(jwt)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const encoded = new TextEncoder().encode(secret);
    const jwt = await new jose.SignJWT({userId: 'u-3', email: 'z@w.com'})
      .setProtectedHeader({alg: 'HS256'})
      .setIssuedAt()
      .setExpirationTime('0s')
      .sign(encoded);

    // Small delay so the token is actually expired.
    await new Promise(r => setTimeout(r, 100));

    expect(await verifier.verifyToken(jwt)).toBeNull();
  });

  it('returns the configured cookie name', () => {
    expect(verifier.getCookieName()).toBe(cookieName);
  });
});
