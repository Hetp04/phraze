import { useExtension } from "../context/ExtensionContext";
import { Link } from "react-router-dom";

export default function Footer() {
  const { isInsideExtension } = useExtension();

  if (isInsideExtension)
    return null;
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <Link to="/contact">Contact</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/cookies">Cookie Policy</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 Phraze. All rights reserved. Affiliated with Human-Centered Computing Group (HCCG).</p>
        </div>
      </div>
    </footer>
  );
} 