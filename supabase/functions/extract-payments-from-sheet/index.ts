// Extracts player rows from photos of printed camp sheets and detects
// MANUAL tick/check marks (the primary signal) using Lovable AI vision.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExtractedRow {
  child_name: string;
  // Manual tick detection — the PRIMARY signal
  attended_tick: "ticked" | "not_ticked" | "unclear";
  paid_tick: "ticked" | "not_ticked" | "unclear";
  tick_confidence: "high" | "medium" | "low";
  tick_notes?: string | null;
  // Secondary signals (printed text / numbers, may be ignored)
  printed_payment_status?: "paid" | "unpaid" | "unknown";
  amount_paid?: number | null;
  amount_owed?: number | null;
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
              "You are reading photos of printed football camp attendance/payment sheets. Each row is a player. The PRIMARY signal you must detect is MANUAL handwritten marks on the sheet — pen/marker ticks, check marks (✓), Xs, slashes, dots, circles, scribbles, or highlighter marks added by hand beside or inside columns. The printed Paid/Unpaid text is SECONDARY — do NOT rely on it as the main signal.\n\nFor every player row, decide:\n- attended_tick: was there a handwritten mark in the attendance/present column or beside the name?\n- paid_tick: was there a handwritten mark in the paid/cash column?\nUse 'ticked' for clear handwritten marks, 'not_ticked' for visibly empty, 'unclear' if you cannot tell (smudged, partial, ambiguous).\nSet tick_confidence to 'high' only when the mark is unambiguous. Use 'low' for faint or ambiguous marks.\nAlso capture printed_payment_status and any printed amounts if visible, but these are secondary.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract every player row from this camp sheet. Focus on detecting MANUAL tick/check marks added by hand." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_rows",
              description: "Submit the extracted player rows with manual tick detection.",
              parameters: {
                type: "object",
                properties: {
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        child_name: { type: "string", description: "Full child name as written" },
                        attended_tick: {
                          type: "string",
                          enum: ["ticked", "not_ticked", "unclear"],
                          description: "Handwritten tick in attendance column / beside name",
                        },
                        paid_tick: {
                          type: "string",
                          enum: ["ticked", "not_ticked", "unclear"],
                          description: "Handwritten tick in paid/cash column",
                        },
                        tick_confidence: {
                          type: "string",
                          enum: ["high", "medium", "low"],
                        },
                        tick_notes: { type: "string", description: "Brief description of the mark seen, e.g. 'pen tick', 'highlighter', 'scribble'" },
                        printed_payment_status: {
                          type: "string",
                          enum: ["paid", "unpaid", "unknown"],
                          description: "Secondary: printed text status",
                        },
                        amount_paid: { type: "number" },
                        amount_owed: { type: "number" },
                      },
                      required: ["child_name", "attended_tick", "paid_tick", "tick_confidence"],
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
