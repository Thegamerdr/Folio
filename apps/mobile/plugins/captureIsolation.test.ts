import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { injectCaptureGradle, isolateCaptureManifest } = require('./withCaptureIsolation.cjs');

describe('native QA capture isolation', () => {
  it('keeps application identity and bundle cache tied to the same explicit build flag', () => {
    const base = "android { defaultConfig { applicationId 'com.folio.v2.greenfield' } }\n";
    const generated = injectCaptureGradle(base);

    expect(generated).toContain(base.trimEnd());
    expect(generated).toContain("System.getenv('EXPO_PUBLIC_MELO_PARITY_CAPTURE') == 'true'");
    expect(generated).toContain(
      "applicationId (meloCaptureBuild ? 'com.folio.v2.greenfield.capture' : 'com.folio.v2.greenfield')",
    );
    expect(generated).toContain("meloUrlScheme: meloCaptureBuild ? 'folio-qa' : 'folio'");
    expect(generated).toContain("meloUpdatesEnabled: meloCaptureBuild ? 'false' : 'true'");
    expect(generated).toContain("inputs.property(key, System.getenv(key) ?: '')");
    for (const suffix of ['CAPTURE', 'FIXTURE', 'NOW', 'SCREEN', 'SHEET', 'THEME', 'GLOBAL']) {
      expect(generated).toContain(`'EXPO_PUBLIC_MELO_PARITY_${suffix}'`);
    }
    expect(injectCaptureGradle(generated)).toBe(generated);
  });

  it.each(['folio', 'folio-qa'])(
    'binds the manifest from a %s prebuild to the current native build identity',
    (scheme) => {
      const manifest = {
        manifest: {
          application: [
            {
              $: { 'android:name': '.MainApplication', 'android:label': '@string/app_name' },
              'meta-data': [
                { $: { 'android:name': 'expo.modules.updates.ENABLED', 'android:value': 'true' } },
              ],
              activity: [
                {
                  $: { 'android:name': '.MainActivity' },
                  'intent-filter': [
                    {
                      data: [
                        { $: { 'android:scheme': scheme } },
                        { $: { 'android:scheme': 'exp+folio-v2-greenfield' } },
                        {
                          $: { 'android:scheme': 'https', 'android:host': 'accounts.example.test' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      const generated = isolateCaptureManifest(manifest);
      const application = generated.manifest.application[0];
      expect(application.$['android:label']).toBe('${meloAppName}');
      expect(application['meta-data'][0].$['android:value']).toBe('${meloUpdatesEnabled}');
      expect(application.activity[0]['intent-filter'][0].data).toEqual([
        { $: { 'android:scheme': '${meloUrlScheme}' } },
        { $: { 'android:scheme': '${meloExpoUrlScheme}' } },
        { $: { 'android:scheme': 'https', 'android:host': 'accounts.example.test' } },
      ]);
      expect(isolateCaptureManifest(structuredClone(generated))).toEqual(generated);
    },
  );
});
