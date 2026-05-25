import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfigured: missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: body.prompt || "Generate a clinical note",
        },
      ],
    });

    return NextResponse.json({
      text: result.choices[0]?.message?.content ?? "",
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to generate note" },
      { status: 500 }
    );
  }
}