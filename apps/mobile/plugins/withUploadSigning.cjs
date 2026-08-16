// Expo config plugin: durable release signing.
//
// `expo prebuild --clean` regenerates android/, wiping any hand edit to build.gradle — so the
// release signingConfig is injected HERE, at prebuild time, instead of being hand-maintained.
//
// Behavior: when the FOLIO_UPLOAD_* Gradle properties are present (this machine keeps them in
// ~/.gradle/gradle.properties, keystore at ~/.folio-signing/ — NEVER committed), release builds
// sign with the real upload keystore. A release task fails closed when any property is absent;
// debug builds remain available without release credentials.
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const RELEASE_SIGNING = `        release {
            def uploadSigningProperties = [
                'FOLIO_UPLOAD_STORE_FILE',
                'FOLIO_UPLOAD_STORE_PASSWORD',
                'FOLIO_UPLOAD_KEY_ALIAS',
                'FOLIO_UPLOAD_KEY_PASSWORD'
            ]
            def missingUploadSigningProperties = uploadSigningProperties.findAll {
                !project.hasProperty(it) || !project.property(it)
            }
            def releaseTaskRequested = gradle.startParameter.taskNames.any {
                it.toLowerCase().contains('release')
            }
            if (releaseTaskRequested && !missingUploadSigningProperties.isEmpty()) {
                throw new GradleException(
                    "Release signing is not configured. Missing Gradle properties: " +
                    missingUploadSigningProperties.join(', ')
                )
            }
            if (missingUploadSigningProperties.isEmpty()) {
                storeFile file(FOLIO_UPLOAD_STORE_FILE)
                storePassword FOLIO_UPLOAD_STORE_PASSWORD
                keyAlias FOLIO_UPLOAD_KEY_ALIAS
                keyPassword FOLIO_UPLOAD_KEY_PASSWORD
            }
        }
`;

function injectSigning(gradle) {
  if (gradle.includes('FOLIO_UPLOAD_STORE_FILE')) return gradle; // already applied

  // 1. Add the release entry inside signingConfigs { debug {...} }.
  const signingConfigsRe = /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\}\n)(\s*\})/;
  if (!signingConfigsRe.test(gradle)) {
    throw new Error('withUploadSigning: could not locate signingConfigs.debug block');
  }
  let out = gradle.replace(signingConfigsRe, (_, head, tail) => head + RELEASE_SIGNING + tail);

  // 2. Point the release buildType at it when the upload key exists.
  const releaseTypeRe = /(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseTypeRe.test(out)) {
    throw new Error('withUploadSigning: could not locate release buildType signingConfig line');
  }
  out = out.replace(releaseTypeRe, `$1signingConfig signingConfigs.release`);
  return out;
}

module.exports = function withUploadSigning(config) {
  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = injectSigning(cfg.modResults.contents);
    return cfg;
  });
  // Deliberate arm64-only builds (the prebuild template writes all four ABIs; a stray manual
  // append used to override it by last-line-wins — this makes the decision explicit + durable).
  // Play distribution should be an AAB, where per-ABI splits make this moot; sideload APKs
  // target modern arm64 phones. Revisit if a 32-bit or emulator-x86 target ever matters.
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter(
      (p) =>
        !(
          p.type === 'property' &&
          (p.key === 'reactNativeArchitectures' || p.key === 'org.gradle.jvmargs')
        ),
    );
    // R8 + the Expo/RN native graph exceeded the template's 512 MiB metaspace during a release
    // bundle. Keep this allocation durable across clean prebuilds and EAS.
    props.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: '-Xmx4096m -XX:MaxMetaspaceSize=1024m',
    });
    props.push({ type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a' });
    cfg.modResults = props;
    return cfg;
  });
};
