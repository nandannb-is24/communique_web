import { useState, useRef, useEffect } from "react";
import { Sparkles, Bold, Italic, Underline, Plus, Trash2 } from "lucide-react";
import Groq from "groq-sdk";

const editorClass =
  "w-full min-h-[88px] p-3 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

export default function ParagraphEditor({ paras, setParas, groqApiKey }) {
  const [loading, setLoading] = useState(false);

  const handleEnhance = async (index) => {
    const apiKey = groqApiKey;
    if (!apiKey) return;
    if (!paras[index].trim()) return;

    setLoading(true);
    try {
      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
      const response = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are an expert formal letter editor. Enhance the grammar, tone, and clarity of the following paragraph to make it highly professional. Preserve any HTML formatting tags like <b>, <i>, or <u>. Return only the improved text with no extra commentary.",
          },
          { role: "user", content: paras[index] },
        ],
        model: "llama-3.3-70b-versatile",
      });
      const enhanced = response.choices[0]?.message?.content || paras[index];
      const copy = [...paras];
      copy[index] = enhanced.trim();
      setParas(copy);
    } catch (err) {
      console.error(err);
      alert("AI Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const execCommand = (cmd) => document.execCommand(cmd, false, null);
  const removePara = (index) => setParas(paras.filter((_, i) => i !== index));

  return (
    <div className="space-y-2.5">
      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 bg-gray-100 border border-gray-200 rounded-lg p-1 w-fit">
        {[
          { cmd: "bold", Icon: Bold, title: "Bold (Ctrl+B)" },
          { cmd: "italic", Icon: Italic, title: "Italic (Ctrl+I)" },
          { cmd: "underline", Icon: Underline, title: "Underline (Ctrl+U)" },
        ].map(({ cmd, Icon, title }) => (
          <button
            key={cmd}
            onMouseDown={(e) => { e.preventDefault(); execCommand(cmd); }}
            title={title}
            className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm transition-all"
          >
            <Icon size={13} />
          </button>
        ))}
      </div>

      {/* Paragraph boxes */}
      {paras.map((p, i) => (
        <EditableParagraph
          key={i}
          initialHtml={p}
          index={i}
          onChange={(newHtml) => {
            const copy = [...paras];
            copy[i] = newHtml;
            setParas(copy);
          }}
          onEnhance={() => handleEnhance(i)}
          onRemove={() => removePara(i)}
          showRemove={paras.length > 1}
          loading={loading}
        />
      ))}

      <button
        onClick={() => setParas([...paras, ""])}
        className="flex items-center gap-2 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors mt-1 group"
      >
        <span className="w-5 h-5 rounded-full border border-indigo-300 flex items-center justify-center group-hover:border-indigo-500 group-hover:bg-indigo-50 transition-all">
          <Plus size={11} />
        </span>
        Add Paragraph
      </button>
    </div>
  );
}

function EditableParagraph({ initialHtml, index, onChange, onEnhance, onRemove, showRemove, loading }) {
  const editorRef = useRef(null);
  const lastSyncRef = useRef(null); // Start as null to force initial sync

  // Sync state if initialHtml changes from OUTSIDE (like AI enhance)
  useEffect(() => {
    if (editorRef.current && initialHtml !== lastSyncRef.current) {
      editorRef.current.innerHTML = initialHtml;
      lastSyncRef.current = initialHtml;
    }
  }, [initialHtml]);


  return (
    <div className="relative group">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={editorClass + " outline-none"}
        onInput={(e) => {
          const newHtml = e.currentTarget.innerHTML;
          lastSyncRef.current = newHtml;
          onChange(newHtml);
        }}
      />



      {/* Hover-reveal action buttons */}
      <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEnhance}
          disabled={loading}
          title="Enhance with AI"
          className="p-1.5 rounded-md bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-all disabled:opacity-40 shadow-sm"
        >
          <Sparkles size={13} className={loading ? "animate-pulse" : ""} />
        </button>
        {showRemove && (
          <button
            onClick={onRemove}
            title="Remove paragraph"
            className="p-1.5 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all shadow-sm"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
