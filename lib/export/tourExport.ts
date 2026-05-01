import type { TourDay } from "@/types/concert";
import type { Hotel } from "@/types/hotel";

type PreTourNight = { requiresHotel: boolean; selectedHotelId: string | null; suggestedHotelId: string | null };

// ──────────────────────────────────────────────────────────────
// Dato-formatering (duplikeret fra DayGroup for at undgå lib → components)
// ──────────────────────────────────────────────────────────────

const WEEKDAYS_DA = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
const MONTHS_DA = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatDayHeader(date: Date): string {
  const week = getISOWeek(date);
  const weekday = WEEKDAYS_DA[date.getUTCDay()];
  const d = date.getUTCDate();
  const month = MONTHS_DA[date.getUTCMonth()];
  return `Uge ${week} · ${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${d}. ${month}`;
}

// ──────────────────────────────────────────────────────────────
// Excel-export
// ──────────────────────────────────────────────────────────────

export async function downloadExcel(days: TourDay[], bandName: string, _hotels: Hotel[], _preTourNight?: PreTourNight): Promise<void> {
  const XLSX = await import("xlsx");

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStamp = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const rows: (string | number)[][] = [
    [`LMS Turnéplan${bandName ? ` — ${bandName}` : ""}`],
    [`Udtrukket ${dateStamp.replace(/-/g, ".")} kl. ${timeStamp}`],
    [],
    ["#", "Dato", "Skole", "Kommune", "OBS"],
  ];

  let globalOrder = 1;
  days.forEach((day) => {
    const datePart = formatDayHeader(day.date).split(" · ")[1] ?? "";
    day.schools.forEach((s) => {
      rows.push([globalOrder++, datePart, s.schoolName, s.municipality, s.notes ?? ""]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 16 }, { wch: 32 }, { wch: 22 }, { wch: 42 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Turnéplan");
  XLSX.writeFile(wb, `${bandName || "turneplan"}_${dateStamp}.xlsx`);
}

// ──────────────────────────────────────────────────────────────
// PDF-export
// ──────────────────────────────────────────────────────────────

export async function downloadPdf(days: TourDay[], bandName: string, hotels: Hotel[], preTourNight?: PreTourNight): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStamp = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`LMS Turnéplan${bandName ? ` — ${bandName}` : ""}`, 14, 14);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(`Udtrukket ${dateStamp.replace(/-/g, ".")} kl. ${timeStamp}`, 14, 20);
  doc.setTextColor(0, 0, 0);

  let globalOrder = 1;
  let startY = 26;

  // Overnatning aftenen før første dag
  if (preTourNight?.requiresHotel) {
    const hotelId = preTourNight.selectedHotelId ?? preTourNight.suggestedHotelId;
    const hotel = hotelId ? hotels.find((h) => h.id === hotelId) : null;
    if (hotel) {
      const note = hotel.hasAgreement
        ? `LMS-aftale · ${hotel.singleRoomPrice ?? "?"} kr`
        : "Ingen LMS-aftale";
      autoTable(doc, {
        startY,
        head: [[{ content: "🏨 Overnatning aftenen før", colSpan: 4, styles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: "bold" } }]],
        body: [["", hotel.name, hotel.city, note]],
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
        theme: "striped",
      });
      const info = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
      startY = info.finalY + 6;
    }
  }

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const dayLabel = formatDayHeader(day.date);

    const body: string[][] = day.schools.map((s) => [
      String(globalOrder++),
      s.schoolName,
      s.municipality,
      s.notes ?? "",
    ]);

    const hotelId = day.selectedHotelId ?? day.suggestedHotelId ?? null;
    const hotel = hotelId ? hotels.find((h) => h.id === hotelId) : null;
    if (day.requiresHotel && hotel) {
      const priceNote = hotel.hasAgreement
        ? `LMS-aftale · ${hotel.singleRoomPrice ?? "?"} kr`
        : "Ingen LMS-aftale";
      body.push(["🏨", hotel.name, hotel.city, priceNote]);
    }

    autoTable(doc, {
      startY,
      head: [[{ content: dayLabel, colSpan: 4, styles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" } }],
             ["#", "Skole", "Kommune", "OBS"]],
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [75, 85, 99] },
      columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 36 }, 3: { cellWidth: 50 } },
      margin: { left: 14, right: 14 },
      theme: "striped",
      didDrawCell: (data) => {
        if (data.section !== "head" || data.row.index !== 0 || data.column.index !== 0) return;
        // Overskriv dag-headercellen med to forskellige skriftstørrelser:
        // "Uge X · " i 8pt og datodelen i 9.6pt (20% større)
        const { x, y, width, height } = data.cell;
        doc.setFillColor(37, 99, 235);
        doc.rect(x, y, width, height, "F");
        const parts = dayLabel.split(" · ");
        const weekText = parts[0] + " · ";
        const dateText = parts[1] ?? "";
        const baseSize = 8;
        const dateSize = baseSize * 1.2;
        const textY = y + height / 2 + 1.2;
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(baseSize);
        const weekWidth = doc.getTextWidth(weekText);
        doc.text(weekText, x + 2.5, textY);
        doc.setFontSize(dateSize);
        doc.text(dateText, x + 2.5 + weekWidth, textY);
      },
    });

    const tableInfo = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
    startY = tableInfo.finalY + 6;
  }

  doc.save(`${bandName || "turneplan"}_${dateStamp}.pdf`);
}
