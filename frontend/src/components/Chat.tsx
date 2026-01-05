'use client';
import React, { useState, useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';
import { Send, ThumbsUp, HelpCircle, User, Bot } from 'lucide-react';
import * as operations from '../graphql/operations';

const client = generateClient();

interface Message {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: string;
  createdAt: string;
  reactions?: string;
}

interface ChatProps {
  meetingId: string;
  userId: string;
  userName: string;
  onProposal: (msg: Message) => void;
}

export default function Chat({ meetingId, userId, userName, onProposal }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await client.graphql({
          query: operations.getMessages,
          variables: { meetingId }
        });
        const msgs = res.data.getMessages;
        // Filter out proposals from main chat history if needed, or keep them
        setMessages(msgs.filter((m: Message) => m.type !== 'PROPOSAL'));
      } catch (e) {
        console.error(e);
      }
    };

    fetchMessages();

    const sub = (client.graphql({
      query: operations.onMessage,
      variables: { meetingId }
    }) as any).subscribe({ // eslint-disable-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: (res: any) => {
        const msg = res?.data?.onMessage;
        if (!msg) return;

        if (msg.type === 'PROPOSAL') {
          onProposal(msg);
        } else {
          setMessages(prev => {
            // 重複を避ける（自分が送信したメッセージの場合、楽観的更新のテンポラリメッセージを削除）
            if (msg.senderId === userId) {
              const filtered = prev.filter(m => !m.messageId.startsWith('temp_'));
              // すでに同じメッセージ（IDが同じもの）があれば追加しない
              if (filtered.some(m => m.messageId === msg.messageId)) return filtered;
              return [...filtered, msg];
            }
            // 他人のメッセージの場合、すでに存在しなければ追加
            if (prev.some(m => m.messageId === msg.messageId)) return prev;
            return [...prev, msg];
          });
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => console.error(err)
    });

    return () => sub.unsubscribe();
  }, [meetingId, onProposal]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const tempId = `temp_${Date.now()}`;
    const newMessage: Message = {
      messageId: tempId,
      senderId: userId,
      senderName: userName,
      content: input,
      type: 'TEXT',
      createdAt: new Date().toISOString(),
    };

    // Optimistic Update
    setMessages(prev => [...prev, newMessage]);
    const currentInput = input;
    setInput('');

    try {
      await client.graphql({
        query: operations.sendMessage,
        variables: {
          meetingId,
          senderId: userId,
          senderName: userName,
          content: currentInput
        }
      });
    } catch (e) {
      console.error(e);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.messageId !== tempId));
      setInput(currentInput);
      alert('メッセージの送信に失敗しました。');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          if (!msg) return null;
          const isMe = msg.senderId === userId;
          const isAI = msg.senderId === 'AI_FACILITATOR';
          
          return (
            <div key={msg.messageId} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isAI ? 'bg-purple-600' : 'bg-gray-300'}`}>
                  {isAI ? <Bot size={16} className="text-white" /> : <User size={16} className="text-gray-600" />}
                </div>
                
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-500 mb-1">{msg.senderName}</span>
                  <div className={`p-3 rounded-2xl ${
                    isMe ? 'bg-blue-600 text-white rounded-br-none' : 
                    isAI ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                    'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>
                  
                  {/* Reactions (Mock UI) */}
                  {!isMe && !isAI && (
                    <div className="flex gap-1 mt-1">
                      <button className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-blue-500">
                        <ThumbsUp size={14} />
                      </button>
                      <button className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-yellow-500">
                        <HelpCircle size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="メッセージを入力..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleSend}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
