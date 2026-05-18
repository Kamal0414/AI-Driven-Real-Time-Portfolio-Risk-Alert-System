import { useEffect, useState } from 'react';

/** Pulsing dot showing the dashboard is live-polling. */
export function LiveIndicator() {
  const [pulseOn, setPulseOn] = useState(true);
  useEffect(() => {
    const id = window.setInterval(() => setPulseOn((p) => !p), 1500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="live-indicator" aria-label="live">
      <span className={`live-dot ${pulseOn ? 'on' : 'off'}`} />
      <span className="live-text">Live</span>
    </span>
  );
}
