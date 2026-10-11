import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, MessageSquare, Clock, MapPin } from 'lucide-react';
import { ISSUE_CATEGORIES, BBMP_ZONES } from '@/data/bbmpWards';
import { motion } from 'framer-motion';

interface IssueCardProps {
  issue: {
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    priority: string | null;
    category?: string | null;
    image_url: string | null;
    created_at: string;
    location: string | null;
    ward_name?: string | null;
    vote_count?: number;
    comment_count?: number;
    zone?: string | null;
    token?: string | null;
  };
  index?: number;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, index = 0 }) => {
  const getCategoryInfo = (category: string | null | undefined) => {
    return ISSUE_CATEGORIES.find(c => c.id === category) || ISSUE_CATEGORIES[5]; // default to 'other'
  };

  const getStatusStyle = (status: string | null) => {
    switch (status) {
      case 'resolved':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in_progress':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'pending':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
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

  const catInfo = getCategoryInfo(issue.category);
  const zoneInfo = issue.zone ? BBMP_ZONES[issue.zone] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <Link to={`/citizen-reports/${issue.id}`} className="block">
        <div className="bg-white rounded-2xl border border-gray-200 hover:border-emerald-300 hover:shadow-lg transition-all duration-200 overflow-hidden group">
          {/* Image */}
          {issue.image_url && (
            <div className="relative h-40 overflow-hidden">
              <img
                src={issue.image_url}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-2 left-2">
                <div className="bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-medium flex items-center gap-1">
                  <span>{catInfo.icon}</span>
                  <span>{catInfo.label}</span>
                </div>
              </div>
            </div>
          )}

          <div className="p-4">
            {/* Category badge (if no image) */}
            {!issue.image_url && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{catInfo.icon}</span>
                <span className="text-xs font-medium text-gray-500">{catInfo.label}</span>
              </div>
            )}

            {issue.token && (
              <p className="font-mono text-[10px] font-semibold text-emerald-700 tracking-wide mb-1">{issue.token}</p>
            )}

            {/* Title */}
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-emerald-700 transition-colors">
              {issue.title}
            </h3>

            {/* Description */}
            {issue.description && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-3">{issue.description}</p>
            )}

            {/* Ward + status */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <Badge className={`text-[10px] border ${getStatusStyle(issue.status)}`}>
                {issue.status || 'pending'}
              </Badge>
              {issue.ward_name && (
                <Badge variant="outline" className="text-[10px]" style={{
                  borderColor: zoneInfo?.color || '#e5e7eb',
                  color: zoneInfo?.color || '#6b7280',
                }}>
                  {issue.ward_name}
                </Badge>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  {issue.vote_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {issue.comment_count || 0}
                </span>
              </div>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getTimeAgo(issue.created_at)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default IssueCard;
