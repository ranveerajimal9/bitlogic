from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict
from typing import List, Optional, Annotated, Dict
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
MAX_POINTS = 10
ROUND_QUALIFIERS = {2: 10, 3: 5}  # after finalizing round 1 -> 10 qualify for r2, after r2 -> 5 for r3

# ---------------- Helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

PyObjectId = Annotated[str, BeforeValidator(str)]

def serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "student"),
        "scores": user.get("scores", {"1": None, "2": None, "3": None}),
        "qualified_round": user.get("qualified_round", 1),
        "eliminated": user.get("eliminated", False),
        "round_wins": user.get("round_wins", []),
        "overall_winner": user.get("overall_winner", False),
        "created_at": user.get("created_at"),
    }

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ---------------- Models ----------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class CompetitionConfig(BaseModel):
    start_datetime: Optional[str] = None
    current_round: int = 0  # 0 = not started, 1/2/3 active round
    finalized_rounds: List[int] = []

class CompetitionUpdate(BaseModel):
    start_datetime: Optional[str] = None
    current_round: Optional[int] = None

class ScoreInput(BaseModel):
    round: int
    points: float

class SubmissionInput(BaseModel):
    round: int
    content: str  # scratch project url OR java code

class McqAnswersInput(BaseModel):
    answers: Dict[str, int]  # puzzle_id -> selected option index

class PuzzleInput(BaseModel):
    question: str
    options: List[str]
    correct_index: int

class StudentCreateInput(BaseModel):
    name: str
    email: EmailStr
    password: str

# ---------------- Competition config ----------------
async def get_config() -> dict:
    cfg = await db.competition.find_one({"_id": "config"})
    if not cfg:
        cfg = {"_id": "config", "start_datetime": None, "current_round": 0, "finalized_rounds": []}
        await db.competition.insert_one(cfg)
    return cfg

# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "student",
        "scores": {"1": None, "2": None, "3": None},
        "qualified_round": 1,
        "eliminated": False,
        "round_wins": [],
        "overall_winner": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await db.login_attempts.delete_many({"email": email})
    access = create_access_token(str(res.inserted_id), email)
    refresh = create_refresh_token(str(res.inserted_id))
    set_auth_cookies(response, access, refresh)
    return {"user": serialize_user(doc), "token": access}

async def check_lockout(email: str):
    # Keyed by email — behind k8s ingress request.client.host is the rotating proxy IP,
    # so an IP-based key never accumulates for a real attacker.
    rec = await db.login_attempts.find_one({"email": email})
    if rec and rec.get("count", 0) >= 5:
        locked_until = rec.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

@api_router.post("/auth/login")
async def login(data: LoginInput, request: Request, response: Response):
    email = data.email.lower()
    await check_lockout(email)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        rec = await db.login_attempts.find_one({"email": email})
        count = (rec.get("count", 0) if rec else 0) + 1
        update = {"$set": {"email": email, "count": count}}
        if count >= 5:
            update["$set"]["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"email": email}, update, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_many({"email": email})
    access = create_access_token(str(user["_id"]), email)
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return {"user": serialize_user(user), "token": access}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def me(request: Request):
    user = await get_current_user(request)
    return serialize_user(user)

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
        return {"token": access}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------------- Competition routes ----------------
@api_router.get("/competition")
async def competition_public():
    cfg = await get_config()
    now = datetime.now(timezone.utc)
    started = False
    if cfg.get("start_datetime"):
        try:
            started = datetime.fromisoformat(cfg["start_datetime"]) <= now
        except Exception:
            started = False
    return {
        "start_datetime": cfg.get("start_datetime"),
        "current_round": cfg.get("current_round", 0),
        "finalized_rounds": cfg.get("finalized_rounds", []),
        "started": started,
    }

@api_router.put("/competition")
async def update_competition(data: CompetitionUpdate, admin: dict = Depends(require_admin)):
    update = {}
    fields = data.model_fields_set
    if "start_datetime" in fields:
        update["start_datetime"] = data.start_datetime  # may be None to clear the date
    if data.current_round is not None:
        if data.current_round not in (0, 1, 2, 3):
            raise HTTPException(status_code=400, detail="Invalid round")
        update["current_round"] = data.current_round
    if update:
        await db.competition.update_one({"_id": "config"}, {"$set": update}, upsert=True)
    return await competition_public()

# ---------------- Student / scoring ----------------
@api_router.get("/students")
async def list_students(admin: dict = Depends(require_admin)):
    users = await db.users.find({"role": "student"}).to_list(1000)
    return [serialize_user(u) for u in users]

@api_router.post("/students")
async def create_student(data: StudentCreateInput, admin: dict = Depends(require_admin)):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "student",
        "scores": {"1": None, "2": None, "3": None},
        "qualified_round": 1,
        "eliminated": False,
        "round_wins": [],
        "overall_winner": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_user(doc)

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, admin: dict = Depends(require_admin)):
    await db.users.delete_one({"_id": ObjectId(student_id), "role": "student"})
    await db.submissions.delete_many({"student_id": student_id})
    return {"message": "deleted"}

@api_router.put("/students/{student_id}/score")
async def set_score(student_id: str, data: ScoreInput, admin: dict = Depends(require_admin)):
    if data.round not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Invalid round")
    if data.points < 0 or data.points > MAX_POINTS:
        raise HTTPException(status_code=400, detail=f"Points must be between 0 and {MAX_POINTS}")
    user = await db.users.find_one({"_id": ObjectId(student_id), "role": "student"})
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")
    scores = user.get("scores", {"1": None, "2": None, "3": None})
    scores[str(data.round)] = data.points
    await db.users.update_one({"_id": ObjectId(student_id)}, {"$set": {"scores": scores}})
    user["scores"] = scores
    return serialize_user(user)

@api_router.post("/rounds/{round_no}/finalize")
async def finalize_round(round_no: int, admin: dict = Depends(require_admin)):
    if round_no not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Invalid round")
    # eligible = students currently qualified for this round
    students = await db.users.find({"role": "student", "qualified_round": {"$gte": round_no}}).to_list(1000)
    # sort by this round's points desc
    def pts(u):
        v = u.get("scores", {}).get(str(round_no))
        return v if v is not None else -1
    ranked = sorted(students, key=pts, reverse=True)

    cfg = await get_config()
    finalized = set(cfg.get("finalized_rounds", []))

    if round_no in (1, 2):
        n_qualify = ROUND_QUALIFIERS[round_no + 1]
        qualifiers = ranked[:n_qualify]
        qualifier_ids = {str(u["_id"]) for u in qualifiers}
        winner = ranked[0] if ranked else None
        for u in students:
            uid = str(u["_id"])
            if uid in qualifier_ids:
                await db.users.update_one({"_id": u["_id"]}, {"$set": {"qualified_round": round_no + 1, "eliminated": False}})
            else:
                await db.users.update_one({"_id": u["_id"]}, {"$set": {"eliminated": True}})
        if winner:
            await db.users.update_one({"_id": winner["_id"]}, {"$addToSet": {"round_wins": round_no}})
    else:  # round 3 -> overall winner
        winner = ranked[0] if ranked else None
        if winner:
            await db.users.update_one({"_id": winner["_id"]}, {"$set": {"overall_winner": True}, "$addToSet": {"round_wins": 3}})

    finalized.add(round_no)
    await db.competition.update_one({"_id": "config"}, {"$set": {"finalized_rounds": list(finalized)}}, upsert=True)
    return {"message": f"Round {round_no} finalized", "finalized_rounds": list(finalized)}

@api_router.post("/rounds/reset")
async def reset_competition(admin: dict = Depends(require_admin)):
    await db.users.update_many(
        {"role": "student"},
        {"$set": {"scores": {"1": None, "2": None, "3": None}, "qualified_round": 1, "eliminated": False, "round_wins": [], "overall_winner": False}},
    )
    await db.competition.update_one({"_id": "config"}, {"$set": {"current_round": 0, "finalized_rounds": []}}, upsert=True)
    await db.submissions.delete_many({})
    return {"message": "Competition reset"}

# ---------------- Leaderboard ----------------
@api_router.get("/leaderboard")
async def leaderboard(admin: dict = Depends(require_admin)):
    students = await db.users.find({"role": "student"}).to_list(1000)
    result = []
    for u in students:
        s = u.get("scores", {"1": None, "2": None, "3": None})
        total = sum(v for v in s.values() if isinstance(v, (int, float)))
        result.append({
            "id": str(u["_id"]),
            "name": u.get("name", ""),
            "scores": s,
            "total": total,
            "qualified_round": u.get("qualified_round", 1),
            "eliminated": u.get("eliminated", False),
            "round_wins": u.get("round_wins", []),
            "overall_winner": u.get("overall_winner", False),
        })
    result.sort(key=lambda x: x["total"], reverse=True)
    return result

# ---------------- Submissions ----------------
async def ensure_round_accessible(user: dict, round_no: int):
    cfg = await get_config()
    if cfg.get("current_round", 0) < round_no:
        raise HTTPException(status_code=403, detail="This round is not open yet")
    if user.get("qualified_round", 1) < round_no:
        raise HTTPException(status_code=403, detail="You are not qualified for this round")
    if round_no in cfg.get("finalized_rounds", []):
        raise HTTPException(status_code=403, detail="This round is closed")

@api_router.get("/me/submissions")
async def my_submissions(request: Request):
    user = await get_current_user(request)
    subs = await db.submissions.find({"student_id": str(user["_id"])}).to_list(100)
    return {s["round"]: {"content": s.get("content"), "answers": s.get("answers"), "updated_at": s.get("updated_at")} for s in subs}

@api_router.post("/rounds/{round_no}/submit")
async def submit_round(round_no: int, data: SubmissionInput, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can submit")
    await ensure_round_accessible(user, round_no)
    await db.submissions.update_one(
        {"student_id": str(user["_id"]), "round": round_no},
        {"$set": {"content": data.content, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"message": "Submission saved"}

@api_router.post("/rounds/2/answers")
async def submit_mcq(data: McqAnswersInput, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can submit")
    await ensure_round_accessible(user, 2)
    # auto compute correct count
    puzzles = await db.puzzles.find({}).to_list(1000)
    correct = 0
    for p in puzzles:
        pid = str(p["_id"])
        if pid in data.answers and data.answers[pid] == p["correct_index"]:
            correct += 1
    await db.submissions.update_one(
        {"student_id": str(user["_id"]), "round": 2},
        {"$set": {"answers": data.answers, "correct_count": correct, "total_questions": len(puzzles), "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"message": "Answers submitted", "correct": correct, "total": len(puzzles)}

# ---------------- Puzzles (Round 2) ----------------
@api_router.get("/puzzles")
async def get_puzzles(request: Request):
    user = await get_current_user(request)
    puzzles = await db.puzzles.find({}).to_list(1000)
    if user.get("role") == "admin":
        return [{"id": str(p["_id"]), "question": p["question"], "options": p["options"], "correct_index": p["correct_index"]} for p in puzzles]
    # students don't get correct answers
    return [{"id": str(p["_id"]), "question": p["question"], "options": p["options"]} for p in puzzles]

@api_router.post("/puzzles")
async def create_puzzle(data: PuzzleInput, admin: dict = Depends(require_admin)):
    if data.correct_index < 0 or data.correct_index >= len(data.options):
        raise HTTPException(status_code=400, detail="Invalid correct_index")
    doc = {"question": data.question, "options": data.options, "correct_index": data.correct_index}
    res = await db.puzzles.insert_one(doc)
    return {"id": str(res.inserted_id), **{k: doc[k] for k in ("question", "options", "correct_index")}}

@api_router.delete("/puzzles/{puzzle_id}")
async def delete_puzzle(puzzle_id: str, admin: dict = Depends(require_admin)):
    await db.puzzles.delete_one({"_id": ObjectId(puzzle_id)})
    return {"message": "deleted"}

@api_router.get("/students/{student_id}/submissions")
async def student_submissions(student_id: str, admin: dict = Depends(require_admin)):
    subs = await db.submissions.find({"student_id": student_id}).to_list(100)
    return {s["round"]: {"content": s.get("content"), "answers": s.get("answers"), "correct_count": s.get("correct_count"), "total_questions": s.get("total_questions"), "updated_at": s.get("updated_at")} for s in subs}

# ---------------- Tie-Breaker (sudden death) ----------------
class TieBreakerInput(BaseModel):
    question: str
    correct_answer: str
    participant_ids: List[str]

class TieAnswerInput(BaseModel):
    answer: str

class DeclareInput(BaseModel):
    student_id: str

@api_router.post("/tiebreaker")
async def create_tiebreaker(data: TieBreakerInput, admin: dict = Depends(require_admin)):
    if len(data.participant_ids) < 2:
        raise HTTPException(status_code=400, detail="Select at least 2 tied finalists")
    parts = await db.users.find({"_id": {"$in": [ObjectId(pid) for pid in data.participant_ids]}, "role": "student"}).to_list(100)
    participants = [{"id": str(p["_id"]), "name": p.get("name", "")} for p in parts]
    tb = {
        "id": str(ObjectId()),
        "question": data.question.strip(),
        "correct_answer": data.correct_answer.strip(),
        "participants": participants,
        "responses": [],
        "winner_id": None,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.competition.update_one({"_id": "config"}, {"$set": {"tiebreaker": tb}}, upsert=True)
    return _tb_admin(tb)

def _tb_admin(tb: dict) -> dict:
    resp = sorted(tb.get("responses", []), key=lambda r: r["submitted_at"])
    return {**tb, "responses": resp}

@api_router.get("/tiebreaker")
async def get_tiebreaker(request: Request):
    user = await get_current_user(request)
    cfg = await get_config()
    tb = cfg.get("tiebreaker")
    if not tb:
        return {"active": False}
    if user.get("role") == "admin":
        return _tb_admin(tb)
    # student view
    uid = str(user["_id"])
    if not any(p["id"] == uid for p in tb.get("participants", [])):
        return {"active": False}
    my = next((r for r in tb.get("responses", []) if r["student_id"] == uid), None)
    return {
        "active": tb.get("active", False),
        "id": tb["id"],
        "question": tb["question"],
        "answered": my is not None,
        "my_answer": my["answer"] if my else None,
        "winner_id": tb.get("winner_id"),
        "is_winner": tb.get("winner_id") == uid,
        "resolved": tb.get("winner_id") is not None,
    }

@api_router.post("/tiebreaker/answer")
async def answer_tiebreaker(data: TieAnswerInput, request: Request):
    user = await get_current_user(request)
    cfg = await get_config()
    tb = cfg.get("tiebreaker")
    if not tb or not tb.get("active"):
        raise HTTPException(status_code=400, detail="No active tie-breaker")
    uid = str(user["_id"])
    if not any(p["id"] == uid for p in tb.get("participants", [])):
        raise HTTPException(status_code=403, detail="You are not part of this tie-breaker")
    if any(r["student_id"] == uid for r in tb.get("responses", [])):
        raise HTTPException(status_code=400, detail="You have already answered — sudden death is final")
    correct = data.answer.strip().lower() == tb["correct_answer"].strip().lower()
    resp = {"student_id": uid, "name": user.get("name", ""), "answer": data.answer.strip(),
            "submitted_at": datetime.now(timezone.utc).isoformat(), "correct": correct}
    # Conditional push guards against a double-submit race (one shot only).
    res = await db.competition.update_one(
        {"_id": "config", "tiebreaker.responses.student_id": {"$ne": uid}},
        {"$push": {"tiebreaker.responses": resp}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=400, detail="You have already answered — sudden death is final")
    return {"message": "Answer locked in", "correct": correct}

@api_router.post("/tiebreaker/declare")
async def declare_tiebreaker(data: DeclareInput, admin: dict = Depends(require_admin)):
    cfg = await get_config()
    tb = cfg.get("tiebreaker")
    if not tb:
        raise HTTPException(status_code=400, detail="No tie-breaker exists")
    if not any(p["id"] == data.student_id for p in tb.get("participants", [])):
        raise HTTPException(status_code=400, detail="Winner must be a tie-breaker participant")
    tb["winner_id"] = data.student_id
    tb["active"] = False
    await db.competition.update_one({"_id": "config"}, {"$set": {"tiebreaker": tb}})
    # A tie-breaker settles the final tie, so it overrides any prior overall winner.
    await db.users.update_many({"role": "student"}, {"$set": {"overall_winner": False}})
    await db.users.update_one({"_id": ObjectId(data.student_id)}, {"$set": {"overall_winner": True}, "$addToSet": {"round_wins": 3}})
    return _tb_admin(tb)

@api_router.delete("/tiebreaker")
async def clear_tiebreaker(admin: dict = Depends(require_admin)):
    cfg = await get_config()
    tb = cfg.get("tiebreaker")
    # Roll back a mistakenly-declared winner so no stale champion remains.
    if tb and tb.get("winner_id"):
        await db.users.update_one({"_id": ObjectId(tb["winner_id"])}, {"$set": {"overall_winner": False}, "$pull": {"round_wins": 3}})
    await db.competition.update_one({"_id": "config"}, {"$unset": {"tiebreaker": ""}})
    return {"message": "Tie-breaker cleared"}

@api_router.get("/")
async def root():
    return {"message": "BITLOGIC API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("email")
    await get_config()
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "BITLOGIC Admin", "role": "admin", "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
