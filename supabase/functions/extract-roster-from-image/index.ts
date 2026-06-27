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
            "You are reading a photo or screenshot of a football coaching camp WEEKLY ROSTER. It lists which coaches are working at which camp/club for the week, on which days, and in what role (Head Coach / Coach / Helper).\n\nReturn structured data describing the roster. If a value is not visible, leave it blank or omit it. Do not invent information.\n\nDays: use the names that appear (Mon, Tue, Wed, Thu, Fri, Sat, Sun). If the roster shows day numbers/dates instead, return the matching weekday name. If a coach is marked as working a day with any tick / Y / shading / their name in a column, count it.\n\nRoles: normalise to one of 'head_coach', 'coach', or 'helper'. If unclear, use 'coach'.\n\nCamp name: the club or venue name. Week label: any date or 'WK1 July' style text shown. Notes: anything written next to the coach name that isn't a day or role (e.g. 'driving', 'half day', 'AM only').",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the roster from this image." },
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
                camp_name: { type: "string", description: "Club or camp name shown on the roster" },
                week_label: { type: "string", description: "Any week/date text shown (e.g. 'WK1 July', '6 Jul 2026')" },
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
    let parsed: { camp_name?: string; week_label?: string; coaches?: unknown[] } = {};
    if (argsStr) {
      try { parsed = JSON.parse(argsStr); } catch (e) { console.error("parse error", e); }
    }

    return new Response(JSON.stringify({
      camp_name: parsed.camp_name || "",
      week_label: parsed.week_label || "",
      coaches: Array.isArray(parsed.coaches) ? parsed.coaches : [],
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