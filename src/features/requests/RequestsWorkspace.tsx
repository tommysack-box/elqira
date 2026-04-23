// Main view for the requests workspace — request list + builder con response inline
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { LoadingScreen } from '../../components/LoadingScreen';
import { RequestsSidebar } from './RequestsSidebar';
import { RequestBuilder } from './RequestBuilder';

const APP_VERSION = __APP_VERSION__;

export function RequestsWorkspace() {
  const { currentScenario, currentRequest, isRequestDataLoading } = useApp();
  const [isToolLayoutExpanded, setIsToolLayoutExpanded] = useState(false);

  if (!currentScenario) return null;
  if (isRequestDataLoading) return <LoadingScreen label="Loading requests" />;

  return (
    <>
      <div className="flex-1 flex min-h-0 bg-[#f7f9fb] pb-8">
        {!isToolLayoutExpanded && <RequestsSidebar />}
        <RequestBuilder onToolExpansionChange={setIsToolLayoutExpanded} />
      </div>

      <footer className="fixed bottom-0 left-0 right-0 h-8 bg-[#f2f4f6] border-t border-[#c7c4d7]/10 flex items-center px-6 justify-between text-[10px] font-mono text-[#c7c4d7] uppercase tracking-widest z-50">
        <div className="flex items-center gap-3">
          <span>Elqira</span>
          <span className="text-[#191c1e]">v{APP_VERSION}</span>
          <span>Analysis</span>
          <span className="text-[#005c54]">Local</span>
        </div>
        <div className="flex items-center gap-3">
            <span>Request</span>
            <span className="text-sm font-bold text-[#191c1e] normal-case tracking-normal">
              {currentRequest?.title ?? 'None'}
            </span>
        </div>
      </footer>
    </>
  );
}
