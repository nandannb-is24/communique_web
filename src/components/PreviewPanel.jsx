import { Download } from "lucide-react";
import Draggable from "react-draggable";
import { useEffect, useState, useRef } from "react";

export default function PreviewPanel({ state }) {
  const {
    letterType,
    toAddress,
    date,
    subject,
    salutation,
    paragraphs,
    postParagraphs,
    tables,
    signature
  } = state;

  // --- DOM Measurement State ---
  const [measurements, setMeasurements] = useState({
    headerHeight: 0,
    paraHeights: new Map(),
    postParaHeights: new Map(),
    tableData: new Map()
  });
  const measureRef = useRef(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; background: white; }
        .a4-page {
          box-shadow: none !important;
          margin: 0 !important;
          page-break-after: always;
          page-break-inside: avoid;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Measure actual heights after each render.
  useEffect(() => {
    if (!measureRef.current) return;

    const newMeasurements = {
      headerHeight: 0,
      paraHeights: new Map(),
      postParaHeights: new Map(),
      tableData: new Map()
    };

    // 1. Measure Header
    const headerEl = measureRef.current.querySelector('[data-measure-id="header-block"]');
    if (headerEl) newMeasurements.headerHeight = headerEl.offsetHeight;

    // 2. Measure Paragraphs
    paragraphs.forEach((_, idx) => {
      const el = measureRef.current.querySelector(`[data-measure-id="para-${idx}"]`);
      if (el) newMeasurements.paraHeights.set(idx, el.offsetHeight);
    });

    // 3. Measure Post-Paragraphs
    postParagraphs.forEach((_, idx) => {
      const el = measureRef.current.querySelector(`[data-measure-id="postpara-${idx}"]`);
      if (el) newMeasurements.postParaHeights.set(idx, el.offsetHeight);
    });

    // 4. Measure Tables
    tables.forEach(table => {
      const tableEl = measureRef.current.querySelector(`[data-measure-id="table-${table.id}"]`);
      if (!tableEl) return;
      const rows = Array.from(tableEl.querySelectorAll('tbody tr'));
      const thead = tableEl.querySelector('thead');
      newMeasurements.tableData.set(table.id, {
        headerHeight: thead ? thead.offsetHeight : 0,
        rowHeights: rows.map(r => r.offsetHeight)
      });
    });

    setMeasurements(prev => {
      const serialize = (obj) => JSON.stringify({
        h: obj.headerHeight,
        p: [...obj.paraHeights.entries()],
        pp: [...obj.postParaHeights.entries()],
        t: [...obj.tableData.entries()]
      });
      return serialize(prev) === serialize(newMeasurements) ? prev : newMeasurements;
    });
  });

  const handleDownloadPdf = () => window.print();

  const DraggableBlock = ({ children, defaultPosition, className }) => (
    <Draggable defaultPosition={defaultPosition}>
      <div className={`cursor-move hover:outline hover:outline-1 hover:outline-dashed hover:outline-indigo-300 w-max max-w-full ${className || ''}`}>
        {children}
      </div>
    </Draggable>
  );

  const PAGE_HEIGHT_PX = 1122;
  const TOP_PAD_FIRST_PX = 165;
  const TOP_PAD_REST_PX = 130;
  const BOTTOM_RESERVED_PX = 95; // Reduced from 125 for a tighter fit

  const getSafeHeight = (isFirst) => {
    const top = isFirst ? TOP_PAD_FIRST_PX : TOP_PAD_REST_PX;
    // On the first page, we reserve space for the header block + 60px margin
    // Reduced fallback from 140 to 120
    const offset = isFirst ? (measurements.headerHeight || 120) + 60 : 0;
    return PAGE_HEIGHT_PX - top - BOTTOM_RESERVED_PX - offset;
  };

  const estimateParaHeight = (p) => {
    const rawText = p.replace(/<[^>]*>?/gm, '');
    const explicitBreaks = (p.match(/<br>|<br\/>|<div>|<p>/gi) || []).length;
    const lines = Math.max(1, Math.ceil(rawText.length / 80)) + explicitBreaks;
    return (lines * 26) + 20;
  };

  let pages = [];
  let currentY = 0;
  let currentPage = { headerElements: true, content: [] };

  const pushToPage = (item) => currentPage.content.push(item);
  const startNewPage = () => {
    pages.push(currentPage);
    currentPage = { headerElements: false, content: [] };
    currentY = 0;
  };

  // Uses real measured heights when available, falls back to a conservative estimate
  const calculateRowsFit = (remainingRows, availableHeight, tableId, rowOffset, tableBreaks = []) => {
    const tableData = measurements.tableData.get(tableId);
    let rowsFit = 0;
    let usedHeight = 0;
    const measuredRows = tableData?.rowHeights;

    for (let i = 0; i < remainingRows.length; i++) {
      const actualRowIdx = rowOffset + i;
      const rowHeight = (measuredRows && measuredRows[actualRowIdx])
        ? measuredRows[actualRowIdx]
        : 46;

      if (usedHeight + rowHeight > availableHeight && rowsFit > 0) break;

      usedHeight += rowHeight;
      rowsFit++;

      // If there's a manual break AFTER this row, stop here
      if (tableBreaks.includes(actualRowIdx)) break;
    }
    return { rowsFit, usedHeight };
  };

  const splitContent = (originalHtml, maxHeight, measureId) => {
    if (!measureRef.current) return { first: originalHtml, second: "" };
    const el = measureRef.current.querySelector(`[data-measure-id="${measureId}"]`);
    if (!el || el.offsetHeight <= maxHeight) return { first: originalHtml, second: "" };

    const clone = el.cloneNode(true);
    const style = window.getComputedStyle(el);
    clone.style.position = "absolute";
    clone.style.visibility = "hidden";
    clone.style.top = "-9999px";
    clone.style.width = style.width;
    clone.style.padding = style.padding;
    clone.style.boxSizing = "border-box";
    clone.style.fontFamily = style.fontFamily;
    clone.style.fontSize = style.fontSize;
    clone.style.lineHeight = style.lineHeight;
    clone.style.textAlign = style.textAlign;
    document.body.appendChild(clone);

    const range = document.createRange();
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null, false);
    let lastValidSplit = { node: null, offset: 0 };
    let found = false;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent;
      // Split by whitespace but keep the whitespace in the chunks
      const chunks = text.split(/(\s+)/);
      let currentPos = 0;

      for (let chunk of chunks) {
        const potentialPos = currentPos + chunk.length;
        range.setStart(clone, 0);
        range.setEnd(node, potentialPos);
        const rect = range.getBoundingClientRect();

        if (rect.height > maxHeight) {
          found = true;
          break;
        }
        currentPos = potentialPos;
        // Only update split point on whitespace for clean breaks
        if (chunk.match(/\s+/)) {
          lastValidSplit = { node, offset: currentPos };
        }
      }
      if (found) break;
    }

    let result = { first: originalHtml, second: "" };
    if (lastValidSplit.node) {
      range.setStart(clone, 0);
      range.setEnd(lastValidSplit.node, lastValidSplit.offset);
      const frag = range.extractContents();
      const tempDiv = document.createElement("div");
      tempDiv.appendChild(frag);
      result = { first: tempDiv.innerHTML.trim(), second: clone.innerHTML.trim() };
    }
    document.body.removeChild(clone);
    return result;
  };

  const validParagraphs = paragraphs.filter(p => p.trim() !== "");
  const validPostParagraphs = postParagraphs ? postParagraphs.filter(p => p.trim() !== "") : [];

  // Queue of content blocks to process
  let contentQueue = [
    ...validParagraphs.map((p, idx) => ({ type: 'para', content: p, id: `para-${idx}` })),
    ...tables.map(t => ({ type: 'table', table: t })),
    ...validPostParagraphs.map((p, idx) => ({ type: 'postPara', content: p, id: `postpara-${idx}` })),
    { type: 'signature' }
  ];

  while (contentQueue.length > 0) {
    const item = contentQueue.shift();

    if (item.type === 'para' || item.type === 'postPara') {
      const measureId = item.id;
      const pHeight = (item.type === 'para' ? measurements.paraHeights : measurements.postParaHeights).get(parseInt(measureId.split('-')[1])) || estimateParaHeight(item.content);
      const availableHeight = getSafeHeight(currentPage.headerElements) - currentY;

      if (pHeight <= availableHeight || availableHeight < 100) {
        if (pHeight > availableHeight) startNewPage();
        pushToPage(item);
        currentY += pHeight;
      } else {
        // Split the paragraph
        const { first, second } = splitContent(item.content, availableHeight, measureId);
        if (second && second.trim()) {
          pushToPage({ ...item, content: first });
          contentQueue.unshift({ ...item, content: second });
          startNewPage();
        } else {
          startNewPage();
          contentQueue.unshift(item);
        }
      }
    } else if (item.type === 'table') {
      const table = item.table;
      let remainingRows = [...table.rows];
      let processedCount = 0;
      currentY += 20;

      while (remainingRows.length > 0) {
        const tableData = measurements.tableData.get(table.id);
        const theadHeight = tableData ? tableData.headerHeight : (table.title ? 84 : 42);
        const tableMarginBottom = 16;
        const availableHeight = getSafeHeight(currentPage.headerElements) - currentY - tableMarginBottom;
        const usableForRows = availableHeight - theadHeight;

        if (usableForRows < 40) { startNewPage(); continue; }

        const { rowsFit, usedHeight } = calculateRowsFit(remainingRows, usableForRows, table.id, processedCount, table.breaks);

        if (rowsFit === 0 && remainingRows.length > 0) { startNewPage(); continue; }

        pushToPage({
          type: 'table',
          title: table.title,
          columns: table.columns,
          rows: remainingRows.slice(0, rowsFit)
        });

        processedCount += rowsFit;
        remainingRows = remainingRows.slice(rowsFit);
        currentY += usedHeight + theadHeight + tableMarginBottom;

        if (remainingRows.length > 0) startNewPage();
      }
    } else if (item.type === 'signature') {
      // Signature is now a "floating" element that doesn't trigger page breaks
      pushToPage({ type: 'signature' });
    }
  }

  pages.push(currentPage);

  const renderTable = (table, tIndex) => (
    <table key={tIndex} className="w-full border-collapse border border-black text-[12pt] bg-white" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      <thead>
        {table.title && (
          <tr>
            <th colSpan={table.columns.length} className="border border-black p-2 font-bold text-center bg-gray-50 uppercase">
              {table.title}
            </th>
          </tr>
        )}
        <tr>
          {table.columns.map((col, cIndex) => (
            <th key={cIndex} className="border border-black p-2 font-bold text-center bg-gray-50">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, rIndex) => (
          <tr key={rIndex}>
            {row.map((cell, cIndex) => (
              <td key={cIndex} className="border border-black p-1.5 text-center" dangerouslySetInnerHTML={{ __html: cell }} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="flex-1 bg-[#f5f0e8] print:bg-white flex flex-col items-center overflow-y-auto print:overflow-visible relative p-8 print:p-0 print:block">

      <div
        ref={measureRef}
        style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', top: -9999, left: 0, width: '186mm' }}
        aria-hidden="true"
      >
        {/* Header Block Measurement */}
        <div data-measure-id="header-block" className="w-full text-[12pt]" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
          <div className="flex justify-between items-start">
            <div className="whitespace-pre-wrap">
              <p className="font-semibold">{letterType},</p>
              <p>{toAddress || "Address Placeholder"}</p>
            </div>
            <div className="whitespace-nowrap ml-4">
              <p><span className="font-semibold">Date:</span> {date || "00/00/0000"}</p>
            </div>
          </div>
          <div className="mt-[10px]">
            <p>{salutation}</p>
          </div>
          {subject && (
            <div className="flex mt-[30px] ml-12">
              <div className="font-bold mr-2 whitespace-nowrap">Subject:</div>
              <div className="font-bold">{subject}</div>
            </div>
          )}
        </div>

        {/* Paragraphs Measurement */}
        {paragraphs.map((p, idx) => (
          <div key={`p-${idx}`} data-measure-id={`para-${idx}`} dangerouslySetInnerHTML={{ __html: p }} className="mb-4 text-justify pr-4 leading-relaxed" />
        ))}

        {/* Post-Paragraphs Measurement */}
        {postParagraphs && postParagraphs.map((p, idx) => (
          <div key={`pp-${idx}`} data-measure-id={`postpara-${idx}`} dangerouslySetInnerHTML={{ __html: p }} className="mb-4 text-justify pr-4 leading-relaxed" />
        ))}

        {/* Tables Measurement */}
        {tables.map(table => (
          <table
            key={table.id}
            data-measure-id={`table-${table.id}`}
            className="w-full border-collapse border border-black text-[12pt]"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            <thead>
              {table.title && (
                <tr>
                  <th colSpan={table.columns.length} className="border border-black p-2 font-bold text-center bg-gray-50 uppercase">
                    {table.title}
                  </th>
                </tr>
              )}
              <tr>
                {table.columns.map((col, cIndex) => (
                  <th key={cIndex} className="border border-black p-2 font-bold text-center bg-gray-50">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rIndex) => (
                <tr key={rIndex}>
                  {row.map((cell, cIndex) => (
                    <td key={cIndex} className="border border-black p-1.5 text-center" dangerouslySetInnerHTML={{ __html: cell }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      {/* Save as PDF */}
      <div className="w-full max-w-[210mm] flex justify-end mb-4 shrink-0 print:hidden">
        <button
          onClick={handleDownloadPdf}
          className="group flex items-center justify-center gap-2.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200/50 text-[12px] tracking-wide font-bold uppercase transition-all hover:-translate-y-0.5 active:scale-95"
        >
          <Download size={16} className="transition-transform group-hover:scale-110" />
          <span>Save as PDF</span>
        </button>
      </div>

      <div id="pdf-container" className="flex flex-col gap-8 pb-8 print:gap-0 print:pb-0 print:block w-full max-w-fit mx-auto">
        {pages.map((page, pageIndex) => (
          <div
            key={pageIndex}
            className="a4-page bg-white shadow-2xl relative shrink-0"
            style={{ width: "210mm", height: "297mm", boxSizing: "border-box", pageBreakAfter: "always" }}
          >
            <img src="/blank_letterhead.png" className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0" alt="Letterhead" />

            <div className="relative z-10 w-full h-full text-[12pt]" style={{
              padding: `${page.headerElements ? TOP_PAD_FIRST_PX : TOP_PAD_REST_PX}px 12mm ${BOTTOM_RESERVED_PX}px 12mm`,
              fontFamily: "'Times New Roman', Times, serif",
              color: "#000",
              overflow: "hidden",      // hard-clip: nothing can bleed into the footer
              boxSizing: "border-box"  // ensure padding is included in h-full
            }}>
              {page.headerElements && (
                <>
                  <div className="flex justify-between items-start">
                    <Draggable>
                      <div className="cursor-move hover:outline hover:outline-1 hover:outline-dashed hover:outline-indigo-300">
                        {letterType === "Submitted" ? (
                          <div className="font-semibold text-[12pt]">Submitted,</div>
                        ) : (
                          <div className="whitespace-pre-wrap text-[12pt]">
                            <p className="font-semibold">{letterType},</p>
                            <p>{toAddress || "[Recipient Address]"}</p>
                          </div>
                        )}
                      </div>
                    </Draggable>
                    <Draggable>
                      <div className="cursor-move hover:outline hover:outline-1 hover:outline-dashed hover:outline-indigo-300 whitespace-nowrap text-[12pt] ml-4">
                        <p><span className="font-semibold">Date:</span> {date ? date.split('-').reverse().join('/') : "DD/MM/YYYY"}</p>
                      </div>
                    </Draggable>
                  </div>

                  <DraggableBlock defaultPosition={{ x: 0, y: 10 }}>
                    <p className="text-[12pt]">{salutation}</p>
                  </DraggableBlock>

                  {subject && (
                    <DraggableBlock defaultPosition={{ x: 0, y: 30 }}>
                      <div className="flex text-[12pt] ml-12">
                        <div className="font-bold mr-2 whitespace-nowrap">Subject:</div>
                        <div className="font-bold">{subject}</div>
                      </div>
                    </DraggableBlock>
                  )}
                </>
              )}

              <div className={page.headerElements ? "mt-[60px]" : "mt-0"}>
                {page.content.map((item, idx) => {
                  if (item.type === 'para') return (
                    <div key={idx} dangerouslySetInnerHTML={{ __html: item.content }} className="mb-4 text-justify pr-4 leading-relaxed" />
                  );
                  if (item.type === 'postPara') return (
                    <DraggableBlock key={idx} defaultPosition={{ x: 0, y: 10 }} className="w-full">
                      <div dangerouslySetInnerHTML={{ __html: item.content }} className="mb-4 text-justify pr-4 leading-relaxed" />
                    </DraggableBlock>
                  );
                  if (item.type === 'table') return renderTable(item, idx);
                  return null;
                })}
              </div>

              {/* Floating Signature - Rendered at the page level for absolute control */}
              {page.content.some(item => item.type === 'signature') && (
                <Draggable defaultPosition={{ x: 0, y: 0 }}>
                  <div className="absolute bottom-[100px] left-[12mm] z-[100] cursor-move p-4 hover:outline hover:outline-1 hover:outline-dashed hover:outline-indigo-300 rounded-lg text-black" style={{ width: '250px' }}>
                    <div className="flex flex-col text-[12pt]">
                      <p>Thank you,</p>
                      <p className="mb-10">Yours sincerely</p>
                      <p>{signature.name}</p>
                      <p>{signature.role}</p>
                    </div>
                  </div>
                </Draggable>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}