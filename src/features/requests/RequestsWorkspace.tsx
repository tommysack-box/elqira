// Main view for the requests workspace — layout fedele al mockup request_builder + response_inspector
import { useApp } from '../../context/AppContext';
import { RequestsSidebar } from './RequestsSidebar';
import { RequestBuilder } from './RequestBuilder';
import { ResponseInspector } from './ResponseInspector';

export function RequestsWorkspace() {
  const { currentScenario } = useApp();

  if (!currentScenario) return null;

  return (
    <div className="flex-1 flex min-h-0 bg-[#f7f9fb]">
      {/* Left sidebar — request list */}
      <RequestsSidebar />

      {/* Center + Right columns */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Builder + Inspector split */}
        <div className="flex-1 flex min-h-0">
          {/* Request Builder */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <RequestBuilder />
          </div>

          {/* Response Inspector — right panel */}
          <div className="w-[420px] shrink-0 flex flex-col bg-[#f7f9fb] border-l border-[#c7c4d7]/15 p-4 overflow-hidden">
            <ResponseInspector />
          </div>
        </div>
      </div>
    </div>
  );
}
