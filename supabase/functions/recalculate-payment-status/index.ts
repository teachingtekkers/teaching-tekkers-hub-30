import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch all synced_bookings with finance fields
    const PAGE = 1000;
    let allRows: any[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("synced_bookings")
        .select("id, total_amount, sibling_discount, amount_paid, refund_amount, payment_status, amount_owed")
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    const counts = { paid: 0, pending: 0, partial: 0, refunded: 0, total: allRows.length, changed: 0 };

    const BATCH = 50;
    for (let i = 0; i < allRows.length; i += BATCH) {
      const batch = allRows.slice(i, i + BATCH);
      const updates: Promise<any>[] = [];

      for (const row of batch) {
        const totalAmount = Number(row.total_amount) || 0;
        const siblingDiscount = Number(row.sibling_discount) || 0;
        const amountPaid = Number(row.amount_paid) || 0;
        const refundAmount = Number(row.refund_amount) || 0;

        const totalCost = Math.max(0, totalAmount - siblingDiscount);
        const owed = Math.max(0, totalCost - amountPaid - refundAmount);

        let newStatus: string;
        if (refundAmount > 0 && amountPaid <= 0) {
          newStatus = "refunded";
        } else if (owed <= 0 && totalCost > 0) {
          newStatus = "paid";
        } else if (amountPaid > 0 && owed > 0) {
          newStatus = "partial";
        } else {
          newStatus = "pending";
        }

        counts[newStatus as keyof typeof counts] = (counts[newStatus as keyof typeof counts] as number) + 1;

        if (row.payment_status !== newStatus || Number(row.amount_owed) !== owed) {
          counts.changed++;
          updates.push(
            supabase
              .from("synced_bookings")
              .update({ payment_status: newStatus, amount_owed: owed })
              .eq("id", row.id)
              .then(({ error }) => {
                if (error) console.error(`Failed to update ${row.id}:`, error.message);
              }),
          );
        }
      }

      await Promise.all(updates);
    }

    return new Response(JSON.stringify({ success: true, counts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("recalculate-payment-status error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
