// "export default function" — this is how every React component starts
// Props: outputs (the text content), activeTab (which tab is selected),
//        setActiveTab (function to change the selected tab)
export default function OutputPanel({ outputs, activeTab, setActiveTab }) {

  // Define the tabs as an array of objects.
  // Why an array? So we can use .map() to render them — no repetition!
  const tabs = [
    { id: 'architecture', label: '🏗 Architecture', content: outputs.architecture },
    { id: 'code',         label: '💻 Code',         content: outputs.code },
    { id: 'tests',        label: '🧪 Test Report', content: outputs.tests },
  ];

  return (
    <div style={{ border: '1px solid #2e3250', borderRadius: '10px', overflow: 'hidden' }}>

      // Tab buttons row
      <div style={{ display: 'flex', background: '#1a1d27', borderBottom: '1px solid #2e3250' }}>

        // .map() loops through the tabs array.
        // For each tab object, it returns a button element.
        // The "key" prop is REQUIRED — React uses it to track list items.
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            // Disable the tab button if there's no content yet
            disabled={!tab.content}
            style={{
              padding: '10px 18px', fontSize: '13px', cursor: tab.content ? 'pointer' : 'default',
              background: 'none', border: 'none',
              // Active tab has a blue bottom border; inactive tabs have transparent border
              borderBottom: activeTab === tab.id ? '2px solid #5db8ff' : '2px solid transparent',
              color: activeTab === tab.id ? '#e8eaf0' : '#6b7a99',
              fontWeight: activeTab === tab.id ? '600' : '400',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      // Content area — shows the text for whichever tab is active
      <div style={{
        padding: '20px', minHeight: '250px', maxHeight: '400px', overflowY: 'auto',
        fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.7',
        color: '#8b90a8', background: '#12151f', whiteSpace: 'pre-wrap',
      }}>
        // Find the tab object whose id matches activeTab, then get its content.
        // The ?. is "optional chaining" — if .find() returns undefined, this won't crash.
        {tabs.find(t => t.id === activeTab)?.content || (
          <span style={{ color: '#3d4265', fontStyle: 'italic' }}>
            Waiting for agent output…
          </span>
        )}
      </div>
    </div>
  );
}