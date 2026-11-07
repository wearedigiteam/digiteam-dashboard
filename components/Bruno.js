// Bruno, the dashboard's AI assistant: his face appears wherever he speaks.
export function BrunoAvatar({ size = 28, className = '' }) {
  return (
    <img src="/eggs/bruno.png" alt="Bruno" width={size} height={size} className={`dt-bruno-avatar ${className}`}
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
  );
}

// A message from Bruno: avatar on the left, speech bubble on the right
export function BrunoSays({ children, size = 36, style }) {
  return (
    <div className="dt-bruno-says" style={style}>
      <BrunoAvatar size={size} />
      <div className="dt-bruno-bubble">{children}</div>
    </div>
  );
}
