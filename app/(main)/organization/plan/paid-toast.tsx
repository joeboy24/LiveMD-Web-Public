"use client";

import { useEffect, useState } from "react";
import { Toast } from "../../../components/toast";

export function PaidToast({ sessionId }: { sessionId: string | null }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const key = `livemd-paid:${sessionId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setMessage("Payment successful.");
  }, [sessionId]);

  return <Toast message={message} tone="success" onDone={() => setMessage(null)} />;
}
