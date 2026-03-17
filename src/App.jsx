// Import React hooks we need.
// useState = gives components memory
// useEffect = runs code in response to state changes
// useRef = direct access to a DOM element
import { useState, useEffect, useRef } from 'react';

// Import our custom components (the building blocks we just made)
import AgentCard from './components/AgentCard';
import OutputPanel from './components/OutputPanel';

// The main component. "export default" means this is the MAIN thing in this file.
export default function App() {

  // ─── STATE DECLARATIONS ───────────────────────────────────────────
  // Think of these as "smart variables" that trigger re-renders when changed.
  // Syntax: const [currentValue, functionToUpdateValue] = useState(startingValue)
  // ──────────────────────────────────────────────────────────────────

  // The text the user types into the prompt box
  const [prompt, setPrompt] = useState('');

  // Is the pipeline currently running? Used to disable the button.
  const [isRunning, setIsRunning] = useState(false);

  // Which agent is currently doing work: null | 'architect' | 'developer' | 'tester' | 'github'
  const [currentPhase, setCurrentPhase] = useState(null);

  // Show/hide the "approve commit" panel
  const [showApproval, setShowApproval] = useState(false);

  // The status message shown to the user
  const [statusMsg, setStatusMsg] = useState('');

  // Which tab is showing in the output panel
  const [activeTab, setActiveTab] = useState('architecture');

  // An object storing the text outputs of each agent stage
  const [outputs, setOutputs] = useState({ architecture: '', code: '', tests: '' });

  // The status and output of all four agents, stored as an object.
  // We use an OBJECT (not an array) so we can do agents.architect, agents.developer, etc.
  const [agents, setAgents] = useState({
    architect: { name: 'Architect',  icon: '🏗', description: 'Analyzes your idea and designs the architecture.', status: 'idle', output: '' },
    developer: { name: 'Developer',  icon: '💻', description: 'Writes the actual code based on the architecture.', status: 'idle', output: '' },
    tester:    { name: 'Tester',     icon: '🧪', description: 'Reviews code for bugs and routes back if needed.',  status: 'idle', output: '' },
    github:    { name: 'GitHub',     icon: '🐙', description: 'Commits the approved code to your repository.',      status: 'idle', output: '' },
  });

  // useRef gives us a reference to an actual DOM element.
  // We use it to auto-scroll the output area when new content arrives.
  // Unlike useState, changing a ref does NOT cause a re-render.
  const outputRef = useRef(null);

  // ─── EFFECTS ──────────────────────────────────────────────────────
  // useEffect(callback, [dependencies])
  // This runs AFTER every render where "outputs" changed.
  // It auto-scrolls the output panel to show new content.
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputs]); // Dependency array: only run when "outputs" changes

  // ─── HELPER FUNCTION ─────────────────────────────────────────────
  // Updates one agent's data without losing the others.
  // The spread operator (...prev) copies all existing state,
  // then we override only the one agent we want to change.
  // ──────────────────────────────────────────────────────────────────
  function updateAgent(name, changes) {
    setAgents(prev => ({
      ...prev,                              // keep all agents as-is
      [name]: { ...prev[name], ...changes } // override only this agent's changed fields
    }));
  }

  // ─── MAIN PIPELINE FUNCTION ──────────────────────────────────────
  // "async" means this function can use "await" to pause and wait for things.
  // We await each fetch() call to the backend — the next step only runs
  // AFTER the previous agent has finished.
  // ──────────────────────────────────────────────────────────────────
  async function runPipeline() {
    if (!prompt.trim() || isRunning) return; // Guard: don't run if already running

    // Reset everything to start fresh
    setIsRunning(true);
    setShowApproval(false);
    setOutputs({ architecture: '', code: '', tests: '' });
    setActiveTab('architecture');
    setStatusMsg('');
    Object.keys(agents).forEach(key => updateAgent(key, { status: 'idle', output: '' }));

    // try/catch: if anything goes wrong (network error, server crash),
    // the catch block runs instead of crashing the whole app.
    try {

      // ── PHASE 1: ARCHITECT ───────────────────────────────────────
      setCurrentPhase('architect');
      updateAgent('architect', { status: 'running' });
      setStatusMsg('🏗 Architect is designing your system…');

      // fetch() sends an HTTP request to our backend.
      // import.meta.env.VITE_API_URL reads from our .env file (we'll set this up soon).
      // We use POST because we're SENDING data (the prompt text).
      const archRes = await fetch(`${import.meta.env.VITE_API_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, phase: 'architect' }),
      });
      if (!archRes.ok) throw new Error(`Architect failed: ${archRes.status}`);
      const archData = await archRes.json(); // Parse JSON response

      updateAgent('architect', { status: 'done', output: archData.result });
      setOutputs(prev => ({ ...prev, architecture: archData.result }));

      // ── PHASE 2: DEVELOPER ───────────────────────────────────────
      setCurrentPhase('developer');
      updateAgent('developer', { status: 'running' });
      setActiveTab('code');
      setStatusMsg('💻 Developer is writing the code…');

      const devRes = await fetch(`${import.meta.env.VITE_API_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, phase: 'developer', context: archData.result }),
      });
      if (!devRes.ok) throw new Error(`Developer failed: ${devRes.status}`);
      const devData = await devRes.json();

      updateAgent('developer', { status: 'done', output: devData.result });
      setOutputs(prev => ({ ...prev, code: devData.result }));

      // ── PHASE 3: TESTER ──────────────────────────────────────────
      setCurrentPhase('tester');
      updateAgent('tester', { status: 'running' });
      setActiveTab('tests');
      setStatusMsg('🧪 Tester is reviewing the code…');

      const testRes = await fetch(`${import.meta.env.VITE_API_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, phase: 'tester', context: devData.result }),
      });
      if (!testRes.ok) throw new Error(`Tester failed: ${testRes.status}`);
      const testData = await testRes.json();

      updateAgent('tester', { status: 'done', output: testData.result });
      setOutputs(prev => ({ ...prev, tests: testData.result }));

      // ── PHASE 4: GITHUB (awaiting approval) ──────────────────────
      setCurrentPhase('github');
      updateAgent('github', { status: 'running' });
      setStatusMsg('🐙 All agents done! Review and approve the commit.');
      setShowApproval(true);

    } catch (err) {
      // If any step fails, show the error and stop
      setStatusMsg(`❌ Error: ${err.message}`);
      setIsRunning(false);
      setCurrentPhase(null);
    }
  }

  // Called when user approves the GitHub commit
  function handleApprove() {
    updateAgent('github', { status: 'done', output: '✅ Committed to main branch!' });
    setCurrentPhase(null); setIsRunning(false); setShowApproval(false);
    setStatusMsg('🎉 Code committed to GitHub successfully!');
  }

  function handleReject() {
    updateAgent('github', { status: 'idle', output: '' });
    setCurrentPhase(null); setIsRunning(false); setShowApproval(false);
    setStatusMsg('Commit rejected. Refine your prompt and try again.');
  }

  // ─── THE RENDER (what the user sees) ─────────────────────────────
  // Everything inside "return ()" is JSX — the HTML-like output of this component.
  // ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 20px' }}>

      {/* HEADER */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>
          Developer AI Agent
        </h1>
        <p style={{ color: '#6b7a99', lineHeight: '1.6' }}>
          Describe what you want to build. Four AI agents will collaborate to design, code, test, and commit it.
        </p>
      </div>

      {/* INPUT — controlled component:
          value={prompt} makes React control what's shown in the box.
          onChange updates state every time the user types a character. */}
      <div style={{ marginBottom: '24px' }}>
        <textarea
          id="project-prompt"
          name="project-prompt"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          disabled={isRunning}
          placeholder="e.g. Build a todo list app with React and localStorage"
          rows={4}
          style={{
            width: '100%', padding: '14px', fontSize: '15px',
            background: '#1a1d27', border: '1px solid #2e3250', borderRadius: '8px',
            color: '#e8eaf0', resize: 'vertical', lineHeight: '1.6',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={runPipeline}
          disabled={!prompt.trim() || isRunning}
          style={{
            marginTop: '10px', padding: '12px 28px', fontSize: '15px', fontWeight: '600',
            background: isRunning ? '#2e3250' : '#7c6af7',
            color: isRunning ? '#6b7a99' : '#fff',
            border: 'none', borderRadius: '8px',
            cursor: isRunning || !prompt.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {isRunning ? '⏳ Running pipeline…' : '▶ Run Agent Pipeline'}
        </button>
      </div>

      {/* AGENT CARDS — CSS Grid layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {/* Object.entries() turns { architect: {...}, developer: {...} }
             into [['architect', {...}], ['developer', {...}]] so we can map over it */}
        {Object.entries(agents).map(([key, agent]) => (
          <AgentCard
            key={key}
            agent={agent}
            isActive={currentPhase === key}
          />
        ))}
      </div>

      {/* STATUS MESSAGE — only renders when statusMsg is not empty */}
      {statusMsg && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px', borderRadius: '8px',
          background: '#1a2535', border: '1px solid #2e3250',
          color: '#5db8ff', fontSize: '14px',
        }}>
          {statusMsg}
        </div>
      )}

      {/* APPROVAL PANEL — only renders when showApproval is true */}
      {showApproval && (
        <div style={{
          padding: '20px', marginBottom: '16px', borderRadius: '10px',
          border: '1px solid #3d3520', background: '#1f1c10',
        }}>
          <p style={{ fontWeight: '600', marginBottom: '6px' }}>🐙 GitHub Agent: Ready to Commit</p>
          <p style={{ fontSize: '14px', color: '#8b90a8', marginBottom: '14px' }}>
            Review the output tabs above, then approve or reject.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleApprove} style={{ padding: '8px 20px', background: '#4ade80', color: '#0a1a0a', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>✓ Approve</button>
            <button onClick={handleReject}  style={{ padding: '8px 20px', background: 'none', color: '#f87171', border: '1px solid #f87171', borderRadius: '6px', cursor: 'pointer' }}>✕ Reject</button>
          </div>
        </div>
      )}

      {/* OUTPUT PANEL — passes both the data AND the setter function as props */}
      <div ref={outputRef}>
        <OutputPanel outputs={outputs} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}