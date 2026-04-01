// ============================================================================
// Connection Status — Online/offline indicator dot
// ============================================================================

import { useSocket } from '../contexts/SocketContext';

export function ConnectionStatus() {
  const { isConnected } = useSocket();

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected
            ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]'
            : 'bg-red-500 animate-pulse'
        }`}
      />
      <span className="text-[10px] font-medium text-stone-400">
        {isConnected ? 'Online' : 'Reconnecting...'}
      </span>
    </div>
  );
}
