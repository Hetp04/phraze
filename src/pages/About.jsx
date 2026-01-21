import { useState } from 'react';
import { FaGlobe, FaLinkedin } from 'react-icons/fa';
import Footer from '../../karumi/components/Footer.jsx';

export default function About() {
  const founders = [
    {
      name: 'Dr. Umair Rehman',
      title:
        'Co-founder · Assistant Professor (Tenure-track), Computer Science · Western University · Leads HCCG',
      initials: 'UR',
      imageSrc: '/umair.jpg',
      bioParts: [
        "Dr. Umair Rehman is the co-founder of Phraze and an Assistant Professor (tenure-track) in Computer Science at Western University, where he leads the Human-Centered Computing Group (HCCG). His career has been built around one core idea: if software is going to shape human judgment, learning, and high-stakes decisions, we need infrastructure for measurement and accountability, not just better demos. He develops human-centered, statistically grounded evaluation methods that make complex systems auditable: what works, for whom, under what conditions, and why.",
        "Phraze was born from that exact gap. In his lab and partner projects, AI conversations quickly became the “source code” for decisions, but the moment the chat ended, the work collapsed into scattered screenshots, copy-pasted transcripts, and lost rationale. Umair recognized this as an inevitability of the next computing shift: language models turn thinking into a first-class interface, so the missing layer isn’t another model. It’s a shared, structured way for teams to collaborate, preserve context, and compound insight over time. Phraze emerged as the product answer to that thesis: turning ephemeral prompts into durable, collective work.",
      ],
      accent: 'bg-slate-100',
    },
    {
      name: 'Het Patel',
      title: 'Founder · Founding Engineer · Honours Computer Science Student · Western University',
      initials: 'HP',
      imageSrc: '/het.jpeg',
      bioParts: [
        "Het Patel is the founder and founding engineer of Phraze, and the lead software engineer behind the platform. He designed and built the core product experience end-to-end.",
        "Phraze started as a scrappy Chrome extension idea. After a year of shipping iterations, talking to users, and rebuilding the workflow again and again, the pattern became obvious: the hardest part wasn’t generating answers, it was keeping track of decisions, context, and the reasoning that led there. That’s when it made sense to transition from a small add-on into a single, unified platform. One place where conversations, annotations, and collaboration could live together without the workflow falling apart.",
      ],
      accent: 'bg-amber-100',
    },
  ];

  const [avatarStatus, setAvatarStatus] = useState(() =>
    founders.reduce((acc, person) => {
      acc[person.name] = person.imageSrc ? 'loading' : 'no-image';
      return acc;
    }, {})
  );

  return (
    <>
      <div className="min-h-screen bg-[#FFFDFA]">
        <div className="relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 pt-24 pb-24 relative">
            <div className="max-w-3xl">
              <h1 className="mt-5 text-4xl md:text-6xl font-serif font-bold text-slate-900 tracking-tight leading-[1.05]">
                Building infrastructure for
                <span
                  className="block"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.22)), url("/turk.jpg")',
                    backgroundSize: '160%',
                    backgroundPosition: '50% 50%',
                    backgroundRepeat: 'no-repeat',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    display: 'inline-block',
                  }}
                >
                  durable AI work.
                </span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-slate-500 font-light leading-relaxed">
                Phraze turns conversations into a shared workspace, so teams can capture rationale, preserve context, and build
                compounding insight over time.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {founders.map((person) => (
                <div
                  key={person.name}
                  className="rounded-[28px] border border-gray-100 bg-white/80 supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:backdrop-blur-xl shadow-[0_24px_60px_-18px_rgba(0,0,0,0.12)] overflow-hidden"
                >
                  <div className="p-8">
                    <div className="flex items-start gap-5">
                      <div className="w-24 aspect-square flex-shrink-0 rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white relative">
                        {(() => {
                          const status = avatarStatus[person.name] || 'loading';
                          const showFallback = !person.imageSrc || status === 'error' || status === 'no-image';
                          const showImage = !!person.imageSrc && status === 'loaded';

                          return (
                            <>
                              <div
                                className={`absolute inset-0 ${person.accent} flex items-center justify-center text-slate-800 font-semibold transition-opacity duration-200 ${
                                  showFallback ? 'opacity-100' : 'opacity-0'
                                }`}
                                aria-hidden="true"
                              >
                                {person.initials}
                              </div>
                              {person.imageSrc ? (
                                <img
                                  src={person.imageSrc}
                                  alt={person.name}
                                  className={`absolute inset-0 w-full h-full object-cover rounded-2xl block transition-opacity duration-200 ${
                                    showImage ? 'opacity-100' : 'opacity-0'
                                  }`}
                                  loading="eager"
                                  decoding="async"
                                  onLoad={() => {
                                    setAvatarStatus((prev) => ({ ...prev, [person.name]: 'loaded' }));
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    setAvatarStatus((prev) => ({ ...prev, [person.name]: 'error' }));
                                  }}
                                />
                              ) : null}
                            </>
                          );
                        })()}
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-xl font-serif font-bold text-slate-900 truncate">{person.name}</h2>
                        <p className="mt-1 text-sm text-slate-500 font-medium leading-relaxed">{person.title}</p>

                        <div className="mt-4 flex items-center gap-3 text-cyan-700">
                          {person.name === 'Dr. Umair Rehman' && (
                            <a
                              href="https://thehccg.com/"
                              target="_blank"
                              rel="noreferrer noopener"
                              aria-label="HCCG Lab Website"
                              title="HCCG Lab Website"
                              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/70 border border-gray-100 hover:text-cyan-900 hover:bg-white transition-colors"
                            >
                              <FaGlobe size={16} />
                            </a>
                          )}

                          {person.name === 'Dr. Umair Rehman' && (
                            <a
                              href="https://www.linkedin.com/in/umair-rehman-phd-42aa2854/"
                              target="_blank"
                              rel="noreferrer noopener"
                              aria-label="Umair Rehman LinkedIn"
                              title="Umair Rehman LinkedIn"
                              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/70 border border-gray-100 hover:text-cyan-900 hover:bg-white transition-colors"
                            >
                              <FaLinkedin size={16} />
                            </a>
                          )}

                          {person.name === 'Het Patel' && (
                            <a
                              href="https://www.linkedin.com/in/hetp04/"
                              target="_blank"
                              rel="noreferrer noopener"
                              aria-label="Het Patel LinkedIn"
                              title="Het Patel LinkedIn"
                              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/70 border border-gray-100 hover:text-cyan-900 hover:bg-white transition-colors"
                            >
                              <FaLinkedin size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 text-slate-600 text-[15px] leading-relaxed font-light">
                      {person.bioParts.map((paragraph, idx) => {
                        const isUmairQuote = person.name === 'Dr. Umair Rehman' && idx === 1;

                        if (isUmairQuote) {
                          return (
                            <div
                              key={paragraph.slice(0, 24)}
                              className="mt-0 mb-5 last:mb-0 rounded-2xl border border-gray-100 bg-slate-50/60 px-5 py-4"
                            >
                              <div className="border-l-2 border-slate-300 pl-4 italic text-slate-600">
                                {paragraph}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <p key={paragraph.slice(0, 24)} className="mt-0 mb-5 last:mb-0">
                            {paragraph}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer
        backgroundImageSrc="/secondflower.jpg"
        headlineLine1="See the story behind Phraze"
        headlineLine2="in a live demo."
        showTypography={true}
      />
    </>
  );
}

