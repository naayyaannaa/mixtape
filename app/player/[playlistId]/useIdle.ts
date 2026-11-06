import { useEffect, useState } from "react";

/** True once the pointer hasn't moved (or touched/clicked) for `ms`; false again on the next movement. */
export function useIdle(ms: number) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), ms);
    const wake = () => {
      clearTimeout(timer);
      setIdle(false);
      timer = setTimeout(() => setIdle(true), ms);
    };
    const events = ["pointermove", "pointerdown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [ms]);

  return idle;
}
