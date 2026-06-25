const fs = require("fs");
let c = fs.readFileSync("app/onboarding/page.tsx", "utf8");

// Fix PLAN_TIERS basic entry (wrong values copied from starter)
c = c.replace(
  "basic:          { 1: 299, 3: 189, 6: 179, 9: 169, 12: 159 },",
  "basic:          { 1: 299, 3: 284, 6: 269, 9: 254, 12: 239 },"
);

// Add Basic plan to PLANS array
c = c.replace(
  `  {
    id: "professional",
    label: "Professional",
    price: 449,`,
  `  {
    id: "basic",
    label: "Basic",
    price: 299,
    desc: "Up to 3 clinicians · Up to 25 clients · 1 location",
    features: ["Everything in Starter", "AI session notes", "Parent portal", "Priority support"],
  },
  {
    id: "professional",
    label: "Professional",
    price: 449,`
);

fs.writeFileSync("app/onboarding/page.tsx", c, "utf8");
console.log("Done");
