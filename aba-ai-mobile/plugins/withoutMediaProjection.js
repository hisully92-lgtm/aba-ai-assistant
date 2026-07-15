const { withAndroidManifest } = require("@expo/config-plugins");

// Twilio's Video SDK bundles the MediaProjection (screen-share) foreground
// service permission unconditionally, even though this app hasn't wired up
// screen sharing on Android yet. That permission gets merged in by Gradle
// from Twilio's own library manifest DURING the native build step — after
// Expo's JS-side manifest mods already ran — so simply filtering it out of
// our own manifest here has no effect; Gradle just re-adds it from Twilio's
// AAR regardless.
//
// The correct fix is Android's actual mechanism for this: adding a
// `tools:node="remove"` marker on the permission in our own manifest, which
// tells Gradle's manifest merger to explicitly drop it even though a
// dependency (Twilio) declares it. This must survive as an *addition*,
// not a removal, for the merge-time instruction to take effect.
function withoutMediaProjectionPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure the "tools" namespace is declared on the manifest root —
    // required for the tools:node attribute to be valid/recognized.
    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    if (!Array.isArray(manifest["uses-permission"])) {
      manifest["uses-permission"] = [];
    }

    // Remove any prior entry for this permission we may have added ourselves
    // (idempotency across multiple prebuild runs), then add the correct
    // merge-time removal instruction.
    manifest["uses-permission"] = manifest["uses-permission"].filter(
      (perm) => perm.$["android:name"] !== "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"
    );

    manifest["uses-permission"].push({
      $: {
        "android:name": "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
        "tools:node": "remove",
      },
    });

    return config;
  });
}

module.exports = withoutMediaProjectionPermission;
