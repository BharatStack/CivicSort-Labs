import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Navigation, ArrowRight, Check, Ticket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ISSUE_CATEGORIES } from '@/data/bbmpWards';
import { googleMapsDirectionsUrl, REPORT_TOKEN_PATTERN } from '@/lib/utils';

interface TrackedReport {
  id: string;
  token: string;
  title: string;
  status: string | null;
  category?: string | null;
  ward_name?: string | null;
  created_at: string;
  resolved_at?: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface TrackedResponse {
  id: string;
  response_text: string;
  created_at: string;
}

const STEPS = [
  { key: 'pending', label: 'Reported' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

const formatDate = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const TrackReportPanel: React.FC<{ initialToken?: string | null }> = ({ initialToken }) => {
  const [input, setInput] = useState(initialToken || '');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TrackedReport | null>(null);
  const [responses, setResponses] = useState<TrackedResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const track = async (raw: string) => {
    const token = raw.trim().toUpperCase();
    setReport(null);
    setResponses([]);
    if (!REPORT_TOKEN_PATTERN.test(token)) {
      setError('Enter a token like CSL-2026-000123.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // `token` is newer than the generated Supabase types (migration v3), so query untyped
      const { data, error: qErr } = await (supabase.from('citizen_reports') as any)
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!data) {
        setError(`No report found for token ${token}. Check the number and try again.`);
        return;
      }
      setReport(data as any);
      const { data: resp } = await supabase
        .from('municipality_responses')
        .select('*')
        .eq('report_id', (data as any).id)
        .order('created_at', { ascending: false })
        .limit(3);
      setResponses((resp as any) || []);
    } catch (err) {
      console.error('Track error:', err);
      setError('Could not look up this token right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialToken) track(initialToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken]);

  const status = report?.status || 'pending';
  const stepIndex = Math.max(0, STEPS.findIndex(s => s.key === status));
  const catInfo = ISSUE_CATEGORIES.find(c => c.id === report?.category);
  const fixHours = report?.resolved_at
    ? Math.round((new Date(report.resolved_at).getTime() - new Date(report.created_at).getTime()) / (1000 * 60 * 60))
    : null;

  return (
    <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 my-6">
      <div className="flex items-center gap-2 mb-1">
        <Ticket className="h-4 w-4 text-emerald-600" />
        <h2 className="text-base font-semibold text-gray-900">Track your report</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">Enter the token you received when you reported the problem to see its latest status.</p>

      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => { e.preventDefault(); track(input); }}
      >
        <Input
          id="track-token"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter your token (e.g. CSL-2026-000123)"
          className="rounded-xl h-11 font-mono uppercase placeholder:normal-case placeholder:font-sans"
          aria-label="Report token"
        />
        <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-11 px-6">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-2" />Track</>}
        </Button>
      </form>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {report && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold text-emerald-700">{report.token}</p>
              <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
              <p className="text-sm text-gray-500">
                {catInfo ? `${catInfo.icon} ${catInfo.label} · ` : ''}
                {report.ward_name ? `${report.ward_name} ward · ` : ''}
                Reported {formatDate(report.created_at)}
              </p>
            </div>
          </div>

          {/* Status timeline */}
          <ol className="flex items-center gap-0 mb-4" aria-label="Report status">
            {STEPS.map((s, i) => {
              const done = i <= stepIndex;
              return (
                <li key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                      ${done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}
                      ${i === stepIndex ? 'ring-4 ring-emerald-100' : ''}`}>
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${done ? 'text-gray-800' : 'text-gray-400'}`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-5 rounded ${i < stepIndex ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                  )}
                </li>
              );
            })}
          </ol>

          {status === 'resolved' && report.resolved_at && (
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 mb-4">
              Resolved on {formatDate(report.resolved_at)}
              {fixHours !== null && ` · fixed in ${fixHours < 24 ? `${fixHours} hours` : `${Math.round(fixHours / 24)} days`}`}.
              This report is no longer on the public dashboard but stays on record.
            </p>
          )}

          {responses.length > 0 && (
            <div className="mb-4 grid gap-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Latest updates from the ward office</p>
              {responses.map(r => (
                <div key={r.id} className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-800">{r.response_text}</p>
                  <p className="text-xs text-blue-500 mt-1">{formatDate(r.created_at)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to={`/citizen-reports/${report.id}`}>
                View full report
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
            {report.latitude && report.longitude && (
              <Button asChild variant="outline" className="rounded-xl">
                <a href={googleMapsDirectionsUrl(report.latitude, report.longitude)} target="_blank" rel="noopener noreferrer">
                  <Navigation className="h-4 w-4 mr-1.5" />
                  Google Map location
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackReportPanel;
