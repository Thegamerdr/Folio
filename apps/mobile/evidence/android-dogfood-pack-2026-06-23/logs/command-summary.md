# Android Dogfood Command Evidence

Date: 2026-06-23

## adb devices -l

```text
List of devices attached
emulator-5554          device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:1

```

## expo install --check

```text
Dependencies are up to date
```

## expo doctor

```text
$ expo-doctor
Running 21 checks on your project...
21/21 checks passed. No issues detected!
```

## pnpm --filter @folio/mobile native:apk:android

```text
$ cd android && gradlew.bat :app:assembleRelease
> Task :gradle-plugin:shared:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :gradle-plugin:settings-plugin:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo-gradle-plugin:expo-autolinking-settings-plugin:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo-gradle-plugin:expo-autolinking-plugin-shared:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo-gradle-plugin:expo-autolinking-settings-plugin:pluginDescriptors
> Task :gradle-plugin:settings-plugin:pluginDescriptors
> Task :expo-gradle-plugin:expo-autolinking-settings-plugin:processResources
> Task :gradle-plugin:settings-plugin:processResources
> Task :gradle-plugin:shared:processResources NO-SOURCE
> Task :expo-gradle-plugin:expo-autolinking-plugin-shared:processResources NO-SOURCE
> Task :gradle-plugin:shared:compileKotlin
> Task :gradle-plugin:shared:compileJava NO-SOURCE
> Task :gradle-plugin:shared:classes UP-TO-DATE
> Task :gradle-plugin:shared:jar
> Task :expo-gradle-plugin:expo-autolinking-plugin-shared:compileKotlin
> Task :expo-gradle-plugin:expo-autolinking-plugin-shared:compileJava NO-SOURCE
> Task :expo-gradle-plugin:expo-autolinking-plugin-shared:classes UP-TO-DATE
> Task :expo-gradle-plugin:expo-autolinking-plugin-shared:jar
> Task :gradle-plugin:settings-plugin:compileKotlin
> Task :gradle-plugin:settings-plugin:compileJava NO-SOURCE
> Task :gradle-plugin:settings-plugin:classes
> Task :gradle-plugin:settings-plugin:jar
> Task :expo-gradle-plugin:expo-autolinking-settings-plugin:compileKotlin
> Task :expo-gradle-plugin:expo-autolinking-settings-plugin:compileJava NO-SOURCE
> Task :expo-gradle-plugin:expo-autolinking-settings-plugin:classes
> Task :expo-gradle-plugin:expo-autolinking-settings-plugin:jar
> Task :expo-gradle-plugin:expo-autolinking-plugin:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo-gradle-plugin:expo-max-sdk-override-plugin:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :gradle-plugin:react-native-gradle-plugin:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo-module-gradle-plugin:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo-module-gradle-plugin:pluginDescriptors
> Task :expo-module-gradle-plugin:processResources
> Task :expo-gradle-plugin:expo-max-sdk-override-plugin:pluginDescriptors
> Task :expo-gradle-plugin:expo-max-sdk-override-plugin:processResources
> Task :expo-gradle-plugin:expo-autolinking-plugin:pluginDescriptors
> Task :gradle-plugin:react-native-gradle-plugin:pluginDescriptors
> Task :expo-gradle-plugin:expo-autolinking-plugin:processResources
> Task :gradle-plugin:react-native-gradle-plugin:processResources
> Task :expo-gradle-plugin:expo-max-sdk-override-plugin:compileKotlin
> Task :expo-gradle-plugin:expo-max-sdk-override-plugin:compileJava NO-SOURCE
> Task :expo-gradle-plugin:expo-max-sdk-override-plugin:classes
> Task :expo-gradle-plugin:expo-max-sdk-override-plugin:jar
> Task :expo-gradle-plugin:expo-autolinking-plugin:compileKotlin
> Task :expo-gradle-plugin:expo-autolinking-plugin:compileJava NO-SOURCE
> Task :expo-gradle-plugin:expo-autolinking-plugin:classes
> Task :expo-gradle-plugin:expo-autolinking-plugin:jar
> Task :gradle-plugin:react-native-gradle-plugin:compileKotlin
> Task :gradle-plugin:react-native-gradle-plugin:compileJava NO-SOURCE
> Task :gradle-plugin:react-native-gradle-plugin:classes
> Task :gradle-plugin:react-native-gradle-plugin:jar

> Task :expo-module-gradle-plugin:compileKotlin
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/expo-module-gradle-plugin/src/main/kotlin/expo/modules/plugin/android/AndroidLibraryExtension.kt:9:24 'var targetSdk: Int?' is deprecated. Will be removed from library DSL in v9.0. Use testOptions.targetSdk or/and lint.targetSdk instead.

> Task :expo-module-gradle-plugin:compileJava NO-SOURCE
> Task :expo-module-gradle-plugin:classes
> Task :expo-module-gradle-plugin:jar

> Configure project :
[32m[ExpoRootProject][0m Using the following versions:
  - buildTools:  [32m36.0.0[0m
  - minSdk:      [32m24[0m
  - compileSdk:  [32m36[0m
  - targetSdk:   [32m36[0m
  - ndk:         [32m27.1.12297006[0m
  - kotlin:      [32m2.1.20[0m
  - ksp:         [32m2.1.20-2.0.1[0m

> Configure project :app
 ??  [33mApplying gradle plugin[0m '[32mexpo-max-sdk-override-plugin[0m'
  [expo-max-sdk-override-plugin] This plugin will find all permissions declared with `android:maxSdkVersion`. If there exists a declaration with the `android:maxSdkVersion` annotation and another one without, the plugin will remove the annotation from the final merged manifest. In order to see a log with the changes run a clean build of the app.

> Configure project :expo-modules-core
Linking react-native-worklets native libs into expo-modules-core build tasks
task ':react-native-worklets:mergeDebugNativeLibs'
task ':react-native-worklets:mergeReleaseNativeLibs'

> Configure project :expo

Using expo modules
  - [32mexpo-log-box[0m (56.0.13)
  - [32mexpo-constants[0m (56.0.18)
  - [32mexpo-modules-core[0m (56.0.17)
  - [33m[??][0m [32mexpo-dom-webview[0m (56.0.5)
  - [33m[??][0m [32mexpo-ui[0m (56.0.18)
  - [33m[??][0m [32mexpo-asset[0m (56.0.17)
  - [33m[??][0m [32mexpo-crypto[0m (56.0.4)
  - [33m[??][0m [32mexpo-document-picker[0m (56.0.4)
  - [33m[??][0m [32mexpo-file-system[0m (56.0.8)
  - [33m[??][0m [32mexpo-font[0m (56.0.7)
  - [33m[??][0m [32mexpo-keep-awake[0m (56.0.3)
  - [33m[??][0m [32mexpo-linking[0m (56.0.14)
  - [33m[??][0m [32mexpo-local-authentication[0m (56.0.4)
  - [33m[??][0m [32mexpo-router[0m (56.2.11)
  - [33m[??][0m [32mexpo-secure-store[0m (56.0.4)
  - [33m[??][0m [32mexpo-splash-screen[0m (56.0.10)
  - [33m[??][0m [32mexpo-status-bar[0m (56.0.4)
  - [33m[??][0m [32mexpo-system-ui[0m (56.0.5)


> Configure project :op-engineering_op-sqlite
[OP-SQLITE] Detected op-sqlite config from package.json at: C:\dev\folio-v2-greenfield\apps\mobile\android\..\package.json
[OP-SQLITE] using sqlcipher.
[OP-SQLITE] Performance mode enabled
[OP-SQLITE] FTS5 enabled

> Task :expo-modules-core:preBuild UP-TO-DATE
> Task :expo-log-box:preBuild UP-TO-DATE
> Task :react-native-masked-view_masked-view:preBuild UP-TO-DATE
> Task :expo-modules-core:preReleaseBuild UP-TO-DATE
> Task :app:generateAutolinkingNewArchitectureFiles UP-TO-DATE
> Task :react-native-masked-view_masked-view:preReleaseBuild UP-TO-DATE
> Task :app:generateAutolinkingPackageList UP-TO-DATE
> Task :expo-log-box:preReleaseBuild UP-TO-DATE
> Task :app:generateCodegenSchemaFromJavaScript SKIPPED
> Task :app:generateCodegenArtifactsFromSchema SKIPPED
> Task :app:generateReactNativeEntryPoint UP-TO-DATE
> Task :app:buildKotlinToolingMetadata UP-TO-DATE
> Task :app:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo:generatePackagesList
> Task :expo:preBuild
> Task :expo:preReleaseBuild
> Task :react-native-masked-view_masked-view:mergeReleaseJniLibFolders
> Task :expo-modules-core:mergeReleaseJniLibFolders
> Task :expo-modules-core:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :react-native-masked-view_masked-view:mergeReleaseNativeLibs NO-SOURCE
> Task :expo-log-box:mergeReleaseJniLibFolders
> Task :expo-log-box:mergeReleaseNativeLibs NO-SOURCE
> Task :expo:mergeReleaseJniLibFolders
> Task :expo:mergeReleaseNativeLibs NO-SOURCE
> Task :expo-log-box:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo:copyReleaseJniLibsProjectOnly
> Task :react-native-masked-view_masked-view:copyReleaseJniLibsProjectOnly
> Task :expo-modules-core:generateReleaseBuildConfig
> Task :expo-log-box:copyReleaseJniLibsProjectOnly
> Task :expo:generateReleaseBuildConfig
> Task :expo-modules-core:generateReleaseResValues
> Task :react-native-masked-view_masked-view:generateReleaseBuildConfig
> Task :expo:generateReleaseResValues
> Task :expo-log-box:generateReleaseBuildConfig
> Task :react-native-masked-view_masked-view:generateReleaseResValues
> Task :expo-log-box:generateReleaseResValues
> Task :expo-modules-core:generateReleaseResources
> Task :expo:generateReleaseResources
> Task :react-native-masked-view_masked-view:generateReleaseResources
> Task :expo-log-box:generateReleaseResources
> Task :expo:packageReleaseResources
> Task :expo-modules-core:packageReleaseResources
> Task :expo-log-box:packageReleaseResources
> Task :react-native-masked-view_masked-view:packageReleaseResources
> Task :react-native-reanimated:assertMinimalReactNativeVersionTask
> Task :react-native-reanimated:assertNewArchitectureEnabledTask SKIPPED
> Task :react-native-worklets:assertMinimalReactNativeVersionTask
> Task :react-native-worklets:assertNewArchitectureEnabledTask SKIPPED
> Task :expo:javaPreCompileRelease
> Task :expo-log-box:javaPreCompileRelease
> Task :expo-modules-core:javaPreCompileRelease
> Task :react-native-masked-view_masked-view:javaPreCompileRelease
> Task :expo-log-box:writeReleaseAarMetadata
> Task :expo-modules-core:extractDeepLinksRelease
> Task :react-native-masked-view_masked-view:extractDeepLinksRelease
> Task :react-native-masked-view_masked-view:writeReleaseAarMetadata
> Task :expo:extractDeepLinksRelease
> Task :expo-log-box:extractDeepLinksRelease
> Task :expo-modules-core:writeReleaseAarMetadata
> Task :expo:writeReleaseAarMetadata
> Task :expo-log-box:prepareReleaseArtProfile UP-TO-DATE
> Task :react-native-masked-view_masked-view:prepareReleaseArtProfile UP-TO-DATE
> Task :react-native-masked-view_masked-view:processReleaseJavaRes NO-SOURCE
> Task :expo-modules-core:prepareReleaseArtProfile UP-TO-DATE
> Task :expo-log-box:mergeReleaseShaders
> Task :react-native-masked-view_masked-view:mergeReleaseShaders
> Task :expo-log-box:compileReleaseShaders NO-SOURCE
> Task :react-native-masked-view_masked-view:compileReleaseShaders NO-SOURCE
> Task :expo-log-box:generateReleaseAssets UP-TO-DATE
> Task :react-native-masked-view_masked-view:generateReleaseAssets UP-TO-DATE
> Task :react-native-masked-view_masked-view:mergeReleaseAssets
> Task :expo:prepareReleaseArtProfile UP-TO-DATE
> Task :expo-log-box:mergeReleaseAssets
> Task :expo:mergeReleaseShaders
> Task :expo:parseReleaseLocalResources
> Task :expo:compileReleaseShaders NO-SOURCE
> Task :expo-modules-core:parseReleaseLocalResources
> Task :react-native-masked-view_masked-view:parseReleaseLocalResources
> Task :expo-log-box:parseReleaseLocalResources
> Task :expo-modules-core:mergeReleaseShaders
> Task :expo:generateReleaseAssets UP-TO-DATE
> Task :react-native-masked-view_masked-view:extractProguardFiles
> Task :expo-modules-core:compileReleaseShaders NO-SOURCE
> Task :expo-modules-core:generateReleaseAssets UP-TO-DATE
> Task :expo:mergeReleaseAssets
> Task :react-native-masked-view_masked-view:prepareLintJarForPublish UP-TO-DATE
> Task :react-native-masked-view_masked-view:stripReleaseDebugSymbols NO-SOURCE
> Task :expo-modules-core:mergeReleaseAssets
> Task :react-native-masked-view_masked-view:copyReleaseJniLibsProjectAndLocalJars
> Task :react-native-masked-view_masked-view:extractDeepLinksForAarRelease UP-TO-DATE
> Task :expo:generateReleaseRFile
> Task :react-native-masked-view_masked-view:generateReleaseRFile
> Task :expo-modules-core:generateReleaseRFile
> Task :expo:extractProguardFiles
> Task :expo:prepareLintJarForPublish UP-TO-DATE
> Task :expo:stripReleaseDebugSymbols NO-SOURCE
> Task :expo-modules-core:extractProguardFiles
> Task :expo-modules-core:prepareLintJarForPublish UP-TO-DATE
> Task :expo-log-box:extractProguardFiles
> Task :expo-modules-core:extractDeepLinksForAarRelease UP-TO-DATE
> Task :expo:copyReleaseJniLibsProjectAndLocalJars
> Task :expo:extractDeepLinksForAarRelease UP-TO-DATE
> Task :expo-modules-core:writeReleaseLintModelMetadata
> Task :expo-log-box:prepareLintJarForPublish UP-TO-DATE
> Task :expo-log-box:stripReleaseDebugSymbols NO-SOURCE
> Task :expo-log-box:generateReleaseRFile
> Task :expo:writeReleaseLintModelMetadata
> Task :expo-log-box:extractDeepLinksForAarRelease UP-TO-DATE
> Task :expo-log-box:copyReleaseJniLibsProjectAndLocalJars
> Task :expo-log-box:writeReleaseLintModelMetadata
> Task :react-native-masked-view_masked-view:mergeReleaseJavaResource
> Task :react-native-masked-view_masked-view:processReleaseManifest
> Task :expo-log-box:processReleaseManifest

> Task :expo-modules-core:processReleaseManifest
C:\dev\folio-v2-greenfield\node_modules\expo-modules-core\android\src\main\AndroidManifest.xml:8:9-11:45 Warning:
	meta-data#com.facebook.soloader.enabled@android:value was tagged at AndroidManifest.xml:8 to replace other declarations but no other declaration present

> Task :expo:processReleaseManifest
> Task :react-native-reanimated:assertWorkletsVersionTask
> Task :op-engineering_op-sqlite:generateCodegenSchemaFromJavaScript
> Task :react-native-safe-area-context:generateCodegenSchemaFromJavaScript
> Task :react-native-gesture-handler:generateCodegenSchemaFromJavaScript
> Task :react-native-worklets:generateCodegenSchemaFromJavaScript
> Task :react-native-screens:generateCodegenSchemaFromJavaScript
> Task :react-native-svg:generateCodegenSchemaFromJavaScript
> Task :react-native-reanimated:generateCodegenSchemaFromJavaScript
> Task :op-engineering_op-sqlite:generateCodegenArtifactsFromSchema
> Task :op-engineering_op-sqlite:prepareHeaders
> Task :op-engineering_op-sqlite:preBuild
> Task :op-engineering_op-sqlite:preReleaseBuild

> Task :expo-constants:createExpoConfig
The NODE_ENV environment variable is required but was not specified. Ensure the project is bundled with Expo CLI or NODE_ENV is set. Using only .env.local and .env

> Task :expo-constants:preBuild
> Task :expo-constants:preReleaseBuild
> Task :react-native-safe-area-context:generateCodegenArtifactsFromSchema
> Task :react-native-safe-area-context:preBuild
> Task :react-native-safe-area-context:preReleaseBuild
> Task :react-native-gesture-handler:generateCodegenArtifactsFromSchema
> Task :react-native-gesture-handler:preBuild
> Task :react-native-gesture-handler:preReleaseBuild
> Task :expo-constants:mergeReleaseJniLibFolders
> Task :expo-constants:mergeReleaseNativeLibs NO-SOURCE
> Task :react-native-safe-area-context:mergeReleaseJniLibFolders
> Task :react-native-safe-area-context:mergeReleaseNativeLibs NO-SOURCE
> Task :expo-constants:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :expo-constants:copyReleaseJniLibsProjectOnly
> Task :react-native-gesture-handler:mergeReleaseJniLibFolders
> Task :react-native-gesture-handler:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :react-native-safe-area-context:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :react-native-safe-area-context:copyReleaseJniLibsProjectOnly
> Task :react-native-gesture-handler:generateReleaseBuildConfig
> Task :expo-constants:generateReleaseBuildConfig
> Task :react-native-safe-area-context:generateReleaseBuildConfig
> Task :expo-constants:generateReleaseResValues
> Task :react-native-gesture-handler:generateReleaseResValues
> Task :react-native-safe-area-context:generateReleaseResValues
> Task :expo-constants:generateReleaseResources
> Task :react-native-gesture-handler:generateReleaseResources
> Task :react-native-safe-area-context:generateReleaseResources
> Task :react-native-worklets:generateCodegenArtifactsFromSchema
> Task :expo-constants:packageReleaseResources
> Task :react-native-safe-area-context:packageReleaseResources
> Task :react-native-gesture-handler:packageReleaseResources
> Task :react-native-safe-area-context:parseReleaseLocalResources
> Task :expo-constants:javaPreCompileRelease
> Task :react-native-safe-area-context:javaPreCompileRelease
> Task :react-native-gesture-handler:javaPreCompileRelease
> Task :react-native-gesture-handler:parseReleaseLocalResources
> Task :expo-constants:parseReleaseLocalResources
> Task :expo-constants:writeReleaseAarMetadata
> Task :react-native-gesture-handler:writeReleaseAarMetadata
> Task :react-native-screens:generateCodegenArtifactsFromSchema
> Task :react-native-safe-area-context:writeReleaseAarMetadata
> Task :react-native-screens:preBuild
> Task :react-native-screens:preReleaseBuild
> Task :expo-constants:extractDeepLinksRelease
> Task :react-native-safe-area-context:extractDeepLinksRelease
> Task :react-native-safe-area-context:generateReleaseRFile
> Task :react-native-gesture-handler:generateReleaseRFile
> Task :react-native-safe-area-context:prepareReleaseArtProfile UP-TO-DATE
> Task :expo-constants:generateReleaseRFile
> Task :react-native-gesture-handler:extractDeepLinksRelease

> Task :react-native-safe-area-context:processReleaseManifest
package="com.th3rdwave.safeareacontext" found in source AndroidManifest.xml: C:\dev\folio-v2-greenfield\node_modules\react-native-safe-area-context\android\src\main\AndroidManifest.xml.
Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported, and the value is ignored.
Recommendation: remove package="com.th3rdwave.safeareacontext" from the source AndroidManifest.xml: C:\dev\folio-v2-greenfield\node_modules\react-native-safe-area-context\android\src\main\AndroidManifest.xml.

> Task :react-native-safe-area-context:mergeReleaseShaders
> Task :react-native-gesture-handler:prepareReleaseArtProfile UP-TO-DATE
> Task :react-native-gesture-handler:processReleaseManifest
> Task :expo-constants:prepareReleaseArtProfile UP-TO-DATE
> Task :react-native-gesture-handler:mergeReleaseShaders
> Task :react-native-gesture-handler:compileReleaseShaders NO-SOURCE
> Task :react-native-gesture-handler:generateReleaseAssets UP-TO-DATE
> Task :expo-constants:mergeReleaseShaders
> Task :expo-constants:compileReleaseShaders NO-SOURCE
> Task :expo-constants:generateReleaseAssets UP-TO-DATE
> Task :react-native-gesture-handler:mergeReleaseAssets
> Task :react-native-worklets:prepareWorkletsHeadersForPrefabs
> Task :react-native-worklets:preBuild
> Task :react-native-worklets:preReleaseBuild
> Task :expo-constants:mergeReleaseAssets
> Task :expo-constants:processReleaseManifest
> Task :react-native-gesture-handler:extractProguardFiles
> Task :react-native-gesture-handler:prepareLintJarForPublish UP-TO-DATE
> Task :react-native-gesture-handler:extractDeepLinksForAarRelease UP-TO-DATE
> Task :expo-constants:extractProguardFiles
> Task :expo-constants:prepareLintJarForPublish UP-TO-DATE
> Task :expo-constants:stripReleaseDebugSymbols NO-SOURCE
> Task :expo-constants:copyReleaseJniLibsProjectAndLocalJars
> Task :expo-constants:extractDeepLinksForAarRelease UP-TO-DATE
> Task :react-native-gesture-handler:writeReleaseLintModelMetadata
> Task :expo-constants:writeReleaseLintModelMetadata
> Task :react-native-svg:generateCodegenArtifactsFromSchema
> Task :react-native-svg:preBuild
> Task :react-native-svg:preReleaseBuild
> Task :react-native-svg:mergeReleaseJniLibFolders
> Task :react-native-svg:mergeReleaseNativeLibs NO-SOURCE
> Task :react-native-svg:copyReleaseJniLibsProjectOnly
> Task :react-native-svg:generateReleaseBuildConfig
> Task :react-native-svg:generateReleaseResValues
> Task :react-native-svg:generateReleaseResources
> Task :react-native-reanimated:generateCodegenArtifactsFromSchema
> Task :react-native-svg:packageReleaseResources
> Task :react-native-svg:parseReleaseLocalResources
> Task :react-native-svg:javaPreCompileRelease
> Task :react-native-svg:writeReleaseAarMetadata
> Task :react-native-svg:generateReleaseRFile
> Task :react-native-svg:extractDeepLinksRelease
> Task :react-native-safe-area-context:compileReleaseShaders NO-SOURCE
> Task :react-native-safe-area-context:generateReleaseAssets UP-TO-DATE

> Task :react-native-masked-view_masked-view:compileReleaseJavaWithJavac
Note: C:\dev\folio-v2-greenfield\node_modules\@react-native-masked-view\masked-view\android\src\main\java\org\reactnative\maskedview\RNCMaskedViewPackage.java uses or overrides a deprecated API.
Note: Recompile with -Xlint:deprecation for details.

> Task :react-native-safe-area-context:mergeReleaseAssets
> Task :react-native-safe-area-context:extractProguardFiles
> Task :react-native-safe-area-context:prepareLintJarForPublish UP-TO-DATE
> Task :react-native-safe-area-context:stripReleaseDebugSymbols NO-SOURCE
> Task :react-native-safe-area-context:copyReleaseJniLibsProjectAndLocalJars
> Task :react-native-safe-area-context:extractDeepLinksForAarRelease UP-TO-DATE
> Task :react-native-safe-area-context:writeReleaseLintModelMetadata
> Task :react-native-reanimated:prepareReanimatedHeadersForPrefabs
> Task :react-native-reanimated:preBuild
> Task :react-native-reanimated:preReleaseBuild
> Task :react-native-reanimated:mergeReleaseJniLibFolders
> Task :react-native-reanimated:generateReleaseBuildConfig
> Task :react-native-reanimated:generateReleaseResValues
> Task :react-native-reanimated:generateReleaseResources
> Task :react-native-reanimated:packageReleaseResources
> Task :react-native-reanimated:extractDeepLinksRelease
> Task :react-native-reanimated:javaPreCompileRelease
> Task :react-native-reanimated:prepareReleaseArtProfile UP-TO-DATE
> Task :react-native-reanimated:processReleaseJavaRes NO-SOURCE
> Task :react-native-reanimated:writeReleaseAarMetadata
> Task :react-native-reanimated:parseReleaseLocalResources
> Task :react-native-reanimated:processReleaseManifest
> Task :react-native-reanimated:mergeReleaseShaders
> Task :react-native-reanimated:compileReleaseShaders NO-SOURCE
> Task :react-native-reanimated:generateReleaseAssets UP-TO-DATE
> Task :react-native-reanimated:generateReleaseRFile
> Task :react-native-reanimated:mergeReleaseAssets
> Task :react-native-reanimated:extractProguardFiles
> Task :react-native-reanimated:prepareLintJarForPublish UP-TO-DATE
> Task :react-native-reanimated:extractDeepLinksForAarRelease UP-TO-DATE
> Task :react-native-masked-view_masked-view:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :react-native-masked-view_masked-view:exportReleaseConsumerProguardFiles UP-TO-DATE
> Task :react-native-reanimated:mergeReleaseJavaResource
> Task :react-native-reanimated:writeReleaseLintModelMetadata
> Task :react-native-masked-view_masked-view:bundleLibCompileToJarRelease
> Task :react-native-masked-view_masked-view:bundleLibRuntimeToJarRelease
> Task :react-native-masked-view_masked-view:generateReleaseLintModel
> Task :react-native-masked-view_masked-view:createFullJarRelease
> Task :react-native-masked-view_masked-view:extractReleaseAnnotations
> Task :react-native-masked-view_masked-view:mergeReleaseConsumerProguardFiles UP-TO-DATE
> Task :react-native-masked-view_masked-view:syncReleaseLibJars
> Task :react-native-masked-view_masked-view:bundleReleaseLocalLintAar
> Task :react-native-masked-view_masked-view:writeReleaseLintModelMetadata
> Task :react-native-masked-view_masked-view:generateReleaseLintVitalModel

> Task :app:createBundleReleaseJsAndAssets
Expo Autolinking module resolution enabled

> Task :react-native-screens:configureCMakeRelWithDebInfo[arm64-v8a]

> Task :op-engineering_op-sqlite:configureCMakeRelWithDebInfo[arm64-v8a]
C/C++: CMake Warning:
C/C++:   Manually-specified variables were not used by the project:
C/C++:     USER_DEFINED_TOKENIZERS_HEADER_PATH

> Task :react-native-worklets:configureCMakeRelWithDebInfo[arm64-v8a]

> Task :react-native-svg:compileReleaseJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: Some input files use unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.

> Task :react-native-svg:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :react-native-svg:exportReleaseConsumerProguardFiles
> Task :react-native-svg:prepareReleaseArtProfile UP-TO-DATE
> Task :react-native-svg:processReleaseManifest
> Task :react-native-svg:processReleaseJavaRes NO-SOURCE
> Task :react-native-svg:mergeReleaseShaders
> Task :react-native-svg:compileReleaseShaders NO-SOURCE
> Task :react-native-svg:generateReleaseAssets UP-TO-DATE
> Task :react-native-svg:bundleLibCompileToJarRelease
> Task :react-native-svg:mergeReleaseAssets
> Task :react-native-svg:extractProguardFiles
> Task :react-native-svg:bundleLibRuntimeToJarRelease
> Task :react-native-svg:generateReleaseLintModel
> Task :react-native-svg:createFullJarRelease
> Task :react-native-svg:prepareLintJarForPublish UP-TO-DATE
> Task :react-native-svg:stripReleaseDebugSymbols NO-SOURCE
> Task :react-native-svg:copyReleaseJniLibsProjectAndLocalJars
> Task :react-native-svg:extractDeepLinksForAarRelease UP-TO-DATE
> Task :react-native-svg:extractReleaseAnnotations
> Task :react-native-svg:mergeReleaseConsumerProguardFiles
> Task :react-native-svg:writeReleaseLintModelMetadata
> Task :react-native-svg:mergeReleaseJavaResource
> Task :react-native-svg:generateReleaseLintVitalModel
> Task :react-native-svg:syncReleaseLibJars
> Task :react-native-svg:bundleReleaseLocalLintAar

> Task :react-native-safe-area-context:compileReleaseKotlin
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-safe-area-context/android/src/main/java/com/th3rdwave/safeareacontext/SafeAreaProviderManager.kt:39:19 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-safe-area-context/android/src/main/java/com/th3rdwave/safeareacontext/SafeAreaView.kt:9:8 'class UIManagerModule : ReactContextBaseJavaModule, LifecycleEventListener, UIManager' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-safe-area-context/android/src/main/java/com/th3rdwave/safeareacontext/SafeAreaView.kt:50:54 'class UIManagerModule : ReactContextBaseJavaModule, LifecycleEventListener, UIManager' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-safe-area-context/android/src/main/java/com/th3rdwave/safeareacontext/SafeAreaView.kt:59:23 'val uiImplementation: UIImplementation!' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-safe-area-context/android/src/main/java/com/th3rdwave/safeareacontext/SafeAreaViewShadowNode.kt:9:32 'class LayoutShadowNode : ReactShadowNodeImpl' is deprecated. This class is part of Legacy Architecture and will be removed in a future release.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-safe-area-context/android/src/main/java/com/th3rdwave/safeareacontext/SafeAreaViewShadowNode.kt:110:61 'class NativeViewHierarchyOptimizer : Any' is deprecated. This class is part of Legacy Architecture and will be removed in a future release.

> Task :app:createBundleReleaseJsAndAssets
Starting Metro Bundler

warning: Bundler cache is empty, rebuilding (this may take a minute)

> Task :react-native-svg:lintVitalAnalyzeRelease
> Task :react-native-masked-view_masked-view:lintVitalAnalyzeRelease

> Task :op-engineering_op-sqlite:configureCMakeRelWithDebInfo[x86_64]
C/C++: CMake Warning:
C/C++:   Manually-specified variables were not used by the project:
C/C++:     USER_DEFINED_TOKENIZERS_HEADER_PATH

> Task :react-native-safe-area-context:compileReleaseJavaWithJavac
> Task :react-native-safe-area-context:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :react-native-safe-area-context:exportReleaseConsumerProguardFiles UP-TO-DATE
> Task :react-native-safe-area-context:bundleLibCompileToJarRelease
> Task :react-native-safe-area-context:bundleLibRuntimeToJarRelease
> Task :react-native-safe-area-context:processReleaseJavaRes
> Task :react-native-safe-area-context:createFullJarRelease
> Task :op-engineering_op-sqlite:generateJsonModelRelease
> Task :op-engineering_op-sqlite:prefabReleaseConfigurePackage UP-TO-DATE
> Task :react-native-safe-area-context:generateReleaseLintModel
> Task :react-native-safe-area-context:extractReleaseAnnotations
> Task :react-native-safe-area-context:mergeReleaseConsumerProguardFiles UP-TO-DATE
> Task :react-native-safe-area-context:mergeReleaseJavaResource
> Task :react-native-safe-area-context:syncReleaseLibJars
> Task :react-native-safe-area-context:bundleReleaseLocalLintAar
> Task :react-native-safe-area-context:generateReleaseLintVitalModel
> Task :react-native-screens:buildCMakeRelWithDebInfo[arm64-v8a]
> Task :react-native-worklets:buildCMakeRelWithDebInfo[arm64-v8a][worklets]

> Task :app:createBundleReleaseJsAndAssets
Android Bundled 47772ms node_modules\expo-router\entry.js (1716 modules)
Writing bundle output to: android\app\build\generated\assets\react\release\index.android.bundle
Writing sourcemap output to: android\app\build\intermediates\sourcemaps\react\release\index.android.bundle.packager.map
Copying 29 asset files
Done writing bundle output
Done writing sourcemap output

> Task :op-engineering_op-sqlite:buildCMakeRelWithDebInfo[arm64-v8a]
> Task :react-native-safe-area-context:lintVitalAnalyzeRelease
> Task :react-native-screens:configureCMakeRelWithDebInfo[x86_64]

> Task :op-engineering_op-sqlite:buildCMakeRelWithDebInfo[arm64-v8a]
C/C++: ninja: Entering directory `C:\dev\folio-v2-greenfield\node_modules\@op-engineering\op-sqlite\android\.cxx\RelWithDebInfo\ir2d6u1h\arm64-v8a'
C/C++: C:/dev/folio-v2-greenfield/node_modules/@op-engineering/op-sqlite/cpp/bridge.cpp:92:9: warning: unused variable 'errMsg' [-Wunused-variable]
C/C++:    92 |   char *errMsg;
C/C++:       |         ^~~~~~
C/C++: 1 warning generated.

> Task :react-native-screens:buildCMakeRelWithDebInfo[x86_64]
> Task :react-native-screens:mergeReleaseJniLibFolders
> Task :react-native-screens:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :react-native-screens:generateReleaseBuildConfig
> Task :react-native-screens:generateReleaseResValues
> Task :react-native-screens:mergeReleaseNativeLibs
> Task :react-native-screens:generateReleaseResources
> Task :react-native-screens:copyReleaseJniLibsProjectOnly
> Task :react-native-screens:packageReleaseResources
> Task :react-native-screens:javaPreCompileRelease
> Task :react-native-screens:writeReleaseAarMetadata
> Task :react-native-screens:extractDeepLinksRelease
> Task :react-native-screens:parseReleaseLocalResources
> Task :react-native-screens:processReleaseManifest
> Task :react-native-screens:prepareReleaseArtProfile UP-TO-DATE
> Task :react-native-screens:generateReleaseRFile
> Task :react-native-screens:mergeReleaseShaders
> Task :react-native-worklets:configureCMakeRelWithDebInfo[x86_64]
> Task :react-native-screens:compileReleaseShaders NO-SOURCE
> Task :react-native-screens:generateReleaseAssets UP-TO-DATE
> Task :react-native-screens:mergeReleaseAssets
> Task :react-native-screens:extractProguardFiles
> Task :react-native-screens:prepareLintJarForPublish UP-TO-DATE
> Task :react-native-screens:extractDeepLinksForAarRelease UP-TO-DATE
> Task :react-native-screens:writeReleaseLintModelMetadata
> Task :react-native-screens:stripReleaseDebugSymbols
> Task :react-native-screens:copyReleaseJniLibsProjectAndLocalJars
> Task :app:preBuild
> Task :app:preReleaseBuild
> Task :app:mergeReleaseJniLibFolders UP-TO-DATE
> Task :app:checkReleaseDuplicateClasses UP-TO-DATE
> Task :app:generateReleaseBuildConfig UP-TO-DATE
> Task :app:generateReleaseResValues UP-TO-DATE
> Task :app:generateReleaseResources UP-TO-DATE
> Task :app:packageReleaseResources UP-TO-DATE
> Task :app:parseReleaseLocalResources UP-TO-DATE
> Task :app:createReleaseCompatibleScreenManifests UP-TO-DATE
> Task :app:extractDeepLinksRelease UP-TO-DATE
> Task :app:javaPreCompileRelease UP-TO-DATE
> Task :app:extractProguardFiles UP-TO-DATE
> Task :app:mergeReleaseStartupProfile UP-TO-DATE
> Task :app:mergeReleaseShaders UP-TO-DATE
> Task :app:compileReleaseShaders NO-SOURCE
> Task :app:generateReleaseAssets UP-TO-DATE
> Task :app:extractReleaseVersionControlInfo UP-TO-DATE
> Task :app:collectReleaseDependencies UP-TO-DATE
> Task :app:sdkReleaseDependencyData UP-TO-DATE
> Task :app:validateSigningRelease UP-TO-DATE
> Task :app:writeReleaseAppMetadata UP-TO-DATE
> Task :app:writeReleaseSigningConfigVersions UP-TO-DATE
> Task :react-native-screens:compileReleaseKotlin
> Task :react-native-worklets:buildCMakeRelWithDebInfo[x86_64][worklets]

> Task :react-native-screens:compileReleaseKotlin
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/RNScreensPackage.kt:66:9 The corresponding parameter in the supertype 'BaseReactPackage' is named 'name'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/RNScreensPackage.kt:67:9 The corresponding parameter in the supertype 'BaseReactPackage' is named 'reactContext'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/RNScreensPackage.kt:79:17 'constructor(name: String, className: String, canOverrideExistingModule: Boolean, needsEagerInit: Boolean, hasConstants: Boolean, isCxxModule: Boolean, isTurboModule: Boolean): ReactModuleInfo' is deprecated. This constructor is deprecated and will be removed in the future. Use ReactModuleInfo(String, String, boolean, boolean, boolean, boolean)].
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/Screen.kt:53:77 Unchecked cast of '(CoordinatorLayout.Behavior<View!>?..CoordinatorLayout.Behavior<*>?)' to 'BottomSheetBehavior<Screen>'.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/Screen.kt:58:33 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/Screen.kt:515:14 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenContainer.kt:250:18 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenContainer.kt:260:18 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenFragment.kt:225:37 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenFragment.kt:242:14 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenFragment.kt:258:22 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenFragment.kt:327:22 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenModalFragment.kt:180:22 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStack.kt:106:14 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:169:18 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:226:31 'var targetElevation: Float' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:229:13 'fun setHasOptionsMenu(p0: Boolean): Unit' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:439:18 This declaration overrides a deprecated member but is not marked as deprecated itself. Add the '@Deprecated' annotation or suppress the diagnostic.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:446:22 'fun onPrepareOptionsMenu(p0: Menu): Unit' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:449:18 This declaration overrides a deprecated member but is not marked as deprecated itself. Add the '@Deprecated' annotation or suppress the diagnostic.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackFragment.kt:454:22 'fun onCreateOptionsMenu(p0: Menu, p1: MenuInflater): Unit' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackHeaderConfig.kt:181:14 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStackHeaderConfig.kt:191:14 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:48:42 'fun replaceSystemWindowInsets(p0: Int, p1: Int, p2: Int, p3: Int): @NonNull() WindowInsetsCompat' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:49:39 'val systemWindowInsetLeft: Int' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:51:39 'val systemWindowInsetRight: Int' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenWindowTraits.kt:52:39 'val systemWindowInsetBottom: Int' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreensModule.kt:100:14 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/SearchBarView.kt:137:29 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:7:8 'object ReactFeatureFlags : Any' is deprecated. Use com.facebook.react.internal.featureflags.ReactNativeFeatureFlags instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:25:13 'object ReactFeatureFlags : Any' is deprecated. Use com.facebook.react.internal.featureflags.ReactNativeFeatureFlags instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:32:9 The corresponding parameter in the supertype 'ReactViewGroup' is named 'left'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:33:9 The corresponding parameter in the supertype 'ReactViewGroup' is named 'top'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:34:9 The corresponding parameter in the supertype 'ReactViewGroup' is named 'right'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:35:9 The corresponding parameter in the supertype 'ReactViewGroup' is named 'bottom'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:71:9 The corresponding parameter in the supertype 'RootView' is named 'childView'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:72:9 The corresponding parameter in the supertype 'RootView' is named 'ev'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:79:46 The corresponding parameter in the supertype 'RootView' is named 'ev'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:83:9 The corresponding parameter in the supertype 'RootView' is named 'childView'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:84:9 The corresponding parameter in the supertype 'RootView' is named 'ev'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/BottomSheetDialogRootView.kt:95:34 The corresponding parameter in the supertype 'RootView' is named 't'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/DimmingView.kt:64:9 The corresponding parameter in the supertype 'ReactCompoundView' is named 'touchX'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/DimmingView.kt:65:9 The corresponding parameter in the supertype 'ReactCompoundView' is named 'touchY'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/DimmingView.kt:69:9 The corresponding parameter in the supertype 'ReactCompoundViewGroup' is named 'touchX'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/DimmingView.kt:70:9 The corresponding parameter in the supertype 'ReactCompoundViewGroup' is named 'touchY'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/gamma/common/event/BaseEventEmitter.kt:12:38 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/gamma/tabs/host/TabsHostViewManager.kt:44:9 The corresponding parameter in the supertype 'TabsHostViewManager' is named 'view'. This may cause problems when calling this function with named arguments.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/safearea/SafeAreaView.kt:143:45 'fun consumeDisplayCutout(): @NonNull() WindowInsetsCompat' is deprecated. Deprecated in Java.

> Task :react-native-screens:compileReleaseJavaWithJavac
> Task :react-native-screens:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :react-native-screens:exportReleaseConsumerProguardFiles UP-TO-DATE
> Task :react-native-screens:processReleaseJavaRes
> Task :react-native-screens:bundleLibCompileToJarRelease
> Task :react-native-screens:bundleLibRuntimeToJarRelease
> Task :react-native-screens:generateReleaseLintModel
> Task :react-native-screens:createFullJarRelease
> Task :react-native-screens:extractReleaseAnnotations
> Task :react-native-screens:mergeReleaseConsumerProguardFiles UP-TO-DATE
> Task :react-native-screens:mergeReleaseJavaResource
> Task :react-native-screens:syncReleaseLibJars
> Task :react-native-screens:bundleReleaseLocalLintAar
> Task :react-native-screens:generateReleaseLintVitalModel
> Task :react-native-worklets:externalNativeBuildRelease
> Task :react-native-worklets:generateJsonModelRelease
> Task :react-native-worklets:prefabReleaseConfigurePackage
> Task :react-native-worklets:prefabReleasePackage
> Task :react-native-worklets:mergeReleaseJniLibFolders
> Task :react-native-worklets:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :react-native-worklets:generateReleaseBuildConfig
> Task :react-native-worklets:generateReleaseResValues
> Task :react-native-worklets:generateReleaseResources
> Task :react-native-worklets:packageReleaseResources
> Task :react-native-worklets:javaPreCompileRelease
> Task :react-native-worklets:parseReleaseLocalResources
> Task :react-native-worklets:writeReleaseAarMetadata
> Task :react-native-worklets:extractDeepLinksRelease
> Task :react-native-worklets:generateReleaseRFile
> Task :react-native-worklets:compileReleaseKotlin NO-SOURCE
> Task :react-native-worklets:mergeReleaseNativeLibs

> Task :react-native-worklets:compileReleaseJavaWithJavac
Note: C:\dev\folio-v2-greenfield\node_modules\react-native-worklets\android\src\main\java\com\swmansion\worklets\WorkletsMessageQueueThreadBase.java uses or overrides a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: C:\dev\folio-v2-greenfield\node_modules\react-native-worklets\android\src\main\java\com\swmansion\worklets\WorkletsPackage.java uses unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.

> Task :react-native-worklets:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :react-native-worklets:bundleLibCompileToJarRelease
> Task :react-native-worklets:exportReleaseConsumerProguardFiles
> Task :react-native-worklets:prepareReleaseArtProfile UP-TO-DATE
> Task :react-native-worklets:processReleaseJavaRes NO-SOURCE
> Task :react-native-worklets:processReleaseManifest
> Task :react-native-worklets:bundleLibRuntimeToJarRelease
> Task :react-native-worklets:mergeReleaseShaders
> Task :react-native-worklets:compileReleaseShaders NO-SOURCE
> Task :react-native-worklets:generateReleaseAssets UP-TO-DATE
> Task :react-native-worklets:mergeReleaseAssets
> Task :react-native-worklets:createFullJarRelease
> Task :react-native-worklets:extractProguardFiles
> Task :react-native-worklets:copyReleaseJniLibsProjectOnly
> Task :react-native-worklets:generateReleaseLintModel
> Task :react-native-worklets:prepareLintJarForPublish UP-TO-DATE
> Task :react-native-worklets:extractDeepLinksForAarRelease UP-TO-DATE
> Task :react-native-worklets:extractReleaseAnnotations
> Task :react-native-worklets:mergeReleaseConsumerProguardFiles
> Task :react-native-worklets:mergeReleaseJavaResource
> Task :react-native-worklets:writeReleaseLintModelMetadata
> Task :react-native-worklets:syncReleaseLibJars
> Task :react-native-worklets:stripReleaseDebugSymbols
> Task :react-native-worklets:generateReleaseLintVitalModel
> Task :react-native-worklets:copyReleaseJniLibsProjectAndLocalJars
> Task :react-native-worklets:bundleReleaseLocalLintAar
> Task :expo-modules-core:configureCMakeRelWithDebInfo[arm64-v8a]
> Task :react-native-reanimated:configureCMakeRelWithDebInfo[arm64-v8a]
> Task :react-native-worklets:lintVitalAnalyzeRelease
> Task :react-native-reanimated:configureCMakeRelWithDebInfo[x86_64]
> Task :react-native-reanimated:generateJsonModelRelease
> Task :react-native-reanimated:prefabReleaseConfigurePackage UP-TO-DATE
> Task :react-native-screens:lintVitalAnalyzeRelease
> Task :expo-modules-core:buildCMakeRelWithDebInfo[arm64-v8a]
> Task :react-native-reanimated:buildCMakeRelWithDebInfo[arm64-v8a][reanimated]
> Task :react-native-gesture-handler:configureCMakeRelWithDebInfo[arm64-v8a]
> Task :app:configureCMakeRelWithDebInfo[arm64-v8a]
> Task :op-engineering_op-sqlite:buildCMakeRelWithDebInfo[x86_64]
C/C++: ninja: Entering directory `C:\dev\folio-v2-greenfield\node_modules\@op-engineering\op-sqlite\android\.cxx\RelWithDebInfo\ir2d6u1h\x86_64'
C/C++: C:/dev/folio-v2-greenfield/node_modules/@op-engineering/op-sqlite/cpp/bridge.cpp:92:9: warning: unused variable 'errMsg' [-Wunused-variable]
C/C++:    92 |   char *errMsg;
C/C++:       |         ^~~~~~
C/C++: 1 warning generated.

> Task :expo-modules-core:buildCMakeRelWithDebInfo[arm64-v8a]
C/C++: ninja: Entering directory `C:\dev\folio-v2-greenfield\node_modules\expo-modules-core\android\.cxx\RelWithDebInfo\1mp3yi1y\arm64-v8a'
C/C++: C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/cpp/fabric/ExpoComponentDescriptorFactory.cpp:17:5: warning: 'RawPropsParser' is deprecated [-Wdeprecated-declarations]
C/C++:    17 |     react::RawPropsParser(/*useRawPropsJsiValue=*/true)
C/C++:       |     ^
C/C++: C:/dev/folio-v2-greenfield/node_modules/react-native/ReactCommon/react/renderer/core/RawPropsParser.h:31:5: note: 'RawPropsParser' has been explicitly marked deprecated here
C/C++:    31 |   [[deprecated]] explicit RawPropsParser(bool /* ignored */) : RawPropsParser() {}
C/C++:       |     ^
C/C++: 1 warning generated.

> Task :expo-modules-core:configureCMakeRelWithDebInfo[x86_64]
> Task :expo-modules-core:buildCMakeRelWithDebInfo[x86_64]
C/C++: ninja: Entering directory `C:\dev\folio-v2-greenfield\node_modules\expo-modules-core\android\.cxx\RelWithDebInfo\1mp3yi1y\x86_64'
C/C++: C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/cpp/fabric/ExpoComponentDescriptorFactory.cpp:17:5: warning: 'RawPropsParser' is deprecated [-Wdeprecated-declarations]
C/C++:    17 |     react::RawPropsParser(/*useRawPropsJsiValue=*/true)
C/C++:       |     ^
C/C++: C:/dev/folio-v2-greenfield/node_modules/react-native/ReactCommon/react/renderer/core/RawPropsParser.h:31:5: note: 'RawPropsParser' has been explicitly marked deprecated here
C/C++:    31 |   [[deprecated]] explicit RawPropsParser(bool /* ignored */) : RawPropsParser() {}
C/C++:       |     ^
C/C++: 1 warning generated.

> Task :expo-modules-core:mergeReleaseNativeLibs
> Task :expo-modules-core:stripReleaseDebugSymbols
> Task :expo-modules-core:copyReleaseJniLibsProjectAndLocalJars
> Task :expo-modules-core:copyReleaseJniLibsProjectOnly
> Task :op-engineering_op-sqlite:externalNativeBuildRelease
> Task :op-engineering_op-sqlite:prefabReleasePackage
> Task :op-engineering_op-sqlite:mergeReleaseJniLibFolders
> Task :op-engineering_op-sqlite:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :op-engineering_op-sqlite:generateReleaseBuildConfig
> Task :op-engineering_op-sqlite:generateReleaseResValues
> Task :op-engineering_op-sqlite:generateReleaseResources
> Task :op-engineering_op-sqlite:packageReleaseResources
> Task :op-engineering_op-sqlite:parseReleaseLocalResources
> Task :op-engineering_op-sqlite:javaPreCompileRelease
> Task :op-engineering_op-sqlite:writeReleaseAarMetadata
> Task :op-engineering_op-sqlite:generateReleaseRFile
> Task :op-engineering_op-sqlite:extractDeepLinksRelease
> Task :op-engineering_op-sqlite:mergeReleaseNativeLibs
> Task :op-engineering_op-sqlite:prepareReleaseArtProfile UP-TO-DATE
> Task :op-engineering_op-sqlite:processReleaseManifest
> Task :op-engineering_op-sqlite:mergeReleaseShaders
> Task :op-engineering_op-sqlite:compileReleaseShaders NO-SOURCE
> Task :op-engineering_op-sqlite:generateReleaseAssets UP-TO-DATE
> Task :op-engineering_op-sqlite:mergeReleaseAssets
> Task :op-engineering_op-sqlite:extractProguardFiles
> Task :op-engineering_op-sqlite:prepareLintJarForPublish UP-TO-DATE
> Task :op-engineering_op-sqlite:extractDeepLinksForAarRelease UP-TO-DATE
> Task :op-engineering_op-sqlite:writeReleaseLintModelMetadata
> Task :op-engineering_op-sqlite:copyReleaseJniLibsProjectOnly
> Task :op-engineering_op-sqlite:stripReleaseDebugSymbols
> Task :op-engineering_op-sqlite:copyReleaseJniLibsProjectAndLocalJars

> Task :op-engineering_op-sqlite:compileReleaseKotlin
w: file:///C:/dev/folio-v2-greenfield/node_modules/@op-engineering/op-sqlite/android/src/main/java/com/op/sqlite/OPSQLiteBridge.kt:19:38 'val jsCallInvokerHolder: CallInvokerHolder' is deprecated. Use ReactContext.getJSCallInvokerHolder instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/@op-engineering/op-sqlite/android/src/main/java/com/op/sqlite/OPSQLitePackage.kt:9:18 This declaration overrides a deprecated member but is not marked as deprecated itself. Add the '@Deprecated' annotation or suppress the diagnostic.

> Task :op-engineering_op-sqlite:compileReleaseJavaWithJavac
> Task :op-engineering_op-sqlite:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :op-engineering_op-sqlite:exportReleaseConsumerProguardFiles UP-TO-DATE
> Task :op-engineering_op-sqlite:bundleLibCompileToJarRelease
> Task :op-engineering_op-sqlite:bundleLibRuntimeToJarRelease
> Task :op-engineering_op-sqlite:processReleaseJavaRes
> Task :op-engineering_op-sqlite:createFullJarRelease
> Task :op-engineering_op-sqlite:generateReleaseLintModel
> Task :op-engineering_op-sqlite:extractReleaseAnnotations
> Task :op-engineering_op-sqlite:mergeReleaseConsumerProguardFiles UP-TO-DATE
> Task :op-engineering_op-sqlite:mergeReleaseJavaResource
> Task :op-engineering_op-sqlite:syncReleaseLibJars
> Task :op-engineering_op-sqlite:bundleReleaseLocalLintAar
> Task :op-engineering_op-sqlite:generateReleaseLintVitalModel
> Task :op-engineering_op-sqlite:lintVitalAnalyzeRelease
> Task :expo-modules-core:compileReleaseKotlin
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/apploader/AppLoaderProvider.kt:34:52 Unchecked cast of 'Class<*>!' to 'Class<out HeadlessAppLoader>'.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/AppContext.kt:14:8 'class UIManagerModule : ReactContextBaseJavaModule, LifecycleEventListener, UIManager' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/AppContext.kt:22:8 'typealias ErrorManagerModule = JSLoggerModule' is deprecated. Use JSLoggerModule instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/AppContext.kt:61:13 'val hostingRuntimeContext: MainRuntime' is deprecated. Use AppContext.runtimeContext instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/AppContext.kt:271:21 'typealias ErrorManagerModule = JSLoggerModule' is deprecated. Use JSLoggerModule instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/AppContext.kt:380:21 'val DEFAULT: Int' is deprecated. UIManagerType.DEFAULT will be deleted in the next release of React Native. Use [LEGACY] instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/AppContext.kt:381:10 'class UIManagerModule : ReactContextBaseJavaModule, LifecycleEventListener, UIManager' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/defaultmodules/NativeModulesProxyModule.kt:16:5 'fun Constants(legacyConstantsProvider: () -> Map<String, Any?>): Unit' is deprecated. Use `Constant` or `Property` instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/events/KModuleEventEmitterWrapper.kt:99:21 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/events/KModuleEventEmitterWrapper.kt:108:21 'fun getEventDispatcherForReactTag(context: ReactContext, reactTag: Int): EventDispatcher?' is deprecated. reactTag is no longer needed.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/views/ViewDefinitionBuilder.kt:470:16 'val errorManager: JSLoggerModule?' is deprecated. Use AppContext.jsLogger instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/views/ViewDefinitionBuilder.kt:470:30 'fun reportExceptionToLogBox(codedException: CodedException): Unit' is deprecated. Use appContext.jsLogger.error(...) instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/views/ViewManagerDefinition.kt:41:16 'val errorManager: JSLoggerModule?' is deprecated. Use AppContext.jsLogger instead.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/views/ViewManagerDefinition.kt:41:30 'fun reportExceptionToLogBox(codedException: CodedException): Unit' is deprecated. Use appContext.jsLogger.error(...) instead.

> Task :react-native-reanimated:buildCMakeRelWithDebInfo[x86_64][reanimated]

> Task :expo-modules-core:compileReleaseJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.

> Task :expo-modules-core:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :expo-modules-core:exportReleaseConsumerProguardFiles
> Task :expo-modules-core:bundleLibCompileToJarRelease
> Task :expo-modules-core:bundleLibRuntimeToJarRelease
> Task :expo-modules-core:processReleaseJavaRes
> Task :expo-modules-core:createFullJarRelease
> Task :expo-modules-core:generateReleaseLintModel
> Task :expo-modules-core:extractReleaseAnnotations
> Task :expo-modules-core:mergeReleaseConsumerProguardFiles
> Task :expo-modules-core:mergeReleaseJavaResource

> Task :expo-constants:compileReleaseKotlin
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo-constants/android/src/main/java/expo/modules/constants/ConstantsModule.kt:13:5 'fun Constants(legacyConstantsProvider: () -> Map<String, Any?>): Unit' is deprecated. Use `Constant` or `Property` instead.

> Task :expo-constants:compileReleaseJavaWithJavac
> Task :expo-constants:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :expo-constants:exportReleaseConsumerProguardFiles UP-TO-DATE
> Task :expo-constants:bundleLibCompileToJarRelease
> Task :expo-constants:bundleLibRuntimeToJarRelease
> Task :expo-log-box:compileReleaseKotlin
> Task :expo-constants:processReleaseJavaRes
> Task :expo-constants:createFullJarRelease
> Task :expo-constants:generateReleaseLintModel
> Task :expo-modules-core:syncReleaseLibJars
> Task :expo-constants:extractReleaseAnnotations
> Task :expo-constants:mergeReleaseConsumerProguardFiles UP-TO-DATE
> Task :expo-constants:mergeReleaseJavaResource
> Task :expo-constants:generateReleaseLintVitalModel
> Task :expo-modules-core:bundleReleaseLocalLintAar
> Task :expo-modules-core:generateReleaseLintVitalModel
> Task :expo-constants:syncReleaseLibJars
> Task :expo-constants:bundleReleaseLocalLintAar
> Task :expo-constants:lintVitalAnalyzeRelease
> Task :expo-log-box:compileReleaseJavaWithJavac
> Task :expo-log-box:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :expo-log-box:bundleLibCompileToJarRelease
> Task :expo-log-box:exportReleaseConsumerProguardFiles UP-TO-DATE
> Task :expo-log-box:processReleaseJavaRes
> Task :expo-log-box:bundleLibRuntimeToJarRelease
> Task :expo-log-box:generateReleaseLintModel
> Task :expo-log-box:createFullJarRelease
> Task :expo-log-box:extractReleaseAnnotations
> Task :expo-log-box:mergeReleaseConsumerProguardFiles UP-TO-DATE
> Task :expo-log-box:mergeReleaseJavaResource
> Task :expo-log-box:generateReleaseLintVitalModel
> Task :expo-log-box:syncReleaseLibJars
> Task :expo-log-box:bundleReleaseLocalLintAar

> Task :expo:compileReleaseKotlin
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo/android/src/main/java/expo/modules/ExpoModulesPackage.kt:34:16 This declaration overrides a deprecated member but is not marked as deprecated itself. Add the '@Deprecated' annotation or suppress the diagnostic.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt:22:8 'class ReactInstanceManager : Any' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt:102:16 This declaration overrides a deprecated member but is not marked as deprecated itself. Add the '@Deprecated' annotation or suppress the diagnostic.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt:102:43 'class ReactInstanceManager : Any' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo/android/src/main/java/expo/modules/ReactActivityDelegateWrapper.kt:103:21 'val reactInstanceManager: ReactInstanceManager' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo/android/src/main/java/expo/modules/fetch/ExpoFetchModule.kt:32:39 'constructor(reactContext: ReactContext): ForwardingCookieHandler' is deprecated. Use the default constructor.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo/android/src/main/java/expo/modules/fetch/NativeResponse.kt:42:16 This declaration overrides a deprecated member but is not marked as deprecated itself. Add the '@Deprecated' annotation or suppress the diagnostic.
w: file:///C:/dev/folio-v2-greenfield/node_modules/expo/android/src/main/java/expo/modules/fetch/NativeResponse.kt:44:11 'fun deallocate(): Unit' is deprecated. Use sharedObjectDidRelease() instead.

> Task :expo-log-box:lintVitalAnalyzeRelease
> Task :expo-modules-core:lintVitalAnalyzeRelease
> Task :expo:compileReleaseJavaWithJavac
> Task :expo:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :expo:exportReleaseConsumerProguardFiles
> Task :expo:processReleaseJavaRes
> Task :expo:bundleLibRuntimeToJarRelease
> Task :expo:bundleLibCompileToJarRelease
> Task :expo:generateReleaseLintModel
> Task :expo:createFullJarRelease
> Task :expo:extractReleaseAnnotations
> Task :expo:mergeReleaseConsumerProguardFiles
> Task :expo:mergeReleaseJavaResource
> Task :expo:syncReleaseLibJars
> Task :expo:bundleReleaseLocalLintAar
> Task :expo:generateReleaseLintVitalModel
> Task :expo:lintVitalAnalyzeRelease
> Task :react-native-reanimated:externalNativeBuildRelease
> Task :react-native-reanimated:prefabReleasePackage
> Task :react-native-reanimated:mergeReleaseNativeLibs

> Task :react-native-reanimated:compileReleaseJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.
Note: Some input files use unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.

> Task :react-native-reanimated:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :react-native-reanimated:bundleLibCompileToJarRelease
> Task :react-native-reanimated:exportReleaseConsumerProguardFiles
> Task :react-native-reanimated:bundleLibRuntimeToJarRelease
> Task :react-native-reanimated:generateReleaseLintModel
> Task :react-native-reanimated:createFullJarRelease
> Task :react-native-reanimated:extractReleaseAnnotations
> Task :react-native-reanimated:mergeReleaseConsumerProguardFiles
> Task :react-native-reanimated:syncReleaseLibJars
> Task :react-native-reanimated:generateReleaseLintVitalModel
> Task :react-native-reanimated:copyReleaseJniLibsProjectOnly
> Task :react-native-reanimated:stripReleaseDebugSymbols
> Task :react-native-reanimated:copyReleaseJniLibsProjectAndLocalJars
> Task :react-native-reanimated:bundleReleaseLocalLintAar
> Task :react-native-reanimated:lintVitalAnalyzeRelease
> Task :react-native-gesture-handler:buildCMakeRelWithDebInfo[arm64-v8a]
> Task :app:buildCMakeRelWithDebInfo[arm64-v8a]
> Task :react-native-gesture-handler:configureCMakeRelWithDebInfo[x86_64]
> Task :react-native-gesture-handler:buildCMakeRelWithDebInfo[x86_64]
> Task :react-native-gesture-handler:mergeReleaseNativeLibs
> Task :react-native-gesture-handler:copyReleaseJniLibsProjectOnly
> Task :react-native-gesture-handler:stripReleaseDebugSymbols
> Task :react-native-gesture-handler:copyReleaseJniLibsProjectAndLocalJars

> Task :react-native-gesture-handler:compileReleaseKotlin
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/Extensions.kt:8:8 'class UIManagerModule : ReactContextBaseJavaModule, LifecycleEventListener, UIManager' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/Extensions.kt:13:29 'class UIManagerModule : ReactContextBaseJavaModule, LifecycleEventListener, UIManager' is deprecated. Deprecated in Java.
w: file:///C:/dev/folio-v2-greenfield/node_modules/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/Extensions.kt:14:32 'class UIManagerModule : ReactContextBaseJavaModule, LifecycleEventListener, UIManager' is deprecated. Deprecated in Java.

> Task :react-native-gesture-handler:compileReleaseJavaWithJavac
> Task :react-native-gesture-handler:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :react-native-gesture-handler:exportReleaseConsumerProguardFiles UP-TO-DATE
> Task :react-native-gesture-handler:processReleaseJavaRes
> Task :react-native-gesture-handler:bundleLibCompileToJarRelease
> Task :react-native-gesture-handler:bundleLibRuntimeToJarRelease
> Task :react-native-gesture-handler:generateReleaseLintModel
> Task :react-native-gesture-handler:createFullJarRelease
> Task :react-native-gesture-handler:extractReleaseAnnotations
> Task :react-native-gesture-handler:mergeReleaseConsumerProguardFiles UP-TO-DATE
> Task :react-native-gesture-handler:mergeReleaseJavaResource
> Task :react-native-gesture-handler:syncReleaseLibJars
> Task :react-native-gesture-handler:bundleReleaseLocalLintAar
> Task :react-native-gesture-handler:generateReleaseLintVitalModel
> Task :react-native-gesture-handler:lintVitalAnalyzeRelease
> Task :app:configureCMakeRelWithDebInfo[x86_64]
> Task :app:buildCMakeRelWithDebInfo[x86_64]
> Task :app:mergeReleaseNativeLibs UP-TO-DATE
> Task :app:stripReleaseDebugSymbols UP-TO-DATE
> Task :app:extractReleaseNativeSymbolTables UP-TO-DATE
> Task :app:mergeReleaseNativeDebugMetadata UP-TO-DATE
> Task :app:checkReleaseAarMetadata UP-TO-DATE
> Task :app:mapReleaseSourceSetPaths UP-TO-DATE
> Task :app:mergeReleaseResources UP-TO-DATE
> Task :app:processReleaseMainManifest UP-TO-DATE
> Task :app:expoReleaseOverrideMaxSdkConflicts UP-TO-DATE
> Task :app:processReleaseManifest UP-TO-DATE
> Task :app:processReleaseManifestForPackage UP-TO-DATE
> Task :app:processReleaseResources UP-TO-DATE
> Task :app:compileReleaseKotlin UP-TO-DATE
> Task :app:compileReleaseJavaWithJavac UP-TO-DATE
> Task :app:mergeReleaseArtProfile UP-TO-DATE
> Task :app:expandReleaseArtProfileWildcards UP-TO-DATE
> Task :app:mergeReleaseGeneratedProguardFiles UP-TO-DATE
> Task :app:processReleaseJavaRes UP-TO-DATE
> Task :app:mergeReleaseJavaResource UP-TO-DATE
> Task :app:minifyReleaseWithR8 UP-TO-DATE
> Task :app:compileReleaseArtProfile UP-TO-DATE
> Task :app:mergeReleaseAssets UP-TO-DATE
> Task :app:compressReleaseAssets UP-TO-DATE
> Task :app:generateReleaseLintVitalReportModel UP-TO-DATE
> Task :app:lintVitalAnalyzeRelease UP-TO-DATE
> Task :app:lintVitalReportRelease UP-TO-DATE
> Task :app:lintVitalRelease
> Task :app:convertShrunkResourcesToBinaryRelease UP-TO-DATE
> Task :app:optimizeReleaseResources UP-TO-DATE
> Task :app:packageRelease UP-TO-DATE
> Task :app:createReleaseApkListingFileRedirect UP-TO-DATE
> Task :app:assembleRelease UP-TO-DATE

[Incubating] Problems report is available at: file:///C:/dev/folio-v2-greenfield/apps/mobile/android/build/reports/problems/problems-report.html

Deprecated Gradle features were used in this build, making it incompatible with Gradle 10.

You can use '--warning-mode all' to show the individual deprecation warnings and determine if they come from your own scripts or plugins.

For more on this, please refer to https://docs.gradle.org/9.3.1/userguide/command_line_interface.html#sec:command_line_warnings in the Gradle documentation.

BUILD SUCCESSFUL in 11m 18s
578 actionable tasks: 461 executed, 117 up-to-date
```

Exit code: 0

## EAS config/auth check

```text
EAS config file: apps/mobile/eas.json
{
  "cli": {
    "appVersionSource": "local",
    "version": ">= 20.3.0"
  },
  "build": {
    "development": {
      "channel": "development",
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "channel": "preview",
      "distribution": "internal"
    },
    "tester": {
      "channel": "tester",
      "developmentClient": false,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "channel": "production"
    }
  }
}
Progress: resolved 1, reused 0, downloaded 0, added 0
Progress: resolved 85, reused 85, downloaded 0, added 0
Progress: resolved 192, reused 189, downloaded 2, added 0
Progress: resolved 461, reused 456, downloaded 5, added 0
Progress: resolved 463, reused 458, downloaded 5, added 0
[WARN] 10 deprecated subdependencies found: @xmldom/xmldom@0.7.13, glob@10.5.0, glob@6.0.4, inflight@1.0.6, lodash.get@4.4.2, rimraf@2.4.5, tar@7.5.7, uuid@7.0.3, uuid@8.3.2, uuid@9.0.1
Packages: +465
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 465, reused 460, downloaded 5, added 0
Progress: resolved 465, reused 460, downloaded 5, added 140
Progress: resolved 465, reused 460, downloaded 5, added 288
Progress: resolved 465, reused 460, downloaded 5, added 390
Progress: resolved 465, reused 460, downloaded 5, added 465, done
Not logged in
```

Exit code: 1

## Install release APK on emulator

```text
Performing Streamed Install
Success
Success
  bash arg: -p
  bash arg: com.folio.v2.greenfield
  bash arg: -c
  bash arg: android.intent.category.LAUNCHER
  bash arg: 1
args: [-p, com.folio.v2.greenfield, -c, android.intent.category.LAUNCHER, 1]
 arg: "-p"
 arg: "com.folio.v2.greenfield"
 arg: "-c"
 arg: "android.intent.category.LAUNCHER"
 arg: "1"
data="com.folio.v2.greenfield"
data="android.intent.category.LAUNCHER"
Events injected: 1
## Network stats: elapsed time=67ms (0ms mobile, 0ms wifi, 67ms not connected)
```

Install exit code: 0

## Clean launch logcat scan

```text
FATAL EXCEPTION=False
ReactNativeJS: Error=False
Unable to load script=False
DevLauncher=False
DevMenu=False
Metro=False
ANR=False
```

## Persistence restart check

```text
  bash arg: -p
  bash arg: com.folio.v2.greenfield
  bash arg: -c
  bash arg: android.intent.category.LAUNCHER
  bash arg: 1
args: [-p, com.folio.v2.greenfield, -c, android.intent.category.LAUNCHER, 1]
 arg: "-p"
 arg: "com.folio.v2.greenfield"
 arg: "-c"
 arg: "android.intent.category.LAUNCHER"
 arg: "1"
data="com.folio.v2.greenfield"
data="android.intent.category.LAUNCHER"
Events injected: 1
## Network stats: elapsed time=125ms (0ms mobile, 0ms wifi, 125ms not connected)
```

## Data Control export/clear runtime check

```text
Tap Prepare export file
Export prepared=False
No export file prepared=False
folio-local-export=True
Export preview=True
User-owned=True
Prepare export file=True
```

Tap Clear records after arming
Local records were cleared=True
workspace is empty=True
not a confirmed zero bank balance=True
0 visible rows=False
Already empty=True
Data control screen=True
Local mode. Saved on this device=True

## Offline surface smoke

```text
Today screen=True
Melo noticed=True
empty local baseline=True
not a confirmed bank balance=True
�0=True
```
