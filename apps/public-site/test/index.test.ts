import { describe, expect, it } from 'vitest';

import worker from '../src/index';

const env = {
  ASSETS: {
    fetch: async () =>
      new Response('asset', {
        headers: { 'Content-Type': 'image/png' },
      }),
  },
};

describe('Melo public site', () => {
  it('serves the frozen product promise and security headers', async () => {
    const response = await worker.fetch(new Request('https://melo-money.com/'), env);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Will my money last to');
    expect(html).toContain('A calm forward view of your money');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('publishes current privacy and terms pages', async () => {
    const privacy = await worker.fetch(new Request('https://melo-money.com/privacy'), env);
    const terms = await worker.fetch(new Request('https://melo-money.com/terms'), env);
    const privacyHtml = await privacy.text();
    const termsHtml = await terms.text();

    expect(privacyHtml).toContain('What stays on your device');
    expect(privacyHtml).toContain('Crash diagnostics');
    expect(termsHtml).toContain('The service');
    expect(termsHtml).toContain('Your statutory consumer rights are unaffected');
  });

  it('uses the public Melo deep-link scheme', async () => {
    const response = await worker.fetch(new Request('https://melo-money.com/open'), env);

    expect(await response.text()).toContain('href="melo://"');
  });

  it.each(['www.melo-money.com', 'melomoney.uk', 'www.melomoney.uk'])(
    'redirects %s to the primary host while preserving path and query',
    async (host) => {
      const response = await worker.fetch(
        new Request(`https://${host}/support?source=domain`),
        env,
      );

      expect(response.status).toBe(308);
      expect(response.headers.get('Location')).toBe('https://melo-money.com/support?source=domain');
      expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
    },
  );

  it('serves canonical assets through the Cloudflare asset binding', async () => {
    const response = await worker.fetch(new Request('https://melo-money.com/melo-hero.png'), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('publishes the upload-signed Android association without fabricating the Apple identity', async () => {
    const apple = await worker.fetch(
      new Request('https://melo-money.com/.well-known/apple-app-site-association'),
      env,
    );
    const android = await worker.fetch(
      new Request('https://melo-money.com/.well-known/assetlinks.json'),
      env,
    );

    expect(apple.status).toBe(404);
    expect(android.status).toBe(200);
    expect(android.headers.get('Content-Type')).toContain('application/json');
    expect(await android.json()).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.melomoney.app',
          sha256_cert_fingerprints: [
            '54:73:96:E1:FD:99:68:1C:2A:6D:76:8B:8B:7D:1B:44:84:B5:F4:2A:17:59:7C:AD:6C:49:52:21:26:7A:54:88',
          ],
        },
      },
    ]);
  });

  it('publishes account-deletion and security-disclosure routes', async () => {
    const deletion = await worker.fetch(new Request('https://melo-money.com/delete-account'), env);
    const security = await worker.fetch(new Request('https://melo-money.com/security'), env);
    const securityTxt = await worker.fetch(
      new Request('https://melo-money.com/.well-known/security.txt'),
      env,
    );

    expect(await deletion.text()).toContain('Melo account deletion request');
    expect(await security.text()).toContain('security@melo-money.com');
    expect(await securityTxt.text()).toContain('Contact: mailto:security@melo-money.com');
    expect(securityTxt.headers.get('Content-Type')).toContain('text/plain');
  });
});
