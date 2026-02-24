'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore, computeRegionFrequency } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Plus, Activity, Clock, Calendar, LogOut, MapPin } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { RegionIntensity } from '@/components/HeadDiagram3D';

const HeadDiagram3D = dynamic(
  () => import('@/components/HeadDiagram3D').then(mod => ({ default: mod.HeadDiagram3D })),
  { ssr: false, loading: () => <div className="aspect-square bg-gray-100 rounded-2xl animate-pulse" /> }
);

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, sessions, logout } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (!currentUser && mounted) {
      router.push('/');
    }
  }, [currentUser, router, mounted]);

  if (!mounted || !currentUser) return null;

  const userSessions = sessions.filter(s => s.user_id === currentUser.id);
  
  // Basic Analytics
  const totalLogs = userSessions.length;
  
  let totalDurationMinutes = 0;
  let totalIntensity = 0;
  let totalRegionsLogged = 0;

  userSessions.forEach(session => {
    const start = parseISO(session.start_time);
    const end = parseISO(session.end_time);
    totalDurationMinutes += Math.max(0, differenceInMinutes(end, start));
    
    session.regions.forEach(r => {
      totalIntensity += r.intensity;
      totalRegionsLogged += 1;
    });
  });

  const avgDuration = totalLogs > 0 ? Math.round(totalDurationMinutes / totalLogs) : 0;
  const avgIntensity = totalRegionsLogged > 0 ? (totalIntensity / totalRegionsLogged).toFixed(1) : '0.0';

  // Region frequency analytics
  const regionFrequency = computeRegionFrequency(userSessions);
  const mostAffectedRegion = regionFrequency.length > 0 ? regionFrequency[0] : null;

  // Heatmap intensities for the 3D head (aggregated average intensities per region)
  const heatmapIntensities: RegionIntensity[] = regionFrequency.map(rf => ({
    region: rf.region,
    intensity: rf.avgIntensity,
  }));

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-semibold text-gray-900">NeuroTrack</h1>
        <button onClick={handleLogout} className="text-gray-500 hover:text-gray-900 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Weekly Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
              <Calendar className="w-5 h-5 text-indigo-500 mb-2" />
              <div className="text-2xl font-bold text-gray-900">{totalLogs}</div>
              <div className="text-xs text-gray-500 mt-1">Total Logs</div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
              <Clock className="w-5 h-5 text-blue-500 mb-2" />
              <div className="text-2xl font-bold text-gray-900">{avgDuration}m</div>
              <div className="text-xs text-gray-500 mt-1">Avg Duration</div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
              <Activity className="w-5 h-5 text-red-500 mb-2" />
              <div className="text-2xl font-bold text-gray-900">{avgIntensity}</div>
              <div className="text-xs text-gray-500 mt-1">Avg Intensity</div>
            </div>
          </div>
        </section>

        {/* Most Affected Region & Region Frequency */}
        {regionFrequency.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Region Analysis</h2>
            {mostAffectedRegion && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-4 flex items-center space-x-3">
                <div className="bg-red-50 p-2 rounded-xl">
                  <MapPin className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Most Affected Region</div>
                  <div className="font-semibold text-gray-900">{mostAffectedRegion.region} <span className="text-sm font-normal text-gray-500">({mostAffectedRegion.count} occurrences, avg {mostAffectedRegion.avgIntensity}/10)</span></div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {regionFrequency.map(rf => (
                <div key={rf.region} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{rf.region}</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-red-400 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (rf.avgIntensity / 10) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{rf.count}× / {rf.avgIntensity}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pain Heatmap */}
        {heatmapIntensities.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Pain Heatmap</h2>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-3">Aggregated pain intensity across all logged sessions.</p>
              <div className="h-[350px]">
                <HeadDiagram3D
                  selectedRegions={[]}
                  onToggleRegion={() => {}}
                  regionIntensities={heatmapIntensities}
                  showNerveOverlay={true}
                />
              </div>
              <div className="flex items-center justify-center mt-3 space-x-1">
                <span className="text-xs text-gray-400">Low</span>
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div className="w-8 bg-blue-300" />
                  <div className="w-8 bg-green-300" />
                  <div className="w-8 bg-yellow-300" />
                  <div className="w-8 bg-orange-400" />
                  <div className="w-8 bg-red-500" />
                </div>
                <span className="text-xs text-gray-400">High</span>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Recent Logs</h2>
          </div>
          
          {userSessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 border-dashed">
              <p className="text-gray-500 mb-4">No migraines logged yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userSessions.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()).map(session => (
                <div key={session.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-gray-900">
                        {format(parseISO(session.start_time), 'MMM d, yyyy')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(parseISO(session.start_time), 'h:mm a')} - {format(parseISO(session.end_time), 'h:mm a')}
                      </div>
                    </div>
                    <div className="bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-medium">
                      {session.regions.length} regions
                    </div>
                  </div>
                  
                  {session.regions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {session.regions.map(r => (
                        <span key={r.region_name} className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-xs text-gray-600 border border-gray-200">
                          {r.region_name} <span className="ml-1 font-semibold text-gray-900">{r.intensity}/10</span>
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {session.notes && (
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mt-2">
                      {session.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4">
        <Link 
          href="/log"
          className="bg-gray-900 text-white shadow-lg shadow-gray-900/20 rounded-full px-6 py-4 flex items-center space-x-2 hover:bg-gray-800 transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Log Migraine</span>
        </Link>
      </div>
    </div>
  );
}
