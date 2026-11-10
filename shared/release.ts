export const releaseVersion = "1.3.0";
export const releaseLabel = `v${releaseVersion.split(".").slice(0, 2).join(".")}`;
// Default closed for v2+. Keep package.json and this version aligned (tested).
export function publicDashboardAllowed(
  version = releaseVersion,
  enabled = true,
) {
  return enabled && version.startsWith("1.");
}
