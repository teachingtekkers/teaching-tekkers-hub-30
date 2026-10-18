import { describe, expect, it } from "vitest";
import { parseBookingCsv } from "../lib/bookingCsv";
import { planImport } from "../../supabase/functions/_shared/booking-logic";

describe("booking CSV logical records", () => {
  it("retains all 20 children and aligns every column across BOM, CRLF, multiline fields and escaped quotes", () => {
    const records = Array.from({ length: 20 }, (_, i) => {
      const notes = i === 12 ? '"Synthetic note, first line\r\nsecond ""quoted"" line\r\nthird line"' : '"No notes"';
      return `${i + 1},Child${i + 1},Synthetic,29/02/2016,guardian${i + 1}@example.test,${notes},85,0,Yes`;
    });
    const parsed = parseBookingCsv('\uFEFFSr. No,First Name,Last Name,DOB,Email,Medical Additional Information,Total Amount,Amount Paid,Photo Permission\r\n' + records.join('\r\n') + '\r\n');
    expect(parsed.rows).toHaveLength(20);
    parsed.rows.forEach((row, i) => {
      expect(row["Sr. No"]).toBe(String(i + 1));
      expect(row["First Name"]).toBe(`Child${i + 1}`);
      expect(row["Email"]).toBe(`guardian${i + 1}@example.test`);
      expect(row["Total Amount"]).toBe("85");
      expect(row["Amount Paid"]).toBe("0");
      expect(row["Photo Permission"]).toBe("Yes");
    });
    expect(parsed.rows[12]["Medical Additional Information"]).toBe('Synthetic note, first line\r\nsecond "quoted" line\r\nthird line');
    const plan = planImport(parsed.rows.map((row) => ({
      child_first_name: row["First Name"], child_last_name: row["Last Name"],
      date_of_birth: row.DOB, parent_email: row.Email,
      medical_notes: row["Medical Additional Information"], total_amount: row["Total Amount"], amount_paid: row["Amount Paid"],
    })), []);
    expect(plan).toHaveLength(20);
    expect(plan.filter((row) => row.classification === "new")).toHaveLength(20);
    expect(plan[12].normalized.child_first_name).toBe("Child13");
    expect(plan[12].normalized.total_amount).toBe(85);
  });
  it.each([",", ";", "\t"])("detects %j delimiter without counting delimiters inside quotes", (delimiter) => {
    const parsed = parseBookingCsv(`Name${delimiter}Notes${delimiter}Total\nChild${delimiter}"a,b;c\td\nnext line"${delimiter}85`);
    expect(parsed.headers).toEqual(["Name", "Notes", "Total"]);
    expect(parsed.rows).toEqual([{ Name: "Child", Notes: "a,b;c\td\nnext line", Total: "85" }]);
  });
  it("ignores only empty records, not newlines inside a quoted field", () => {
    expect(parseBookingCsv('Name,Notes\n\nChild,"one\n\nthree"\n,\n').rows).toEqual([{ Name: "Child", Notes: "one\n\nthree" }]);
  });
  it.each(['Name,Notes\nChild,"unterminated', 'Name,Notes\nChild,"note"broken'])('rejects invalid quoting: %j', (text) => {
    expect(() => parseBookingCsv(text)).toThrow(/quoting/);
  });
  it.each(['Name,Total\nChild', 'Name,Total\nChild,85,extra'])('rejects misaligned columns instead of dropping cells: %j', (text) => {
    expect(() => parseBookingCsv(text)).toThrow(/columns/);
  });
  it.each(['Name,Name\nChild,85', ',Total\nChild,85'])('rejects ambiguous headers: %j', (text) => {
    expect(() => parseBookingCsv(text)).toThrow(/headers/);
  });
});