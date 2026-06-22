const fs = require("fs");
let content = fs.readFileSync("components/layout/Sidebar.tsx", "utf8");

// Remove Program Books from Clients / Learners (it belongs under Skill Programs)
content = content.replace(
  `        { label: "Program Books", href: "/dashboard/program-books" },\n        { label: "Add Client", href: "/dashboard/clients/new" },`,
  `        { label: "Add Client", href: "/dashboard/clients/new" },`
);

fs.writeFileSync("components/layout/Sidebar.tsx", content);
console.log("Done");
