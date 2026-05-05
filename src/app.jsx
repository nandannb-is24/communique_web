import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import EditorPanel from "./components/EditorPanel";
import PreviewPanel from "./components/PreviewPanel";

function parseSheetData(data) {
  if (!data || data.length === 0) return null;
  let headerIdx = 0;
  let maxNonEmpty = 0;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const nonEmptyCount = data[i].filter(cell => cell && String(cell).trim() !== "").length;
    if (nonEmptyCount > maxNonEmpty) {
      maxNonEmpty = nonEmptyCount;
      headerIdx = i;
    }
  }

  let tableTitle = "";
  for (let i = 0; i < headerIdx; i++) {
    const rowText = data[i].filter(cell => cell && String(cell).trim() !== "").join(" ");
    if (rowText) {
      tableTitle = rowText;
      break;
    }
  }

  const rawHeaders = data[headerIdx].map(h => String(h || "").trim());
  const rawRows = data.slice(headerIdx + 1).filter(r => r.some(c => c !== ""));

  const colMapping = [];
  const finalCols = ["SL NO"];
  rawHeaders.forEach((h, i) => {
    const up = h.toUpperCase();
    if (h !== "" && !up.includes("SL NO") && !up.includes("SL. NO")) {
      finalCols.push(h); colMapping.push(i);
    }
  });

  // Enforce a fixed display order for known columns — explicit match, no sort ambiguity
  const DESIRED_ORDER = ["REGT", "NAME", "USN", "BRANCH", "SEMESTER"];
  const paired = finalCols.slice(1).map((col, i) => ({ col, src: colMapping[i] }));
  
  const sortedPairs = [];
  // First, add columns in the desired order
  DESIRED_ORDER.forEach(key => {
    const found = paired.find(p => {
      const colUpper = p.col.toUpperCase().trim();
      return colUpper.includes(key) && !sortedPairs.includes(p);
    });
    if (found) sortedPairs.push(found);
  });
  // Then append any remaining columns that didn't match (so nothing is dropped)
  paired.forEach(p => { if (!sortedPairs.includes(p)) sortedPairs.push(p); });

  const sortedCols = ["SL NO", ...sortedPairs.map(p => p.col)];
  const sortedMapping = sortedPairs.map(p => p.src);

  const finalRows = rawRows.map((row, idx) => {
    const newRow = [String(idx + 1)];
    sortedMapping.forEach(cIdx => newRow.push(String(row[cIdx] || "")));
    return newRow;
  });

  return { id: Date.now(), title: tableTitle, columns: sortedCols, rows: finalRows };
}

export default function App() {
  // Load API key from environment variable (configure this in Vercel)
  const [groqApiKey, setGroqApiKey] = useState(import.meta.env.VITE_GROQ_API_KEY || "");
  const [letterType, setLetterType] = useState("Submitted");
  const [toAddress, setToAddress] = useState("");
  const [date, setDate] = useState("");
  const [subject, setSubject] = useState("");
  const [salutation, setSalutation] = useState("Respected Sir,");
  const [paragraphs, setParagraphs] = useState([""]);
  const [postParagraphs, setPostParagraphs] = useState([]);
  const [signature, setSignature] = useState({ name: "Lt. (Dr.) Ajay K M", role: "ANO, NCC RVCE" });

  // Full editable table data (same as before)
  const [tables, setTables] = useState([]);
  // checkedRows: Map<tableId, Set<rowIndex>> — which rows appear in the letter
  // Default: empty (nobody selected)
  const [checkedRows, setCheckedRows] = useState(new Map());

  // Auto-load bundled cadet Excel on startup
  useEffect(() => {
    fetch("/Cadet details for app.xlsx")
      .then(res => { if (!res.ok) throw new Error("not found"); return res.arrayBuffer(); })
      .then(buffer => {
        const wb = XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const table = parseSheetData(data);
        if (table) {
          setTables([table]);
          // Start with nobody checked
          setCheckedRows(new Map([[table.id, new Set()]]));
        }
      })
      .catch(err => console.warn("Could not auto-load cadet file:", err.message));
  }, []);

  // Derive preview tables — only checked rows, SL NO renumbered
  const previewTables = tables.map(table => {
    const checked = checkedRows.get(table.id) || new Set();
    const filteredRows = table.rows
      .filter((_, i) => checked.has(i))
      .map((row, idx) => [String(idx + 1), ...row.slice(1)]);
    return { ...table, rows: filteredRows };
  }).filter(t => t.rows.length > 0);

  const clearDocument = () => {
    if (confirm("Are you sure you want to completely clear this document?")) {
      setToAddress("");
      setDate("");
      setSubject("");
      setParagraphs([""]);
      setPostParagraphs([]);
      setTables([]);
      setCheckedRows(new Map());
    }
  };

  const state = {
    groqApiKey, setGroqApiKey,
    letterType, setLetterType,
    toAddress, setToAddress,
    date, setDate,
    subject, setSubject,
    salutation, setSalutation,
    paragraphs, setParagraphs,
    postParagraphs, setPostParagraphs,
    tables, setTables,
    checkedRows, setCheckedRows,
    signature, setSignature,
    clearDocument,
  };

  return (
    <div className="h-screen print:h-auto print:block flex bg-neutral-100 overflow-hidden print:overflow-visible font-sans">
      <EditorPanel state={state} />
      <PreviewPanel state={{ ...state, tables: previewTables }} />
    </div>
  );
}