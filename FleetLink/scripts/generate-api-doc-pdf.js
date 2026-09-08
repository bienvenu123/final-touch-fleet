const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "docs", "FLEETLINK_FRONTEND_API.md");
const outputPath = path.join(projectRoot, "docs", "FLEETLINK_FRONTEND_API.pdf");
const markdown = fs.readFileSync(sourcePath, "utf8").replace(/\r/g, "");

const document = new PDFDocument({ size: "A4", margin: 44, info: { Title: "FleetLink frontend API reference" } });
document.pipe(fs.createWriteStream(outputPath));

const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
const bottom = () => document.page.height - document.page.margins.bottom;

function ensureSpace(height) {
  if (document.y + height > bottom()) document.addPage();
}

function write(text, options = {}) {
  const font = options.font || "Helvetica";
  const size = options.size || 9;
  document.font(font).fontSize(size);
  const height = document.heightOfString(text, { width: pageWidth, lineGap: options.lineGap || 2 });
  ensureSpace(height + 3);
  document.text(text, { width: pageWidth, lineGap: options.lineGap || 2, ...options });
}

function horizontalRule() {
  ensureSpace(12);
  document.moveTo(document.page.margins.left, document.y + 3)
    .lineTo(document.page.width - document.page.margins.right, document.y + 3)
    .strokeColor("#B8C2CC").stroke();
  document.moveDown(0.7);
}

let inCodeBlock = false;
for (const rawLine of markdown.split("\n")) {
  const line = rawLine.trimEnd();
  if (line.startsWith("```")) {
    inCodeBlock = !inCodeBlock;
    document.moveDown(0.25);
    continue;
  }
  if (inCodeBlock) {
    write(line || " ", { font: "Courier", size: 7.5, indent: 8, fill: "#203040", lineGap: 1 });
    continue;
  }
  if (!line.trim()) {
    document.moveDown(0.35);
    continue;
  }
  if (/^#{1,3} /.test(line)) {
    const level = line.match(/^#+/)[0].length;
    const text = line.replace(/^#+\s*/, "");
    document.moveDown(level === 1 ? 0.5 : 0.25);
    write(text, { font: "Helvetica-Bold", size: level === 1 ? 20 : level === 2 ? 14 : 11, fill: "#102A43", lineGap: 2 });
    document.moveDown(0.18);
    continue;
  }
  if (/^> /.test(line)) {
    write(line.slice(2), { font: "Helvetica-Oblique", size: 8.5, fill: "#486581", indent: 10 });
    continue;
  }
  if (/^\|/.test(line)) {
    if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/`/g, ""));
    write(cells.join("  ?  "), { font: "Helvetica", size: 7.2, fill: "#243B53", lineGap: 1 });
    continue;
  }
  if (/^[-*] /.test(line)) {
    write(`? ${line.slice(2)}`, { size: 9, indent: 10 });
    continue;
  }
  if (/^\d+\. /.test(line)) {
    write(line, { size: 9, indent: 10 });
    continue;
  }
  if (/^---+$/.test(line)) {
    horizontalRule();
    continue;
  }
  write(line.replace(/`/g, ""), { size: 9 });
}

document.end();
document.on("end", () => console.log(`Created ${outputPath}`));
