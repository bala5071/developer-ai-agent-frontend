export default function AgentCard({ agent, isActive }) {
  const statusStyles = {
    idle:    { color: '#6b7a99', label: 'Waiting',  dot: '○' },
    running: { color: '#5db8ff', label: 'Running…', dot: '●' },
    done:    { color: '#4ade80', label: 'Done ✓',  dot: '✓' },
    error:   { color: '#f87171', label: 'Error',    dot: '✕' },
  };

  
  const style = statusStyles[agent.status] || statusStyles.idle;

  
  return (
    <div style={{
      padding: '16px',
      border: `1px solid ${isActive ? '#5db8ff' : '#2e3250'}`,
      borderRadius: '10px',
      background: '#1a1d27',
      transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>{agent.icon}</span>
        <strong style={{ fontSize: '15px' }}>{agent.name}</strong>

        
        {isActive && (
          <span style={{
            marginLeft: 'auto', fontSize: '11px',
            background: '#1a2535', color: '#5db8ff',
            padding: '2px 8px', borderRadius: '99px',
          }}>Active</span>
        )}
      </div>

      <p style={{ fontSize: '12px', color: '#6b7a99', marginBottom: '10px', lineHeight: '1.5' }}>
        {agent.description}
      </p>

      <span style={{ fontSize: '13px', color: style.color, fontWeight: '600' }}>
        {style.dot} {style.label}
      </span>

  
      {agent.status === 'done' && agent.output && (
        <p style={{
          marginTop: '10px', fontSize: '11px', color: '#8b90a8',
          borderTop: '1px solid #2e3250', paddingTop: '8px',
          fontFamily: 'monospace', lineHeight: '1.5',
        }}>
          {agent.output.substring(0, 120)}…
        </p>
      )}
    </div>
  );
}