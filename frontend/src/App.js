import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Round1 from "@/pages/Round1";
import Round2 from "@/pages/Round2";
import Round3 from "@/pages/Round3";
import Leaderboard from "@/pages/Leaderboard";
import Admin from "@/pages/Admin";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/dashboard" element={<ProtectedRoute role="student"><Dashboard /></ProtectedRoute>} />
          <Route path="/round/1" element={<ProtectedRoute role="student"><Round1 /></ProtectedRoute>} />
          <Route path="/round/2" element={<ProtectedRoute role="student"><Round2 /></ProtectedRoute>} />
          <Route path="/round/3" element={<ProtectedRoute role="student"><Round3 /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
    </AuthProvider>
  );
}

export default App;
