import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { getPipelineDownloadUrl } from '../services/api';

interface CodeExportProps {
  code: string;
}

export const CodeExport: React.FC<CodeExportProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <h2 className="panel-title font-mono">datalysis_pipeline.py</h2>
          <p className="panel-sub">
            A <code className="text-ink">ColumnTransformer</code> with the imputers, outlier handling, scalers and encoders chosen for each column. {code.split('\n').length} lines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-good" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <a href={getPipelineDownloadUrl()} download="datalysis_pipeline.py" className="btn btn-primary">
            <Download className="h-4 w-4" aria-hidden /> Download .py
          </a>
        </div>
      </div>
      <pre
        tabIndex={0}
        aria-label="Generated pipeline code"
        className="max-h-[70vh] overflow-auto bg-sunken p-5 text-[0.8125rem] leading-6 text-ink"
      >
        <code>{code}</code>
      </pre>
    </section>
  );
};
