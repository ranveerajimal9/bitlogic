"""BITLOGIC backend API tests."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://scratch-to-code-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "ranveerajimal9@gmail.com"
ADMIN_PASSWORD = "Bitlogic@2026"


# ---------------- helpers/fixtures ----------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def reset_all(admin_session):
    r = admin_session.post(f"{API}/rounds/reset")
    assert r.status_code == 200
    # also delete existing TEST_ students
    r = admin_session.get(f"{API}/students")
    for u in r.json():
        if u["email"].startswith("test_") or u["email"].startswith("TEST_"):
            admin_session.delete(f"{API}/students/{u['id']}")
    return True


@pytest.fixture
def new_student(admin_session, reset_all):
    email = f"test_{uuid.uuid4().hex[:8]}@t.com"
    r = admin_session.post(f"{API}/students", json={"name": "Tester", "email": email, "password": "Student@123"})
    assert r.status_code == 200, r.text
    return {"id": r.json()["id"], "email": email, "password": "Student@123"}


def student_session(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert "BITLOGIC" in r.json().get("message", "")

    def test_admin_login_and_me(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        assert r.json()["email"] == ADMIN_EMAIL

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "wrong"})
        assert r.status_code == 401

    def test_logout_clears_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_public_student(self, reset_all):
        email = f"test_reg_{uuid.uuid4().hex[:6]}@t.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={"name": "R", "email": email, "password": "Student@123"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "student"
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200

    def test_brute_force_lockout(self, reset_all):
        email = f"test_bf_{uuid.uuid4().hex[:6]}@t.com"
        # register user
        requests.post(f"{API}/auth/register", json={"name": "BF", "email": email, "password": "Right@123"})
        got_lock = False
        for _ in range(7):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong"})
            if r.status_code == 429:
                got_lock = True
                break
        assert got_lock, "no 429 after repeated failed logins"


# ---------------- Competition config ----------------
class TestCompetition:
    def test_public_competition(self):
        r = requests.get(f"{API}/competition")
        assert r.status_code == 200
        for k in ("start_datetime", "current_round", "finalized_rounds", "started"):
            assert k in r.json()

    def test_admin_can_update(self, admin_session):
        past = "2020-01-01T00:00:00+00:00"
        r = admin_session.put(f"{API}/competition", json={"start_datetime": past, "current_round": 1})
        assert r.status_code == 200
        data = r.json()
        assert data["current_round"] == 1
        assert data["started"] is True

    def test_non_admin_cannot_update(self, new_student):
        s = student_session(new_student["email"], new_student["password"])
        r = s.put(f"{API}/competition", json={"current_round": 2})
        assert r.status_code == 403

    def test_invalid_round(self, admin_session):
        r = admin_session.put(f"{API}/competition", json={"current_round": 9})
        assert r.status_code == 400


# ---------------- Scoring ----------------
class TestScoring:
    def test_score_ranges(self, admin_session, new_student):
        sid = new_student["id"]
        r = admin_session.put(f"{API}/students/{sid}/score", json={"round": 1, "points": 8})
        assert r.status_code == 200
        assert r.json()["scores"]["1"] == 8

        r = admin_session.put(f"{API}/students/{sid}/score", json={"round": 1, "points": 11})
        assert r.status_code == 400

        r = admin_session.put(f"{API}/students/{sid}/score", json={"round": 1, "points": -1})
        assert r.status_code == 400

        r = admin_session.put(f"{API}/students/{sid}/score", json={"round": 5, "points": 3})
        assert r.status_code == 400

    def test_score_requires_admin(self, new_student):
        s = student_session(new_student["email"], new_student["password"])
        r = s.put(f"{API}/students/{new_student['id']}/score", json={"round": 1, "points": 5})
        assert r.status_code == 403


# ---------------- Round access & submissions ----------------
class TestRoundAccess:
    def test_round1_submit_flow(self, admin_session, new_student):
        # set current_round=1 with past start
        admin_session.put(f"{API}/competition", json={"start_datetime": "2020-01-01T00:00:00+00:00", "current_round": 1})
        s = student_session(new_student["email"], new_student["password"])
        r = s.post(f"{API}/rounds/1/submit", json={"round": 1, "content": "https://scratch.mit.edu/projects/1"})
        assert r.status_code == 200

    def test_round2_blocked_for_unqualified(self, admin_session, new_student):
        admin_session.put(f"{API}/competition", json={"start_datetime": "2020-01-01T00:00:00+00:00", "current_round": 2})
        s = student_session(new_student["email"], new_student["password"])
        # fresh student qualified_round=1, so round 2 should be denied
        r = s.post(f"{API}/rounds/2/submit", json={"round": 2, "content": "x"})
        assert r.status_code == 403

    def test_round_not_open(self, admin_session, new_student):
        admin_session.put(f"{API}/competition", json={"start_datetime": "2020-01-01T00:00:00+00:00", "current_round": 1})
        s = student_session(new_student["email"], new_student["password"])
        r = s.post(f"{API}/rounds/3/submit", json={"round": 3, "content": "code"})
        assert r.status_code == 403


# ---------------- Puzzles ----------------
class TestPuzzles:
    def test_admin_crud(self, admin_session):
        r = admin_session.post(f"{API}/puzzles", json={
            "question": "2+2?", "options": ["3", "4", "5", "6"], "correct_index": 1
        })
        assert r.status_code == 200
        pid = r.json()["id"]
        r = admin_session.get(f"{API}/puzzles")
        assert r.status_code == 200
        assert any(p["id"] == pid for p in r.json())
        # admin sees correct_index
        assert "correct_index" in r.json()[0]
        r = admin_session.delete(f"{API}/puzzles/{pid}")
        assert r.status_code == 200

    def test_invalid_correct_index(self, admin_session):
        r = admin_session.post(f"{API}/puzzles", json={
            "question": "x", "options": ["a", "b"], "correct_index": 5
        })
        assert r.status_code == 400

    def test_student_puzzles_no_answers(self, admin_session, new_student):
        r = admin_session.post(f"{API}/puzzles", json={"question": "q?", "options": ["a", "b", "c", "d"], "correct_index": 2})
        pid = r.json()["id"]
        s = student_session(new_student["email"], new_student["password"])
        r = s.get(f"{API}/puzzles")
        assert r.status_code == 200
        for p in r.json():
            assert "correct_index" not in p
        admin_session.delete(f"{API}/puzzles/{pid}")


# ---------------- Round 2 answers ----------------
class TestRound2Answers:
    def test_mcq_submit(self, admin_session, new_student):
        # clean puzzles then add two
        existing = admin_session.get(f"{API}/puzzles").json()
        for p in existing:
            admin_session.delete(f"{API}/puzzles/{p['id']}")
        p1 = admin_session.post(f"{API}/puzzles", json={"question": "q1", "options": ["a", "b", "c", "d"], "correct_index": 0}).json()
        p2 = admin_session.post(f"{API}/puzzles", json={"question": "q2", "options": ["a", "b", "c", "d"], "correct_index": 3}).json()
        # advance current_round=2 and qualify student
        admin_session.put(f"{API}/competition", json={"start_datetime": "2020-01-01T00:00:00+00:00", "current_round": 2})
        admin_session.put(f"{API}/students/{new_student['id']}/score", json={"round": 1, "points": 10})
        # finalize r1 to qualify student
        admin_session.post(f"{API}/rounds/1/finalize")
        s = student_session(new_student["email"], new_student["password"])
        r = s.post(f"{API}/rounds/2/answers", json={"answers": {p1["id"]: 0, p2["id"]: 1}})
        assert r.status_code == 200, r.text
        assert r.json()["correct"] == 1
        assert r.json()["total"] == 2


# ---------------- Finalize ranking ----------------
class TestFinalize:
    def test_finalize_r1_top10_and_winner(self, admin_session, reset_all):
        # create 12 students with varying r1 scores
        ids = []
        for i in range(12):
            email = f"test_f_{i}_{uuid.uuid4().hex[:4]}@t.com"
            r = admin_session.post(f"{API}/students", json={"name": f"S{i}", "email": email, "password": "P@123"})
            sid = r.json()["id"]
            ids.append(sid)
            admin_session.put(f"{API}/students/{sid}/score", json={"round": 1, "points": i * 0.5})  # 0..5.5
        r = admin_session.post(f"{API}/rounds/1/finalize")
        assert r.status_code == 200
        # top 10 (indexes 2..11) qualified for r2; indexes 0,1 eliminated
        students = admin_session.get(f"{API}/students").json()
        by_id = {u["id"]: u for u in students}
        assert by_id[ids[11]]["qualified_round"] == 2
        assert 1 in by_id[ids[11]]["round_wins"]  # winner
        assert by_id[ids[0]]["eliminated"] is True
        assert by_id[ids[1]]["eliminated"] is True


# ---------------- Leaderboard ----------------
class TestLeaderboard:
    def test_leaderboard_sorted(self, admin_session, reset_all):
        for i, pts in enumerate([3, 7, 5]):
            r = admin_session.post(f"{API}/students", json={"name": f"L{i}", "email": f"test_l_{i}_{uuid.uuid4().hex[:4]}@t.com", "password": "P@123"})
            sid = r.json()["id"]
            admin_session.put(f"{API}/students/{sid}/score", json={"round": 1, "points": pts})
        r = requests.get(f"{API}/leaderboard")
        assert r.status_code == 200
        totals = [u["total"] for u in r.json()]
        assert totals == sorted(totals, reverse=True)


# ---------------- Reset ----------------
class TestReset:
    def test_reset_clears(self, admin_session, new_student):
        admin_session.put(f"{API}/students/{new_student['id']}/score", json={"round": 1, "points": 5})
        r = admin_session.post(f"{API}/rounds/reset")
        assert r.status_code == 200
        students = admin_session.get(f"{API}/students").json()
        for u in students:
            assert u["scores"] == {"1": None, "2": None, "3": None}
            assert u["qualified_round"] == 1
            assert u["eliminated"] is False
        cfg = requests.get(f"{API}/competition").json()
        assert cfg["current_round"] == 0
        assert cfg["finalized_rounds"] == []
