// Extracts player payment rows from photos of printed camp sheets
// using the Lovable AI Gateway (Gemini vision via tool calling).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExtractedRow {
  child_name: string;
  payment_status: "paid" | "unpaid" | "unknown";
  amount_paid?: number | null;
  amount_owed?: number | null;
  cash_marked?: boolean;
  notes?: string | null;
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
              "You read photos of printed football camp attendance/payment sheets. Extract each player row. Detect payment status from columns labelled Paid/Cash/Owed or visible tick/check marks. If a row has a tick/check or 'P' in a paid column, mark paid. If 'unpaid', 'owed', 'no', cross, or empty paid column, mark unpaid. If unclear, mark unknown. Read amounts only if printed clearly.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract every player row from this camp sheet." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_rows",
              description: "Submit the extracted player payment rows.",
              parameters: {
                type: "object",
                properties: {
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        child_name: { type: "string", description: "Full child name as written" },
                        payment_status: {
                          type: "string",
                          enum: ["paid", "unpaid", "unknown"],
                        },
                        amount_paid: { type: "number" },
                        amount_owed: { type: "number" },
                        cash_marked: { type: "boolean" },
                        notes: { type: "string" },
                      },
                      required: ["child_name", "payment_status"],
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
