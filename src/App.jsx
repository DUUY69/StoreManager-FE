import { Routes, Route, Navigate } from "react-router-dom";
import { Dashboard, Auth } from "@/layouts";
import { Login } from "@/pages/auth";

function App() {
  return (
    <Routes>
      <Route path="/dashboard/*" element={<Dashboard />} />
      <Route path="/auth/*" element={<Auth />} />
      <Route path="/lcs" element={<div className="relative min-h-screen w-full"><Login /></div>} />
      <Route path="/" element={<Navigate to="/lcs" replace />} />
      <Route path="*" element={<Navigate to="/lcs" replace />} />
    </Routes>
  );
}

export default App;
