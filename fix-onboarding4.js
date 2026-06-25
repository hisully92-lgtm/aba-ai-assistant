const fs = require("fs");
let c = fs.readFileSync("app/onboarding/page.tsx", "utf8");

// Find the PLANS array and replace it entirely
const start = c.indexOf("const PLANS = [");
const end = c.indexOf("];", start) + 2;
const newPlans = `const PLANS = [
  {
    id: "starter",
    label: "Starter",
    price: 199,
    desc: "1 clinician · Up to 10 clients · 1 location",
    features: ["Session notes", "Basic data collection", "Progress reports", "Email support"],
  },
  {
    id: "basic",
    label: "Basic",
    price: 299,
    desc: "Up to 3 clinicians · Up to 25 clients · 1 location",
    features: ["Everything in Starter", "AI session notes", "Parent portal", "Priority support"],
  },
  {
    id: "professional",
    label: "Professional",
    price: 449,
    desc: "Up to 5 clinicians · Unlimited clients · 2 locations",
    features: ["Everything in Basic", "AI session notes", "Insurance billing", "Priority support"],
  },
  {
    id: "growth",
    label: "Growth",
    price: 649,
    desc: "Up to 25 clinicians · Unlimited clients · 5 locations",
    features: ["Everything in Professional", "Advanced reporting", "Multi-location dashboard", "Onboarding support"],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: 849,
    desc: "Up to 75 clinicians · Unlimited clients · 15 locations",
    features: ["Everything in Growth", "EDI 837 claims", "QuickBooks integration", "Custom branding"],
  },
  {
    id: "clinic",
    label: "Clinic",
    price: 1099,
    desc: "Unlimited clinicians · Unlimited clients · Unlimited locations",
    features: ["Everything in Enterprise", "White-label options", "API access", "Priority dedicated support"],
  },
];`;
c = c.slice(0, start) + newPlans + c.slice(end);
fs.writeFileSync("app/onboarding/page.tsx", c, "utf8");
console.log("done, has basic:", c.includes('id: "basic"'));
