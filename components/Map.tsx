import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { Country } from '../types';
import { WORLD_TOPO_URL, COUNTRIES } from '../constants';

interface MapProps {
  targetCountry: Country | null;
  phase: string;
  showHighlight: boolean;
}

const Map: React.FC<MapProps> = ({ targetCountry, showHighlight }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [worldData, setWorldData] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Load Data
  useEffect(() => {
    fetch(WORLD_TOPO_URL)
      .then(response => response.json())
      .then(data => {
        setWorldData(data);
      })
      .catch(err => {
        console.error("Failed to load map data", err);
      });
  }, []);

  // Handle Resize
  useEffect(() => {
    if (!wrapperRef.current) return;

    const updateDimensions = () => {
      if (wrapperRef.current) {
        const { width, height } = wrapperRef.current.getBoundingClientRect();
        setDimensions(prev => (prev.width !== width || prev.height !== height) ? { width, height } : prev);
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(wrapperRef.current);
    window.addEventListener('resize', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Render Map
  useEffect(() => {
    if (!worldData || !svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // @ts-ignore
    const countriesFeature = topojson.feature(worldData, worldData.objects.countries);
    
    // -- Focus/Zoom Logic --
    // Default to the whole world
    let fitGeometry: any = countriesFeature;

    // If we have a target, zoom intelligently
    if (targetCountry) {
        // Find target feature
        // @ts-ignore
        const allFeatures = (countriesFeature as any).features;
        const targetFeature = allFeatures.find((f: any) => Number(f.id) === Number(targetCountry.id));

        if (targetFeature) {
            // Heuristic: Use target size to determine neighborhood
            const bounds = d3.geoBounds(targetFeature);
            const dx = bounds[1][0] - bounds[0][0];
            const dy = bounds[1][1] - bounds[0][1];
            // Diagonal length in degrees (approx)
            const diagonal = Math.sqrt(dx * dx + dy * dy);
            
            // Define threshold: at least 15 degrees, or 2.5x the country's size, whichever is larger
            // This ensures tiny countries get context, huge countries get their space
            const paddingBuffer = Math.max(15, diagonal * 2.5);
            
            const centroid = d3.geoCentroid(targetFeature);
            
            // Filter features that are close to the target
            const closeFeatures = allFeatures.filter((f: any) => {
                const c = d3.geoCentroid(f);
                const d = d3.geoDistance(centroid, c); // in radians
                // Convert degrees to radians for comparison roughly: 1 rad ~ 57 degrees
                const radThreshold = (paddingBuffer * Math.PI) / 180;
                return d < radThreshold;
            });
            
            // Always include target
            if (!closeFeatures.includes(targetFeature)) closeFeatures.push(targetFeature);

            fitGeometry = {
                type: "FeatureCollection",
                features: closeFeatures
            };
        } else {
             // Fallback: Continent based if ID mismatch
            const continentCountryIds = COUNTRIES
                .filter(c => c.continent === targetCountry.continent)
                .map(c => Number(c.id));
            
            fitGeometry = {
                type: "FeatureCollection",
                // @ts-ignore
                features: countriesFeature.features.filter((f: any) => continentCountryIds.includes(Number(f.id)))
            };
        }
    }

    // Projection
    const projection = d3.geoMercator()
      .fitExtent(
          [[20, 20], [dimensions.width - 20, dimensions.height - 20]], 
          fitGeometry
      );
    
    const path = d3.geoPath().projection(projection);
    const g = svg.append("g");

    // -- Rendering Order Logic --
    // We separate the target country from the rest so we can draw it last (on top).
    // @ts-ignore
    const allFeatures = (countriesFeature as any).features;
    const targetId = targetCountry ? Number(targetCountry.id) : -1;
    
    const backgroundFeatures = allFeatures.filter((f: any) => Number(f.id) !== targetId);
    const targetFeature = allFeatures.find((f: any) => Number(f.id) === targetId);

    // 1. Draw Background Countries
    g.selectAll(".country")
      .data(backgroundFeatures)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", path as any)
      .attr("fill", "#475569") // Slate-600
      .attr("stroke", "#0f172a") // Slate-900
      .attr("stroke-width", 0.5);

    // 2. Draw Target Country (if exists and highlight is on)
    if (targetFeature && showHighlight && targetCountry) {
      g.append("path")
        .datum(targetFeature)
        .attr("d", path as any)
        .attr("fill", "#FACC15") // Yellow-400
        .attr("stroke", "#FEF08A") // Yellow-200
        .attr("stroke-width", 2)
        .attr("class", "animate-pulse"); 
    } else if (targetFeature) {
      // Draw target normally if highlight is off
      g.append("path")
        .datum(targetFeature)
        .attr("d", path as any)
        .attr("fill", "#475569")
        .attr("stroke", "#0f172a")
        .attr("stroke-width", 0.5);
    }
      
  }, [worldData, targetCountry, dimensions, showHighlight]);

  return (
    <div ref={wrapperRef} className="w-full h-full bg-slate-950 rounded-xl overflow-hidden shadow-2xl border border-slate-700 relative">
      <div className="absolute top-2 left-2 z-10 px-3 py-1 bg-slate-900/90 rounded text-xs text-white uppercase font-bold tracking-widest pointer-events-none border border-slate-600 shadow-lg">
        {targetCountry ? targetCountry.continent : 'World Map'}
      </div>
      <svg ref={svgRef} className="w-full h-full block"></svg>
    </div>
  );
};

export default Map;