import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { formatTimeAgo, safeString } from '@/lib/utils';
import { MessageCircle, ThumbsUp, Eye } from 'lucide-react';
import type { QuestionWithAuthor } from '@shared/schema';

interface QuestionCardProps {
  question: QuestionWithAuthor;
  onClick: () => void;
}

export function QuestionCard({ question, onClick }: QuestionCardProps) {
  const authorName = question.author.name || question.author.username || 'Anonymous';

  const authorInitials = question.author.name 
    ? question.author.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
    : question.author.username?.[0].toUpperCase() || 'A';

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          {/* Question Stats */}
          <div className="flex-shrink-0 space-y-4">
            <div className="text-center">
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <ThumbsUp className="h-4 w-4" />
                <span className="font-medium">{question.votes || 0}</span>
              </div>
              <div className="text-xs text-gray-500">votes</div>
            </div>
            <div className="text-center">
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <MessageCircle className="h-4 w-4" />
                <span className="font-medium">{question.answers?.length || 0}</span>
              </div>
              <div className="text-xs text-gray-500">answers</div>
            </div>
            <div className="text-center">
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <Eye className="h-4 w-4" />
                <span className="font-medium">{question.views || 0}</span>
              </div>
              <div className="text-xs text-gray-500">views</div>
            </div>
          </div>

          {/* Question Content */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-primary">
              {question.title}
            </h3>
            
            <div 
              className="text-gray-700 mb-3 line-clamp-2"
              dangerouslySetInnerHTML={{ 
                __html: truncateText(question.description.replace(/<[^>]*>/g, ''), 200)
              }}
            />

            {/* Question Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {question.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Question Meta */}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={safeString(question.author.profileImageUrl)} alt={authorName} />
                  <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{authorName}</span>
                <span>•</span>
                <span>{formatTimeAgo(question.createdAt)}</span>
              </div>
              {question.acceptedAnswerId && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Solved
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
