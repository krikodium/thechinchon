from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import bcrypt
from jose import JWTError, jwt
import json
import random
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

# FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# Security
security = HTTPBearer()

# Enums
class GameStatus(str, Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    FINISHED = "finished"

class UserRole(str, Enum):
    USER = "user"
    EMPLOYEE = "employee"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class TransactionType(str, Enum):
    TOPUP = "topup"
    WITHDRAWAL = "withdrawal"
    MATCH_WIN = "match_win"
    MATCH_LOSS = "match_loss"
    COMMISSION = "commission"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    avatar: str = "avatar1"
    role: UserRole = UserRole.USER
    balance: float = 0.0
    stats: Dict[str, Any] = Field(default_factory=lambda: {
        "matches_played": 0,
        "wins": 0,
        "losses": 0,
        "total_staked": 0.0,
        "total_won": 0.0
    })
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    password: str
    avatar: str = "avatar1"

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    host_id: str
    target_points: int
    stake_amount: float
    status: GameStatus = GameStatus.WAITING
    winner_id: Optional[str] = None
    players: List[str] = Field(default_factory=list)
    game_state: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MatchCreate(BaseModel):
    target_points: int
    stake_amount: float

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    match_id: str
    user_id: str
    username: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Spanish deck setup
SUITS = ['oros', 'copas', 'espadas', 'bastos']
RANKS = ['1', '2', '3', '4', '5', '6', '7', 'sota', 'caballo', 'rey']

def create_spanish_deck():
    """Create a Spanish deck (40 cards)"""
    deck = []
    for suit in SUITS:
        for rank in RANKS:
            deck.append({'suit': suit, 'rank': rank})
    return deck

def card_value(rank):
    """Get the point value of a card in Chinchón"""
    if rank in ['sota', 'caballo', 'rey']:
        return 10
    return int(rank)

def calculate_hand_value(hand):
    """Calculate the total point value of a hand"""
    return sum(card_value(card['rank']) for card in hand)

def is_valid_sequence(cards):
    """Check if cards form a valid sequence (same suit, consecutive ranks)"""
    if len(cards) < 3:
        return False
    
    # Sort by rank value
    rank_values = {'1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 'sota': 8, 'caballo': 9, 'rey': 10}
    sorted_cards = sorted(cards, key=lambda x: rank_values[x['rank']])
    
    # Check same suit and consecutive
    suit = sorted_cards[0]['suit']
    if not all(card['suit'] == suit for card in sorted_cards):
        return False
    
    for i in range(1, len(sorted_cards)):
        if rank_values[sorted_cards[i]['rank']] - rank_values[sorted_cards[i-1]['rank']] != 1:
            return False
    
    return True

def is_valid_set(cards):
    """Check if cards form a valid set (same rank, different suits)"""
    if len(cards) < 3:
        return False
    
    rank = cards[0]['rank']
    suits = set()
    
    for card in cards:
        if card['rank'] != rank:
            return False
        if card['suit'] in suits:
            return False  # No duplicate suits
        suits.add(card['suit'])
    
    return True

# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**user)

# API Routes
@app.post("/api/auth/register", response_model=Token)
async def register(user: UserCreate):
    # Check if username exists
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    # Create new user
    hashed_password = hash_password(user.password)
    new_user = User(
        username=user.username,
        password_hash=hashed_password,
        avatar=user.avatar
    )
    
    await db.users.insert_one(new_user.dict())
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login", response_model=Token)
async def login(user: UserLogin):
    # Find user
    db_user = await db.users.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user["id"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/api/avatars")
async def get_avatars():
    return {
        "avatars": [
            {"id": "avatar1", "name": "Male 1", "gender": "male"},
            {"id": "avatar2", "name": "Male 2", "gender": "male"},
            {"id": "avatar3", "name": "Male 3", "gender": "male"},
            {"id": "avatar4", "name": "Female 1", "gender": "female"},
            {"id": "avatar5", "name": "Female 2", "gender": "female"},
            {"id": "avatar6", "name": "Female 3", "gender": "female"},
        ]
    }

@app.post("/api/matches", response_model=Match)
async def create_match(match_data: MatchCreate, current_user: User = Depends(get_current_user)):
    # Check if user has enough balance
    if current_user.balance < match_data.stake_amount:
        raise HTTPException(
            status_code=400,
            detail="Insufficient balance"
        )
    
    # Create match
    new_match = Match(
        host_id=current_user.id,
        target_points=match_data.target_points,
        stake_amount=match_data.stake_amount,
        players=[current_user.id]
    )
    
    await db.matches.insert_one(new_match.dict())
    return new_match

@app.get("/api/matches")
async def get_matches(status: Optional[GameStatus] = None):
    query = {}
    if status:
        query["status"] = status
    
    matches = await db.matches.find(query).to_list(100)
    return [Match(**match) for match in matches]

@app.post("/api/matches/{match_id}/join")
async def join_match(match_id: str, current_user: User = Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    match_obj = Match(**match)
    
    if match_obj.status != GameStatus.WAITING:
        raise HTTPException(status_code=400, detail="Match is not waiting for players")
    
    if current_user.id in match_obj.players:
        raise HTTPException(status_code=400, detail="Already in match")
    
    if len(match_obj.players) >= 2:
        raise HTTPException(status_code=400, detail="Match is full")
    
    if current_user.balance < match_obj.stake_amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Add player and start game if we have 2 players
    match_obj.players.append(current_user.id)
    if len(match_obj.players) == 2:
        match_obj.status = GameStatus.PLAYING
        
        # Initialize game state
        deck = create_spanish_deck()
        random.shuffle(deck)
        
        # Deal 7 cards to each player
        player1_hand = deck[:7]
        player2_hand = deck[7:14]
        discard_pile = [deck[14]]
        stock_pile = deck[15:]
        
        match_obj.game_state = {
            "deck": stock_pile,
            "discard_pile": discard_pile,
            "players": {
                match_obj.players[0]: {
                    "hand": player1_hand,
                    "points": 0
                },
                match_obj.players[1]: {
                    "hand": player2_hand,
                    "points": 0
                }
            },
            "current_turn": match_obj.players[0],
            "turn_start_time": datetime.utcnow().isoformat()
        }
    
    await db.matches.update_one(
        {"id": match_id},
        {"$set": match_obj.dict()}
    )
    
    return {"message": "Joined match successfully"}

# Socket.IO Events
@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")

@sio.event
async def join_match_room(sid, data):
    match_id = data.get("match_id")
    if match_id:
        await sio.enter_room(sid, match_id)
        await sio.emit("joined_room", {"match_id": match_id}, room=sid)

@sio.event
async def leave_match_room(sid, data):
    match_id = data.get("match_id")
    if match_id:
        await sio.leave_room(sid, match_id)

@sio.event
async def send_chat_message(sid, data):
    match_id = data.get("match_id")
    user_id = data.get("user_id")
    content = data.get("content")
    
    if match_id and user_id and content:
        # Get user info
        user = await db.users.find_one({"id": user_id})
        if user:
            # Create chat message
            message = ChatMessage(
                match_id=match_id,
                user_id=user_id,
                username=user["username"],
                content=content
            )
            
            # Store in database
            await db.chat_messages.insert_one(message.dict())
            
            # Keep only last 50 messages per match
            message_count = await db.chat_messages.count_documents({"match_id": match_id})
            if message_count > 50:
                oldest_messages = await db.chat_messages.find(
                    {"match_id": match_id}
                ).sort("created_at", 1).limit(message_count - 50).to_list(None)
                
                oldest_ids = [msg["id"] for msg in oldest_messages]
                await db.chat_messages.delete_many({"id": {"$in": oldest_ids}})
            
            # Emit to match room
            await sio.emit("chat_message", message.dict(), room=match_id)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:socket_app", host="0.0.0.0", port=8001, reload=True)