// Favorites — quick access to starred requests across all projects and scenarios
import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MethodBadge } from '../../components/MethodBadge';
import { getScenarioById, getProjectById } from '../../services/dataService';

const APP_VERSION = __APP_VERSION__;

export function FavoritesView() {
  const { t, favoriteRequests, updateRequest, setCurrentProject, setCurrentScenario, setCurrentRequest } = useApp();

  const favorites = useMemo(() => {
    return favoriteRequests.map((r) => {
      const scenario = getScenarioById(r.scenarioId);
      const project = scenario ? getProjectById(scenario.projectId) : null;
      return { request: r, scenario, project };
    });
  }, [favoriteRequests]);

  const handleOpen = (entry: typeof favorites[number]) => {
    if (!entry.project || !entry.scenario) return;
    setCurrentProject(entry.project);
    setCurrentScenario(entry.scenario);
    setCurrentRequest(entry.request);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fb]">
      <div className="max-w-7xl mx-auto px-8 pt-8 pb-12">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-[#191c1e] tracking-tight mb-2">
            {t('favorites')} <span className="text-[#2a14b4]">{t('overview')}</span>
          </h1>
          <p className="text-[#464554] max-w-2xl leading-relaxed">
            {t('favoritesSubtitle')}
          </p>
        </div>

        {favorites.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#e3dfff]/30 rounded-2xl mb-6 ring-1 ring-[#2a14b4]/20">
              <span className="material-symbols-outlined text-3xl text-[#2a14b4]" style={{ fontVariationSettings: "'wght' 300" }}>
                star
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#191c1e] mb-2">{t('noFavorites')}</h2>
            <p className="text-[#464554] max-w-sm text-sm leading-relaxed">{t('noFavoritesDesc')}</p>
          </div>
        )}

        {favorites.length > 0 && (
          <div className="flex flex-col gap-3">
            {favorites.map(({ request: r, scenario, project }) => (
              <div
                key={r.id}
                onClick={() => handleOpen({ request: r, scenario, project })}
                className="group flex items-center gap-4 bg-white rounded-xl px-5 py-4 border border-[#c7c4d7]/15 hover:bg-[#f7f9fb] hover:border-[#2a14b4]/20 transition-colors cursor-pointer"
              >
                <MethodBadge method={r.method} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#191c1e] truncate">{r.title}</p>
                </div>
                <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-[#777586] uppercase tracking-wider shrink-0">
                  {project && (
                    <>
                      <span className="truncate max-w-[120px]">{project.title}</span>
                      <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                    </>
                  )}
                  {scenario && (
                    <span className="truncate max-w-[120px]">{scenario.title}</span>
                  )}
                </div>
                <button
                  type="button"
                  title={t('removeFromFavorites')}
                  aria-label={t('removeFromFavorites')}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateRequest(r.id, { isFavorite: false });
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[#ffdad6]/50 text-[#e8b800] hover:text-[#ba1a1a]"
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                </button>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity material-symbols-outlined text-sm text-[#2a14b4]">
                  arrow_forward
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="fixed bottom-0 left-0 right-0 h-8 bg-[#f2f4f6] border-t border-[#c7c4d7]/10 flex items-center px-6 justify-between text-[10px] font-mono text-[#c7c4d7] uppercase tracking-widest z-50">
        <div className="flex items-center gap-3">
          <span>Elqira</span>
          <span className="text-[#191c1e]">v{APP_VERSION}</span>
          <span>Favorites</span>
        </div>
        <div />
      </footer>
    </div>
  );
}
