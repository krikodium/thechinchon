# Chinchón Gaming Platform 🎮

A complete real-time multiplayer Chinchón card game platform with Spanish deck, Socket.IO integration, and professional gaming UI.

## ✨ Features

- **Real-time Multiplayer**: Play Chinchón with Socket.IO powered real-time gameplay
- **Spanish Card Game**: Authentic 40-card Spanish deck (oros 🪙, copas 🏆, espadas ⚔️, bastos 🪄)
- **Professional UI**: Mobile-first dark blue theme with glassmorphism effects
- **Authentication**: Simple username-only registration with JWT security
- **Live Chat**: In-game chat system during gameplay
- **Turn-based Mechanics**: Proper draw → discard → win cycle
- **Financial System**: Configurable stakes, commissions, and balance management

## 🚀 Local Development Setup

### Prerequisites

- Python 3.9+
- Node.js 16+
- Yarn package manager

### 1. Clone and Setup

```bash
git clone <repository-url>
cd chinchon-platform
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your MongoDB Atlas credentials
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
yarn install

# Copy environment file
cp .env.example .env
```

### 4. Start Services

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python server.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
yarn start
```

### 5. Access the Platform

- **Game**: http://localhost:3000
- **API**: http://localhost:8001/api

## 🎮 How to Play

1. **Register**: Create account with username + select avatar
2. **Lobby**: Create or join matches with configurable stakes
3. **Gameplay**: 
   - Draw from stock pile or discard pile
   - Form sequences (consecutive same suit) or sets (same rank)
   - Discard unwanted cards
   - Close when your hand ≤ 7 points
4. **Chat**: Communicate with opponent in real-time
5. **Win**: Lowest points wins the pot (minus commission)

## 🃏 Chinchón Rules

- **Deck**: 40 Spanish cards (no 8s, 9s, 10s)
- **Deal**: 7 cards per player
- **Objective**: Form sequences/sets to minimize points
- **Values**: Number cards = face value, J/Q/K = 10 points
- **Closing**: Can close with ≤7 points, perfect chinchón = 0 points
- **Winning**: Player with lowest points wins

## 🏗️ Technical Architecture

- **Backend**: FastAPI + Socket.IO + MongoDB Atlas
- **Frontend**: React 19 + Socket.IO Client + Tailwind CSS
- **Database**: MongoDB Atlas for user data, matches, chat
- **Real-time**: Socket.IO for live gameplay and chat
- **Authentication**: JWT tokens with secure sessions

## 📁 Project Structure

```
chinchon-platform/
├── backend/
│   ├── server.py          # Main FastAPI + Socket.IO server
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables (not in git)
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main React application
│   │   └── App.css       # Game styling
│   ├── package.json      # Node dependencies
│   └── .env              # Frontend environment (not in git)
└── README.md
```

## 🔒 Security Features

- JWT token authentication
- Password hashing with bcrypt
- CORS configuration
- Input validation
- Environment variable protection
- Secure MongoDB Atlas connection

## 🎨 Design Highlights

- Mobile-first responsive design
- Dark blue gaming theme with gradients
- Glassmorphism card effects
- Spanish suit symbols (🪙🏆⚔️🪄)
- Smooth animations and transitions
- Professional lobby interface

## 🚀 Production Deployment

### Environment Variables

Create production `.env` files:

**Backend (.env):**
```env
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
DB_NAME=chinchon_production
SECRET_KEY=your-super-secret-production-key
```

**Frontend (.env):**
```env
REACT_APP_BACKEND_URL=https://your-api-domain.com
```

### Build Commands

```bash
# Frontend production build
cd frontend
yarn build

# Backend production server
cd backend
uvicorn server:socket_app --host 0.0.0.0 --port 8001
```

## 🧪 Testing

The platform includes comprehensive testing for:
- User authentication and registration
- Match creation and joining
- Real-time Socket.IO connectivity  
- Spanish card game mechanics
- Chat system functionality
- UI/UX responsiveness

## 📈 Features Roadmap

- [ ] Admin panel (Super Admin/Admin/Employee roles)
- [ ] Financial operations (top-up/withdrawal)
- [ ] Weekly rankings and statistics
- [ ] Tournament modes
- [ ] Mobile native apps
- [ ] Advanced game modes

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🎉 Enjoy Gaming!

Experience authentic Spanish Chinchón card game with modern real-time multiplayer technology! 🃏✨