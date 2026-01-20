export default function Preloader() {
  return (
    <div className="preloader">
      <div className="bubble-container">
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
      </div>
      <div className="loader-container">
        <div className="loader">
          <div className="book">
            <div className="page"></div>
            <div className="page page2"></div>
          </div>
        </div>
        <div className="loader-slogan">Highlight. Save. Learn.</div>
        <div className="research-credit">A project by HCCG - Human Centered Computing Group</div>
      </div>
    </div>
  );
} 