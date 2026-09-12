import React, { useState, useEffect } from 'react';
import { MapPin, Sparkles, Smile, Zap } from 'lucide-react';

const FUNNY_MESSAGES = [
  "Hunting down the address records... 🕵️‍♂️",
  "Sorting the pincodes & streets... 📬",
  "Polishing the database records... ✨",
  "Feeding the server hamsters... 🐹⚡",
  "Waking up the cloud functions... ☕",
  "Jumping through the address matrix... 🏃‍♂️💨",
  "Almost there, hang tight! 🎈"
];

export function PageLoader({
  message,
  subMessage,
  minHeight = '320px',
  icon: CustomIcon = MapPin,
  fullscreen = false,
  showFunnyQuote = true
}) {
  const [funnyIndex, setFunnyIndex] = useState(0);

  useEffect(() => {
    if (!showFunnyQuote) return;
    const timer = setInterval(() => {
      setFunnyIndex((prev) => (prev + 1) % FUNNY_MESSAGES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [showFunnyQuote]);

  const displayTitle = message || FUNNY_MESSAGES[funnyIndex];
  const displaySub = subMessage || "Fetching live data with real-time indexing...";

  const content = (
    <div className="funny-loader-wrapper">
      {/* Playful Floating Mascot Orb */}
      <div className="funny-mascot-container">
        <div className="funny-mascot-glow" />
        <div className="funny-mascot-body">
          <CustomIcon size={26} className="funny-mascot-icon" />
        </div>
        <div className="funny-mascot-shadow" />
      </div>

      {/* FUNNY ANIMATED BOUNCING JELLY DOT WAVE WITH SQUASH & STRETCH */}
      <div className="funny-dot-wave-stage">
        {[
          { id: 1, color: '#3b82f6', face: '^‿^', label: 'dot-blue' },
          { id: 2, color: '#8b5cf6', face: '◕‿◕', label: 'dot-purple' },
          { id: 3, color: '#10b981', face: '•‿•', label: 'dot-green' },
          { id: 4, color: '#f59e0b', face: '★‿★', label: 'dot-amber' },
          { id: 5, color: '#ec4899', face: '^o^', label: 'dot-pink' }
        ].map((item, idx) => (
          <div key={item.id} className="funny-dot-column">
            {/* The Bouncing Dot Character */}
            <div 
              className={`funny-jelly-dot dot-bounce-${idx + 1}`}
              style={{ background: item.color }}
            >
              <span className="funny-dot-face">{item.face}</span>
            </div>
            {/* The Dynamic Squash Shadow Beneath the Dot */}
            <div className={`funny-dot-shadow shadow-bounce-${idx + 1}`} />
          </div>
        ))}
      </div>

      {/* Dynamic Animated Status Text */}
      <div className="funny-loader-text-box">
        <div className="funny-bubble-title">
          <Sparkles size={16} className="funny-sparkle-spin" />
          <h4 className="funny-title-text">{displayTitle}</h4>
        </div>
        
        {displaySub && (
          <p className="funny-subtitle-text">{displaySub}</p>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="page-loader-fullscreen">
        {content}
      </div>
    );
  }

  return (
    <div className="card page-loader-container" style={{ minHeight }}>
      {content}
    </div>
  );
}

export default PageLoader;
