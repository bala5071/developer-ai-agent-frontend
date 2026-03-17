// We don't need any imports here — this is a "pure" component.
// It only receives data (props) and returns HTML-like JSX.

// The function name IS the component name.
// "export default" means other files can import it.
export default function AgentCard({ agent, isActive }) {
  // "agent" and "isActive" come from the PARENT component (App.jsx)
  // This is called "destructuring props" — pulling values from the props object

  // A lookup table: maps status → colors and label
  // Why an object instead of if/else? Cleaner and easier to add new statuses.
  const statusStyles = {
    idle:    { color: '#6b7a99', label: 'Waiting',  dot: '○' },
    running: { color: '#5db8ff', label: 'Running…', dot: '●' },
    done:    { color: '#4ade80', label: 'Done ✓',  dot: '✓' },
    error:   { color: '#f87171', label: 'Error',    dot: '✕' },
  };

  // Get the style for the current status, fall back to "idle" if unknown
  const style = statusStyles[agent.status] || statusStyles.idle;

  // JSX looks like HTML but has two key rules:
  // 1. Use className instead of class (because "class" is a reserved word in JS)
  // 2. JavaScript expressions go inside { curly braces }
  return (
    <div style={{
      padding: '16px',
      border: `1px solid ${isActive ? '#5db8ff' : '#2e3250'}`,
      // Template literal: if isActive is true, use blue border, else dark border
      borderRadius: '10px',
      background: '#1a1d27',
      transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>{agent.icon}</span>
        <strong style={{ fontSize: '15px' }}>{agent.name}</strong>

        // Conditional rendering: only show "Active" badge when isActive is true
        // The && operator: if left side is true, render right side. If false, render nothing.
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

      // Ternary operator: condition ? show_if_true : show_if_false
      // Here: if status is "done" AND there's output text, show a preview
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