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

// Teaching Tekkers brand blue
const BRAND = { r: 11, g: 107, b: 203 }; // hsl(213,94%,45%) ≈ #0B6BCB
const WHITE = { r: 255, g: 255, b: 255 };
const DARK = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };
const LIGHT_BG = { r: 241, g: 245, b: 249 };

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

export default function ItineraryPdfExport({ itinerary, days }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // ========== COVER PAGE ==========
      drawCoverPage(doc, itinerary);

      // ========== NOTES PAGE (if notes exist) ==========
      if (itinerary.notes) {
        doc.addPage();
        drawNotesPage(doc, itinerary);
      }

      // ========== DAY PAGES ==========
      for (const day of days) {
        doc.addPage();
        drawDayPage(doc, itinerary, day);
      }

      doc.save(`${itinerary.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_Itinerary.pdf`);
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

function drawCoverPage(doc: jsPDF, it: Itinerary) {
  // Full-page blue background
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Subtle accent stripe at top
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.06 }));
  doc.rect(0, 0, PAGE_W, 60, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  // "TEACHING TEKKERS" brand label
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const labelY = 105;
  doc.text("TEACHING TEKKERS", PAGE_W / 2, labelY, { align: "center" });

  // Decorative line
  const lineY = labelY + 6;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.setGState(doc.GState({ opacity: 0.4 }));
  doc.line(PAGE_W / 2 - 30, lineY, PAGE_W / 2 + 30, lineY);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Cover title
  const coverText = (it.cover_title || it.title).toUpperCase();
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(coverText, CONTENT_W - 20);
  const titleY = 135;
  doc.text(titleLines, PAGE_W / 2, titleY, { align: "center", lineHeightFactor: 1.2 });

  // Camp type badge
  if (it.camp_type) {
    const badgeY = titleY + titleLines.length * 14 + 10;
    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.setGState(doc.GState({ opacity: 0.85 }));
    doc.text(it.camp_type.toUpperCase(), PAGE_W / 2, badgeY, { align: "center" });
    doc.setGState(doc.GState({ opacity: 1 }));
  }

  // Team format
  if (it.team_format) {
    const fmtY = 200;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setGState(doc.GState({ opacity: 0.65 }));
    doc.text(it.team_format, PAGE_W / 2, fmtY, { align: "center" });
    doc.setGState(doc.GState({ opacity: 1 }));
  }

  // Bottom accent stripe
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.06 }));
  doc.rect(0, PAGE_H - 40, PAGE_W, 40, "F");
  doc.setGState(doc.GState({ opacity: 1 }));
}

function drawNotesPage(doc: jsPDF, it: Itinerary) {
  let y = MARGIN;

  // Header bar
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, PAGE_W, 28, "F");
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TEACHING TEKKERS", MARGIN, 12);
  doc.setFontSize(14);
  doc.text("NOTES & INSTRUCTIONS", MARGIN, 22);

  y = 40;
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(it.notes, CONTENT_W);
  doc.text(lines, MARGIN, y);
}

function drawDayPage(doc: jsPDF, it: Itinerary, day: Day) {
  // Header bar
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, PAGE_W, 28, "F");
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TEACHING TEKKERS", MARGIN, 12);
  doc.setFontSize(14);
  const dayTitle = day.theme ? `${day.title} – ${day.theme}` : day.title;
  doc.text(dayTitle.toUpperCase(), MARGIN, 22);

  let y = 34;

  // Setup notes
  if (day.setup_notes) {
    doc.setFillColor(LIGHT_BG.r, LIGHT_BG.g, LIGHT_BG.b);
    const noteLines = doc.splitTextToSize(day.setup_notes, CONTENT_W - 8);
    const noteH = noteLines.length * 4 + 6;
    doc.rect(MARGIN, y, CONTENT_W, noteH, "F");
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(noteLines, MARGIN + 4, y + 5);
    y += noteH + 4;
  }

  // Schedule blocks
  const timeColW = 32;
  const titleColW = 42;
  const descColW = CONTENT_W - timeColW - titleColW - 4;

  for (let i = 0; i < day.blocks.length; i++) {
    const block = day.blocks[i];

    // Check if we need a new page
    if (y > PAGE_H - 30) {
      doc.addPage();
      y = MARGIN;
    }

    // Alternate row bg
    const rowBg = i % 2 === 0;

    // Calculate row height based on description length
    doc.setFontSize(7.5);
    const descLines = block.description
      ? doc.splitTextToSize(block.description, descColW - 4)
      : [];
    const sessionLine = block.linked_session_title ? 1 : 0;
    const contentLines = Math.max(1, descLines.length + sessionLine);
    const rowH = Math.max(8, contentLines * 3.8 + 4);

    if (rowBg) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
    }

    // Thin divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);

    // Time
    const timeStr = formatTime(block.start_time) +
      (block.end_time ? ` – ${formatTime(block.end_time)}` : "");
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(timeStr, MARGIN + 3, y + 5);

    // Title
    doc.setTextColor(DARK.r, DARK.g, DARK.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(block.block_title, MARGIN + timeColW, y + 5);

    // Description
    if (descLines.length > 0) {
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(descLines, MARGIN + timeColW + titleColW, y + 5);
    }

    // Linked session
    if (block.linked_session_title) {
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const sessionY = y + 5 + descLines.length * 3.8;
      doc.text(`📋 ${block.linked_session_title}`, MARGIN + timeColW + titleColW, sessionY);
    }

    y += rowH;
  }

  // Next day reminder
  if (day.next_day_reminder) {
    y += 4;
    if (y > PAGE_H - 20) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setGState(doc.GState({ opacity: 0.08 }));
    doc.rect(MARGIN, y, CONTENT_W, 10, "F");
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`Tomorrow: ${day.next_day_reminder}`, MARGIN + 4, y + 6.5);
  }
}
