from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from core.consumers import active_users
from core.models import Quiz, CompetitiveSession
import json
from datetime import datetime


def add_cors_headers(response):
    """Add CORS headers to response"""
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT, DELETE"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response["Access-Control-Max-Age"] = "3600"
    return response


def options_handler(request):
    """Handle OPTIONS preflight requests"""
    response = JsonResponse({})
    return add_cors_headers(response)


def home(request):
    return render(request, "core/home.html")


def chat_room(request, problem_id):
    return render(request, "core/chat.html", {"problem_id": problem_id})


def active_problems(request):
    """ Returns a list of active problems with active user counts """
    return JsonResponse({"active_problems": active_users})


@require_http_methods(["GET", "OPTIONS"])
def quiz_detail(request, quiz_id):
    """Fetch quiz data by quiz_id"""
    if request.method == "OPTIONS":
        return options_handler(request)
    
    try:
        quiz = Quiz.objects.get(id=quiz_id)
        response = JsonResponse({
            "ok": True,
            "data": {
                "id": quiz.id,
                "title": quiz.title,
                "description": quiz.description,
                "questions": quiz.questions,
                "duration": quiz.duration,
                "difficulty": quiz.difficulty
            }
        })
        return add_cors_headers(response)
    except Quiz.DoesNotExist:
        response = JsonResponse({"ok": False, "error": "Quiz not found"}, status=404)
        return add_cors_headers(response)


@require_http_methods(["GET", "OPTIONS"])
def competition_detail(request, session_id):
    """Fetch competitive session data by room_id"""
    if request.method == "OPTIONS":
        return options_handler(request)
    
    try:
        session = CompetitiveSession.objects.get(room_id=session_id)
        response = JsonResponse({
            "ok": True,
            "data": {
                "room_id": session.room_id,
                "quiz_id": session.quiz.id,
                "user1_name": session.user1_name,
                "user2_name": session.user2_name,
                "user1_score": session.user1_score,
                "user2_score": session.user2_score,
                "status": session.status,
                "winner": session.winner
            }
        })
        return add_cors_headers(response)
    except CompetitiveSession.DoesNotExist:
        response = JsonResponse({"ok": False, "error": "Competition session not found"}, status=404)
        return add_cors_headers(response)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def create_quiz(request):
    """Create a new quiz"""
    if request.method == "OPTIONS":
        return options_handler(request)
    
    try:
        data = json.loads(request.body)
        quiz = Quiz.objects.create(
            title=data.get("title", "Untitled Quiz"),
            description=data.get("description", ""),
            questions=data.get("questions", []),
            duration=data.get("duration", 60),
            difficulty=data.get("difficulty", "medium")
        )
        response = JsonResponse({
            "ok": True,
            "data": {"id": quiz.id, "title": quiz.title}
        }, status=201)
        return add_cors_headers(response)
    except Exception as e:
        response = JsonResponse({"ok": False, "error": str(e)}, status=400)
        return add_cors_headers(response)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def create_competitive_session(request):
    """Create a new competitive session"""
    if request.method == "OPTIONS":
        return options_handler(request)
    
    try:
        data = json.loads(request.body)
        quiz_id = data.get("quiz_id")
        room_id = data.get("room_id")
        user1_name = data.get("user1_name")
        user2_name = data.get("user2_name", "")

        quiz = Quiz.objects.get(id=quiz_id)
        session = CompetitiveSession.objects.create(
            quiz=quiz,
            room_id=room_id,
            user1_name=user1_name,
            user2_name=user2_name,
            status='pending'
        )
        response = JsonResponse({
            "ok": True,
            "data": {
                "room_id": session.room_id,
                "quiz_id": session.quiz.id
            }
        }, status=201)
        return add_cors_headers(response)
    except Quiz.DoesNotExist:
        response = JsonResponse({"ok": False, "error": "Quiz not found"}, status=404)
        return add_cors_headers(response)
    except Exception as e:
        response = JsonResponse({"ok": False, "error": str(e)}, status=400)
        return add_cors_headers(response)
