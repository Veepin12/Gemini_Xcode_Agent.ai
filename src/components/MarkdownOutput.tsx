import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

function CopyButton({ textToCopy }: { textToCopy: string }) {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="p-1.5 rounded-md flex items-center justify-center transition-colors bg-[#1c1c1f] border border-[#2d2d30] text-[#a1a1aa] hover:bg-[#2d2d30] hover:text-[#e4e4e7]"
      title="Copy to clipboard"
    >
      {isCopied ? <Check size={14} className="text-[#10b981]" /> : <Copy size={14} />}
    </button>
  );
}

// Ultra-polished syntax highlighter powered by highlight.js
function highlight(code: string, lang: string): React.ReactNode {
  const language = (lang || '').toLowerCase();
  
  try {
    if (language && hljs.getLanguage(language)) {
      const highlighted = hljs.highlight(code, { language }).value;
      return (
        <pre className="m-0 select-text overflow-x-auto">
          <code 
            className={`hljs language-${language}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      );
    }
  } catch (err) {
    console.error('highlight.js custom language error:', err);
  }

  // Fallback / Auto-highlighting or plain text
  try {
    const highlighted = hljs.highlightAuto(code).value;
    return (
      <pre className="m-0 select-text overflow-x-auto">
        <code 
          className="hljs"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    );
  } catch {
    return (
      <pre className="m-0 select-text overflow-x-auto font-mono">
        <code>{code}</code>
      </pre>
    );
  }
}

export function MarkdownOutput({ content, lightMode = false }: { content: string; lightMode?: boolean }) {
  return (
    <div className={`max-w-full text-left text-[15px] leading-[1.6] ${lightMode ? 'text-zinc-800' : 'text-[#e4e4e7]'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Main headings
          h1: ({ children }) => <h1 className={`text-xl font-bold mb-4 mt-6 border-b pb-2 ${lightMode ? 'text-zinc-900 border-zinc-200' : 'text-white border-[#2d2d30]'}`}>{children}</h1>,
          h2: ({ children }) => <h2 className={`text-lg font-bold mb-3 mt-5 ${lightMode ? 'text-zinc-900' : 'text-white'}`}>{children}</h2>,
          h3: ({ children }) => <h3 className={`text-md font-semibold mb-2 mt-4 ${lightMode ? 'text-zinc-800' : 'text-white'}`}>{children}</h3>,
          
          // Paragraphs and text
          p: ({ children }) => <p className={`mb-4 leading-[1.6] ${lightMode ? 'text-zinc-800' : 'text-[#e4e4e7]'}`}>{children}</p>,
          
          // Lists
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className={lightMode ? 'text-zinc-800' : 'text-[#e4e4e7]'}>{children}</li>,
          
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className={`border-l-4 pl-4 italic my-4 py-1 pr-2 rounded-r ${lightMode ? 'border-zinc-300 bg-zinc-100 text-zinc-650' : 'border-[#3f3f46] bg-[#141416]/50 text-[#a1a1aa]'}`}>
              {children}
            </blockquote>
          ),
          
          // Inline and block code
          code: ({ children, className, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            const languageName = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code className={`font-mono px-1.5 py-0.5 rounded text-[13.5px] border ${lightMode ? 'bg-[#f4f4f5] text-rose-600 border-zinc-200' : 'bg-[#1c1c1f] text-[#f43f5e] border-[#2d2d30]'}`}>
                  {children}
                </code>
              );
            }

            return (
              <div className={`my-[18px] border rounded-lg p-5 pt-10 font-mono text-[13px] leading-[1.5] relative w-full overflow-x-auto group ${lightMode ? 'bg-[#f4f4f5] text-zinc-900 border-zinc-200 shadow-sm' : 'bg-[#121214] border-[#2d2d30] text-[#d4d4d8]'}`}>
                {/* Elegant label at the top-left */}
                {languageName && (
                  <div className={`absolute top-2.5 left-4 text-[10px] uppercase font-mono tracking-wider font-bold select-none ${lightMode ? 'text-zinc-500' : 'text-[#10b981]'}`}>
                    {languageName}
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-3 select-none z-10">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <CopyButton textToCopy={codeString} />
                  </div>
                </div>
                <div className="overflow-x-auto leading-[1.6]">
                  {highlight(codeString, languageName)}
                </div>
              </div>
            );
          },

          // Tables
          table: ({ children }) => (
            <div className={`overflow-x-auto w-full my-4 border rounded-lg ${lightMode ? 'border-zinc-200 shadow-sm' : 'border-[#2d2d30]'}`}>
              <table className={`min-w-full divide-y text-left text-[14px] ${lightMode ? 'divide-zinc-200' : 'divide-[#2d2d30]'}`}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className={lightMode ? 'bg-zinc-50' : 'bg-[#141416]'}>{children}</thead>,
          tbody: ({ children }) => <tbody className={`divide-y ${lightMode ? 'divide-zinc-200 bg-white' : 'divide-[#2d2d30] bg-[#09090b]/50'}`}>{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th className={`px-4 py-3 font-semibold select-none ${lightMode ? 'text-zinc-900' : 'text-white'}`}>{children}</th>,
          td: ({ children }) => <td className={`px-4 py-3 ${lightMode ? 'text-zinc-650' : 'text-[#a1a1aa]'}`}>{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
