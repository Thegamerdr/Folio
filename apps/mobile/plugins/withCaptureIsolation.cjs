// Keep the developer capture harness in a separate Android application/vault, including when
// developers invoke Gradle directly without rerunning Expo prebuild after changing capture flags.
const { withAppBuildGradle, withAndroidManifest } = require('expo/config-plugins');

const START = '// Melo capture isolation: begin';
const END = '// Melo capture isolation: end';
const BLOCK = `${START}
def meloCaptureBuild = System.getenv('EXPO_PUBLIC_MELO_PARITY_CAPTURE') == 'true'
android {
    defaultConfig {
        applicationId (meloCaptureBuild ? 'com.folio.v2.greenfield.capture' : 'com.folio.v2.greenfield')
        manifestPlaceholders += [
            meloUrlScheme: meloCaptureBuild ? 'folio-qa' : 'folio',
            meloExpoUrlScheme: meloCaptureBuild ? 'exp+folio-v2-greenfield.capture' : 'exp+folio-v2-greenfield',
            meloUpdatesEnabled: meloCaptureBuild ? 'false' : 'true',
            meloAppName: meloCaptureBuild ? 'Melo QA' : 'Melo'
        ]
    }
}
// Environment changes are not ordinary React bundle inputs. Model them so moving from a QA
// build to production cannot reuse JS containing a baked capture flag or fixture.
tasks.matching { it.name.startsWith('createBundle') && it.name.endsWith('JsAndAssets') }.configureEach {
    [
        'EXPO_PUBLIC_MELO_PARITY_CAPTURE', 'EXPO_PUBLIC_MELO_PARITY_FIXTURE',
        'EXPO_PUBLIC_MELO_PARITY_NOW', 'EXPO_PUBLIC_MELO_PARITY_SCREEN',
        'EXPO_PUBLIC_MELO_PARITY_SHEET', 'EXPO_PUBLIC_MELO_PARITY_THEME',
        'EXPO_PUBLIC_MELO_PARITY_GLOBAL'
    ].each { key -> inputs.property(key, System.getenv(key) ?: '') }
}
${END}`;

function injectCaptureGradle(contents) {
  const start = contents.indexOf(START);
  const end = contents.indexOf(END);
  if (start !== -1 || end !== -1) {
    if (start === -1 || end < start) throw new Error('Incomplete Melo capture isolation block');
    return contents.slice(0, start) + BLOCK + contents.slice(end + END.length);
  }
  return `${contents.trimEnd()}\n\n${BLOCK}\n`;
}

function isolateCaptureManifest(manifest) {
  const application = manifest.manifest.application?.[0];
  if (!application) throw new Error('Melo capture isolation requires an Android application');
  application.$['android:label'] = '${meloAppName}';
  const metadata = (application['meta-data'] ??= []);
  let updates = metadata.find(
    (entry) => entry.$['android:name'] === 'expo.modules.updates.ENABLED',
  );
  if (!updates) {
    updates = { $: { 'android:name': 'expo.modules.updates.ENABLED' } };
    metadata.push(updates);
  }
  updates.$['android:value'] = '${meloUpdatesEnabled}';
  for (const activity of application.activity ?? []) {
    for (const filter of activity['intent-filter'] ?? []) {
      for (const data of filter.data ?? []) {
        const scheme = data.$['android:scheme'];
        if (scheme === 'folio' || scheme === 'folio-qa') {
          data.$['android:scheme'] = '${meloUrlScheme}';
        } else if (
          scheme === 'exp+folio-v2-greenfield' ||
          scheme === 'exp+folio-v2-greenfield.capture'
        ) {
          data.$['android:scheme'] = '${meloExpoUrlScheme}';
        }
      }
    }
  }
  return manifest;
}

module.exports = function withCaptureIsolation(config) {
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('Melo capture isolation requires a Groovy app build.gradle');
    }
    cfg.modResults.contents = injectCaptureGradle(cfg.modResults.contents);
    return cfg;
  });
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = isolateCaptureManifest(cfg.modResults);
    return cfg;
  });
};

module.exports.injectCaptureGradle = injectCaptureGradle;
module.exports.isolateCaptureManifest = isolateCaptureManifest;
