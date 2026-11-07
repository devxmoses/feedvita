import { assertDisposableDatabase } from './global-setup';

const NEON = 'postgresql://u:pw@ep-cool-x.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const LOCAL = 'postgresql://feedvita:feedvita@localhost:55432/feedvita_test';

describe('e2e database guard', () => {
  it('accepts the local throwaway database', () => {
    expect(assertDisposableDatabase(LOCAL)).toEqual({
      host: 'localhost', port: '55432', database: 'feedvita_test',
    });
  });

  it('accepts a bracketed IPv6 loopback host', () => {
    expect(assertDisposableDatabase('postgresql://u:p@[::1]:5432/x_test').host).toBe('::1');
  });

  it('refuses a remote host', () => {
    expect(() => assertDisposableDatabase(NEON)).toThrow(/non-local database/);
  });

  it('never leaks the password in the refusal', () => {
    expect(() => assertDisposableDatabase(NEON)).not.toThrow(/pw/);
  });

  it('refuses a local database not named *_test', () => {
    expect(() => assertDisposableDatabase('postgresql://u:p@localhost:5432/feedvita')).toThrow(
      /does not end in "_test"/,
    );
  });

  it('refuses an unset DATABASE_URL', () => {
    expect(() => assertDisposableDatabase('')).toThrow(/not set/);
  });

  it('refuses a value that is not a URL', () => {
    expect(() => assertDisposableDatabase('not-a-url')).toThrow(/not a parseable URL/);
  });
});
