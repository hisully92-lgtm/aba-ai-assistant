const fs = require("fs");
const files = [
  "app/dashboard/interval-recording/page.tsx",
  "app/dashboard/rate-data/page.tsx",
  "app/dashboard/safmeds/page.tsx",
  "app/dashboard/training/course/page.tsx",
  "app/dashboard/visual-supports/page.tsx",
];
files.forEach(f => {
  let c = fs.readFileSync(f, "utf8");
  c = c.replace(/useRef<ReturnType<typeof setInterval> \| null>/g, "useRef<any>");
  c = c.replace(/useRef<ReturnType<typeof setTimeout> \| null>/g, "useRef<any>");
  c = c.replace(/useRef<NodeJS\.Timeout \| null>/g, "useRef<any>");
  c = c.replace(/useRef<number \| null>/g, "useRef<any>");
  fs.writeFileSync(f, c, "utf8");
  console.log("Fixed: " + f);
});
console.log("Done");
