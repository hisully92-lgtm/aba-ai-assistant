import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return NextResponse.json(
        { error: "Missing client_id" },
        { status: 400 }
      );
    }

    // 📦 GET FULL CLIENT HISTORY
    const { data: sessions } = await supabase
      .from("sessions")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(30);

    const history = sessions
      ?.map(
        (s) => `
Date: ${s.date}
Behaviors: ${s.behaviors_observed}
Interventions: ${s.interventions_used}
Response: ${s.client_response}
Programs: ${s.programs_targeted}
---`
      )
      .join("\n");

    // 🧠 AI REPORT GENERATION
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You generate insurance-ready ABA clinical reports.",
        },
        {
          role: "user",
          content: `
Create a formal ABA clinical report.

Include:
1. Client Summary
2. Behavioral Progress
3. Treatment Interventions
4. Response to Treatment
5. Skill Acquisition Summary
6. Clinical Concerns
7. Recommendations
8. Insurance-ready conclusion

SESSION DATA:
${history}
          `,
        },
      ],
      temperature: 0.3,
    });

    const report =
      completion.choices[0]?.message?.content ||
      "No report generated.";

    return NextResponse.json({ report });
  } catch (err) {
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}