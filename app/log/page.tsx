'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore, RegionName, RegionLog, PainType } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { HeadDiagram3D } from '@/components/HeadDiagram3D';
import { ArrowLeft, Check, Clock, Edit3, Save, Activity } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const AVAILABLE_PAIN_TYPES: PainType[] = [
  'Pulsating',
  'Stabbing',
  'Pressing',
  'Burning',
  'Throbbing',
  'Shooting',
  'Squeezing',
  'Dull Ache',
];

export default function LogMigrainePage() {
  const router = useRouter();
  const { currentUser, addSession } = useAppStore();
  const [mounted, setMounted] = useState(false);

  const [selectedRegions, setSelectedRegions] = useState<RegionName[]>([]);
  const [intensities, setIntensities] = useState<Record<RegionName, number>>({} as Record<RegionName, number>);
  const [painTypes, setPainTypes] = useState<Record<RegionName, PainType[]>>({} as Record<RegionName, PainType[]>);

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

        const newPainTypes = { ...painTypes };
        delete newPainTypes[region];
        setPainTypes(newPainTypes);

        return next;
      } else {
        setIntensities(prevIntensities => ({ ...prevIntensities, [region]: 5 }));
        setPainTypes(prevPainTypes => ({ ...prevPainTypes, [region]: [] }));
        return [...prev, region];
      }
    });
  };

  const handleIntensityChange = (region: RegionName, value: number) => {
    setIntensities(prev => ({ ...prev, [region]: value }));
  };

  const handleTogglePainType = (region: RegionName, type: PainType) => {
    setPainTypes(prev => {
      const currentTypes = prev[region] || [];
      const newTypes = currentTypes.includes(type)
        ? currentTypes.filter(t => t !== type)
        : [...currentTypes, type];
      return { ...prev, [region]: newTypes };
    });
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
      intensity: intensities[name] || 5,
      pain_types: painTypes[name] || []
    }));

    addSession({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      notes,
      regions
    });

    router.push('/dashboard');
  };

  // Helper to determine color based on intensity
  const getIntensityColor = (value: number) => {
    if (value <= 3) return 'text-green-600 bg-green-50 ring-green-500/30';
    if (value <= 6) return 'text-yellow-600 bg-yellow-50 ring-yellow-500/30';
    if (value <= 8) return 'text-orange-600 bg-orange-50 ring-orange-500/30';
    return 'text-red-600 bg-red-50 ring-red-500/30';
  };

  const getIntensitySliderColor = (value: number) => {
    if (value <= 3) return 'accent-green-500';
    if (value <= 6) return 'accent-yellow-500';
    if (value <= 8) return 'accent-orange-500';
    return 'accent-red-500';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      <header className="bg-white border-b px-4 py-4 flex items-center sticky top-0 z-10 shadow-sm">
        <Link href="/dashboard" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 ml-2 tracking-tight">Log Migraine</h1>
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
              className="mb-6 h-[400px] md:h-[450px]"
            />

            {selectedRegions.length === 0 && (
              <div className="text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">
                No regions selected yet.
              </div>
            )}
          </section>

          {/* Intensity & Pain Type Section */}
          {selectedRegions.length > 0 && (
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center space-x-2 text-gray-900 mb-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-medium">Pain Profile</h2>
              </div>
              <p className="text-sm text-gray-500 -mt-4 mb-6">Describe the intensity and type of pain for each region.</p>

              <div className="space-y-8">
                {selectedRegions.map(region => {
                  const intensityVal = intensities[region] || 5;
                  const selectedTypes = painTypes[region] || [];

                  return (
                    <div key={region} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-5">

                      {/* Header */}
                      <div className="flex justify-between items-center">
                        <label className="text-base font-semibold text-gray-800">{region}</label>
                        <span className={cn(
                          "text-sm font-bold px-3 py-1 rounded-full ring-1 tracking-tight transition-colors",
                          getIntensityColor(intensityVal)
                        )}>
                          {intensityVal} / 10
                        </span>
                      </div>

                      {/* Interactive Slider */}
                      <div className="space-y-2">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={intensityVal}
                          onChange={(e) => handleIntensityChange(region, parseInt(e.target.value))}
                          className={cn(
                            "w-full h-2.5 bg-gray-200 rounded-full appearance-none cursor-pointer transition-all",
                            getIntensitySliderColor(intensityVal)
                          )}
                        />
                        <div className="flex justify-between text-xs font-medium text-gray-400 px-1">
                          <span>0 - Mild</span>
                          <span>5 - Moderate</span>
                          <span>10 - Severe</span>
                        </div>
                      </div>

                      {/* Pain Type Selector */}
                      <div className="pt-2 border-t border-gray-200/60">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          What kind of pain is it? <span className="text-gray-400 font-normal">(Select all that apply)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_PAIN_TYPES.map(pt => {
                            const isSelected = selectedTypes.includes(pt);
                            return (
                              <button
                                key={pt}
                                type="button"
                                onClick={() => handleTogglePainType(region, pt)}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all active:scale-95",
                                  isSelected
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm"
                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                                )}
                              >
                                {pt}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  );
                })}
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
