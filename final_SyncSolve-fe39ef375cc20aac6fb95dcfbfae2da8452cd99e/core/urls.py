from django.urls import path
from . import views  # Ensure views.py is imported

urlpatterns = [
    path("", views.home, name="home"),
    path("chat/<int:problem_id>/", views.chat_room, name="chat_room"),
    path("api/active_problems/", views.active_problems, name="active_problems"),
    # Quiz and Competition API endpoints
    path("api/quiz/<int:quiz_id>/", views.quiz_detail, name="quiz_detail"),
    path("api/competition/<int:session_id>/", views.competition_detail, name="competition_detail"),
    path("api/quiz/create/", views.create_quiz, name="create_quiz"),
    path("api/competition/create/", views.create_competitive_session, name="create_competition"),
]
