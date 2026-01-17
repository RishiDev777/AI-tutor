import React from 'react';

interface MarkdownTextProps {
  content: string;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ content }) => {
  // Preprocess text to replace common LaTeX math symbols with Unicode
  const processText = (text: string) => {
    return text
      // Arrows
      .replace(/\\(rightarrow|to|longrightarrow)/gi, '→')
      .replace(/\\(leftarrow|longleftarrow)/gi, '←')
      .replace(/\\(leftrightarrow)/gi, '↔')
      .replace(/\\(implies|Rightarrow)/gi, '⇒')
      .replace(/\\(iff|Leftrightarrow)/gi, '⇔')
      // Math operators
      .replace(/\\(times)/gi, '×')
      .replace(/\\(div)/gi, '÷')
      .replace(/\\(approx)/gi, '≈')
      .replace(/\\(neq|ne)/gi, '≠')
      .replace(/\\(leq|le)/gi, '≤')
      .replace(/\\(geq|ge)/gi, '≥')
      .replace(/\\(pm)/gi, '±')
      .replace(/\\(cdot)/gi, '·')
      // Superscripts (x^2 -> x²)
      .replace(/\^0/g, '⁰')
      .replace(/\^1/g, '¹')
      .replace(/\^2/g, '²')
      .replace(/\^3/g, '³')
      .replace(/\^4/g, '⁴')
      .replace(/\^5/g, '⁵')
      .replace(/\^6/g, '⁶')
      .replace(/\^7/g, '⁷')
      .replace(/\^8/g, '⁸')
      .replace(/\^9/g, '⁹')
      .replace(/\^(-?\d+)/g, '($1)') // Fallback for complex powers
      // Subscripts (H_2O -> H₂O)
      .replace(/_0/g, '₀')
      .replace(/_1/g, '₁')
      .replace(/_2/g, '₂')
      .replace(/_3/g, '₃')
      .replace(/_4/g, '₄')
      .replace(/_5/g, '₅')
      .replace(/_6/g, '₆')
      .replace(/_7/g, '₇')
      .replace(/_8/g, '₈')
      .replace(/_9/g, '₉')
      // Greek letters (common ones)
      .replace(/\\(alpha)/gi, 'α')
      .replace(/\\(beta)/gi, 'β')
      .replace(/\\(theta)/gi, 'θ')
      .replace(/\\(pi)/gi, 'π')
      .replace(/\\(delta)/gi, 'δ')
      .replace(/\\(Delta)/g, 'Δ') 
      .replace(/\\(lambda)/gi, 'λ')
      .replace(/\\(mu)/gi, 'μ')
      .replace(/\\(sigma)/gi, 'σ')
      .replace(/\\(omega)/gi, 'ω')
      .replace(/\\(Omega)/g, 'Ω')
      // Degree
      .replace(/\\(degree|circ)/gi, '°')
      // Text command removal
      .replace(/\\text\{([^}]+)\}/g, '$1')
      // Remove LaTeX delimiters if they remain
      .replace(/\$([^\$]+)\$/g, '$1') 
      .replace(/\$/g, ''); 
  };

  const processedContent = processText(content);
  const lines = processedContent.split('\n');

  return (
    <div className="space-y-1 leading-relaxed">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (trimmed === '') return <div key={index} className="h-4" />;

        // Header detection (simple)
        if (trimmed.startsWith('### ')) {
           return <h4 key={index} className="font-bold text-base text-slate-800 mt-4 mb-2">{trimmed.replace('### ', '')}</h4>;
        }
        if (trimmed.startsWith('## ')) {
           return <h3 key={index} className="font-bold text-lg text-blue-800 mt-5 mb-3">{trimmed.replace('## ', '')}</h3>;
        }
        if (trimmed.startsWith('# ')) {
           return <h2 key={index} className="font-bold text-xl text-blue-900 mt-6 mb-4 border-b pb-2">{trimmed.replace('# ', '')}</h2>;
        }

        // Bullet points
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ');
        
        // Numbered lists (e.g., "1. " or "1) ")
        const numberedListMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);
        const isNumbered = !!numberedListMatch;

        let displayContent = line;
        
        if (isBullet) {
            displayContent = trimmed.replace(/^[-•*]\s+/, '');
        } else if (isNumbered && numberedListMatch) {
            displayContent = numberedListMatch[2];
        }

        // Bold formatting parser
        const parts = displayContent.split(/(\*\*.*?\*\*)/g);

        return (
          <div 
            key={index} 
            className={`
              ${isBullet ? 'pl-5 relative' : ''} 
              ${isNumbered ? 'pl-6 relative' : ''}
            `}
          >
             {isBullet && (
                 <span className="absolute left-0 top-0.5 text-blue-500">•</span>
             )}
             {isNumbered && numberedListMatch && (
                 <span className="absolute left-0 top-0 font-medium text-slate-500 text-sm">{numberedListMatch[1]}.</span>
             )}

            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
              }
              return <span key={i}>{part}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
};