'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import '../lib/amplify'; // Init Amplify
import { generateClient } from 'aws-amplify/api';
import * as operations from '../graphql/operations';
import Chat from '../components/Chat';
import Board from '../components/Board';
import { Sparkles, X } from 'lucide-react';

const client = generateClient();

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlMeetingId = searchParams.get('meetingId');

  const [isMounted, setIsMounted] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  
  // Setup Form State
  const [goal, setGoal] = useState('AWSアーキテクチャの決定');
  const [duration, setDuration] = useState(30);
  const [isLoading, setIsLoading] = useState(false);

  // App State
  const [boardContent, setBoardContent] = useState('{}');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [proposal, setProposal] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    // Generate random User ID
    setUserId(`user_${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  const fetchMeetingDetails = async (id: string) => {
    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await client.graphql({
        query: operations.getMeeting,
        variables: { id }
      });
      if (res?.data?.getMeeting) {
        setGoal(res.data.getMeeting.goal);
        setBoardContent(res.data.getMeeting.boardContent || '{}');
      } else {
        console.warn('Meeting not found');
        setMeetingId(null);
      }
    } catch (e) {
      console.error('Error fetching meeting:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle URL Meeting ID
  useEffect(() => {
    if (isMounted && urlMeetingId) {
      setMeetingId(urlMeetingId);
      fetchMeetingDetails(urlMeetingId);
    }
  }, [isMounted, urlMeetingId]);

  useEffect(() => {
    if (!meetingId || !hasJoined) return;

    // Subscribe to Board Updates
    const sub = (client.graphql({
      query: operations.onBoardUpdate,
      variables: { meetingId }
    }) as any).subscribe({ // eslint-disable-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: (res: any) => {
        if (res?.data?.onBoardUpdate?.boardContent) {
          setBoardContent(res.data.onBoardUpdate.boardContent);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => console.error(err)
    });

    return () => sub.unsubscribe();
  }, [meetingId, hasJoined]);

  if (!isMounted) return null;

  const handleStart = async () => {
    if (!userName) return alert('名前を入力してください');
    
    if (meetingId) {
      // Join existing
      setHasJoined(true);
    } else {
      // Create new
      await createMeeting();
    }
  };

  const createMeeting = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await client.graphql({
        query: `
          mutation CreateMeeting($goal: String!, $duration: Int!) {
            createMeeting(goal: $goal, duration: $duration) {
              id
              boardContent
            }
          }
        `,
        variables: { goal, duration }
      });
      const meeting = res?.data?.createMeeting;
      if (meeting) {
        setMeetingId(meeting.id);
        setBoardContent(meeting.boardContent || '{}');
        setHasJoined(true);
        router.push(`/?meetingId=${meeting.id}`);
      }
    } catch (e) {
      console.error(e);
      // Fallback for demo if API fails (e.g. no backend)
      setMeetingId('demo-meeting-id');
      setHasJoined(true);
    }
  };

  const handleProposalAction = async (accept: boolean) => {
    if (accept && proposal?.content) {
      // User accepted the proposal -> Post it as a system message or AI message
      await client.graphql({
        query: operations.sendMessage,
        variables: {
          meetingId,
          senderId: 'AI_FACILITATOR',
          senderName: 'AIファシリテーター',
          content: proposal.content
        }
      });
    }
    setProposal(null);
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">TALKNAVI Setup</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">あなたの名前</label>
              <input 
                className="w-full p-2 border rounded" 
                value={userName} 
                onChange={e => setUserName(e.target.value)} 
                placeholder="例: 田中 太郎"
              />
            </div>
            
            {meetingId ? (
              // Join Mode
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800 font-bold mb-1">参加する会議:</p>
                <p className="text-lg text-gray-800">{isLoading ? '読み込み中...' : goal}</p>
              </div>
            ) : (
              // Create Mode
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">会議のゴール</label>
                  <input 
                    className="w-full p-2 border rounded" 
                    value={goal} 
                    onChange={e => setGoal(e.target.value)} 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">予定時間 (分)</label>
                  <input 
                    type="number"
                    className="w-full p-2 border rounded" 
                    value={duration} 
                    onChange={e => setDuration(Number(e.target.value))} 
                  />
                </div>
              </>
            )}

            <button 
              onClick={handleStart}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {meetingId ? '会議に参加する' : '会議を開始する'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10">
          <div>
            <h1 className="font-bold text-lg text-gray-800">{goal}</h1>
            <div className="text-xs text-gray-500">参加者: {userName} (ID: {userId.substr(0,6)})</div>
          </div>
          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            残り {duration} 分
          </div>
        </header>
        
        <div className="flex-1 overflow-hidden relative">
          <Chat 
            meetingId={meetingId!} 
            userId={userId} 
            userName={userName}
            onProposal={setProposal}
          />

          {/* Facilitator Proposal Panel (Overlay) */}
          {proposal && (
            <div className="absolute bottom-4 right-4 left-4 md:left-auto md:w-96 bg-white rounded-xl shadow-2xl border-2 border-purple-500 p-4 animate-in slide-in-from-bottom-10 fade-in">
              <div className="flex items-start gap-3">
                <div className="bg-purple-100 p-2 rounded-full">
                  <Sparkles className="text-purple-600" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-purple-900 mb-1">AIからの提案</h3>
                  <p className="text-gray-700 text-sm mb-3">{proposal?.content}</p>
                  <div className="flex gap-2 justify-end">
                    <button 
                      onClick={() => handleProposalAction(false)}
                      className="px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded"
                    >
                      無視する
                    </button>
                    <button 
                      onClick={() => handleProposalAction(true)}
                      className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      採用する
                    </button>
                  </div>
                </div>
                <button onClick={() => setProposal(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Board */}
      <div className="w-96 hidden md:block h-full shadow-xl z-20">
        <Board content={boardContent} />
      </div>
    </div>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-red-200 max-w-2xl w-full">
            <h1 className="text-xl font-bold text-red-600 mb-4">アプリケーションエラーが発生しました</h1>
            <div className="bg-gray-100 p-4 rounded text-xs font-mono overflow-auto max-h-96">
              <p className="font-bold mb-2">{this.state.error?.toString()}</p>
              <p className="whitespace-pre">{this.state.error?.stack}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <HomeContent />
      </Suspense>
    </ErrorBoundary>
  );
}
