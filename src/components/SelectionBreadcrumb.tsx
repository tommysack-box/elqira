// Horizontal Hierarchy Stepper — Signature Component dal design system Stitch
// Struttura: [Project] / [Scenario] / [Request] con pill-card glassmorfiche
import { useApp } from '../context/AppContext';

export function SelectionBreadcrumb() {
  const { currentProject, currentScenario, currentRequest, setView, setCurrentScenario, setCurrentRequest } = useApp();

  if (!currentProject) return null;

  return (
    <nav className="px-8 py-3 flex items-center gap-2 bg-[#f2f4f6]/50 backdrop-blur-sm sticky top-14 z-30 overflow-x-auto">
      {/* Project pill */}
      <button
        onClick={() => {
          setCurrentScenario(null);
          setCurrentRequest(null);
          setView('scenarios');
        }}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#e6e8ea] rounded-full flex-shrink-0 cursor-pointer hover:bg-[#e0e3e5] transition-colors group"
      >
        <span className="w-1 h-1 rounded-full bg-[#2a14b4]" />
        <span className="text-xs font-semibold text-[#191c1e] tracking-tight">{currentProject.title}</span>
        <span className="material-symbols-outlined text-xs text-[#777586]">expand_more</span>
      </button>

      {currentScenario && (
        <>
          <span className="text-[#c7c4d7] text-xs flex-shrink-0">/</span>
          <button
            onClick={() => {
              setCurrentRequest(null);
              setView('requests');
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#e6e8ea] rounded-full flex-shrink-0 cursor-pointer hover:bg-[#e0e3e5] transition-colors"
          >
            <span className="text-xs font-semibold text-[#191c1e] tracking-tight">{currentScenario.title}</span>
            <span className="material-symbols-outlined text-xs text-[#777586]">expand_more</span>
          </button>
        </>
      )}

      {currentRequest && (
        <>
          <span className="text-[#c7c4d7] text-xs flex-shrink-0">/</span>
          {/* Active segment: white bg + primary dot + border */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#2a14b4]/20 rounded-full flex-shrink-0 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2a14b4]" />
            <span className="text-xs font-bold text-[#191c1e] tracking-tight">{currentRequest.title}</span>
          </div>
        </>
      )}
    </nav>
  );
}
