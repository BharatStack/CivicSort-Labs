import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, MapPin, Clock, Share2, Landmark, User2, Send, Loader2, CheckCircle2, AlertTriangle, Trophy, Copy, Navigation } from 'lucide-react';
import { googleMapsDirectionsUrl } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ISSUE_CATEGORIES, BBMP_ZONES, getWardById, type BBMPWard } from '@/data/bbmpWards';
import BBMPMap from '@/components/reports/BBMPMap';

interface ReportDetail {
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
  resolved_at?: string | null;
  last_activity_at?: string | null;
  token?: string | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
}

interface MunicipalityResponse {
  id: string;
  response_text: string;
  status_update: string | null;
  created_at: string;
}

// Calculate reward points based on resolution time
const calculateRewardPoints = (createdAt: string, resolvedAt: string): { points: number; grade: string; color: string } => {
  const hours = Math.round((new Date(resolvedAt).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
  if (hours <= 24) return { points: 100, grade: 'Excellent', color: 'text-emerald-600' };
  if (hours <= 72) return { points: 75, grade: 'Good', color: 'text-blue-600' };
  if (hours <= 168) return { points: 50, grade: 'Average', color: 'text-amber-600' };
  return { points: 25, grade: 'Slow', color: 'text-red-600' };
};

const CitizenReportDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [responses, setResponses] = useState<MunicipalityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [resolving, setResolving] = useState(false);

  const isOwner = user?.id && report?.user_id && user.id === report.user_id;
  const isResolved = report?.status === 'resolved';

  useEffect(() => {
    if (id) {
      fetchReport();
      fetchComments();
      fetchResponses();
    }
  }, [id]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('citizen_reports')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      setReport(data);
      setVoteCount((data as any).vote_count || 0);
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('report_comments')
        .select('*')
        .eq('report_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const fetchResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('municipality_responses')
        .select('*')
        .eq('report_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setResponses(data || []);
    } catch (err) {
      console.error('Error fetching responses:', err);
    }
  };

  const handleVote = async (type: 'up' | 'down') => {
    if (hasVoted) return;
    setHasVoted(true);
    const delta = type === 'up' ? 1 : -1;
    setVoteCount(prev => prev + delta);

    try {
      await supabase
        .from('report_votes')
        .insert({
          report_id: id,
          vote_type: type === 'up' ? 'upvote' : 'downvote',
        } as any);
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('report_comments')
        .insert({
          report_id: id,
          content: newComment.trim(),
        } as any);
      if (error) throw error;

      // Update last_activity_at if owner is commenting
      if (isOwner) {
        await supabase
          .from('citizen_reports')
          .update({ last_activity_at: new Date().toISOString() } as any)
          .eq('id', id);
      }

      setNewComment('');
      fetchComments();
      toast({ title: 'Comment added!' });
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // RESOLVE HANDLER — only accessible by report owner
  const handleResolve = async () => {
    if (!isOwner || !report || isResolved) return;

    setResolving(true);
    const resolvedAt = new Date().toISOString();

    try {
      // 1. Update report status
      const { error: updateError } = await supabase
        .from('citizen_reports')
        .update({
          status: 'resolved',
          resolved_at: resolvedAt,
          resolved_by: user?.id,
          resolution_date: resolvedAt,
        } as any)
        .eq('id', report.id);

      if (updateError) throw updateError;

      // 2. Calculate and award representative rewards
      const ward = (report as any).ward_id ? getWardById((report as any).ward_id) : null;
      if (ward) {
        const reward = calculateRewardPoints(report.created_at, resolvedAt);

        // Award MLA
        await supabase.from('representative_rewards').insert({
          ward_id: ward.ward_id,
          ward_name: ward.ward_name,
          representative_type: 'mla',
          representative_name: ward.mla_name,
          party: ward.mla_party,
          report_id: report.id,
          resolution_hours: Math.round((new Date(resolvedAt).getTime() - new Date(report.created_at).getTime()) / (1000 * 60 * 60)),
          reward_points: reward.points,
        } as any);

        // Award MP
        await supabase.from('representative_rewards').insert({
          ward_id: ward.ward_id,
          ward_name: ward.ward_name,
          representative_type: 'mp',
          representative_name: ward.mp_name,
          party: ward.mp_party,
          report_id: report.id,
          resolution_hours: Math.round((new Date(resolvedAt).getTime() - new Date(report.created_at).getTime()) / (1000 * 60 * 60)),
          reward_points: reward.points,
        } as any);
      }

      // 3. Refetch
      await fetchReport();

      toast({
        title: '🎉 Issue Resolved!',
        description: [
          ward ? `${ward.mla_name} (MLA) and ${ward.mp_name} (MP) have been awarded points.` : 'Thank you for confirming the resolution.',
          report.token ? `It's now removed from the public dashboard. Track it anytime with token ${report.token}.` : '',
        ].filter(Boolean).join(' '),
      });
    } catch (err: any) {
      console.error('Resolve error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to resolve', variant: 'destructive' });
    } finally {
      setResolving(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: report?.title || 'Civic Report',
        text: `Check out this civic issue${report?.token ? ` (token ${report.token})` : ''}: ${report?.title}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copied!' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-500">Report not found</p>
        <Button onClick={() => navigate('/citizen-reports')} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const catInfo = ISSUE_CATEGORIES.find(c => c.id === (report as any).category);
  const ward = (report as any).ward_id ? getWardById((report as any).ward_id) : null;
  const zoneInfo = ward ? BBMP_ZONES[ward.zone] : null;
  const resolutionReward = isResolved && (report as any).resolved_at
    ? calculateRewardPoints(report.created_at, (report as any).resolved_at)
    : null;

  // Stale warning — > 14 days since last activity
  const daysSinceActivity = (report as any).last_activity_at
    ? Math.floor((Date.now() - new Date((report as any).last_activity_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isNearStale = daysSinceActivity > 14 && !isResolved;

  const getStatusStyle = (status: string | null) => {
    switch (status) {
      case 'resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in_progress': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getAnonymousName = (userId: string | null) => {
    if (!userId) return 'Anonymous';
    if (userId === report.user_id) return '🔹 Reporter';
    const hash = userId.slice(0, 8);
    const names = ['Citizen', 'Resident', 'Neighbour', 'Observer', 'Reporter'];
    const idx = parseInt(hash, 16) % names.length;
    return `${names[idx]}${hash.slice(0, 4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/citizen-reports')} className="rounded-lg">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} className="rounded-lg">
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Stale warning */}
        {isNearStale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              This issue has been inactive for {daysSinceActivity} days. It will be auto-removed after 21 days without activity.
            </p>
          </motion.div>
        )}

        {/* Resolved banner */}
        {isResolved && resolutionReward && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-emerald-800">Issue Resolved!</h3>
              <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                {resolutionReward.grade}
              </Badge>
            </div>
            <p className="text-xs text-emerald-600 mb-3">
              Resolved on {formatDate((report as any).resolved_at)} · Resolution time: {Math.round((new Date((report as any).resolved_at).getTime() - new Date(report.created_at).getTime()) / (1000 * 60 * 60))} hours
            </p>
            {ward && (
              <div className="flex items-center gap-4 bg-white/50 rounded-xl p-3">
                <Trophy className="h-6 w-6 text-amber-500" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Representatives awarded</p>
                  <p className="text-sm font-medium">{ward.mla_name} (MLA) & {ward.mp_name} (MP)</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${resolutionReward.color}`}>+{resolutionReward.points}</p>
                  <p className="text-[10px] text-gray-500 uppercase">points each</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Image */}
        {report.image_url && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
          >
            <img src={report.image_url} alt={report.title} className="w-full h-64 sm:h-80 object-cover" />
          </motion.div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {catInfo && (
            <Badge className="bg-gray-100 text-gray-700 border-gray-200">
              {catInfo.icon} {catInfo.label}
            </Badge>
          )}
          <Badge className={`border ${getStatusStyle(report.status)}`}>
            {report.status || 'pending'}
          </Badge>
          {report.priority && (
            <Badge variant="outline" className="capitalize text-xs">{report.priority}</Badge>
          )}
          {isOwner && <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Your Report</Badge>}
          {report.token && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(report.token!)
                  .then(() => toast({ title: 'Token copied', description: report.token! }))
                  .catch(() => toast({ title: 'Copy failed', description: 'Select the token and copy it manually.' }));
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              title="Copy token"
            >
              Token <span className="font-mono">{report.token}</span>
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{report.title}</h1>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(report.created_at)}
          </span>
          {report.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {report.location}
            </span>
          )}
        </div>

        {/* Description */}
        {report.description && (
          <p className="text-gray-700 text-base leading-relaxed mb-6">{report.description}</p>
        )}

        {/* RESOLVE BUTTON — only visible to report owner */}
        {isOwner && !isResolved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <Button
              onClick={handleResolve}
              disabled={resolving}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-12 text-base shadow-lg shadow-emerald-200"
            >
              {resolving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resolving...</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 mr-2" /> Mark as Resolved</>
              )}
            </Button>
            <p className="text-xs text-gray-400 text-center mt-2">
              This will award your ward's MLA & MP with resolution points
            </p>
          </motion.div>
        )}

        {/* Vote Bar */}
        <div className="flex items-center gap-4 mb-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
          <button
            onClick={() => handleVote('up')}
            disabled={hasVoted}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${hasVoted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-100'}`}
          >
            <ThumbsUp className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-emerald-700">Upvote</span>
          </button>
          <span className="text-2xl font-bold text-gray-800">{voteCount}</span>
          <button
            onClick={() => handleVote('down')}
            disabled={hasVoted}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${hasVoted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`}
          >
            <ThumbsDown className="h-5 w-5 text-red-500" />
          </button>
        </div>

        {/* Ward Info Card */}
        {ward && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm"
            style={{ borderLeftWidth: 4, borderLeftColor: zoneInfo?.color }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zoneInfo?.color }} />
              <h3 className="text-sm font-semibold text-gray-700">Ward #{ward.ward_id} · {ward.ward_name}</h3>
              <Badge variant="outline" className="text-[10px] ml-auto">{ward.zone} Zone</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <Landmark className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">MLA</p>
                  <p className="font-medium text-gray-800">{ward.mla_name} ({ward.mla_party})</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <User2 className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">MP · {ward.mp_constituency}</p>
                  <p className="font-medium text-gray-800">{ward.mp_name} ({ward.mp_party})</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mini Map */}
        {report.latitude && report.longitude && (
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm mb-6" style={{ height: '200px' }}>
            <BBMPMap
              issues={[{ id: report.id, title: report.title, latitude: report.latitude, longitude: report.longitude, status: report.status }]}
              userLocation={{ lat: report.latitude, lng: report.longitude }}
              height="100%"
              interactive={false}
              showIssuePins={true}
            />
          </div>
        )}
        {report.latitude && report.longitude && (
          <div className="flex flex-wrap items-center justify-between gap-2 -mt-3 mb-6">
            <a
              href={googleMapsDirectionsUrl(report.latitude, report.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <Navigation className="h-4 w-4" />
              Google Map location
            </a>
            <span className="text-xs text-gray-400 font-mono">
              {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
            </span>
          </div>
        )}

        <Separator className="my-6" />

        {/* Municipality Responses */}
        {responses.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Municipality Responses
            </h3>
            <div className="space-y-3">
              {responses.map((resp) => (
                <div key={resp.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-gray-800">{resp.response_text}</p>
                  <p className="text-xs text-blue-500 mt-2">{formatDate(resp.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments ({comments.length})
          </h3>

          <div className="space-y-3 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                    {getAnonymousName(comment.user_id).slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-600">{getAnonymousName(comment.user_id)}</span>
                  <span className="text-[10px] text-gray-400">{formatDate(comment.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700">{comment.content}</p>
              </div>
            ))}
          </div>

          {/* Add comment — disabled for owner if resolved */}
          <div className="flex gap-2">
            <Textarea
              placeholder={isResolved ? "This issue is resolved" : "Add a comment..."}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="rounded-xl min-h-[48px] max-h-[120px] flex-1"
              disabled={isResolved}
            />
            <Button
              onClick={handleCommentSubmit}
              disabled={!newComment.trim() || submittingComment || isResolved}
              className="bg-emerald-600 hover:bg-emerald-500 rounded-xl h-12 w-12 p-0"
            >
              {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenReportDetails;
