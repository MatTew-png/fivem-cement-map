import { Map as MapIcon, Globe, Moon } from 'lucide-react';
import type { MapTileLayer } from '../types/map';
import { MAP_LAYERS } from '../data/defaultSpots';

interface LayerSwitcherProps {
  activeLayer: MapTileLayer;
  onLayerChange: (layer: MapTileLayer) => void;
}

export const LayerSwitcher = ({
  activeLayer,
  onLayerChange,
}: LayerSwitcherProps) => {
  const getIcon = (id: MapTileLayer) => {
    switch (id) {
      case 'gtalens_game':
        return <Moon className="w-3.5 h-3.5 text-amber-400" />;
      case 'gtalens_satellite':
        return <Globe className="w-3.5 h-3.5" />;
      case 'gtalens_print':
        return <MapIcon className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-2xl">
      <div className="flex items-center gap-1">
        {MAP_LAYERS.map((layer) => {
          const isActive = activeLayer === layer.id;
          return (
            <button
              key={layer.id}
              onClick={() => onLayerChange(layer.id)}
              title={layer.description}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {getIcon(layer.id)}
              <span className="hidden sm:inline">{layer.name.split(' ')[0]}</span>
              <span className="sm:hidden">{layer.id.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
