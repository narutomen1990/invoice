"use client";

import { Printer, X } from "lucide-react";
import { useEffect } from "react";

export function PrintActions({ docNo }: { docNo: string }) {
  useEffect(() => {
    document.title = `${docNo} — พิมพ์ใบกำกับภาษี`;
  }, [docNo]);

  return (
    <div className="print-toolbar">
      <button onClick={() => window.print()} className="btn btn-primary">
        <Printer size={16} />
        พิมพ์
      </button>
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
          display: flex; gap: 8px; justify-content: center;
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
        @media print { .print-toolbar { display: none; } }
      `}</style>
    </div>
  );
}
