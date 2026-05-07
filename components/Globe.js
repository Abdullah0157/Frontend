'use client'

import React from 'react';

export default function Globe() {
  return (
    <div className="relative w-full aspect-square mx-auto flex justify-center items-center group">
      {/* Background Glow */}
      <div className="absolute inset-[-15%] bg-blue-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-colors duration-1000"></div>
      
      {/* The Globe Container (Sphere) */}
      <div className="relative w-full h-full rounded-full overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.15)] bg-slate-900 scale-100 transition-transform duration-1000 ease-out">
        
        {/* Earth Texture Layer (Base) */}
        <div 
          className="absolute inset-0 w-[200%] h-full animate-rotate-slow pointer-events-none"
          style={{
            backgroundImage: `url('/images/earth_texture.png')`,
            backgroundSize: '50% 100%',
            backgroundRepeat: 'repeat-x',
            opacity: 0.9
          }}
        ></div>

        {/* Cloud Layer (Parallax Effect for 3D depth) */}
        <div 
          className="absolute inset-0 w-[200%] h-full animate-rotate-clouds pointer-events-none opacity-40 mix-blend-screen"
          style={{
            backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Earth_Cloud_Map.jpg/2048px-Earth_Cloud_Map.jpg')`,
            backgroundSize: '50% 100%',
            backgroundRepeat: 'repeat-x',
            filter: 'brightness(1.5)'
          }}
        ></div>
        
        {/* Realistic 3D Lighting & Lens Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-white/20 z-10 pointer-events-none"></div>
        
        {/* Specular Highlight (The 'Shine') */}
        <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-white/20 blur-[40px] rounded-full z-20 pointer-events-none"></div>
        
        {/* Inner Shadow (Depth) */}
        <div className="absolute inset-0 shadow-[inset_-30px_-30px_60px_rgba(0,0,0,0.8),inset_20px_20px_60px_rgba(255,255,255,0.1)] z-10 pointer-events-none"></div>
      </div>

      <style jsx>{`
        @keyframes rotate-slow {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes rotate-clouds {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-rotate-slow {
          animation: rotate-slow 50s linear infinite;
        }
        .animate-rotate-clouds {
          animation: rotate-clouds 35s linear infinite;
        }
      `}</style>
    </div>
  );
}

