const fs = require("fs");
let c = fs.readFileSync("app/onboarding/page.tsx", "utf8");
const oldPlans = `const PLANS = [
  {
    id: "starter",
    label: "Starter",
    price: 199,
    desc: "1 clinician \u00b7 Up to 10 clients \u00b7 1 location",
    features: ["Session notes", "Basic data collection", "Progress reports", "Email support"],
  },
  {
    id: "professional",`;
const newPlans = `const PLANS = [
  {
    id: "starter",
    label: "Starter",
    price: 199,
    desc: "1 clinician \u00b7 Up to 10 clients \u00b7 1 location",
    features: ["Session notes", "Basic data collection", "Progress reports", "Email support"],
  },
  {
    id: "basic",
    label: "Basic",
    price: 299,
    desc: "Up to 3 clinicians \u00b7 Up to 25 clients \u00b7 1 location",
    features: ["Everything in Starter", "AI session notes", "Parent portal", "Priority support"],
  },
  {
    id: "professional",`;
c = c.replace(oldPlans, newPlans);
fs.writeFileSync("app/onboarding/page.tsx", c, "utf8");
console.log("replaced:", c.includes('id: "basic"'));
