import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Copy, Clock, MapPin, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ISSUE_CATEGORIES } from '@/data/bbmpWards';

interface MyReport {
  id: string;
  token?: string | null;
  title: string;
  status: string | null;
  category?: string | null;
  ward_name?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-red-100 text-red-700 border-red-200' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  resolved: { label: 'Resolved', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Every report the signed-in citizen has filed, including resolved ones (which are hidden from the public dashboard)
const MyReports: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('citizen_reports')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setReports((data as any) || []);
      } catch (err) {
        console.error('Error fetching my reports:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token)
      .then(() => toast({ title: 'Token copied', description: token }))
      .catch(() => toast({ title: 'Copy failed', description: 'Select the token and copy it manually.' }));
  };

  const openCount = reports.filter(r => r.status !== 'resolved').length;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-600" />
            My reports
          </span>
          {reports.length > 0 && (
            <span className="text-xs font-normal text-gray-500">
              {reports.length} filed · {openCount} open
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600">You haven't reported any issues yet.</p>
            <Button onClick={() => navigate('/citizen-reports/new')} className="mt-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl">
              <Plus className="h-4 w-4 mr-1.5" /> Report an issue
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {reports.map(r => {
              const cat = ISSUE_CATEGORIES.find(c => c.id === r.category);
              const st = STATUS[r.status || 'pending'] || STATUS.pending;
              return (
                <div key={r.id} className="rounded-xl border border-gray-200 hover:border-emerald-300 transition-colors p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {r.token ? (
                      <button
                        type="button"
                        onClick={() => copyToken(r.token!)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        title="Copy token"
                      >
                        {r.token}
                        <Copy className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Token pending</span>
                    )}
                    <Badge className={`border text-[10px] ${st.className}`}>{st.label}</Badge>
                  </div>

                  <Link to={`/citizen-reports/${r.id}`} className="block group">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 line-clamp-2">
                      {cat ? `${cat.icon} ` : ''}{r.title}
                    </h3>
                  </Link>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    {r.ward_name && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.ward_name}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Reported {formatDate(r.created_at)}</span>
                    {r.status === 'resolved' && r.resolved_at && (
                      <span className="text-emerald-700">Resolved {formatDate(r.resolved_at)}</span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button asChild size="sm" variant="outline" className="rounded-lg h-8">
                      <Link to={`/citizen-reports/${r.id}`}>View</Link>
                    </Button>
                    {r.token && (
                      <Button asChild size="sm" variant="outline" className="rounded-lg h-8">
                        <Link to={`/citizen-reports?track=${encodeURIComponent(r.token)}`}>Track</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyReports;
