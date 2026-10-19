/**
 * Decorative panel in the style of the Appkit 4 login screen: bold geometric
 * line work on a deep blue field. Purely decorative, hidden from assistive tech.
 */
export function LoginArtwork() {
  return (
    <div className="relative hidden overflow-hidden bg-[#2d3c66] lg:block" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="480" height="900" fill="url(#grid)" />
        <polyline points="-20,140 70,60 150,150 240,40 330,170 420,70 520,150" fill="none" stroke="#d04a02" strokeWidth="26" strokeLinejoin="miter" />
        <polyline points="-20,330 90,240 170,330 270,210 360,320 450,250 520,300" fill="none" stroke="#dedede" strokeWidth="26" strokeLinejoin="miter" />
        <polyline points="-20,560 60,500 150,600 250,470 340,560 430,480 520,540" fill="none" stroke="#ffb600" strokeWidth="26" strokeLinejoin="miter" />
        <circle cx="250" cy="470" r="34" fill="none" stroke="#ffb600" strokeWidth="22" />
        <circle cx="400" cy="660" r="46" fill="none" stroke="#e0301e" strokeWidth="24" />
        <rect x="60" y="620" width="96" height="96" fill="none" stroke="#dedede" strokeWidth="20" transform="rotate(12 108 668)" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2d3c66] via-[#2d3c66]/95 to-transparent px-10 pt-24 pb-10 text-white">
        <p className="text-sm tracking-wide text-white/70 uppercase">Tech Catalyst · Digital Consulting</p>
        <p className="mt-2 max-w-sm text-2xl leading-8 font-medium">Know who is on what, and who is free, at a glance.</p>
      </div>
    </div>
  );
}
