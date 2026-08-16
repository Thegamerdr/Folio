// Clerk's web bundle depends on Solana wallet adapters, which in turn publish an Android native
// package. Melo uses Clerk's email-code flow and never imports the wallet adapter, but Expo's deep
// autolinker still discovers that transitive module in the hoisted workspace. Excluding it keeps the
// native graph equal to apps/mobile/package.json instead of compiling an unrelated crypto-wallet SDK.
module.exports = {
  dependencies: {
    '@solana-mobile/mobile-wallet-adapter-protocol': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
