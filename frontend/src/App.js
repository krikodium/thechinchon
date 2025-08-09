import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Socket.IO connection
let socket;

// Card component
const Card = ({ card, onClick, selected, disabled }) => {
  const suitSymbols = {
    'oros': '🪙',
    'copas': '🏆',
    'espadas': '⚔️',
    'bastos': '🪄'
  };

  const suitColors = {
    'oros': 'text-yellow-600',
    'copas': 'text-red-500',
    'espadas': 'text-gray-700',
    'bastos': 'text-green-600'
  };

  return (
    <div
      className={`playing-card ${selected ? 'selected' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} 
        w-16 h-24 bg-white rounded-lg border-2 ${selected ? 'border-blue-500 transform -translate-y-2' : 'border-gray-300'} 
        flex flex-col items-center justify-center text-sm font-bold transition-all duration-200 hover:transform hover:-translate-y-1 shadow-md`}
      onClick={disabled ? undefined : onClick}
    >
      <div className={suitColors[card.suit] || 'text-gray-700'}>
        {suitSymbols[card.suit] || '?'}
      </div>
      <div className="text-gray-800">
        {card.rank === 'sota' ? 'J' : card.rank === 'caballo' ? 'Q' : card.rank === 'rey' ? 'K' : card.rank}
      </div>
    </div>
  );
};

// Chat component
const ChatComponent = ({ matchId, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (socket) {
      socket.on("chat_message", (message) => {
        setMessages(prev => [...prev, message]);
      });

      // Load existing messages
      loadMessages();
    }

    return () => {
      if (socket) {
        socket.off("chat_message");
      }
    };
  }, [matchId]);

  const loadMessages = async () => {
    try {
      const response = await axios.get(`${API}/matches/${matchId}/chat`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      socket.emit("send_chat_message", {
        match_id: matchId,
        user_id: currentUser.id,
        content: newMessage.trim()
      });
      setNewMessage("");
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl rounded-xl p-4 h-64 flex flex-col">
      <h3 className="text-sm font-semibold text-white mb-2">Chat</h3>
      
      <div className="flex-1 overflow-y-auto mb-3 space-y-1">
        {messages.map((msg) => (
          <div key={msg.id} className="text-sm">
            <span className={`font-medium ${msg.user_id === currentUser.id ? 'text-blue-400' : 'text-slate-300'}`}>
              {msg.username}:
            </span>
            <span className="text-slate-400 ml-1">{msg.content}</span>
          </div>
        ))}
      </div>
      
      <form onSubmit={sendMessage} className="flex">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-1 bg-slate-700 border border-slate-600 rounded-l-lg text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg text-sm transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};

// Game Room Component
const GameRoom = ({ matchId, user, onLeaveMatch }) => {
  const [gameState, setGameState] = useState(null);
  const [match, setMatch] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (socket && matchId) {
      // Join match room
      socket.emit("join_match_room", { 
        match_id: matchId, 
        user_id: user.id 
      });

      // Listen for game state updates
      socket.on("match_state", (data) => {
        console.log("Game state update:", data);
        if (data.state && Object.keys(data.state).length > 0) {
          setGameState(data.state);
          setLoading(false);
        }
      });

      socket.on("joined_room", (data) => {
        console.log("Joined room:", data);
        // After joining room, load match data
        loadMatchData();
      });

      socket.on("error", (errorData) => {
        console.error("Socket error:", errorData);
        setError(errorData.message);
        setTimeout(() => setError(null), 3000);
      });

      // Load initial match data immediately
      loadMatchData();
    }

    return () => {
      if (socket) {
        socket.off("match_state");
        socket.off("joined_room");
        socket.off("error");
        if (matchId) {
          socket.emit("leave_match_room", { match_id: matchId });
        }
      }
    };
  }, [matchId, user.id]);

  const loadMatchData = async () => {
    try {
      const response = await axios.get(`${API}/matches/${matchId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setMatch(response.data);
    } catch (error) {
      console.error("Error loading match:", error);
      setError("Failed to load match data");
    }
  };

  const handleGameAction = (action, payload = {}) => {
    if (socket && gameState) {
      socket.emit("game_action", {
        match_id: matchId,
        user_id: user.id,
        action: action,
        payload: payload
      });
    }
  };

  const handleCardClick = (card) => {
    if (gameState?.phase === "discard" && gameState?.current_turn === user.id) {
      setSelectedCard(card);
    }
  };

  const handleDiscard = () => {
    if (selectedCard) {
      handleGameAction("discard", { card_id: selectedCard.id });
      setSelectedCard(null);
    }
  };

  const handleDrawStock = () => {
    handleGameAction("draw_stock");
  };

  const handleDrawDiscard = () => {
    handleGameAction("draw_discard");
  };

  const handleClose = () => {
    if (window.confirm("Are you sure you want to close the game?")) {
      handleGameAction("close");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  if (!gameState || !match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-xl mb-4">Waiting for game to start...</div>
          <button 
            onClick={onLeaveMatch}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
          >
            Leave Match
          </button>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players?.[user.id];
  const isMyTurn = gameState.current_turn === user.id;
  const canDraw = gameState.phase === "draw" && isMyTurn;
  const canDiscard = gameState.phase === "discard" && isMyTurn && selectedCard;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Chinchón Game</h1>
            <p className="text-slate-400 text-sm">Target: {match.target_points} points • Stake: ${match.stake_amount}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`text-sm px-3 py-1 rounded-full ${isMyTurn ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/20 text-slate-400'}`}>
              {isMyTurn ? 'Your Turn' : 'Opponent\'s Turn'}
            </div>
            <button 
              onClick={onLeaveMatch}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Game Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Table Area */}
          <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
            <div className="grid grid-cols-2 gap-8 mb-6">
              {/* Stock Pile */}
              <div className="text-center">
                <h3 className="text-sm font-semibold text-white mb-2">Stock Pile</h3>
                <div 
                  onClick={canDraw ? handleDrawStock : undefined}
                  className={`w-16 h-24 bg-blue-800 border-2 border-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto
                    ${canDraw ? 'cursor-pointer hover:bg-blue-700 hover:transform hover:-translate-y-1' : 'opacity-50'}
                    transition-all duration-200`}
                >
                  {gameState.deck?.length || 0}
                </div>
              </div>
              
              {/* Discard Pile */}
              <div className="text-center">
                <h3 className="text-sm font-semibold text-white mb-2">Discard Pile</h3>
                {gameState.discard_pile && gameState.discard_pile.length > 0 ? (
                  <div onClick={canDraw ? handleDrawDiscard : undefined}>
                    <Card 
                      card={gameState.discard_pile[gameState.discard_pile.length - 1]} 
                      disabled={!canDraw}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-24 bg-gray-200 border-2 border-gray-300 rounded-lg mx-auto opacity-50"></div>
                )}
              </div>
            </div>

            {/* Actions */}
            {isMyTurn && (
              <div className="flex justify-center space-x-4 mb-6">
                {gameState.phase === "discard" && (
                  <>
                    <button
                      onClick={handleDiscard}
                      disabled={!canDiscard}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                    >
                      Discard {selectedCard ? 'Selected Card' : '(Select a card)'}
                    </button>
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition-colors"
                    >
                      Close Game
                    </button>
                  </>
                )}
                {gameState.phase === "draw" && (
                  <div className="text-center">
                    <p className="text-slate-400 text-sm mb-2">Choose a pile to draw from</p>
                  </div>
                )}
              </div>
            )}

            {/* Current Player's Hand */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Your Hand ({currentPlayer?.hand?.length || 0} cards)</h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {currentPlayer?.hand?.map((card) => (
                  <Card
                    key={card.id}
                    card={card}
                    selected={selectedCard?.id === card.id}
                    onClick={() => handleCardClick(card)}
                    disabled={!isMyTurn || gameState.phase !== "discard"}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Game Status */}
          <div className="bg-slate-800/80 backdrop-blur-xl rounded-xl p-4 border border-slate-700/50">
            <div className="grid grid-cols-2 gap-4 text-center">
              {match.players.map((playerId, index) => (
                <div key={playerId} className="text-white">
                  <div className="text-sm text-slate-400">Player {index + 1}</div>
                  <div className="font-semibold">{playerId === user.id ? 'You' : 'Opponent'}</div>
                  <div className="text-xs text-slate-500">
                    {gameState.players?.[playerId]?.hand?.length || 0} cards
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="lg:col-span-1">
          <ChatComponent matchId={matchId} currentUser={user} />
        </div>
      </div>
    </div>
  );
};

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

      console.log("Submitting to:", endpoint, "with payload:", payload);
      const response = await axios.post(endpoint, payload);
      
      console.log("Response received:", response.data);
      localStorage.setItem("token", response.data.access_token);
      onLogin();
    } catch (error) {
      console.error("Authentication error:", error);
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
      const response = await axios.post(`${API}/matches/${matchId}/join`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      if (response.data.match && response.data.match.status === 'playing') {
        onJoinMatch(matchId);
      } else {
        // Match is waiting for more players
        fetchMatches();
      }
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
        
        // Initialize socket connection with proper configuration
        if (!socket) {
          socket = io(BACKEND_URL, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            forceNew: true
          });
          
          socket.on('connect', () => {
            console.log('Socket.IO connected:', socket.id);
          });
          
          socket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
          });
          
          socket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
          });
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