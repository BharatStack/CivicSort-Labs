import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Check, MapPin, Camera, Upload, X, Loader2, Copy, Navigation, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { playSuccessChime } from '@/lib/sounds';
import { googleMapsDirectionsUrl } from '@/lib/utils';
import { ISSUE_CATEGORIES, findNearestWard, getWardById, type BBMPWard, BBMP_ZONES } from '@/data/bbmpWards';
import CategoryPicker from '@/components/reports/CategoryPicker';
import BBMPMap from '@/components/reports/BBMPMap';

const STEPS = [
  { number: 1, label: 'Category', icon: '📋' },
  { number: 2, label: 'Location', icon: '📍' },
  { number: 3, label: 'Details', icon: '✍️' },
];

const NewCitizenReport: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string; token: string; wardName: string; lat: number; lng: number } | null>(null);

  // Form data
  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Location
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [detectedWard, setDetectedWard] = useState<BBMPWard | null>(null);
  const [locationAddress, setLocationAddress] = useState('');

  // Initialize from URL params (ward pre-fill)
  useEffect(() => {
    const wardParam = searchParams.get('ward');
    if (wardParam) {
      const ward = getWardById(parseInt(wardParam));
      if (ward) {
        setDetectedWard(ward);
        setPinLocation({ lat: ward.latitude, lng: ward.longitude });
      }
    }
  }, [searchParams]);

  // Get GPS on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          if (!pinLocation) {
            setPinLocation(loc);
            const ward = findNearestWard(loc.lat, loc.lng);
            setDetectedWard(ward);
          }
        },
        () => {
          // Default to Bangalore center
          if (!pinLocation) {
            setPinLocation({ lat: 12.9716, lng: 77.5946 });
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Re-detect ward when pin moves
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPinLocation({ lat, lng });
    const ward = findNearestWard(lat, lng);
    setDetectedWard(ward);
  }, []);

  // Image handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Validation
  const canProceed = () => {
    switch (step) {
      case 1: return category && title.trim().length >= 5;
      case 2: return pinLocation && detectedWard;
      case 3: return true; // description is optional
      default: return false;
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!category || !title || !pinLocation || !detectedWard) return;

    setSubmitting(true);
    try {
      let imageUrl = null;

      // Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('images')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      // Insert report
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to submit a report.');

      const { data, error } = await supabase
        .from('citizen_reports')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          category: category,
          latitude: pinLocation.lat,
          longitude: pinLocation.lng,
          location: locationAddress || `${detectedWard.ward_name}, ${detectedWard.zone} Zone`,
          ward_id: detectedWard.ward_id,
          ward_name: detectedWard.ward_name,
          image_url: imageUrl,
          priority,
          status: 'pending',
          user_id: user.id,
          last_activity_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) throw error;

      playSuccessChime();

      const token = (data as any)?.token as string | undefined;
      if (token) {
        // Show the tracking token; the citizen leaves via the dialog's buttons
        setSubmitted({ id: (data as any).id, token, wardName: detectedWard.ward_name, lat: pinLocation.lat, lng: pinLocation.lng });
        return;
      }

      // Token column not set up yet (migration v3 not run) — keep the old behaviour
      toast({
        title: '🎉 Report Submitted!',
        description: `Your issue has been reported in ${detectedWard.ward_name} ward.`,
      });

      navigate('/citizen-reports');
    } catch (err: any) {
      console.error('Submit error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const catInfo = ISSUE_CATEGORIES.find(c => c.id === category);
  const zoneInfo = detectedWard ? BBMP_ZONES[detectedWard.zone] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/citizen-reports')} className="rounded-lg">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-sm font-semibold text-gray-700">Report an Issue</h1>
          <div className="w-16" />
        </div>

        {/* Step indicator */}
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.number}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                      ${step > s.number
                        ? 'bg-emerald-500 text-white'
                        : step === s.number
                          ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                  >
                    {step > s.number ? <Check className="h-4 w-4" /> : s.number}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${step >= s.number ? 'text-gray-700' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 rounded ${step > s.number ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* STEP 1: Category + Title */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">What's the issue?</h2>
              <p className="text-sm text-gray-500 mb-6">Select a category and give a brief title</p>

              <CategoryPicker selected={category} onSelect={setCategory} />

              <div className="mt-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Title *</label>
                <Input
                  placeholder="e.g., Garbage dump near 3rd Cross Road"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="rounded-xl h-12 text-base"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</p>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Location + Photo */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">Where is it?</h2>
              <p className="text-sm text-gray-500 mb-4">Pin the location on the map. Drag the marker to adjust.</p>

              {/* Detected ward banner */}
              {detectedWard && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zoneInfo?.color }} />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      📍 {detectedWard.ward_name}
                    </p>
                    <p className="text-xs text-emerald-600">
                      {detectedWard.zone} Zone · Ward #{detectedWard.ward_id} · {detectedWard.assembly_constituency}
                    </p>
                  </div>
                </div>
              )}

              {/* Map */}
              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '350px' }}>
                <BBMPMap
                  userLocation={userLocation}
                  userWard={detectedWard}
                  pinLocation={pinLocation}
                  onMapClick={handleMapClick}
                  height="100%"
                  showIssuePins={false}
                  interactive={true}
                />
              </div>

              {/* Location address (optional) */}
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Address / Landmark (optional)</label>
                <Input
                  placeholder="e.g., Near SBI Bank, MG Road"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>

              {/* Photo upload */}
              <div className="mt-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Photo (optional)</label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-xl border" />
                    <button
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-400 cursor-pointer transition bg-gray-50 hover:bg-emerald-50">
                    <Camera className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Click to upload a photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3: Description + Review + Submit */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">Describe the issue</h2>
              <p className="text-sm text-gray-500 mb-6">Add details to help resolve the issue faster</p>

              <Textarea
                placeholder="Provide more details about the issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className="rounded-xl min-h-[120px] text-base"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/500</p>

              {/* Priority */}
              <div className="mt-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Priority</label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high', 'critical'].map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all capitalize
                        ${priority === p
                          ? p === 'critical' ? 'bg-red-100 border-red-300 text-red-700'
                            : p === 'high' ? 'bg-orange-100 border-orange-300 text-orange-700'
                              : p === 'medium' ? 'bg-amber-100 border-amber-300 text-amber-700'
                                : 'bg-green-100 border-green-300 text-green-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Card */}
              <div className="mt-8 bg-gray-50 rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 Review</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20">Category:</span>
                    <span className="font-medium">{catInfo?.icon} {catInfo?.label}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20">Title:</span>
                    <span className="font-medium text-gray-800">{title}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20">Ward:</span>
                    <span className="font-medium text-gray-800">
                      {detectedWard?.ward_name} · {detectedWard?.zone} Zone
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20">Priority:</span>
                    <span className="font-medium capitalize">{priority}</span>
                  </div>
                  {imagePreview && (
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-500 w-20">Photo:</span>
                      <img src={imagePreview} alt="" className="w-16 h-12 rounded object-cover" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pb-8">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/citizen-reports')}
            className="rounded-xl h-11 px-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-11 px-6"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canProceed()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-11 px-6"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Success dialog with the tracking token */}
      <Dialog open={!!submitted} onOpenChange={(open) => { if (!open) navigate('/citizen-reports'); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          {submitted && (
            <>
              <DialogHeader>
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <DialogTitle className="text-center">Report submitted</DialogTitle>
                <DialogDescription className="text-center">
                  Your issue has been reported in {submitted.wardName} ward. Save this token to track your report.
                </DialogDescription>
              </DialogHeader>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Your token number</p>
                <p className="font-mono text-2xl font-bold text-gray-900 tracking-wide select-all">{submitted.token}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-lg"
                  onClick={() => {
                    navigator.clipboard.writeText(submitted.token)
                      .then(() => toast({ title: 'Token copied', description: submitted.token }))
                      .catch(() => toast({ title: 'Copy failed', description: 'Select the token and copy it manually.' }));
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy token
                </Button>
              </div>

              <a
                href={googleMapsDirectionsUrl(submitted.lat, submitted.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                <Navigation className="h-4 w-4" />
                Google Map location
              </a>

              <div className="grid gap-2">
                <Button
                  onClick={() => navigate(`/citizen-reports?track=${encodeURIComponent(submitted.token)}`)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-11"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Track this report
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/citizen-reports/${submitted.id}`)}>
                    View report
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => navigate('/citizen-reports')}>
                    Back to reports
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewCitizenReport;
