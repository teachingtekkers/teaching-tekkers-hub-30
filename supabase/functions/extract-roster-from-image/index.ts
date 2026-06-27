// Extracts a weekly coaching roster from a screenshot/photo.
// Returns: camp/club, week label, and a list of coach assignments
// (name, role, days worked, notes). Frontend handles matching to existing
// camps and coach profiles.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (typeof image !== "string" || !image.startsWith("data:image")) {
      return new Response(JSON.stringify({ error: "image (data URL) required" }), {
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

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            [
              "You are reading a photo or screenshot of a football coaching WEEKLY ROSTER.",
              "The image lists MULTIPLE camps/clubs running in the same week. Each camp is its own section with a centered heading like 'ST. ANTHONY'S KILCOOLE (78 KIDS)' or 'DUNBOYNE (65 KIDS)'. Under that heading is a grid of coach names (rows) × weekdays (columns: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, sometimes FRIDAY).",
              "Return ONE entry per camp section in the `camps` array. The `camp_name` is the section heading WITHOUT the '(NN KIDS)' suffix. Strip the kid count.",
              "",
              "CELL COLOUR MEANING (very important):",
              "- GREEN cell = the coach IS working that day. Include this day in `days`.",
              "- RED cell = the coach is NOT available / NOT working that day. DO NOT include this day in `days`.",
              "- YELLOW / AMBER cell = tentative or 'maybe'. INCLUDE the day in `days` AND append 'tentative <Day>' to the coach's `notes`.",
              "- Empty / white / no fill = NOT working that day.",
              "Always include only the days actually worked. A coach with green Mon+Tue and red Wed+Thu has days=['Mon','Tue'].",
              "",
              "ROLE / DRIVER PARSING (from the name cell):",
              "Names often have a suffix after a dash, e.g. 'CRAIG STAUNTON - HC/D', 'AARON FALVEY - D', 'EVAN WYNNE - HC', 'LUKE MAHER - HC'.",
              "- 'HC' → role = 'head_coach'.",
              "- 'D' → the coach drives this week. Add 'driving' to the `notes` (do not change the role for 'D' alone).",
              "- 'HC/D' → role = 'head_coach' AND add 'driving' to notes.",
              "- No suffix → role = 'coach'.",
              "- Other suffixes: 'Helper', 'Junior', 'Trainee' → role = 'helper'.",
              "Always strip the role/driver suffix from the returned `name`. Return clean names like 'Craig Staunton', 'Aaron Falvey', 'Evan Wynne'.",
              "",
              "DAYS: return only weekday names from this list: Mon, Tue, Wed, Thu, Fri, Sat, Sun. Map MONDAY→Mon, TUESDAY→Tue, WEDNESDAY→Wed, THURSDAY→Thu, FRIDAY→Fri.",
              "WEEK LABEL: any 'W/C 29th June' or 'WK1 July' style text shown for the overall sheet — return it verbatim.",
              "Do not invent coaches or camps. Only return what is visibly on the image.",
            ].join("\n"),
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract every camp on this roster and list each camp's coaches separately." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "submit_roster",
            description: "Submit the parsed roster.",
            parameters: {
              type: "object",
              properties: {
                week_label: { type: "string", description: "Any week/date text shown (e.g. 'WK1 July', '6 Jul 2026')" },
                camps: {
                  type: "array",
                  description: "One entry per camp/club section shown on the image.",
                  items: {
                    type: "object",
                    properties: {
                      camp_name: { type: "string", description: "Club or venue name for this camp section" },
                      coaches: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            role: { type: "string", enum: ["head_coach", "coach", "helper"] },
                            days: {
                              type: "array",
                              items: { type: "string", enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
                            },
                            notes: { type: "string" },
                          },
                          required: ["name", "role", "days"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["camp_name", "coaches"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["camps"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_roster" } },
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
    const argsStr = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: {
      week_label?: string;
      camps?: Array<{ camp_name?: string; coaches?: unknown[] }>;
    } = {};
    if (argsStr) {
      try { parsed = JSON.parse(argsStr); } catch (e) { console.error("parse error", e); }
    }

    const camps = Array.isArray(parsed.camps)
      ? parsed.camps.map((c) => ({
          camp_name: c?.camp_name || "",
          coaches: Array.isArray(c?.coaches) ? c.coaches : [],
        }))
      : [];

    return new Response(JSON.stringify({
      week_label: parsed.week_label || "",
      camps,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-roster error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});