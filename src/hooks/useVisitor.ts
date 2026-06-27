import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const VISITOR_ID_KEY = `${window.location.hostname}_phantom_visitor_id_local_storage`;

export function useVisitor() {
  const [visitorId, setVisitorId] = useState<string | null>(() =>
    localStorage.getItem(VISITOR_ID_KEY)
  );

  useEffect(() => {
    const handleVisitorRecovery = () => {
      console.warn("[phantom] Visitor not found on backend, clearing and creating new visitor");
      localStorage.removeItem(VISITOR_ID_KEY);
      setVisitorId(null);
    };

    const createVisitor = async () => {
      try {
        const res = await fetch(`${API}/visitors`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { visitorId: string } = await res.json();
        if (data.visitorId) {
          console.log("[phantom] New visitor created:", data.visitorId);
          localStorage.setItem(VISITOR_ID_KEY, data.visitorId);
          setVisitorId(data.visitorId);
        }
      } catch (err) {
        console.error("[phantom] Failed to create visitor:", err);
      }
    };

    const validateAndTouch = async (id: string) => {
      try {
        const res = await fetch(`${API}/visitors?visitorId=${encodeURIComponent(id)}`);
        if (res.status === 404) {
          handleVisitorRecovery();
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        console.log("[phantom] Visitor validated, updating timestamp");
        const patchRes = await fetch(`${API}/visitors`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId: id,
            lastVisitedTimestamp: new Date().toISOString(),
          }),
        });
        if (patchRes.status === 404) {
          handleVisitorRecovery();
        }
      } catch (err) {
        console.error("[phantom] Visitor validation failed:", err);
      }
    };

    if (!visitorId) {
      createVisitor();
    } else {
      validateAndTouch(visitorId);
    }
  }, [visitorId]);

  return visitorId;
}
