"use client";

import { Printer, X, ZoomIn, ZoomOut, Maximize, FileDown } from "lucide-react";
import { useEffect, useState } from "react";

const MIN = 0.3;
const MAX = 2;
const STEP = 0.1;

export function PrintActions({ docNo, id }: { docNo: string; id: number }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    document.title = `${docNo} — หนังสือรับรองหัก ณ ที่จ่าย`;
  }, [docNo]);

  // apply zoom to the printed sheet
  useEffect(() => {
    const sheet = document.querySelector<HTMLElement>(".sheet");
    if (sheet) {
      sheet.style.transform = `scale(${zoom})`;
      sheet.style.transformOrigin = "top center";
    }
  }, [zoom]);

  const dec = () => setZoom((z) => Math.max(MIN, +(z - STEP).toFixed(2)));
  const inc = () => setZoom((z) => Math.min(MAX, +(z + STEP).toFixed(2)));
  const reset = () => setZoom(1);

  return (
    <div className="print-toolbar">
      <button onClick={() => window.print()} className="btn btn-primary">
        <Printer size={16} />
        พิมพ์
      </button>

      <a href={`/api/withholding/${id}/pdf?download=1`} className="btn btn-pdf">
        <FileDown size={16} />
        PDF
      </a>

      <div className="zoom-group">
        <button onClick={dec} className="btn btn-icon" title="ย่อ">
          <ZoomOut size={16} />
        </button>
        <button onClick={reset} className="btn btn-zoom" title="ขนาดจริง 100%">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={inc} className="btn btn-icon" title="ขยาย">
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setZoom(0.75)}
          className="btn btn-icon"
          title="พอดีหน้าจอ"
        >
          <Maximize size={16} />
        </button>
      </div>

      <button
        onClick={() => {
          window.close();
          if (!window.closed) history.back();
        }}
        className="btn"
      >
        <X size={16} />
        ปิด
      </button>

      <style>{`
        .print-toolbar {
          position: sticky; top: 0; z-index: 10;
          display: flex; gap: 8px; justify-content: center; align-items: center;
          padding: 8px; background: #fafafa; border-bottom: 1px solid #ddd;
        }
        .btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 6px;
          background: #fff; border: 1px solid #ccc; cursor: pointer;
          font-size: 13px; color: #333;
        }
        .btn:hover { background: #f0f0f0; }
        .btn-primary { background: #18181b; color: #fff; border-color: #18181b; }
        .btn-primary:hover { background: #27272a; }
        .btn-pdf { background: #dc2626; color: #fff; border-color: #dc2626; text-decoration: none; }
        .btn-pdf:hover { background: #b91c1c; }
        .btn-icon { padding: 6px 9px; }
        .btn-zoom {
          min-width: 54px; justify-content: center;
          font-variant-numeric: tabular-nums;
        }
        .zoom-group {
          display: flex; gap: 4px; align-items: center;
          padding: 0 6px; border-left: 1px solid #ddd;
          border-right: 1px solid #ddd;
        }
        @media print {
          .print-toolbar { display: none; }
        }
      `}</style>
    </div>
  );
}
