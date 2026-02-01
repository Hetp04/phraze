import React from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import ScrollHero from '../newanimation/components/ScrollHero';
import Platforms from '../src/components/Platforms';
import Demonstration from '../src/components/Demonstration';
import WorkspaceHero from './components/WorkspaceHero.jsx';
import HowItWorksHero from './components/HowItWorksHero.jsx';
import ToolsAndAnalyticsSection from './components/ToolsAndAnalyticsSection.jsx';
import FAQPartSection from './components/FAQPartSection.jsx';
import Footer from './components/Footer.jsx';

type AppProps = {
  showNavbar?: boolean;
};

const App: React.FC<AppProps> = ({ showNavbar = true }) => {
  return (
    <div className="min-h-screen bg-[#FFFDF8] text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900">

      <div className="relative z-10">
        {showNavbar && <Navbar />}
        <main style={{ overflowX: 'visible' }}>
          <Hero />
          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', marginTop: '-90px' }}>
            <ScrollHero />
          </div>

          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
            <div style={{ height: '1px', backgroundColor: 'rgba(148, 163, 184, 0.35)' }} />
            <div style={{ height: '1px', backgroundColor: 'rgba(148, 163, 184, 0.18)' }} />
          </div>

          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
            <div style={{
              padding: '20px 0',
              maxWidth: '1400px',
              margin: '0.75rem auto 0 auto',
              paddingLeft: '20px',
              paddingRight: '20px',
              position: 'relative',
              textAlign: 'center'
            }}>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '-0.75rem', bottom: 0, width: '1150px', maxWidth: '100%', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(148, 163, 184, 0.28)' }} />
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(148, 163, 184, 0.28)' }} />
              </div>
              <h2 style={{
                fontSize: '0.9rem',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '1.2rem',
                fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
                letterSpacing: '0.02em'
              }}>
                Supported by the generous contributions of
              </h2>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '6.2rem',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '70px',
                  opacity: '0.9',
                  transition: 'all 0.3s ease',
                  filter: 'grayscale(100%) saturate(0%)',
                  padding: '10px'
                }}>
                  <img
                    src="/western.svg"
                    alt="Western University"
                    style={{
                      height: '100%',
                      maxWidth: '220px',
                      objectFit: 'contain',
                      filter: 'grayscale(100%) saturate(0%)'
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '90px',
                  opacity: '0.9',
                  transition: 'all 0.3s ease',
                  filter: 'grayscale(100%) saturate(0%)',
                  padding: '10px'
                }}>
                  <img
                    src="/NSERC.svg"
                    alt="NSERC"
                    style={{
                      height: '100%',
                      maxWidth: '450px',
                      objectFit: 'contain',
                      filter: 'grayscale(100%) saturate(0%)'
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '70px',
                  opacity: '0.9',
                  transition: 'all 0.3s ease',
                  filter: 'grayscale(100%) saturate(0%)',
                  padding: '10px'
                }}>
                  <img
                    src="/sshrc.png"
                    alt="SSHRC"
                    style={{
                      height: '100%',
                      maxWidth: '320px',
                      objectFit: 'contain',
                      filter: 'grayscale(100%) saturate(0%)'
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '40px',
                  padding: '6px 14px',
                  backgroundColor: 'rgb(229, 231, 235)',
                  borderRadius: '20px',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(17, 24, 39, 0.06)',
                  gap: '8px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" style={{ flexShrink: 0, transform: 'translateY(-1px)' }}>
                    <path fill="#6b7280" d="m221.56 100.85l-79.95-75.47l-.16-.15a19.93 19.93 0 0 0-26.91 0l-.17.15l-79.93 75.47a20.07 20.07 0 0 0-6.44 14.7V208a20 20 0 0 0 20 20h160a20 20 0 0 0 20-20v-92.45a20.07 20.07 0 0 0-6.44-14.7ZM204 204H52v-86.72l76-71.75l76 71.75Z"/>
                  </svg>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    fontFamily: '"Glacial Indifference", sans-serif',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em'
                  }}>
                    HCCG (Human-Centered Computing Group)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
            <div style={{ height: '1px', backgroundColor: 'rgba(148, 163, 184, 0.28)' }} />
          </div>

          <div style={{ height: '96px' }} />

          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', backgroundColor: '#FFFDF8' }}>
            <WorkspaceHero />
          </div>

          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', backgroundColor: '#FFFDF8' }}>
            <HowItWorksHero />
          </div>

          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', backgroundColor: '#FFFDF8' }}>
            <ToolsAndAnalyticsSection />
          </div>

          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', backgroundColor: '#FFFDF8' }}>
            <FAQPartSection />
          </div>

          <Platforms />
          <Demonstration />
          <Footer showTypography={true} showStencil={true} />
        </main>
      </div>
    </div>
  );
};

export default App;