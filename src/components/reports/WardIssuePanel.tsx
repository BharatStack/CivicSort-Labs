import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MapPin, Users, AlertTriangle, CheckCircle2, Clock, ArrowRight, Plus, User2, Landmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type BBMPWard, BBMP_ZONES, ISSUE_CATEGORIES } from '@/data/bbmpWards';
import { motion, AnimatePresence } from 'framer-motion';

interface WardIssuePanelProps {
  ward: BBMPWard | null;
  open: boolean;
  onClose: () => void;
}

interface WardIssue {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  category?: string | null;
  image_url: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
}

const WardIssuePanel: React.FC<WardIssuePanelProps> = ({ ward, open, onClose }) => {
  const [issues, setIssues] = useState<WardIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (ward && open) {
      fetchWardIssues(ward.ward_id);
    }
  }, [ward, open]);

  const fetchWardIssues = async (wardId: number) => {
    setLoading(true);
    try {
      // Query issues for this ward - use ward_name match since ward_id may not be set on older reports
      const { data, error } = await supabase
        .from('citizen_reports')
        .select('*')
        .or(`ward_id.eq.${wardId},ward_name.eq.${ward?.ward_name}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setIssues(data || []);
    } catch (err) {
      console.error('Error fetching ward issues:', err);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  if (!ward) return null;

  const zoneInfo = BBMP_ZONES[ward.zone];
  // Resolved issues count in the stats but are not listed publicly (trackable by token)
  const openIssues = issues.filter(i => i.status !== 'resolved');
  const openCount = openIssues.length;
  const resolvedCount = issues.filter(i => i.status === 'resolved').length;
  const resolutionRate = issues.length > 0 ? Math.round((resolvedCount / issues.length) * 100) : 0;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'resolved':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Resolved</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">In Progress</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Pending</Badge>;
    }
  };

  const getCategoryIcon = (category: string | null) => {
    const cat = ISSUE_CATEGORIES.find(c => c.id === category);
    return cat?.icon || '📋';
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return `${Math.floor(diffInHours / 168)}w ago`;
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:w-[420px] p-0 border-l-0 shadow-2xl">
        {/* Ward header */}
        <div
          className="px-6 pt-6 pb-4"
          style={{ background: `linear-gradient(135deg, ${zoneInfo?.color}15, ${zoneInfo?.color}05)` }}
        >
          <SheetHeader className="text-left mb-3">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: zoneInfo?.color }}
              />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {ward.zone} Zone · Ward #{ward.ward_id}
              </span>
            </div>
            <SheetTitle className="text-xl font-bold text-gray-900">
              {ward.ward_name}
            </SheetTitle>
            <p className="text-sm text-gray-500">{ward.assembly_constituency} Constituency</p>
          </SheetHeader>

          {/* Representatives */}
          <div className="space-y-2 mt-4">
            <div className="flex items-center gap-3 bg-white/80 rounded-lg px-3 py-2">
              <Landmark className="h-4 w-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">MLA</p>
                <p className="text-sm font-medium text-gray-800 truncate">{ward.mla_name}</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{ward.mla_party}</Badge>
            </div>
            <div className="flex items-center gap-3 bg-white/80 rounded-lg px-3 py-2">
              <User2 className="h-4 w-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">MP · {ward.mp_constituency}</p>
                <p className="text-sm font-medium text-gray-800 truncate">{ward.mp_name}</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{ward.mp_party}</Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4">
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{openCount}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Open</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-600">{resolvedCount}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{resolutionRate}%</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Rate</div>
          </div>
        </div>

        <Separator />

        {/* Issues list */}
        <div className="px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Open issues ({openIssues.length})
            </h3>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6" style={{ height: 'calc(100vh - 480px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : openIssues.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No open issues</p>
              <p className="text-xs text-gray-400 mt-1">This ward looks clean!</p>
            </div>
          ) : (
            <AnimatePresence>
              <div className="space-y-3 pb-4">
                {openIssues.map((issue, index) => (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gray-50 hover:bg-gray-100 rounded-xl p-3 cursor-pointer transition-colors border border-gray-100"
                    onClick={() => navigate(`/citizen-reports/${issue.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      {issue.image_url ? (
                        <img
                          src={issue.image_url}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 text-lg">
                          {getCategoryIcon(issue.category ?? null)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{issue.title}</p>
                        {issue.description && (
                          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{issue.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {getStatusBadge(issue.status)}
                          <span className="text-[10px] text-gray-400">{getTimeAgo(issue.created_at)}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300 shrink-0 mt-1" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </ScrollArea>

        {/* CTA button */}
        <div className="px-6 py-4 border-t bg-white">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11"
            onClick={() => navigate(`/citizen-reports/new?ward=${ward.ward_id}`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Report Issue in {ward.ward_name}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WardIssuePanel;
