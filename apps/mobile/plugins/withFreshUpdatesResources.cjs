const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// Melo: regenerate embedded Expo update metadata for every native build.';

module.exports = function withFreshUpdatesResources(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withFreshUpdatesResources requires a Groovy app build.gradle');
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      // Expo SDK 56 does not declare app config/native fingerprint sources as task inputs.
      // A cached manifest can therefore omit assets/fingerprint even when Android expects it.
      // Regenerate only this small metadata task, not the bundle or native compilation tasks.
      cfg.modResults.contents += `\n${MARKER}\ntasks.matching { it.name.startsWith('create') && it.name.endsWith('UpdatesResources') }.configureEach {\n    outputs.upToDateWhen { false }\n}\n`;
    }
    return cfg;
  });
};
