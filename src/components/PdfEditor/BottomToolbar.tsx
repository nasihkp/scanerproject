import React from 'react';
import {
    MousePointer2, Hand, Pen, Type, Undo, Redo
} from 'lucide-react';
import { PdfEditorState, Action, ToolName } from './PdfEditorState';

interface BottomToolbarProps {
    state: PdfEditorState;
    dispatch: React.Dispatch<Action>;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({ state, dispatch }) => {

    const renderToolBtn = (icon: any, tool: ToolName) => {
        const isActive = state.activeTool === tool;
        const Icon = icon;
        return (
            <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool })}
                className={`flex-1 min-w-[48px] h-12 flex items-center justify-center rounded-xl transition-all ${isActive ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
                <Icon size={20} />
            </button>
        );
    };

    return (
        <div className="flex md:hidden fixed bottom-4 left-4 right-4 z-40 bg-[#1e1e1e]/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-1.5 gap-1 shrink-0 overflow-x-auto hide-scrollbar">
            {renderToolBtn(MousePointer2, 'select')}
            {renderToolBtn(Hand, 'pan')}
            <div className="w-px h-8 bg-white/10 mx-1 self-center scale-y-75"></div>
            {renderToolBtn(Pen, 'pen')}
            {renderToolBtn(Type, 'add_text')}
            <div className="w-px h-8 bg-white/10 mx-1 self-center scale-y-75"></div>

            <button
                onClick={() => dispatch({ type: 'UNDO' })}
                disabled={state.historyIndex < 0}
                className={`flex-1 min-w-[48px] h-12 flex items-center justify-center rounded-xl transition-colors ${state.historyIndex < 0 ? 'text-white/30 cursor-not-allowed' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
                <Undo size={20} />
            </button>
            <button
                onClick={() => dispatch({ type: 'REDO' })}
                disabled={state.historyIndex >= state.history.length - 1}
                className={`flex-1 min-w-[48px] h-12 flex items-center justify-center rounded-xl transition-colors ${state.historyIndex >= state.history.length - 1 ? 'text-white/30 cursor-not-allowed' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
                <Redo size={20} />
            </button>
        </div>
    );
};
