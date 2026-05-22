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

    // 📦 GET SESSION HISTORY
    const { data: sessions } = await supabase
      .from("sessions")
      .select(
        "date, behaviors_observed, interventions_used, client_response, programs_targeted"
      )
      .eq("client_id", client_id)
      .order("date", { ascending: true })
      .limit(50);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        result: "No session data available for timeline analysis.",
      });
    }

    const timelineData = sessions
      .map(
        (s, i) => `
Session ${i + 1}
Date: ${s.date}
Behaviors: ${s.behaviors_observed}
Interventions: ${s.interventions_used}
Response: ${s.client_response}
Programs: ${s.programs_targeted}
---`
      )
      .join("\n");

    // 🧠 AI TIMELINE ANALYSIS
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a clinical ABA data analyst.

Your job:
- detect behavior trends over time
- identify improvement or regression
- flag risks
- summarize skill acquisition progress

Return structured insights:
1. Overall Trend (Improving / Stable / Declining)
2. Behavioral Changes
3. Intervention Effectiveness
4. Risk Flags
5. Clinical Recommendations
6. Summary Score (0–100 progress rating)
          `,
        },
        {
          role: "user",
          content: timelineData,
        },
      ],
      temperature: 0.2,
    });

    const result =
      completion.choices[0]?.message?.content ||
      "No analysis generated.";

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: "Timeline analysis failed" },
      { status: 500 }
    );
  }
}