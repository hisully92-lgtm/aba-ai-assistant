import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// server-side supabase (IMPORTANT)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔒 server-only
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { client_id } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: "Missing client_id" },
        { status: 400 }
      );
    }

    // 📦 FETCH CLIENT SESSION HISTORY
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const historyText = sessions
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

    const prompt = `
You are an expert ABA clinical analyst.

Analyze the client's full session history and produce:

1. Behavioral Trends
2. Skill Acquisition Progress
3. Response to Interventions
4. Areas of Concern
5. Strengths
6. Clinical Summary
7. Recommendations for Treatment Plan Adjustment

Be objective, clinical, and concise.

CLIENT SESSION HISTORY:
${historyText}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You analyze ABA clinical data and produce progress summaries.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });

    const result =
      completion.choices[0]?.message?.content ||
      "No summary generated.";

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: "Client summary failed" },
      { status: 500 }
    );
  }
}