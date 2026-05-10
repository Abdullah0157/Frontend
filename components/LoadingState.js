'use client'

export default function LoadingState({ message = "Scanning Network" }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 w-full animate-fade-in">
      <div className="relative w-24 h-24">
        {/* 3D Rotating Prism / Cube Effect */}
        <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-2xl animate-[spin_3s_linear_infinite] rotate-45 shadow-[0_0_50px_-12px_rgba(99,102,241,0.5)]"></div>
        <div className="absolute inset-2 border-4 border-purple-500/40 rounded-2xl animate-[spin_2s_linear_infinite_reverse] rotate-12"></div>
        <div className="absolute inset-4 border-4 border-blue-400/60 rounded-2xl animate-[spin_1.5s_linear_infinite]"></div>
        
        {/* Inner Glowing Core */}
        <div className="absolute inset-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg animate-pulse shadow-[0_0_30px_rgba(99,102,241,0.8)]"></div>
      </div>
      
      {/* Dynamic Text with Shimmer */}
      <div className="mt-12 text-center">
        <h3 className="text-xl font-black text-white uppercase tracking-[0.3em] animate-pulse">
          {message}
        </h3>
        <p className="text-indigo-200/50 text-[10px] font-bold uppercase tracking-widest mt-2">
          {message === "Analyzing Resume" ? "Our AI is matching your skills..." : "Fetching 1000+ global opportunities..."}
        </p>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
