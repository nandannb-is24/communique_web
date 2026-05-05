import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, FileSpreadsheet, Check, X, Scissors } from "lucide-react";
import * as XLSX from "xlsx";

export default function TableBuilder({ tables, setTables, checkedRows, setCheckedRows }) {
  const fileInputRef = useRef(null);
  const [importData, setImportData] = useState(null);
  const [tablePrompt, setTablePrompt] = useState(false);
  const [promptRows, setPromptRows] = useState(3);
  const [promptCols, setPromptCols] = useState(3);

  const openTablePrompt = () => {
    setPromptRows(3);
    setPromptCols(3);
    setTablePrompt(true);
  };

  const confirmAddTable = () => {
    const cols = [];
    for (let i = 0; i < promptCols; i++) cols.push(`Col ${i + 1}`);
    const rows = [];
    for (let r = 0; r < promptRows; r++) {
      rows.push(new Array(promptCols).fill(""));
    }
    const newTable = { id: Date.now(), title: "", columns: cols, rows: rows };
    setTables([...tables, newTable]);
    setCheckedRows(prev => {
      const next = new Map(prev);
      next.set(newTable.id, new Set(rows.map((_, i) => i)));
      return next;
    });
    setTablePrompt(false);
  };

  const removeTable = (id) => {
    setTables(tables.filter((t) => t.id !== id));
  };

  const addRow = (tableIndex) => {
    const newTables = [...tables];
    const newRow = new Array(newTables[tableIndex].columns.length).fill("");
    const rowIndex = newTables[tableIndex].rows.length;
    newTables[tableIndex].rows.push(newRow);
    setTables(newTables);
    
    setCheckedRows(prev => {
      const next = new Map(prev);
      const tableId = newTables[tableIndex].id;
      const rowSet = new Set(prev.get(tableId) || []);
      rowSet.add(rowIndex);
      next.set(tableId, rowSet);
      return next;
    });
  };

  const removeRow = (tableIndex, rowIndex) => {
    const newTables = [...tables];
    newTables[tableIndex].rows.splice(rowIndex, 1);
    setTables(newTables);
  };

  const addColumn = (tableIndex) => {
    const newTables = [...tables];
    newTables[tableIndex].columns.push(`Col ${newTables[tableIndex].columns.length + 1}`);
    newTables[tableIndex].rows.forEach(row => row.push(""));
    setTables(newTables);
  };
  
  const removeColumn = (tableIndex, colIndex) => {
    const newTables = [...tables];
    newTables[tableIndex].columns.splice(colIndex, 1);
    newTables[tableIndex].rows.forEach(row => row.splice(colIndex, 1));
    setTables(newTables);
  };

  const updateHeader = (tableIndex, colIndex, value) => {
    const newTables = [...tables];
    newTables[tableIndex].columns[colIndex] = value;
    setTables(newTables);
  };

  const updateCell = (tableIndex, rowIndex, colIndex, value) => {
    const newTables = [...tables];
    newTables[tableIndex].rows[rowIndex][colIndex] = value;
    setTables(newTables);
  };

  const togglePageBreak = (tableIndex, rowIndex) => {
    const newTables = [...tables];
    const table = newTables[tableIndex];
    if (!table.breaks) table.breaks = [];
    
    if (table.breaks.includes(rowIndex)) {
      table.breaks = table.breaks.filter(idx => idx !== rowIndex);
    } else {
      table.breaks = [...table.breaks, rowIndex].sort((a, b) => a - b);
    }
    setTables(newTables);
  };


  // --- Excel Import Logic ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Read as 2D array
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        
        if (data.length > 0) {
          // Find the header row (sometimes excel sheets have empty top rows or title rows)
          // Heuristic: The header row is likely the row with the most non-empty columns near the top.
          let headerIdx = 0;
          let maxNonEmpty = 0;
          for (let i=0; i<Math.min(data.length, 10); i++) {
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

          const headers = data[headerIdx].map(h => String(h || "").trim());
          const rows = data.slice(headerIdx + 1).filter(r => r.some(cell => cell !== ""));

          setImportData({
            title: tableTitle,
            headers: headers,
            rows: rows,
            selectedRows: new Set(rows.map((_, i) => i)), // All selected by default
            selectedCols: new Set(headers.map((h, i) => h !== "" ? i : -1).filter(i => i !== -1)) // valid cols
          });
        }
      } catch (err) {
        alert("Error parsing Excel file. Make sure it's a valid .xlsx or .csv");
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
    // reset input
    e.target.value = "";
  };

  const toggleImportCol = (colIdx) => {
    const newSet = new Set(importData.selectedCols);
    if (newSet.has(colIdx)) newSet.delete(colIdx);
    else newSet.add(colIdx);
    setImportData({ ...importData, selectedCols: newSet });
  };

  const toggleImportRow = (rowIdx) => {
    const newSet = new Set(importData.selectedRows);
    if (newSet.has(rowIdx)) newSet.delete(rowIdx);
    else newSet.add(rowIdx);
    setImportData({ ...importData, selectedRows: newSet });
  };

  const finalizeImport = () => {
    // Build final columns array: skip existing SL NO
    const finalCols = ["SL NO"];
    const colMapping = []; // maps finalColIndex -> originalColIndex
    
    importData.headers.forEach((h, i) => {
       const headerUpper = String(h || "").toUpperCase().trim();
       if (importData.selectedCols.has(i) && !headerUpper.includes("SL NO") && !headerUpper.includes("SL. NO")) {
           finalCols.push(h);
           colMapping.push(i);
       }
    });

    // Build final rows array with auto-numbering
    const finalRows = [];
    let slNo = 1;
    importData.rows.forEach((row, rIdx) => {
       if (importData.selectedRows.has(rIdx)) {
           const finalRow = [String(slNo++)]; // Auto-incrementing SL NO
           colMapping.forEach(cIdx => {
               finalRow.push(String(row[cIdx] || ""));
           });
           finalRows.push(finalRow);
       }
    });

    // Push as a SINGLE table so it behaves like a Word Document
    const newTable = { id: Date.now(), title: importData.title || "", columns: finalCols, rows: finalRows };
    setTables([...tables, newTable]);
    // All newly imported rows are checked by default
    setCheckedRows(prev => {
      const next = new Map(prev);
      next.set(newTable.id, new Set(finalRows.map((_, i) => i)));
      return next;
    });
    setImportData(null); // Close the importer UI
  };


  return (
    <div className="mt-6 mb-6">
      
      {/* Import Modal / UI */}
      {importData && createPortal(
         <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
               
               <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
                  <h3 className="font-bold text-indigo-900 text-lg">Select Cadets & Columns</h3>
                  <button onClick={() => setImportData(null)} className="text-gray-500 hover:text-gray-800"><X size={20} /></button>
               </div>

               <div className="p-4 overflow-y-auto flex-1">
                  <div className="mb-6">
                     <h4 className="text-sm font-bold text-gray-700 mb-2">1. Select Columns to Include</h4>
                     <div className="flex flex-wrap gap-2">
                        {importData.headers.map((col, i) => col && (
                           <label key={i} className={`flex items-center space-x-1 px-3 py-1.5 rounded border text-sm cursor-pointer transition-colors ${importData.selectedCols.has(i) ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-gray-50 text-gray-500'}`}>
                              <input type="checkbox" checked={importData.selectedCols.has(i)} onChange={() => toggleImportCol(i)} className="hidden" />
                              <span>{col}</span>
                           </label>
                        ))}
                     </div>
                  </div>

                  <div>
                     <div className="flex justify-between items-center mb-2">
                         <h4 className="text-sm font-bold text-gray-700">2. Select Cadets (Rows) to Include</h4>
                         <div className="text-xs text-gray-500">{importData.selectedRows.size} Selected</div>
                     </div>
                     <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600">
                           <thead className="bg-gray-100 text-xs uppercase">
                              <tr>
                                 <th className="p-2 w-10 text-center">
                                     <input 
                                       type="checkbox" 
                                       checked={importData.selectedRows.size === importData.rows.length}
                                       onChange={(e) => {
                                          if (e.target.checked) {
                                              setImportData({...importData, selectedRows: new Set(importData.rows.map((_, i) => i))});
                                          } else {
                                              setImportData({...importData, selectedRows: new Set()});
                                          }
                                       }}
                                     />
                                 </th>
                                 {importData.headers.map((col, i) => importData.selectedCols.has(i) && (
                                     <th key={i} className="p-2 border-l border-gray-200">{col}</th>
                                 ))}
                              </tr>
                           </thead>
                           <tbody>
                              {importData.rows.map((row, rIdx) => (
                                 <tr key={rIdx} className={`border-t hover:bg-indigo-50/30 cursor-pointer ${importData.selectedRows.has(rIdx) ? '' : 'opacity-50'}`} onClick={() => toggleImportRow(rIdx)}>
                                    <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                                       <input type="checkbox" checked={importData.selectedRows.has(rIdx)} onChange={() => toggleImportRow(rIdx)} />
                                    </td>
                                    {row.map((cell, cIdx) => importData.selectedCols.has(cIdx) && (
                                       <td key={cIdx} className="p-2 border-l border-gray-100 max-w-[200px] truncate" title={cell}>{cell}</td>
                                    ))}
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>

               <div className="p-4 border-t bg-gray-50 flex justify-end">
                  <button onClick={() => setImportData(null)} className="px-4 py-2 text-gray-600 hover:text-gray-800 mr-2">Cancel</button>
                  <button onClick={finalizeImport} className="px-6 py-2 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 flex items-center font-medium">
                     <Check size={16} className="mr-2" /> Add Table to Letter
                  </button>
               </div>
            </div>
         </div>,
         document.body
      )}

      {/* New Table Prompt Modal */}
      {tablePrompt && createPortal(
         <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
               <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
                  <h3 className="font-bold text-indigo-900 text-lg">Create New Table</h3>
                  <button onClick={() => setTablePrompt(false)} className="text-gray-500 hover:text-gray-800"><X size={20} /></button>
               </div>
               <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Number of Columns</label>
                    <input 
                      type="number" 
                      min="1" max="20"
                      value={promptCols} 
                      onChange={(e) => setPromptCols(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Number of Rows</label>
                    <input 
                      type="number" 
                      min="1" max="100"
                      value={promptRows} 
                      onChange={(e) => setPromptRows(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
               </div>
               <div className="p-4 border-t bg-gray-50 flex justify-end">
                  <button onClick={() => setTablePrompt(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800 mr-2 text-sm font-medium">Cancel</button>
                  <button onClick={confirmAddTable} className="px-5 py-2 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 flex items-center text-sm font-medium">
                     Create Table
                  </button>
               </div>
            </div>
         </div>,
         document.body
      )}

      <div className="flex justify-between items-center mb-4">
        <label className="text-sm font-bold text-gray-800 tracking-tight">Tables & Cadets</label>
        <div className="flex gap-2">
           <input 
             type="file" 
             accept=".xlsx, .xls, .csv" 
             className="hidden" 
             ref={fileInputRef}
             onChange={handleFileUpload}
           />
           <button
             onClick={() => fileInputRef.current.click()}
             className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-md hover:bg-green-100 flex items-center font-medium shadow-sm border border-green-200"
           >
             <FileSpreadsheet size={14} className="mr-1" /> Import Excel
           </button>
           <button
             onClick={openTablePrompt}
             className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-100 flex items-center font-medium shadow-sm border border-indigo-200"
           >
             <Plus size={14} className="mr-1" /> New Table
           </button>
        </div>
      </div>

      {tables.map((table, tIndex) => (
        <div key={table.id} className="border border-gray-200 rounded-lg p-4 bg-white mb-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div className="flex flex-col w-full mr-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                {tIndex === 0 ? "Default Cadet List" : `Additional Table ${tIndex}`}
              </span>
              <input 
                className="text-sm font-bold text-indigo-600 uppercase bg-transparent border-b border-transparent hover:border-indigo-200 focus:border-indigo-500 focus:outline-none w-full"
                value={table.title || ""}
                onChange={(e) => {
                   const newTables = [...tables];
                   newTables[tIndex].title = e.target.value;
                   setTables(newTables);
                }}
                placeholder="Table Printed Title (Optional)"
              />
            </div>
            {tIndex > 0 && (
              <button onClick={() => removeTable(table.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md self-start mt-1">
                <Trash2 size={14} />
              </button>
            )}
          </div>


          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  {/* Include checkbox header */}
                  <th className="px-2 py-2 w-10 text-center border-r border-gray-200">
                    <input
                      type="checkbox"
                      title="Select All"
                      checked={table.rows.length > 0 && table.rows.every((_, rIdx) => (checkedRows?.get(table.id) || new Set()).has(rIdx))}
                      onChange={(e) => {
                        setCheckedRows(prev => {
                          const next = new Map(prev);
                          next.set(table.id, e.target.checked ? new Set(table.rows.map((_, i) => i)) : new Set());
                          return next;
                        });
                      }}
                      className="accent-indigo-600"
                    />
                  </th>
                  {table.columns.map((col, cIndex) => (
                    <th key={cIndex} className="px-2 py-2 border-r border-gray-200 min-w-[100px] relative group">
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => updateHeader(tIndex, cIndex, e.target.value)}
                        className="bg-transparent font-bold focus:outline-none focus:text-indigo-600 w-full"
                      />
                      <button 
                        onClick={() => removeColumn(tIndex, cIndex)} 
                        className="absolute right-1 top-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 p-0.5 rounded"
                        title="Delete Column"
                      >
                         <Trash2 size={12} />
                      </button>
                    </th>
                  ))}
                  <th className="px-2 py-2 w-10 text-center bg-gray-50 border-r border-gray-200" title="Page Break">
                     <Scissors size={14} className="mx-auto text-gray-400" />
                  </th>
                  <th className="px-2 py-2 w-10 text-center bg-indigo-50">
                     <button onClick={() => addColumn(tIndex)} className="text-indigo-600 hover:text-indigo-800" title="Add Column">
                        <Plus size={16} />
                     </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rIndex) => {
                  const isChecked = (checkedRows?.get(table.id) || new Set()).has(rIndex);
                  return (
                    <tr key={rIndex} className={`border-b border-gray-100 hover:bg-gray-50 ${isChecked ? "bg-indigo-50/40" : ""} ${table.breaks?.includes(rIndex) ? "border-b-2 border-dashed border-indigo-400" : ""}`}>
                      {/* Row checkbox */}
                      <td className="px-2 py-2 text-center border-r border-gray-100">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setCheckedRows(prev => {
                              const next = new Map(prev);
                              const rowSet = new Set(prev.get(table.id) || []);
                              if (rowSet.has(rIndex)) rowSet.delete(rIndex);
                              else rowSet.add(rIndex);
                              next.set(table.id, rowSet);
                              return next;
                            });
                          }}
                          className="accent-indigo-600"
                        />
                      </td>
                      {row.map((cell, cIndex) => (
                        <td key={cIndex} className="px-2 py-2 border-r border-gray-100">
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => updateCell(tIndex, rIndex, cIndex, e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none p-1"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center border-r border-gray-100 bg-indigo-50/20">
                         <button 
                           onClick={() => togglePageBreak(tIndex, rIndex)} 
                           className={`p-1.5 rounded transition-all ${table.breaks?.includes(rIndex) ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:bg-indigo-100'}`}
                           title="Toggle Page Break after this row"
                         >
                           <Scissors size={14} />
                         </button>
                      </td>
                      <td className="px-2 py-2 text-center bg-red-50/30">
                         <button onClick={() => removeRow(tIndex, rIndex)} className="text-red-400 hover:text-red-600 p-1">
                           <Trash2 size={14} />
                         </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => addRow(tIndex)}
            className="mt-3 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 flex items-center font-medium"
          >
            <Plus size={14} className="mr-1" /> Add Row
          </button>
        </div>
      ))}
    </div>
  );
}
