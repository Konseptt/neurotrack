'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore, RegionName, RegionLog } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { HeadDiagram3D } from '@/components/HeadDiagram3D';
import { ArrowLeft, Check, Clock, Edit3, Save } from 'lucide-react';
import Link from 'next/link';

export default function LogMigrainePage() {
  const router = useRouter();
  const { currentUser, addSession } = useAppStore();
  const [mounted, setMounted] = useState(false);

  const [selectedRegions, setSelectedRegions] = useState<RegionName[]>([]);
  const [intensities, setIntensities] = useState<Record<RegionName, number>>({} as Record<RegionName, number>);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (!currentUser && mounted) {
      router.push('/');
    }
  }, [currentUser, router, mounted]);

  useEffect(() => {
    // Set default times
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const formatTime = (date: Date) => {
      return date.toISOString().slice(0, 16); // YYYY-MM-DDThh:mm
    };
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartTime(formatTime(oneHourAgo));
    setEndTime(formatTime(now));
  }, []);

  if (!mounted || !currentUser) return null;

  const handleToggleRegion = (region: RegionName) => {
    setSelectedRegions(prev => {
      if (prev.includes(region)) {
        const next = prev.filter(r => r !== region);
        const newIntensities = { ...intensities };
        delete newIntensities[region];
        setIntensities(newIntensities);
        return next;
      } else {
        setIntensities(prevIntensities => ({ ...prevIntensities, [region]: 5 }));
        return [...prev, region];
      }
    });
  };

  const handleIntensityChange = (region: RegionName, value: number) => {
    setIntensities(prev => ({ ...prev, [region]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedRegions.length === 0) {
      alert("Please select at least one region.");
      return;
    }
    
    if (!startTime || !endTime) {
      alert("Please select start and end times.");
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end < start) {
      alert("End time cannot be before start time.");
      return;
    }

    const regions: RegionLog[] = selectedRegions.map(name => ({
      region_name: name,
      intensity: intensities[name] || 5
    }));

    addSession({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      notes,
      regions
    });

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b px-4 py-4 flex items-center sticky top-0 z-10 shadow-sm">
        <Link href="/dashboard" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 ml-2">Log Migraine</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Head Diagram Section */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="text-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">Where does it hurt?</h2>
              <p className="text-sm text-gray-500 mt-1">Tap the regions on the head below.</p>
            </div>
            
            <HeadDiagram3D 
              selectedRegions={selectedRegions} 
              onToggleRegion={handleToggleRegion} 
              className="mb-6 h-[400px]"
            />
            
            {selectedRegions.length === 0 && (
              <div className="text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">
                No regions selected yet.
              </div>
            )}
          </section>

          {/* Intensity Sliders */}
          {selectedRegions.length > 0 && (
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Pain Intensity</h2>
                <p className="text-sm text-gray-500 mt-1">Rate the pain for each selected region (0-10).</p>
              </div>
              
              <div className="space-y-6">
                {selectedRegions.map(region => (
                  <div key={region} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-gray-700">{region}</label>
                      <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">
                        {intensities[region]}/10
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      step="1"
                      value={intensities[region] || 5}
                      onChange={(e) => handleIntensityChange(region, parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                    <div className="flex justify-between text-xs text-gray-400 font-medium">
                      <span>Mild</span>
                      <span>Severe</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Time Section */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center space-x-2 text-gray-900">
              <Clock className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-medium">Duration</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Started</label>
                <input 
                  type="datetime-local" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Ended</label>
                <input 
                  type="datetime-local" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                  required
                />
              </div>
            </div>
          </section>

          {/* Notes Section */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center space-x-2 text-gray-900">
              <Edit3 className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-medium">Notes (Optional)</h2>
            </div>
            
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any triggers? Medication taken? Symptoms?"
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none resize-none"
            />
          </section>

          {/* Submit Button */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
            <div className="max-w-2xl mx-auto">
              <button 
                type="submit"
                disabled={selectedRegions.length === 0}
                className="w-full bg-gray-900 text-white font-medium py-4 rounded-2xl shadow-lg hover:bg-gray-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Save className="w-5 h-5" />
                <span>Save Migraine Log</span>
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
