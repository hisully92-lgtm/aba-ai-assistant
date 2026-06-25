const fs = require("fs");
let c = fs.readFileSync("app/onboarding/page.tsx", "utf8");
c = c.replace(
  '    id: "professional",\n    label: "Professional",\n    price: 449,',
  '    id: "basic",\n    label: "Basic",\n    price: 299,\n    desc: "Up to 3 clinicians \u00b7 Up to 25 clients \u00b7 1 location",\n    features: ["Everything in Starter", "AI session notes", "Parent portal", "Priority support"],\n  },\n  {\n    id: "professional",\n    label: "Professional",\n    price: 449,'
);
fs.writeFileSync("app/onboarding/page.tsx", c, "utf8");
console.log("Done");
