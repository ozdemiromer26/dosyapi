import { createRoot } from "react-dom/client";
import "./styles/fonts.css";
import "./styles/theme.css";
import "./styles/hover.css";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(<App />);
