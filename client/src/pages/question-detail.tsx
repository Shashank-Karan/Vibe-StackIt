import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Eye, MessageCircle, ThumbsUp, Check, Bot } from 'lucide-react';
import { VotingButtons } from '@/components/questions/voting-buttons';
import { AnswerForm } from '@/components/questions/answer-form';
import { AskQuestionModal } from '@/components/questions/ask-question-modal';
import { AIChatbot } from '@/components/ai/ai-chatbot';
import { Header } from '@/components/layout/header';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isUnauthorizedError } from '@/lib/authUtils';
import { formatTimeAgo, safeString } from '@/lib/utils';
import type { QuestionWithAuthor, AnswerWithAuthor } from '@shared/schema';

export default function QuestionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch question details
  const { 
    data: question, 
    isLoading, 
    error 
  } = useQuery<QuestionWithAuthor>({
    queryKey: [`/api/questions/${id}`],
    enabled: !!id,
    retry: false,
    staleTime: 0,
  });

  const acceptAnswerMutation = useMutation({
    mutationFn: async (answerId: number) => {
      await apiRequest('POST', `/api/questions/${question!.id}/answers/${answerId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      queryClient.invalidateQueries({ queryKey: [`/api/questions/${id}`] });
      toast({
        title: "Success",
        description: "Answer accepted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to accept answer",
        variant: "destructive",
      });
    },
  });

  const handleAnswerSuccess = () => {
    setShowAnswerForm(false);
    queryClient.invalidateQueries({ queryKey: [`/api/questions/${id}`] });
  };

  const handleAskQuestion = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to ask a question",
        variant: "destructive",
      });
      return;
    }
    setIsAskModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header
          onOpenChatbot={() => setIsChatbotOpen(true)}
          searchQuery=""
          onSearchChange={() => {}}
        />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header
          onOpenChatbot={() => setIsChatbotOpen(true)}
          searchQuery=""
          onSearchChange={() => {}}
        />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Question Not Found</h1>
            <p className="text-gray-600 mb-4">The question you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const authorName = question.author.name || question.author.username || 'Anonymous';

  const authorInitials = question.author.name 
    ? question.author.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
    : question.author.username?.[0].toUpperCase() || 'A';

  const isQuestionAuthor = user?.id === question.authorId;

  const handleAcceptAnswer = (answerId: number) => {
    acceptAnswerMutation.mutate(answerId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onOpenChatbot={() => setIsChatbotOpen(!isChatbotOpen)}
        searchQuery=""
        onSearchChange={() => {}}
      />
      
      <div className="flex">
        <main className={`flex-1 px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ${isAuthenticated && isChatbotOpen ? 'md:mr-96' : 'max-w-4xl mx-auto'}`}>
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Questions
        </Button>

        {/* Question */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-8 overflow-hidden">
          <div className="p-8">
            <div className="flex items-start space-x-6">
              {/* Voting Buttons */}
              <VotingButtons
                itemType="question"
                itemId={question.id}
                votes={question.votes || 0}
                onVoteSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
                  queryClient.invalidateQueries({ queryKey: [`/api/questions/${question.id}`] });
                }}
              />

              {/* Question Content */}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">{question.title}</h1>
                
                {/* Question Description */}
                <div 
                  className="prose prose-lg max-w-none mb-8 text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: question.description }}
                />

                {/* Tags */}
                {question.tags && question.tags.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-6">
                    {question.tags.map((tag, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="text-sm px-3 py-1.5 bg-gradient-to-r from-primary/10 to-purple-600/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Question Stats */}
                <div className="flex items-center space-x-6 text-sm text-gray-600 mb-6 bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{question.views || 0}</span>
                    <span className="text-gray-500">views</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{question.answers?.length || 0}</span>
                    <span className="text-gray-500">answers</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ThumbsUp className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">{question.votes || 0}</span>
                    <span className="text-gray-500">votes</span>
                  </div>
                </div>

                {/* Question Meta */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                      <AvatarImage src={safeString(question.author.profileImageUrl)} alt={authorName} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white font-semibold">{authorInitials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-gray-900">{authorName}</div>
                      <div className="text-sm text-gray-500">{formatTimeAgo(question.createdAt)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Answers Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {question.answers?.length || 0} Answer{(question.answers?.length || 0) !== 1 ? 's' : ''}
              </h2>
              {isAuthenticated && (
                <Button onClick={() => setShowAnswerForm(!showAnswerForm)}>
                  {showAnswerForm ? 'Cancel' : 'Write Answer'}
                </Button>
              )}
            </div>

            {/* Answer Form */}
            {showAnswerForm && (
              <div className="mb-8">
                <AnswerForm
                  questionId={question.id}
                  onSuccess={handleAnswerSuccess}
                />
              </div>
            )}

            {/* Answers List */}
            <div className="space-y-6">
              {question.answers?.map((answer: AnswerWithAuthor) => {
                const answerAuthorName = answer.author.name || answer.author.username || 'Anonymous';

                const answerAuthorInitials = answer.author.name 
                  ? answer.author.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
                  : answer.author.username?.[0].toUpperCase() || 'A';

                return (
                  <div key={answer.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                    <div className="flex items-start space-x-4">
                      {/* Voting Buttons */}
                      <VotingButtons
                        itemType="answer"
                        itemId={answer.id}
                        votes={answer.votes || 0}
                        onVoteSuccess={() => {
                          queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
                          queryClient.invalidateQueries({ queryKey: [`/api/questions/${question.id}`] });
                        }}
                      />

                      {/* Answer Content */}
                      <div className="flex-1">
                        <div 
                          className="prose max-w-none mb-4"
                          dangerouslySetInnerHTML={{ __html: answer.content }}
                        />

                        {/* Answer Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={safeString(answer.author.profileImageUrl)} alt={answerAuthorName} />
                              <AvatarFallback className="text-xs">{answerAuthorInitials}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm text-gray-700">{answerAuthorName}</span>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-gray-500">{formatTimeAgo(answer.createdAt)}</span>
                          </div>
                          
                          {/* Accept Answer Button */}
                          {isQuestionAuthor && !answer.isAccepted && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcceptAnswer(answer.id)}
                              disabled={acceptAnswerMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Accept Answer
                            </Button>
                          )}
                          
                          {/* Accepted Badge */}
                          {answer.isAccepted && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <Check className="h-3 w-3 mr-1" />
                              Accepted
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* No Answers Message */}
            {(!question.answers || question.answers.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">No answers yet</p>
                <p>Be the first to answer this question!</p>
                {isAuthenticated && !showAnswerForm && (
                  <Button onClick={() => setShowAnswerForm(true)} className="mt-4">
                    Write the First Answer
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        </main>

        {/* AI Chatbot Sidebar */}
        {isAuthenticated && isChatbotOpen && (
          <aside className="w-full md:w-96 bg-white border-l border-gray-200 fixed right-0 top-16 bottom-0 overflow-hidden z-40 transform transition-transform duration-300 ease-in-out">
            <div className="h-full flex flex-col">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">AI Assistant</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChatbotOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  ×
                </Button>
              </div>
              {/* Chatbot Content */}
              <div className="flex-1 overflow-hidden">
                <AIChatbot />
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Ask Question Modal */}
      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
      />
    </div>
  );
}