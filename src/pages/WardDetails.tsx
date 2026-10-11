import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, MapPin, Landmark, User2, AlertTriangle, CheckCircle2, Plus, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getWardById, BBMP_ZONES, type BBMPWard } from '@/data/bbmpWards';
import IssueCard from '@/components/reports/IssueCard';
import BBMPMap from '@/components/reports/BBMPMap';

const WardDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ward, setWard] = useState<BBMPWard | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const w = getWardById(parseInt(id));
      setWard(w || null);
      fetchIssues(parseInt(id));
    }
  }, [id]);

  const fetchIssues = async (wardId: number) => {
    setLoading(true);
    try {
      const w = getWardById(wardId);
      const { data, error } = await supabase
        .from('citizen_reports')
        .select('*')
        .or(`ward_id.eq.${wardId}${w ? `,ward_name.eq.${w.ward_name}` : ''}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setIssues(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!ward) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-500">Ward not found</p>
        <Button onClick={() => navigate('/citizen-reports')} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const zoneInfo = BBMP_ZONES[ward.zone];
  // Resolved issues count in the stats but are not listed publicly (trackable by token)
  const openIssues = issues.filter(i => i.status !== 'resolved');
  const openCount = openIssues.length;
  const resolvedCount = issues.filter(i => i.status === 'resolved').length;
  const resRate = issues.length > 0 ? Math.round((resolvedCount / issues.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/citizen-reports')} className="rounded-lg">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(`/citizen-reports/new?ward=${ward.ward_id}`)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Report Issue
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Ward Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm mb-6"
          style={{ borderTopWidth: 4, borderTopColor: zoneInfo?.color }}
        >
          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zoneInfo?.color }} />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {ward.zone} Zone · Ward #{ward.ward_id}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{ward.ward_name}</h1>
            <p className="text-sm text-gray-500">{ward.assembly_constituency} Assembly Constituency</p>

            {/* Representatives */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">MLA</span>
                </div>
                <p className="text-sm font-semibold text-gray-800">{ward.mla_name}</p>
                <Badge variant="outline" className="text-[10px] mt-1">{ward.mla_party}</Badge>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <User2 className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">MP</span>
                </div>
                <p className="text-sm font-semibold text-gray-800">{ward.mp_name}</p>
                <Badge variant="outline" className="text-[10px] mt-1">{ward.mp_party} · {ward.mp_constituency}</Badge>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">Corporator</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">Elections pending</p>
              </div>
            </div>
          </div>

          {/* Mini Map */}
          <div style={{ height: '200px' }}>
            <BBMPMap
              issues={openIssues.map((i: any) => ({
                id: i.id, title: i.title, latitude: i.latitude, longitude: i.longitude,
                status: i.status, ward_id: i.ward_id,
              }))}
              selectedWardId={ward.ward_id}
              userLocation={{ lat: ward.latitude, lng: ward.longitude }}
              height="100%"
              interactive={false}
              showIssuePins={true}
            />
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-800">{openCount}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Open</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-800">{resolvedCount}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Resolved</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <TrendingUp className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-800">{resRate}%</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rate</p>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Issues */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Open issues in {ward.ward_name} ({openIssues.length})</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : openIssues.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <CheckCircle2 className="h-12 w-12 text-emerald-200 mx-auto mb-3" />
            <p className="font-medium text-gray-600">No open issues in this ward</p>
            <Button
              onClick={() => navigate(`/citizen-reports/new?ward=${ward.ward_id}`)}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" /> Report First Issue
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-8">
            {openIssues.map((issue: any, i: number) => (
              <IssueCard
                key={issue.id}
                issue={{ ...issue, ward_name: ward.ward_name, zone: ward.zone, comment_count: 0 }}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WardDetails;
