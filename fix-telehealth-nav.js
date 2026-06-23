const fs = require("fs");

// Add to sidebar under Schedule section
let sidebar = fs.readFileSync("components/layout/Sidebar.tsx", "utf8");
sidebar = sidebar.replace(
  `        { label: "Telehealth", href: "/dashboard/telehealth" },`,
  `        { label: "Telehealth", href: "/dashboard/telehealth" },
        { label: "Telehealth Settings", href: "/dashboard/settings/telehealth" },`
);
fs.writeFileSync("components/layout/Sidebar.tsx", sidebar);

// Add to settings page
let settings = fs.readFileSync("app/dashboard/settings/page.tsx", "utf8");
settings = settings.replace(
  `  {
    href: "/dashboard/settings/billing",`,
  `  {
    href: "/dashboard/settings/telehealth",
    icon: "🎥",
    title: "Telehealth",
    desc: "Connect Daily.co, Doxy.me, Zoom, VSee, or GoTo Meeting",
    color: "border-blue-100 hover:border-blue-300 hover:bg-blue-50",
  },
  {
    href: "/dashboard/settings/billing",`
);
fs.writeFileSync("app/dashboard/settings/page.tsx", settings);

console.log("Done");
