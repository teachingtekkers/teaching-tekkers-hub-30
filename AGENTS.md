# Agent rules

- Booking CSV imports go through the `booking-import` function (preview → commit); matching logic lives in `supabase/functions/booking-import/logic.ts` with tests in `src/test/bookingImportLogic.test.ts`. Why: one tested place decides identity and protects app-side edits.
- Participant identity is source participant ID, else name + DOB + guardian contact, scoped to an explicit source camp ID; never row position or "Sr. No". Why: CSVs have no stable row IDs and get reordered.
- Imports only overwrite a field when it still equals the value the previous import wrote (`synced_bookings.source_values`). Why: preserves staff edits to payments, kit and notes.
