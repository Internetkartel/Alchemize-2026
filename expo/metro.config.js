const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports a .wasm binary (wa-sqlite.wasm) as a static
// asset. Metro's default asset extensions don't include wasm, so `expo export
// --platform web` fails to resolve it. withRorkMetro doesn't touch assetExts,
// so this has to be set here.
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];

module.exports = withRorkMetro(config);
