import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Map, List, BarChart3, Plus, Search, MapPin, AlertTriangle, CheckCircle2, Clock, TrendingUp, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BBMP_WARDS, BBMP_ZONES, ISSUE_CATEGORIES, findNearestWard, getWardsByZone, type BBMPWard } from '@/data/bbmpWards';
import BBMPMap from '@/components/reports/BBMPMap';
import WardIssuePanel from '@/components/reports/WardIssuePanel';
import IssueCard from '@/components/reports/IssueCard';
import TrackReportPanel from '@/components/reports/TrackReportPanel';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Report {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  category?: string | null;
  image_url: string | null;
  created_at: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  ward_id?: number | null;
  ward_name?: string | null;
  vote_count?: number;
  user_id: string | null;
  token?: string | null;
}

const CitizenReports: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trackToken = searchParams.get('track');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userWard, setUserWard] = useState<BBMPWard | null>(null);
  const [selectedPanelWard, setSelectedPanelWard] = useState<BBMPWard | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('map');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Fetch reports
  useEffect(() => {
    fetchReports();
  }, []);

  // Get user GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(loc);
          const nearest = findNearestWard(loc.lat, loc.lng);
          setUserWard(nearest);
        },
        (err) => console.log('Geolocation not available:', err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('citizen_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Auto-filter: remove stale issues (no activity for 21+ days, not resolved).
      // Resolved reports are kept here for the stats, but not shown in the public list/map.
      const STALE_DAYS = 21;
      const now = Date.now();
      const activeReports = (data || []).filter((r: any) => {
        if (r.status === 'resolved') return true;
        const lastActivity = r.last_activity_at || r.created_at;
        const daysSince = Math.floor((now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        return daysSince < STALE_DAYS;
      });

      setReports(activeReports);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  // Public dashboard shows only open issues; resolved ones stay in the DB and are found via token tracking
  const openReports = useMemo(() => reports.filter(r => r.status !== 'resolved'), [reports]);

  // Filter + search
  const filteredReports = useMemo(() => {
    let result = [...openReports];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.token?.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q) ||
        (r as any).ward_name?.toLowerCase().includes(q)
      );
    }

    if (filterZone !== 'all') {
      const wardIds = getWardsByZone(filterZone).map(w => w.ward_id);
      result = result.filter(r => (r as any).ward_id && wardIds.includes((r as any).ward_id));
    }

    if (filterCategory !== 'all') {
      result = result.filter(r => (r as any).category === filterCategory);
    }

    if (filterStatus !== 'all') {
      result = result.filter(r => r.status === filterStatus);
    }

    // Sort
    switch (sortBy) {
      case 'votes':
        result.sort((a, b) => ((b as any).vote_count || 0) - ((a as any).vote_count || 0));
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      default: // newest
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [openReports, searchQuery, filterZone, filterCategory, filterStatus, sortBy]);

  // Analytics data
  const analyticsData = useMemo(() => {
    const byCat: Record<string, number> = {};
    const byZone: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byMonth: Record<string, number> = {};

    // Resolution time tracking
    const resolutionTimes: number[] = [];

    reports.forEach(r => {
      const cat = (r as any).category || 'other';
      byCat[cat] = (byCat[cat] || 0) + 1;

      const ward = BBMP_WARDS.find(w => w.ward_id === (r as any).ward_id);
      const zone = ward?.zone || 'Unknown';
      byZone[zone] = (byZone[zone] || 0) + 1;

      const status = r.status || 'pending';
      byStatus[status] = (byStatus[status] || 0) + 1;

      const month = new Date(r.created_at).toLocaleDateString('en', { month: 'short', year: '2-digit' });
      byMonth[month] = (byMonth[month] || 0) + 1;

      // Track resolution time
      if (r.status === 'resolved' && (r as any).resolved_at) {
        const hours = Math.round((new Date((r as any).resolved_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
        resolutionTimes.push(hours);
      }
    });

    const avgResolutionHours = resolutionTimes.length > 0
      ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
      : 0;
    const resolutionRate = reports.length > 0
      ? Math.round((reports.filter(r => r.status === 'resolved').length / reports.length) * 100)
      : 0;

    return { byCat, byZone, byStatus, byMonth, avgResolutionHours, resolutionRate };
  }, [reports]);

  // Stats
  const totalReports = reports.length;
  const pendingCount = reports.filter(r => r.status === 'pending' || !r.status).length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;
  const inProgressCount = reports.filter(r => r.status === 'in_progress').length;

  const handleWardClick = (ward: BBMPWard) => {
    setSelectedPanelWard(ward);
    setPanelOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <h1 className="text-2xl font-bold">CivicReports</h1>
              </div>
              <p className="text-emerald-200 text-sm max-w-lg">
                Report civic issues in your ward. Track progress. Hold representatives accountable across all 198 BBMP wards.
              </p>
            </div>
            <Button
              onClick={() => navigate('/citizen-reports/new')}
              className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl h-11 px-6 shadow-lg shadow-emerald-500/25"
            >
              <Plus className="h-4 w-4 mr-2" />
              Report Issue
            </Button>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Total Reports', value: totalReports, icon: AlertTriangle, color: 'text-white' },
              { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-amber-400' },
              { label: 'In Progress', value: inProgressCount, icon: TrendingUp, color: 'text-blue-400' },
              { label: 'Resolved', value: resolvedCount, icon: CheckCircle2, color: 'text-emerald-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                <div className="flex items-center gap-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-white/60 uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <TrackReportPanel initialToken={trackToken} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-4 px-4 sm:-mx-6 sm:px-6">
            <TabsList className="h-12 bg-transparent gap-1 w-full justify-start">
              <TabsTrigger
                value="map"
                className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800 rounded-lg px-4"
              >
                <Map className="h-4 w-4 mr-2" />
                Map View
              </TabsTrigger>
              <TabsTrigger
                value="feed"
                className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800 rounded-lg px-4"
              >
                <List className="h-4 w-4 mr-2" />
                Issues Feed
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800 rounded-lg px-4"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          {/* MAP VIEW */}
          <TabsContent value="map" className="mt-0 -mx-4 sm:-mx-6">
            <div className="relative" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
              <BBMPMap
                issues={openReports.map(r => ({
                  id: r.id,
                  title: r.title,
                  latitude: r.latitude,
                  longitude: r.longitude,
                  status: r.status,
                  category: (r as any).category,
                  ward_id: (r as any).ward_id,
                  ward_name: (r as any).ward_name,
                }))}
                onWardClick={handleWardClick}
                userLocation={userLocation}
                userWard={userWard}
                selectedWardId={selectedPanelWard?.ward_id || null}
                height="100%"
              />

              {/* Floating Report button on map */}
              <div className="absolute bottom-6 right-6 z-10">
                <Button
                  onClick={() => navigate('/citizen-reports/new')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full h-14 w-14 shadow-xl shadow-emerald-500/30 p-0"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ISSUE FEED */}
          <TabsContent value="feed" className="mt-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search issues or token..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl h-10 border-gray-200"
                  />
                </div>
              </div>
              <Select value={filterZone} onValueChange={setFilterZone}>
                <SelectTrigger className="w-[150px] rounded-xl h-10">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {Object.keys(BBMP_ZONES).map(zone => (
                    <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px] rounded-xl h-10">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {ISSUE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px] rounded-xl h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[130px] rounded-xl h-10">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="votes">Most Voted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results count */}
            <p className="text-sm text-gray-500 mb-4">
              Showing {filteredReports.length} of {openReports.length} open issues
              {userWard && filterZone === 'all' && (
                <span className="ml-2">
                  · <button
                    onClick={() => setFilterZone(userWard.zone)}
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Show my ward ({userWard.ward_name})
                  </button>
                </span>
              )}
            </p>

            {/* Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-20">
                <CheckCircle2 className="h-16 w-16 text-emerald-200 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700">No issues found</h3>
                <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or report a new issue</p>
                <Button
                  onClick={() => navigate('/citizen-reports/new')}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Report Issue
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                {filteredReports.map((report, index) => (
                  <IssueCard
                    key={report.id}
                    issue={{
                      ...report,
                      category: (report as any).category,
                      ward_name: (report as any).ward_name,
                      vote_count: (report as any).vote_count || 0,
                      comment_count: 0,
                    }}
                    index={index}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ANALYTICS */}
          <TabsContent value="analytics" className="mt-6 pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Issues by Category */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Issues by Category</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={Object.entries(analyticsData.byCat).map(([key, val]) => ({
                        name: ISSUE_CATEGORIES.find(c => c.id === key)?.label || key,
                        value: val,
                        fill: ISSUE_CATEGORIES.find(c => c.id === key)?.color || '#6b7280',
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {Object.entries(analyticsData.byCat).map(([key], i) => (
                        <Cell key={i} fill={ISSUE_CATEGORIES.find(c => c.id === key)?.color || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {Object.entries(analyticsData.byCat).map(([key, val]) => {
                    const cat = ISSUE_CATEGORIES.find(c => c.id === key);
                    return (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat?.color }} />
                        {cat?.label || key}: {val}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Issues by Zone */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Issues by Zone</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={Object.entries(analyticsData.byZone).map(([zone, count]) => ({
                    zone: BBMP_ZONES[zone]?.label || zone,
                    count,
                    fill: BBMP_ZONES[zone]?.color || '#6b7280',
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="zone" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {Object.entries(analyticsData.byZone).map(([zone], i) => (
                        <Cell key={i} fill={BBMP_ZONES[zone]?.color || '#6b7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Status Breakdown */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Breakdown</h3>
                <div className="space-y-3">
                  {[
                    { key: 'pending', label: 'Pending', color: '#ef4444' },
                    { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
                    { key: 'resolved', label: 'Resolved', color: '#22c55e' },
                  ].map(status => {
                    const count = analyticsData.byStatus[status.key] || 0;
                    const pct = totalReports > 0 ? (count / totalReports) * 100 : 0;
                    return (
                      <div key={status.key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">{status.label}</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Wards */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Wards by Issues</h3>
                <div className="space-y-2">
                  {Object.entries(
                    reports.reduce((acc, r) => {
                      const wn = (r as any).ward_name || 'Unknown';
                      acc[wn] = (acc[wn] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  )
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([ward, count], i) => (
                      <div key={ward} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                        <span className="text-sm text-gray-700 flex-1 truncate">{ward}</span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                </div>
              </div>

              {/* Resolution Stats */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Resolution Performance</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{analyticsData.resolutionRate}%</p>
                    <p className="text-xs text-emerald-600 mt-1">Resolution Rate</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">
                      {analyticsData.avgResolutionHours > 0
                        ? analyticsData.avgResolutionHours < 24
                          ? `${analyticsData.avgResolutionHours}h`
                          : `${Math.round(analyticsData.avgResolutionHours / 24)}d`
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Avg Resolution Time</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    { label: 'Excellent (< 24h)', threshold: 24, color: '#22c55e' },
                    { label: 'Good (1-3 days)', threshold: 72, color: '#3b82f6' },
                    { label: 'Average (3-7 days)', threshold: 168, color: '#f59e0b' },
                    { label: 'Slow (> 7 days)', threshold: Infinity, color: '#ef4444' },
                  ].map(tier => {
                    const resolved = reports.filter(r => r.status === 'resolved' && (r as any).resolved_at);
                    const count = resolved.filter(r => {
                      const hours = Math.round((new Date((r as any).resolved_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
                      if (tier.threshold === 24) return hours <= 24;
                      if (tier.threshold === 72) return hours > 24 && hours <= 72;
                      if (tier.threshold === 168) return hours > 72 && hours <= 168;
                      return hours > 168;
                    }).length;
                    return (
                      <div key={tier.label} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                        <span className="text-gray-600 flex-1">{tier.label}</span>
                        <span className="font-semibold text-gray-800">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Ward Issue Panel */}
      <WardIssuePanel
        ward={selectedPanelWard}
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelectedPanelWard(null);
        }}
      />
    </div>
  );
};

export default CitizenReports;
