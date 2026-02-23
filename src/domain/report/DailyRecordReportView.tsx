// src/ui/report/DailyRecordReportView.tsx
import React, { useMemo, useState } from "react";
import type { DailyRecordAggregate } from "../../domain/type";
import {
  buildDailyRecordReport,
  type ReportAudience,
} from "../../domain/report/dailyRecordReport";

type Props = {
  record: DailyRecordAggregate;
  onSave: () => Promise<boolean> | boolean;
};

type MessageState = {
  saveOk: boolean | null;
  copyOk: boolean | null;
};

export const DailyRecordReportView: React.FC<Props> = ({ record, onSave }) => {
  const [audience, setAudience] = useState<ReportAudience>("chatgpt");
  const [isProcessing, setIsProcessing] = useState(false);
  const [messageState, setMessageState] = useState<MessageState>({
    saveOk: null,
    copyOk: null,
  });

  const reportText = useMemo(
    () => buildDailyRecordReport(record, { audience }),
    [record, audience]
  );

  const handleCopyAndSave = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    let saveOk = false;
    let copyOk = false;

    try {
      const result = await onSave();
      saveOk = !!result;
    } catch {
      saveOk = false;
    }

    try {
      if (navigator?.clipboard && reportText) {
        await navigator.clipboard.writeText(reportText);
        copyOk = true;
      } else {
        copyOk = false;
      }
    } catch {
      copyOk = false;
    }

    setMessageState({ saveOk, copyOk });
    setIsProcessing(false);
  };

  const renderMessage = () => {
    const { saveOk, copyOk } = messageState;
    if (saveOk === null && copyOk === null) return null;

    const parts: string[] = [];
    if (saveOk === true) parts.push("保存したよ");
    if (saveOk === false) parts.push("保存失敗しちゃった");
    if (copyOk === true) parts.push("クリップボードにコピーしたよ");
    if (copyOk === false) parts.push("コピー失敗しちゃった");

    if (!parts.length) return null;
    return (
      <p style={{ marginTop: 8, fontSize: 12 }}>
        {parts.join(" / ")}
      </p>
    );
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* 上段：audience切り替え＋ボタン */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <label>
            <input
              type="radio"
              name="reportAudience"
              value="chatgpt"
              checked={audience === "chatgpt"}
              onChange={() => setAudience("chatgpt")}
            />
            <span style={{ marginLeft: 4 }}>ChatGPT向け</span>
          </label>
          <label>
            <input
              type="radio"
              name="reportAudience"
              value="dietitian"
              checked={audience === "dietitian"}
              onChange={() => setAudience("dietitian")}
            />
            <span style={{ marginLeft: 4 }}>栄養士向け</span>
          </label>
          <label>
            <input
              type="radio"
              name="reportAudience"
              value="copilot"
              checked={audience === "copilot"}
              onChange={() => setAudience("copilot")}
            />
            <span style={{ marginLeft: 4 }}>Copilot向け</span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleCopyAndSave}
          disabled={isProcessing}
          style={{
            padding: "6px 12px",
            fontWeight: 600,
            borderRadius: 4,
            border: "1px solid #ccc",
          }}
        >
          {isProcessing ? "処理中..." : "レポートをコピーして保存"}
        </button>
      </div>

      {renderMessage()}

      {/* レポート本文 */}
      <div
        style={{
          marginTop: 4,
          border: "1px solid #ddd",
          borderRadius: 4,
          padding: 8,
          // maxHeight と overflow を削除
          backgroundColor: "#fafafa",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 13,
          whiteSpace: "pre-wrap",
        }}
      >
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {reportText}
        </pre>
      </div>
    </section>
  );
};
