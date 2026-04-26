// Extracts player rows from photos of printed coach sign-in sheets and
// detects ANY coach mark (ticks, cash notes, "paid", "walk-in", initials,
// handwritten amounts, etc.) connected to each printed row. Also extracts
// handwritten walk-in names that appear in margins or blank spaces.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExtractedRow {
  child_name: string;
  // Did the coach mark this row in any way?
  signed_in: "yes" | "no" | "unclear";
  // Best evidence the coach left for this child.
  // tick_on_row | cash_note | paid_note | paid_online_note | paid_revolut_note |
  // handwritten_amount | initials | unpaid_note | none | other
  evidence_type: string;
  // Free-text description of what was seen
  evidence_notes?: string | null;
  // Did the coach explicitly write "unpaid", "owes", "not paid", "outstanding"?
  marked_unpaid: boolean;
  // Confidence 0..1
  confidence: number;
  // Is this a handwritten walk-in (not a printed row)?
  is_walk_in: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "images array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allRows: ExtractedRow[] = [];

    for (const imageDataUrl of images) {
      const body = {
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are reading a photo of a printed football camp COACH SIGN-IN SHEET. Each printed row is a child. Coaches mark sheets messily — they may tick beside the name, tick anywhere on the row, write 'cash', 'paid', 'paid online', 'paid revolut', 'walk', initials, or amounts in any column or margin.\n\nRULE: Signed in = attended. For every printed row, scan LEFT TO RIGHT across the whole row AND nearby margin notes. If there is ANY clear coach mark connected to that child, set signed_in = 'yes'. Ignore the printed 'Paid/Unpaid' text — only handwritten coach marks count.\n\nEvidence types to recognise: tick_on_row, cash_note, paid_note, paid_online_note, paid_revolut_note, handwritten_amount, initials, unpaid_note, other. Use 'none' if no mark.\n\nIf the coach explicitly wrote 'unpaid', 'not paid', 'owes', or 'outstanding' for a child, set marked_unpaid = true (the child still attended).\n\nAlso look for HANDWRITTEN WALK-IN NAMES — names written by hand in blank spaces, margins, or extra rows that are NOT part of the printed list. Return each as a row with is_walk_in = true.\n\nConfidence: 0.9+ for unambiguous marks, 0.6-0.8 for likely, below 0.5 if you are guessing.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract every printed child row AND every handwritten walk-in name from this coach sign-in sheet. For each, report whether the coach signed them in and what evidence you saw." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_rows",
              description: "Submit every child row found on the sheet, including handwritten walk-ins.",
              parameters: {
                type: "object",
                properties: {
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        child_name: { type: "string", description: "Full child name as written" },
                        signed_in: {
                          type: "string",
                          enum: ["yes", "no", "unclear"],
                          description: "Did the coach mark this child as present in any way?",
                        },
                        evidence_type: {
                          type: "string",
                          enum: [
                            "tick_on_row",
                            "cash_note",
                            "paid_note",
                            "paid_online_note",
                            "paid_revolut_note",
                            "handwritten_amount",
                            "initials",
                            "unpaid_note",
                            "other",
                            "none",
                          ],
                        },
                        evidence_notes: { type: "string", description: "Plain-English description of the mark" },
                        marked_unpaid: { type: "boolean", description: "Coach explicitly wrote unpaid/owes/outstanding" },
                        confidence: { type: "number", description: "0.0 to 1.0" },
                        is_walk_in: { type: "boolean", description: "Handwritten name not on the printed list" },
                      },
                      required: ["child_name", "signed_in", "evidence_type", "marked_unpaid", "confidence", "is_walk_in"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["rows"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_rows" } },
      };

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("AI gateway error", resp.status, text);
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit hit. Try again shortly." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `AI extraction failed (${resp.status})` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const json = await resp.json();
      const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = toolCall?.function?.arguments;
      if (argsStr) {
        try {
          const parsed = JSON.parse(argsStr);
          if (Array.isArray(parsed?.rows)) allRows.push(...parsed.rows);
        } catch (e) {
          console.error("Failed to parse tool args", e);
        }
      }
    }

    return new Response(JSON.stringify({ rows: allRows }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-payments error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
