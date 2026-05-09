import { useState } from "react";
import { FileText, Calendar, AlignLeft, Table, PenLine, ChevronDown, ChevronRight, Settings } from "lucide-react";
import ParagraphEditor from "./ParagraphEditor";
import TableBuilder from "./TableBuilder";

function Section({ icon: Icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-5 hover:bg-gray-50 transition-colors group"
      >
        <div className="flex items-center gap-3.5">
          <Icon size={18} className="text-indigo-500 shrink-0" />
          <span className="text-[15px] font-semibold text-gray-600 group-hover:text-gray-800 transition-colors">
            {title}
          </span>
        </div>
        {open
          ? <ChevronDown size={15} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
          : <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
        }
      </button>
      {open && <div className="px-5 pb-5 pt-1 space-y-3.5">{children}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold tracking-wide uppercase text-gray-400">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-700 placeholder-gray-300 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

export default function EditorPanel({ state }) {
  const {
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
  } = state;

  return (
    <div className="w-[440px] bg-white flex flex-col flex-shrink-0 overflow-y-auto print:hidden h-full border-r border-gray-100 shadow-[1px_0_20px_0_rgba(0,0,0,0.04)]">

      {/* Header */}
      <div className="px-5 py-5 border-b border-gray-100 shrink-0 bg-white">
        <div className="flex items-center gap-4">
          <img src="/communique_logo.png" alt="Logo" className="w-10 h-10 rounded-xl shadow-md" />
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Communiqué</h1>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1">

        <Section icon={FileText} title="Header" defaultOpen={false}>
          <Field label="Letter Type">
            <select
              className={inputClass + " appearance-none cursor-pointer"}
              value={letterType}
              onChange={(e) => setLetterType(e.target.value)}
            >
              <option value="To">To Address (Standard Letter)</option>
              <option value="Submitted">Submitted (Internal / Approval)</option>
              <option value="Through">Through (Proper Channel)</option>
            </select>
          </Field>

          {letterType !== "Submitted" && (
            <Field label={`${letterType} Address`}>
              <textarea
                className={inputClass}
                rows={3}
                placeholder={`The Principal\nCollege Name\nCity`}
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
              />
            </Field>
          )}

          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="Salutation">
            <input
              type="text"
              className={inputClass}
              placeholder="Respected Sir,"
              value={salutation}
              onChange={(e) => setSalutation(e.target.value)}
            />
          </Field>

          <Field label="Subject">
            <textarea
              className={inputClass}
              rows={2}
              placeholder="Requisition for..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
        </Section>

        <Section icon={AlignLeft} title="Body Paragraphs" defaultOpen={false}>
          <ParagraphEditor paras={paragraphs} setParas={setParagraphs} groqApiKey={groqApiKey} />
        </Section>

        <Section icon={Table} title="Cadet Table" defaultOpen={false}>
          <TableBuilder
            tables={tables}
            setTables={setTables}
            checkedRows={checkedRows}
            setCheckedRows={setCheckedRows}
          />
        </Section>

        <Section icon={AlignLeft} title="Closing Paragraphs" defaultOpen={false}>
          <ParagraphEditor paras={postParagraphs} setParas={setPostParagraphs} groqApiKey={groqApiKey} />
        </Section>

        <Section icon={PenLine} title="Signature" defaultOpen={false}>
          <Field label="Name">
            <input
              type="text"
              className={inputClass}
              value={signature.name}
              onChange={(e) => setSignature({ ...signature, name: e.target.value })}
            />
          </Field>
          <Field label="Role / Designation">
            <input
              type="text"
              className={inputClass}
              value={signature.role}
              onChange={(e) => setSignature({ ...signature, role: e.target.value })}
            />
          </Field>
        </Section>

        <Section icon={Settings} title="Settings" defaultOpen={false}>
          <Field label="Groq API Key (Optional)">
            <input
              type="password"
              className={inputClass}
              placeholder="Leave blank to use default app key..."
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
            />
          </Field>
          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
            The app uses a built-in server proxy by default. If you encounter rate limits, you can enter your own personal Groq API key here to bypass them. It is stored securely on your device.
          </p>
        </Section>

      </div>

      {/* Footer / Prototype Warning */}
      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
        <p className="text-[10px] text-gray-400 text-center leading-relaxed">
          <span className="font-semibold text-amber-500 uppercase tracking-wider">Prototype</span><br />
          Any issues? Reach out at:<br />
          <a href="mailto:rvcecdtnandannaniyappanb@gmail.com" className="text-indigo-400 hover:text-indigo-600 transition-colors">
            rvcecdtnandannaniyappanb@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}