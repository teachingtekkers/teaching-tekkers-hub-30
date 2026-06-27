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
            "You are reading a photo or screenshot of a football coaching WEEKLY ROSTER. The image may list MULTIPLE camps/clubs running in the same week — each typically as its own section, table, column, or block with a heading like the club/venue name. For EACH camp section, list the coaches working there, which days they work, and their role (Head Coach / Coach / Helper).\n\nReturn one entry per camp in the `camps` array. Put coaches under the camp section they appear in. Do not merge coaches from different camps into one camp. Do not invent information.\n\nDays: use Mon, Tue, Wed, Thu, Fri, Sat, Sun. If the sheet uses dates/day numbers instead, map them to the matching weekday name. A coach is working a day when there's a tick / Y / shading / their name in that column. If a single name spans multiple day columns, include all those days.\n\nRoles: normalise to 'head_coach', 'coach', or 'helper'. If unclear, use 'coach'. Words like HC, Head, Lead → head_coach. Asst, Coach, AC → coach. Helper, Junior, Trainee → helper.\n\nWeek label: any date or 'WK1 July'-style text shown for the overall sheet.\nNotes: anything next to a coach name that isn't a day or role (e.g. 'driving', 'half day', 'AM only', 'maybe').",
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