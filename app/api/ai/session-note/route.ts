import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      client_name,
      behaviors_observed,
      interventions_used,
      client_response,
      programs_targeted,
      date,
      staff_member,
    } = body;

    const prompt = `
You are an expert ABA clinical documentation assistant.

Write a professional ABA session note.

Use this structure:

1. Objective Summary
2. Target Behaviors
3. Interventions Applied
4. Client Response
5. Skill Acquisition / Programs
6. Clinical Analysis
7. Recommendations for Next Session

Keep tone:
- clinical
- objective
- insurance-ready
- concise but detailed

SESSION DATA:
Client: ${client_name}
Staff: ${staff_member || "Not specified"}
Date: ${date || "Not specified"}

Behaviors Observed:
${behaviors_observed}

Interventions Used:
${interventions_used}

Client Response:
${client_response}

Programs Targeted:
${programs_targeted}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You generate ABA clinical documentation for therapy sessions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
    });

    const result =
      completion.choices[0]?.message?.content ||
      "No response generated.";

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 500 }
    );
  }
}