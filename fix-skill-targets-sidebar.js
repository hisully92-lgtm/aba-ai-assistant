const fs = require("fs");
let content = fs.readFileSync("components/layout/Sidebar.tsx", "utf8");
content = content.replace(
  `{ label: "Skill Targets", href: "/dashboard/targets" },`,
  `{ label: "Skill Targets", href: "/dashboard/programs/targets" },`
);
fs.writeFileSync("components/layout/Sidebar.tsx", content);
console.log("Done");
