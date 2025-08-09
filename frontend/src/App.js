import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Socket.IO connection
let socket;

// Auth Components
const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("avatar1");
  const [loading, setLoading] = useState(false);
  const [avatars, setAvatars] = useState([]);

  useEffect(() => {
    fetchAvatars();
  }, []);

  const fetchAvatars = async () => {
    try {
      const response = await axios.get(`${API}/avatars`);
      setAvatars(response.data.avatars);
    } catch (error) {
      console.error("Error fetching avatars:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? `${API}/auth/login` : `${API}/auth/register`;
      const payload = isLogin 
        ? { username, password }
        : { username, password, avatar: selectedAvatar };

      const response = await axios.post(endpoint, payload);
      
      localStorage.setItem("token", response.data.access_token);
      onLogin();
    } catch (error) {
      alert(error.response?.data?.detail || "Authentication failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-slate-700/50">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Chinchón</h1>
            <p className="text-slate-400">Enter the game</p>
          </div>

          <div className="flex mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-l-xl text-sm font-medium transition-colors ${
                isLogin 
                  ? "bg-blue-600 text-white" 
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-r-xl text-sm font-medium transition-colors ${
                !isLogin 
                  ? "bg-blue-600 text-white" 
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                required
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                required
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Choose Avatar
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {avatars.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar.id)}
                      className={`p-3 rounded-xl border-2 transition-colors ${
                        selectedAvatar === avatar.id
                          ? "border-blue-500 bg-blue-500/20"
                          : "border-slate-600 hover:border-slate-500"
                      }`}
                    >
                      <div className="text-2xl mb-1">
                        {avatar.gender === "male" ? "👨" : "👩"}
                      </div>
                      <div className="text-xs text-slate-300">{avatar.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
            >
              {loading ? "Please wait..." : (isLogin ? "Login" : "Create Account")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Lobby Component
const Lobby = ({ user, onJoinMatch }) => {
  const [matches, setMatches] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [targetPoints, setTargetPoints] = useState(50);
  const [stakeAmount, setStakeAmount] = useState(100);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await axios.get(`${API}/matches?status=waiting`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setMatches(response.data);
    } catch (error) {
      console.error("Error fetching matches:", error);
    }
  };

  const createMatch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/matches`, 
        { target_points: targetPoints, stake_amount: stakeAmount },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      
      setShowCreateForm(false);
      fetchMatches();
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to create match");
    }
    setLoading(false);
  };

  const joinMatch = async (matchId) => {
    try {
      await axios.post(`${API}/matches/${matchId}/join`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      onJoinMatch(matchId);
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to join match");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Chinchón Lobby</h1>
            <p className="text-slate-400 text-sm">Welcome, {user.username}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Balance</p>
            <p className="text-lg font-bold text-green-400">${user.balance}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Create Match Button */}
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-2xl transition-colors shadow-lg"
        >
          + Create New Match
        </button>

        {/* Create Match Form */}
        {showCreateForm && (
          <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
            <form onSubmit={createMatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Target Points
                </label>
                <select
                  value={targetPoints}
                  onChange={(e) => setTargetPoints(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                >
                  <option value={50}>50 Points</option>
                  <option value={75}>75 Points</option>
                  <option value={100}>100 Points</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Stake Amount
                </label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(Number(e.target.value))}
                  min="1"
                  max={user.balance}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Total pot: ${stakeAmount * 2}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-medium rounded-xl transition-colors"
                >
                  {loading ? "Creating..." : "Create Match"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 py-3 px-4 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Available Matches */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Available Matches</h2>
          <div className="space-y-3">
            {matches.length === 0 ? (
              <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 text-center">
                <p className="text-slate-400">No matches available</p>
                <p className="text-sm text-slate-500 mt-1">Create one to get started!</p>
              </div>
            ) : (
              matches.map((match) => (
                <div
                  key={match.id}
                  className="bg-slate-800/80 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium">
                          {match.target_points} Points
                        </span>
                        <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-lg">
                          ${match.stake_amount} each
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">
                        {match.players.length}/2 players • Total pot: ${match.stake_amount * 2}
                      </p>
                    </div>
                    <button
                      onClick={() => joinMatch(match.id)}
                      disabled={match.players.includes(user.id)}
                      className="py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
                    >
                      {match.players.includes(user.id) ? "Joined" : "Join"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Game Component (placeholder)
const GameRoom = ({ matchId, user }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="text-center text-white">
        <h1 className="text-2xl font-bold mb-4">Game Room</h1>
        <p>Match ID: {matchId}</p>
        <p>Game interface coming soon...</p>
      </div>
    </div>
  );
};

// Main App
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const response = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data);
        setIsAuthenticated(true);
        
        // Initialize socket connection
        if (!socket) {
          socket = io(BACKEND_URL);
        }
      } catch (error) {
        localStorage.removeItem("token");
      }
    }
    setLoading(false);
  };

  const handleLogin = () => {
    checkAuth();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setUser(null);
    setCurrentMatch(null);
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };

  const handleJoinMatch = (matchId) => {
    setCurrentMatch(matchId);
    if (socket) {
      socket.emit("join_match_room", { match_id: matchId });
    }
  };

  const handleLeaveMatch = () => {
    if (currentMatch && socket) {
      socket.emit("leave_match_room", { match_id: currentMatch });
    }
    setCurrentMatch(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  if (currentMatch) {
    return <GameRoom matchId={currentMatch} user={user} onLeaveMatch={handleLeaveMatch} />;
  }

  return <Lobby user={user} onJoinMatch={handleJoinMatch} />;
}

export default App;