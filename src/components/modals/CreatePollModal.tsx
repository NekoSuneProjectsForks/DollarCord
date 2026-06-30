"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";

interface Props {
  open: boolean;
  onClose: () => void;
  channelId: string;
}

export function CreatePollModal({ open, onClose, channelId }: Props) {
  const { addToast } = useToast();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setQuestion("");
    setOptions(["", ""]);
    setMultiple(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) {
      addToast("Add a question and at least 2 options.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), options: opts, multiple }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || "Failed to create poll", "error"); return; }
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full bg-dc-input text-dc-text px-3 py-2 rounded border border-dc-border focus:border-dc-accent focus:outline-none text-sm";

  return (
    <Modal open={open} onClose={onClose} title="Create a Poll">
      <form onSubmit={submit} className="space-y-3">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question…" maxLength={300} className={inputCls} />
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={opt}
              onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
              placeholder={`Option ${i + 1}`}
              maxLength={100}
              className={inputCls}
            />
            {options.length > 2 && (
              <button type="button" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))} className="px-2 text-dc-muted hover:text-dc-danger">✕</button>
            )}
          </div>
        ))}
        {options.length < 10 && (
          <button type="button" onClick={() => setOptions((prev) => [...prev, ""])} className="text-sm text-dc-accent hover:underline">
            + Add option
          </button>
        )}
        <label className="flex items-center gap-2 text-sm text-dc-muted">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="accent-dc-accent" />
          Allow multiple choices
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-dc-muted hover:text-dc-text">Cancel</button>
          <button type="submit" disabled={busy} className="rounded bg-dc-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dc-accent-hover disabled:opacity-50">
            {busy ? "Creating…" : "Create Poll"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
