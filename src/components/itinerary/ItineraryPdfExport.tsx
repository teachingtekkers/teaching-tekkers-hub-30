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

async function loadImage(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Brand colours from reference PDF
const DARK_BLUE = { r: 27, g: 43, b: 139 };
const LIGHT_BLUE = { r: 0, g: 113, b: 193 };
const WHITE = { r: 255, g: 255, b: 255 };
const DARK = { r: 30, g: 41, b: 80 };
const MUTED = { r: 80, g: 90, b: 130 };
const ROW_ALT = { r: 242, g: 244, b: 252 };

const PW = 210;
const PH = 297;
const M = 12;
const CW = PW - M * 2;

export default function ItineraryPdfExport({ itinerary, days }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Load background images
      let coverBg: string | null = null;
      let headerBg: string | null = null;
      let logoBg: string | null = null;
      try {
        [coverBg, headerBg, logoBg] = await Promise.all([
          loadImage("/tt-cover-bg.jpg"),
          loadImage("/tt-day-header.jpg"),
          loadImage("/tt-logo-cover.png"),
        ]);
      } catch {
        // Fallback to drawn version if images fail
      }

      drawCoverPage(doc, itinerary, coverBg, logoBg);

      if (itinerary.notes) {
        doc.addPage();
        drawNotesPage(doc, itinerary, headerBg);
      }

      for (const day of days) {
        doc.addPage();
        drawDayPage(doc, itinerary, day, headerBg);
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
function drawCoverPage(doc: jsPDF, it: Itinerary, coverBg: string | null, logoBg: string | null) {
  if (coverBg) {
    doc.addImage(coverBg, "JPEG", 0, 0, PW, PH);
  } else {
    doc.setFillColor(DARK_BLUE.r, DARK_BLUE.g, DARK_BLUE.b);
    doc.rect(0, 0, PW, PH, "F");
  }

  // Single title: "TEACHING TEKKERS EASTER CAMPS 2026"
  const rawTitle = (it.cover_title || it.title || "").toUpperCase();
  const fullTitle = rawTitle.startsWith("TEACHING TEKKERS")
    ? rawTitle
    : `TEACHING TEKKERS ${rawTitle}`;

  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont("helvetica", "bold");

  let fontSize = 30;
  doc.setFontSize(fontSize);
  let titleLines = doc.splitTextToSize(fullTitle, CW - 20);
  while (titleLines.length > 3 && fontSize > 18) {
    fontSize -= 2;
    doc.setFontSize(fontSize);
    titleLines = doc.splitTextToSize(fullTitle, CW - 20);
  }

  const lineH = fontSize * 0.52;
  const titleBlockH = titleLines.length * lineH;
  const titleStartY = 85 - titleBlockH / 2;

  for (let i = 0; i < titleLines.length; i++) {
    doc.text(titleLines[i], PW / 2, titleStartY + i * lineH, { align: "center" });
  }

  // Logo centered below title with no boxed background
  if (logoBg) {
    const logoW = 48;
    const logoH = logoW;
    const logoX = (PW - logoW) / 2;
    const logoY = titleStartY + titleBlockH + 10;
    doc.addImage(logoBg, "PNG", logoX, logoY, logoW, logoH);
  }
}

/* ── NOTES PAGE ── */
function drawNotesPage(doc: jsPDF, it: Itinerary, headerBg: string | null) {
  drawDayHeader(doc, "NOTES & INSTRUCTIONS", headerBg);

  let y = 36;
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(it.notes, CW - 4);
  doc.text(lines, M + 2, y);
}

/* ── DAY PAGE ── */
function drawDayPage(doc: jsPDF, _it: Itinerary, day: Day, headerBg: string | null) {
  const dayLabel = day.title.toUpperCase();
  const themeLabel = day.theme ? day.theme.toUpperCase() : "";
  const headerRight = themeLabel ? `${dayLabel} – ${themeLabel}` : dayLabel;

  drawDayHeader(doc, headerRight, headerBg);

  let y = 36;

  // Setup notes banner
  if (day.setup_notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const setupLines = doc.splitTextToSize(day.setup_notes, CW - 8);
    const setupH = Math.max(10, setupLines.length * 4 + 5);

    doc.setFillColor(DARK_BLUE.r, DARK_BLUE.g, DARK_BLUE.b);
    doc.setGState(doc.GState({ opacity: 0.06 }));
    doc.rect(M, y, CW, setupH, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setTextColor(DARK_BLUE.r, DARK_BLUE.g, DARK_BLUE.b);
    doc.text(setupLines, M + 4, y + 5);
    y += setupH + 3;
  }

  // Schedule table
  const timeW = 36;
  const descW = CW - timeW;

  // Table top border
  doc.setDrawColor(DARK_BLUE.r, DARK_BLUE.g, DARK_BLUE.b);
  doc.setLineWidth(0.6);
  doc.line(M, y, M + CW, y);

  for (let i = 0; i < day.blocks.length; i++) {
    const block = day.blocks[i];

    doc.setFontSize(8.5);
    const titleText = block.block_title;
    const descText = block.description || "";
    const descLines = descText ? doc.splitTextToSize(descText, descW - 10) : [];
    const sessionLine = block.linked_session_title ? 1 : 0;
    const titleLines = doc.splitTextToSize(titleText, descW - 10);
    const totalTextLines = titleLines.length + descLines.length + sessionLine;
    const rowH = Math.max(11, totalTextLines * 4.2 + 7);

    // Page break check
    if (y + rowH > PH - 18) {
      doc.addPage();
      drawDayHeader(doc, headerRight + " (cont.)", headerBg);
      y = 36;
    }

    // Row background
    if (i % 2 === 0) {
      doc.setFillColor(ROW_ALT.r, ROW_ALT.g, ROW_ALT.b);
      doc.rect(M, y, CW, rowH, "F");
    }

    // Time cell — dark blue background
    doc.setFillColor(DARK_BLUE.r, DARK_BLUE.g, DARK_BLUE.b);
    doc.rect(M, y, timeW, rowH, "F");

    // Row border
    doc.setDrawColor(200, 210, 230);
    doc.setLineWidth(0.2);
    doc.line(M, y + rowH, M + CW, y + rowH);

    // Time text — white on dark blue
    const timeStr = formatTime(block.start_time) +
      (block.end_time ? `-${formatTime(block.end_time)}` : "");
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(timeStr, M + timeW / 2, y + rowH / 2 + 1, { align: "center" });

    // Content — title bold, description normal, centered vertically
    let textY = y + 5.5;
    doc.setTextColor(DARK.r, DARK.g, DARK.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    for (const tl of titleLines) {
      doc.text(tl, M + timeW + 5, textY);
      textY += 4.2;
    }

    if (descLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      for (const dl of descLines) {
        doc.text(dl, M + timeW + 5, textY);
        textY += 4.2;
      }
    }

    if (block.linked_session_title) {
      doc.setTextColor(LIGHT_BLUE.r, LIGHT_BLUE.g, LIGHT_BLUE.b);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.text(`Session: ${block.linked_session_title}`, M + timeW + 5, textY);
    }

    y += rowH;
  }

  // Table bottom border
  doc.setDrawColor(DARK_BLUE.r, DARK_BLUE.g, DARK_BLUE.b);
  doc.setLineWidth(0.6);
  doc.line(M, y, M + CW, y);

  // Next day reminder
  if (day.next_day_reminder) {
    y += 5;
    if (y > PH - 16) {
      doc.addPage();
      y = M;
    }
    doc.setFillColor(DARK_BLUE.r, DARK_BLUE.g, DARK_BLUE.b);
    doc.setGState(doc.GState({ opacity: 0.1 }));
    doc.roundedRect(M, y, CW, 10, 1.5, 1.5, "F");
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.setTextColor(DARK_BLUE.r, DARK_BLUE.g, DARK_BLUE.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`Tomorrow: ${day.next_day_reminder}`, M + 4, y + 6.5);
  }
}

/* ── SHARED: Day header bar ── */
function drawDayHeader(doc: jsPDF, rightText: string, headerBg: string | null) {
  const barH = 21; // mm height of the header bar

  if (headerBg) {
    // Use the real TT day header artwork (two-tone blue + diagonal separator)
    doc.addImage(headerBg, "JPEG", 0, 0, PW, barH);
  } else {
    // Fallback: draw the two-tone header manually
    // Left panel — lighter blue
    doc.setFillColor(LIGHT_BLUE.r, LIGHT_BLUE.g, LIGHT_BLUE.b);
    doc.rect(0, 0, 65, barH, "F");
    // Right panel — dark blue
    doc.setFillColor(DARK_BLUE.r, DARK_BLUE.g, DARK_BLUE.b);
    doc.rect(65, 0, PW - 65, barH, "F");
  }

  // "TEACHING TEKKERS" on the left panel
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TEACHING", M, 9);
  doc.text("TEKKERS", M, 16);

  // Day title on the right — auto-size to fit
  const maxRightW = PW - 80;
  let fontSize = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);

  // Shrink font if text is too wide
  while (doc.getTextWidth(rightText) > maxRightW && fontSize > 10) {
    fontSize -= 1;
    doc.setFontSize(fontSize);
  }

  doc.text(rightText, PW - M, barH / 2 + fontSize / 6, { align: "right" });
}
