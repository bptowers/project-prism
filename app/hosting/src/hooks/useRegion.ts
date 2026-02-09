import { useState, useCallback, useMemo } from 'react';
import type { Region, RegionData } from '@/lib/types';
import { regionDataMap } from '@/data/sampleData';

export function useRegion() {
  const [region, setRegion] = useState<Region>('all');
  const data: RegionData = useMemo(() => regionDataMap[region], [region]);
  const selectRegion = useCallback((r: Region) => setRegion(r), []);
  return { region, data, selectRegion };
}
