import Papa from "papaparse";

export interface BookingCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Parse logical records, not physical lines. Never accept truncated/misaligned rows. */
export function parseBookingCsv(text: string): BookingCsv {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    header: false,
    dynamicTyping: false,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t"],
  });
  const errors = result.errors.filter((error) => error.code !== "UndetectableDelimiter");
  if (errors.length) throw new Error("Invalid CSV quoting. Check the export and upload it again; no preview was created.");
  const [rawHeaders, ...records] = result.data;
  if (!rawHeaders) return { headers: [], rows: [] };
  const headers = rawHeaders.map((header) => header
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[""'']/g, "")
    .replace(/\s+/g, " ")
    .trim());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new Error("CSV headers are blank or duplicated. Check the export before previewing.");
  }
  const rows = records.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV record ${index + 1} has ${values.length} columns; expected ${headers.length}. No preview was created.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
  return { headers, rows };
}