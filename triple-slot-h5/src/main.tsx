import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "antd-mobile/bundle/style.css";
import "./index.less";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
