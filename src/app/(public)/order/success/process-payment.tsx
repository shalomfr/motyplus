"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Client component that processes iCount payment data from URL params.
 * Acts as fallback if the IPN webhook didn't fire.
 * Calls /api/public/process-icount-success with the URL params.
 */
export function ProcessPayment() {
  const searchParams = useSearchParams();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    let pendingOrderId = "";

    // Method 1: direct param (iCount strips m__ prefix)
    pendingOrderId = params.get("pendingOrderId") || "";

    // Method 2: m__ prefixed param
    if (!pendingOrderId) {
      pendingOrderId = params.get("m__pendingOrderId") || "";
    }

    // Method 3: custom[{json}] format (legacy)
    if (!pendingOrderId) {
      for (const [key] of params.entries()) {
        if (key.startsWith("custom[") || key.startsWith("custom%5B")) {
          try {
            const match = key.match(/custom[\[%5B](.+?)[\]%5D]/i);
            if (match) {
              const decoded = decodeURIComponent(match[1]);
              const parsed = JSON.parse(decoded);
              if (parsed.pendingOrderId) {
                pendingOrderId = parsed.pendingOrderId;
              }
            }
          } catch { /* skip */ }
        }
      }
    }

    if (!pendingOrderId) return;

    // Fire and forget — process the payment
    fetch("/api/public/process-icount-success", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pendingOrderId,
        docnum: searchParams.get("docnum"),
        doc_url: searchParams.get("doc_url"),
        total: searchParams.get("sum") || searchParams.get("total_paid"),
        confirmation_code: searchParams.get("confirmation_code"),
        customer_id: searchParams.get("customer_id"),
        cp: searchParams.get("cp"),
      }),
    }).catch(() => { /* silent — webhook should handle it anyway */ });
  }, [searchParams]);

  return null;
}
