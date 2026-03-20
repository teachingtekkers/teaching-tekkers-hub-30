import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";

interface Block {
  start_time: string;
  end_time: string;
  block_title: string;
  description: string;
  linked_session_title?: string;
}

interface Day {
  day_number: number;
  title: string;
  theme: string;
  next_day_reminder: string;
  setup_notes: string;
  blocks: Block[];
}

interface Itinerary {
  title: string;
  camp_type: string;
  venue: string;
  team_format: string;
  cover_title: string;
  notes: string;
  num_days: number;
}

interface Props {
  itinerary: Itinerary;
  days: Day[];
}

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  const ampm = hr >= 12 ? "pm" : "am";
  const h12 = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${h12}:${m}${ampm}`;
}

// Brand colours matched to TT PDF reference
const BLUE = { r: 38, g: 64, b: 190 }; // royal blue from PDF
const WHITE = { r: 255, g: 255, b: 255 };
const DARK = { r: 30, g: 41, b: 80 };
const MUTED = { r: 80, g: 90, b: 130 };
const LIGHT_BLUE = { r: 230, g: 236, b: 255 };
const ROW_ALT = { r: 245, g: 247, b: 255 };

const PW = 210;
const PH = 297;
const M = 14;
const CW = PW - M * 2;

export default function ItineraryPdfExport({ itinerary, days }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      drawCoverPage(doc, itinerary);

      if (itinerary.notes) {
        doc.addPage();
        drawNotesPage(doc, itinerary);
      }

      for (const day of days) {
        doc.addPage();
        drawDayPage(doc, itinerary, day);
      }

      const filename = (itinerary.title || "Itinerary")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, "_");
      doc.save(`${filename}_Itinerary.pdf`);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={exporting} variant="outline" className="gap-2">
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Export PDF
    </Button>
  );
}

/* ── COVER PAGE ── */
function drawCoverPage(doc: jsPDF, it: Itinerary) {
  // Full blue background
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(0, 0, PW, PH, "F");

  // Football pitch line decorations (white, semi-transparent)
  doc.setDrawColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setGState(doc.GState({ opacity: 0.15 }));

  // Diagonal line top-left to bottom-right
  doc.setLineWidth(3);
  doc.line(-20, -10, 80, 90);

  // Centre circle (lower right area)
  doc.setLineWidth(3);
  doc.ellipse(160, 210, 55, 55);

  // Diagonal through circle
  doc.line(110, 160, 210, 260);

  // Small arc top-right
  doc.setLineWidth(2.5);
  doc.line(PW - 10, 0, PW + 10, 50);

  doc.setGState(doc.GState({ opacity: 1 }));

  // Title text block — centered, stacked
  const coverText = (it.cover_title || it.title || "").toUpperCase();
  const centerY = 95;

  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);

  // "TEACHING TEKKERS" heading
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(36);
  doc.text("TEACHING TEKKERS", PW / 2, centerY, { align: "center" });

  // Camp title (e.g. "HALLOWEEN CAMPS")
  doc.setFontSize(34);
  const titleLines = doc.splitTextToSize(coverText, CW - 10);
  let titleY = centerY + 24;
  for (const line of titleLines) {
    doc.text(line, PW / 2, titleY, { align: "center" });
    titleY += 16;
  }

  // Camp type subtitle
  if (it.camp_type) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "italic");
    doc.setGState(doc.GState({ opacity: 0.85 }));
    doc.text(it.camp_type.toUpperCase(), PW / 2, titleY + 6, { align: "center" });
    doc.setGState(doc.GState({ opacity: 1 }));
    titleY += 14;
  }

  // Team format subtitle
  if (it.team_format) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "italic");
    doc.setGState(doc.GState({ opacity: 0.7 }));
    doc.text(it.team_format, PW / 2, titleY + 4, { align: "center" });
    doc.setGState(doc.GState({ opacity: 1 }));
  }

  // Simulated logo badge (circle with "TT" text)
  const badgeCX = PW / 2;
  const badgeCY = 210;
  const badgeR = 22;

  // Outer ring
  doc.setDrawColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setLineWidth(2);
  doc.setGState(doc.GState({ opacity: 0.9 }));
  doc.circle(badgeCX, badgeCY, badgeR, "S");
  doc.circle(badgeCX, badgeCY, badgeR - 3, "S");

  // Badge text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);

  // Curved "TEACHING" at top — approximate with positioned text
  doc.setFontSize(8);
  doc.text("TEACHING", badgeCX, badgeCY - 14, { align: "center" });
  doc.text("TEKKERS", badgeCX, badgeCY + 17, { align: "center" });

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text("Est. 2019", badgeCX, badgeCY + 3, { align: "center" });

  doc.setGState(doc.GState({ opacity: 1 }));
}

/* ── NOTES PAGE ── */
function drawNotesPage(doc: jsPDF, it: Itinerary) {
  // Blue header bar
  drawDayHeader(doc, "NOTES & INSTRUCTIONS", "");

  let y = 42;
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(it.notes, CW - 4);
  doc.text(lines, M + 2, y);
}

/* ── DAY PAGE ── */
function drawDayPage(doc: jsPDF, it: Itinerary, day: Day) {
  const dayLabel = day.title.toUpperCase();
  const themeLabel = day.theme ? day.theme.toUpperCase() : "";
  const headerRight = themeLabel ? `${dayLabel} – ${themeLabel}` : dayLabel;

  drawDayHeader(doc, headerRight, "");

  let y = 42;

  // Setup notes banner
  if (day.setup_notes) {
    doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setGState(doc.GState({ opacity: 0.08 }));
    doc.rect(M, y, CW, 12, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const setupLines = doc.splitTextToSize(day.setup_notes, CW - 8);
    const setupH = Math.max(12, setupLines.length * 4 + 6);

    // Redraw background with correct height
    doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setGState(doc.GState({ opacity: 0.08 }));
    doc.rect(M, y, CW, setupH, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text(setupLines, M + 4, y + 5);
    y += setupH + 3;
  }

  // Schedule table
  const timeW = 38;
  const descW = CW - timeW;

  for (let i = 0; i < day.blocks.length; i++) {
    const block = day.blocks[i];

    // Calculate row height
    doc.setFontSize(8.5);
    const titleText = block.block_title;
    const descText = block.description || "";
    const descLines = descText ? doc.splitTextToSize(descText, descW - 8) : [];
    const sessionLine = block.linked_session_title ? 1 : 0;
    const titleLines = doc.splitTextToSize(titleText, descW - 8);
    const totalTextLines = titleLines.length + descLines.length + sessionLine;
    const rowH = Math.max(10, totalTextLines * 4.2 + 6);

    // Page break check
    if (y + rowH > PH - 20) {
      doc.addPage();
      drawDayHeader(doc, headerRight + " (cont.)", "");
      y = 42;
    }

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(ROW_ALT.r, ROW_ALT.g, ROW_ALT.b);
      doc.rect(M, y, CW, rowH, "F");
    }

    // Time cell — blue background
    doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setGState(doc.GState({ opacity: 0.1 }));
    doc.rect(M, y, timeW, rowH, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    // Row border
    doc.setDrawColor(200, 210, 230);
    doc.setLineWidth(0.2);
    doc.line(M, y + rowH, M + CW, y + rowH);

    // Vertical divider
    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setLineWidth(0.5);
    doc.line(M + timeW, y, M + timeW, y + rowH);

    // Time text
    const timeStr = formatTime(block.start_time) +
      (block.end_time ? `-${formatTime(block.end_time)}` : "");
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(timeStr, M + timeW / 2, y + rowH / 2 + 1, { align: "center" });

    // Content — title bold, description normal
    let textY = y + 5;
    doc.setTextColor(DARK.r, DARK.g, DARK.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    for (const tl of titleLines) {
      doc.text(tl, M + timeW + 4, textY);
      textY += 4.2;
    }

    if (descLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      for (const dl of descLines) {
        doc.text(dl, M + timeW + 4, textY);
        textY += 4.2;
      }
    }

    if (block.linked_session_title) {
      doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.text(`Session: ${block.linked_session_title}`, M + timeW + 4, textY);
    }

    y += rowH;
  }

  // Next day reminder
  if (day.next_day_reminder) {
    y += 5;
    if (y > PH - 18) {
      doc.addPage();
      y = M;
    }
    doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setGState(doc.GState({ opacity: 0.12 }));
    doc.rect(M, y, CW, 10, "F");
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`Tomorrow: ${day.next_day_reminder}`, M + 4, y + 6.5);
  }
}

/* ── SHARED: Day header bar ── */
function drawDayHeader(doc: jsPDF, rightText: string, _leftText: string) {
  // Blue header bar matching PDF style
  const barH = 30;
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(0, 0, PW, barH, "F");

  // "TEACHING TEKKERS" left side with slight indent
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(16);
  doc.text("TEACHING", M + 2, 14);
  doc.text("TEKKERS", M + 2, 24);

  // Diagonal accent slash between brand name and day title
  doc.setDrawColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setLineWidth(2);
  doc.setGState(doc.GState({ opacity: 0.4 }));
  doc.line(60, 0, 72, barH);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Day title on right side
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(rightText, PW - M - 2, 20, { align: "right" });
}
