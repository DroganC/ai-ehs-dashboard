import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PATH_HOME } from "../constant/routes";
import { GamePlayPage } from "../pages/GamePlayPage";
import { HomePage } from "../pages/HomePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={PATH_HOME} element={<HomePage />} />
        <Route path="/game/:gameCode" element={<GamePlayPage />} />
        <Route path="*" element={<Navigate to={PATH_HOME} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
