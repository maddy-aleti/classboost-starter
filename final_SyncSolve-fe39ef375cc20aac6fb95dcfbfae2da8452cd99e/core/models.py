from django.db import models
import json


class Quiz(models.Model):
    """Model to store quiz data for competitive sessions"""
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    questions = models.JSONField()  # List of question objects: [{"question": "...", "options": [...], "correct_answer": 0}, ...]
    duration = models.IntegerField(default=60)  # Duration in seconds
    difficulty = models.CharField(
        max_length=20,
        choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')],
        default='medium'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.difficulty})"


class CompetitiveSession(models.Model):
    """Model to track competitive quiz sessions between two participants"""
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='sessions')
    room_id = models.IntegerField(unique=True)  # Unique room identifier
    user1_name = models.CharField(max_length=255)
    user2_name = models.CharField(max_length=255, blank=True, null=True)
    user1_score = models.IntegerField(default=0)
    user2_score = models.IntegerField(default=0)
    user1_submission_time = models.IntegerField(default=0)  # Time taken in seconds
    user2_submission_time = models.IntegerField(default=0)
    quiz_start_time = models.DateTimeField(blank=True, null=True)  # When quiz starts
    quiz_end_time = models.DateTimeField(blank=True, null=True)
    winner = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Name of winner or 'draw'"
    )
    status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('active', 'Active'), ('completed', 'Completed')],
        default='pending'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Session {self.room_id}: {self.user1_name} vs {self.user2_name}"


class Participation(models.Model):
    """Model to track individual participant answers and submissions"""
    session = models.ForeignKey(CompetitiveSession, on_delete=models.CASCADE, related_name='participations')
    participant_name = models.CharField(max_length=255)
    is_user1 = models.BooleanField(default=True)  # True for user1, False for user2
    answers = models.JSONField(default=list)  # List of answer indices: [0, 2, 1, ...]
    score = models.IntegerField(default=0)
    submission_time = models.IntegerField(default=0)  # Seconds taken
    submitted_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.participant_name} in session {self.session.room_id}"
