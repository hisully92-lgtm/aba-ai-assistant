const { withAndroidManifest } = require("@expo/config-plugins");

// Twilio's Video SDK bundles the MediaProjection (screen-share) foreground
// service permission unconditionally, even though this app hasn't wired up
// screen sharing on Android yet. Leaving it in forces an extra Google Play
// "Foreground Service Permissions" declaration (with a demo video) for a
// feature that doesn't actually exist in the app — so we strip it here
// until screen sharing is actually built on Android.
function withoutMediaProjectionPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (Array.isArray(manifest["uses-permission"])) {
      manifest["uses-permission"] = manifest["uses-permission"].filter(
        (perm) => perm.$["android:name"] !== "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"
      );
    }

    // Also strip the mediaProjection foregroundServiceType attribute from any
    // <service> entry Twilio's manifest merges in, if present.
    const application = manifest.application?.[0];
    if (application && Array.isArray(application.service)) {
      application.service.forEach((service) => {
        if (service.$ && service.$["android:foregroundServiceType"] === "mediaProjection") {
          delete service.$["android:foregroundServiceType"];
        }
      });
    }

    return config;
  });
}

module.exports = withoutMediaProjectionPermission;
