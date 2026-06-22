const fs = require("fs");
let content = fs.readFileSync("app/dashboard/student-hub/page.tsx", "utf8");

const oldLink = `        <Link href="/dashboard/supervisor-hours?filter=pending">
          <div className={\`border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all \${pendingCount > 0 ? "bg-yellow-50 border-yellow-100 text-yellow-700" : "bg-gray-50 border-gray-100 text-gray-500"}\`}>
            <p className="text-xs font-semibold uppercase">Pending Review</p>
            <p className="text-3xl font-bold mt-1">{pendingCount}</p>
            {pendingCount > 0 && <p className="text-xs mt-1">Awaiting supervisor →</p>}
          </div>
        </Link>`;

const newDiv = `        <div onClick={() => { setActiveTab("tracker"); setFilterStatus("pending"); }}
          className={\`border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all \${pendingCount > 0 ? "bg-yellow-50 border-yellow-100 text-yellow-700" : "bg-gray-50 border-gray-100 text-gray-500"}\`}>
          <p className="text-xs font-semibold uppercase">Pending Review</p>
          <p className="text-3xl font-bold mt-1">{pendingCount}</p>
          {pendingCount > 0 && <p className="text-xs mt-1">Awaiting supervisor →</p>}
        </div>`;

content = content.replace(oldLink, newDiv);

// Remove unused Link import if no other hrefs use it
content = content.replace(`import Link from "next/link";\n`, "");

fs.writeFileSync("app/dashboard/student-hub/page.tsx", content);
console.log("Done");
