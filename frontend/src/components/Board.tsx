'use client';
import React from 'react';

interface BoardProps {
  content: string; // JSON string
}

interface BoardData {
  agenda_status?: string;
  opinions?: { topic: string; pros: string[]; cons: string[] }[];
  decisions?: string[];
  pending_questions?: string[];
}

export default function Board({ content }: BoardProps) {
  let data: BoardData = {};
  try {
    data = JSON.parse(content);
  } catch (e) {
    // ignore parse error
  }

  return (
    <div className="h-full p-4 bg-white border-l border-gray-200 overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 text-gray-800">📝 リアルタイム板書</h2>
      
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">現在の論点</h3>
        <div className="p-3 bg-blue-50 rounded-lg text-blue-800 font-medium">
          {data.agenda_status || '待機中...'}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">意見の整理</h3>
        {data.opinions?.map((op, i) => (
          <div key={i} className="mb-3 p-3 bg-gray-50 rounded-lg">
            <div className="font-bold text-gray-700 mb-2">{op?.topic}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-green-600 font-bold">PROS</span>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {op?.pros?.map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              </div>
              <div>
                <span className="text-xs text-red-600 font-bold">CONS</span>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {op?.cons?.map((c, j) => <li key={j}>{c}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
        {!data.opinions?.length && <p className="text-gray-400 text-sm">意見はまだありません</p>}
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">決定事項</h3>
        <ul className="space-y-2">
          {data.decisions?.map((d, i) => (
            <li key={i} className="flex items-start">
              <span className="mr-2 text-green-500">✓</span>
              <span className="text-gray-700">{d}</span>
            </li>
          ))}
        </ul>
        {!data.decisions?.length && <p className="text-gray-400 text-sm">決定事項はまだありません</p>}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">未解決の疑問 (?)</h3>
        <ul className="space-y-2">
          {data.pending_questions?.map((q, i) => (
            <li key={i} className="flex items-start p-2 bg-yellow-50 rounded text-sm text-yellow-800">
              <span className="mr-2">?</span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
